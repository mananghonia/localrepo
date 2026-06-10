import heapq
import logging
from collections import defaultdict
from datetime import datetime, timezone

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from realtime import pubsub as realtime_pubsub
from users.models import Friendship, User, Notification
from users import services

from .models import Activity, Expense, ExpenseParticipant


def _isoformat_utc(value):
    if not value:
        return None
    dt = value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).isoformat().replace('+00:00', 'Z')


logger = logging.getLogger(__name__)


def _serialize_user_min(user):
	return {
		"id": str(user.id),
		"name": user.name,
		"email": user.email,
		"username": getattr(user, 'username', '') or '',
	}


def serialize_expense(expense):
	return {
		"id": str(expense.id),
		"note": expense.note or '',
		"group_name": expense.group_name or '',
		"total_amount": round(expense.total_amount, 2),
		"created_at": _isoformat_utc(expense.created_at),
		"payer": _serialize_user_min(expense.payer),
		"participants": [
			{
				"user": _serialize_user_min(part.user),
				"amount": round(part.amount, 2),
				"is_payer": bool(part.is_payer),
			}
			for part in expense.participants
		],
	}


def serialize_activity(entry):
	expense_data = None
	if entry.expense:
		try:
			expense_data = {
				"id": str(entry.expense.id),
				"note": entry.expense.note or '',
				"total_amount": round(entry.expense.total_amount, 2),
			}
		except Exception:
			expense_data = None
	return {
		"id": str(entry.id),
		"summary": entry.summary,
		"detail": entry.detail,
		"status": entry.status,
		"amount": round(entry.amount or 0, 2),
		"created_at": _isoformat_utc(entry.created_at),
		"expense": expense_data,
	}


def _list_names(parts):
	names = [part.user.name for part in parts]
	if not names:
		return ''
	if len(names) == 1:
		return names[0]
	return ', '.join(names[:-1]) + f" & {names[-1]}"


def _notify_expense_participants(expense, payer, friend_parts, group_label, expense_title):
	"""Send email notifications to every non-payer participant when an expense is logged."""
	failed_recipients = []
	for part in friend_parts:
		target_email = part.user.email
		if not target_email:
			continue
		lines = [
			f"{payer.name} logged {expense_title} in {group_label}.",
			f"You owe ${part.amount:.2f} to {payer.name} for this split.",
			'',
			"Open Balance Studio to review the updated balances.",
		]
		try:
			services._send_email(
				subject=f"{payer.name} added an expense",
				text_body='\n'.join(lines),
				to_email=target_email,
			)
		except Exception as exc:
			failed_recipients.append((target_email, str(exc)))

	if failed_recipients:
		recipients = ', '.join(email for email, _ in failed_recipients)
		logger.warning("Failed to send expense email to %s", recipients)
		for email, reason in failed_recipients:
			logger.debug("Email delivery failure (%s): %s", email, reason)


class ExpenseListCreateView(APIView):
	def get(self, request):
		user = request.user
		expenses = (
			Expense.objects(participants__user=user)
			.order_by('-created_at')
			.limit(25)
		)
		return Response({"results": [serialize_expense(expense) for expense in expenses]})

	def post(self, request):
		user = request.user
		payload = request.data or {}
		raw_total = payload.get('total_amount')
		note = (payload.get('note') or '').strip()
		expense_title = f'"{note}"' if note else 'a new expense'
		group_label = services.normalize_group_label(payload.get('group_name'))
		participants_payload = payload.get('participants') or []

		try:
			total_amount = round(float(raw_total), 2)
		except (TypeError, ValueError):
			return Response({"error": "Total amount must be a valid number."}, status=400)

		if total_amount <= 0:
			return Response({"error": "Total amount must be greater than zero."}, status=400)

		if len(participants_payload) < 1:
			return Response({"error": "Add at least one other participant."}, status=400)

		participant_docs = []
		participant_map = {}

		for entry in participants_payload:
			user_id = entry.get('user_id')
			amount_value = entry.get('amount')
			if not user_id:
				return Response({"error": "Each participant requires a user_id."}, status=400)

			try:
				share = round(float(amount_value), 2)
			except (TypeError, ValueError):
				return Response({"error": "Participant amounts must be valid numbers."}, status=400)

			if share < 0:
				return Response({"error": "Shares cannot be negative."}, status=400)

			participant_user = User.objects(id=str(user_id)).first()
			if not participant_user:
				return Response({"error": f"User {user_id} not found."}, status=404)

			key = str(participant_user.id)
			if key in participant_map:
				participant_map[key].amount = round(participant_map[key].amount + share, 2)
				continue

			part_doc = ExpenseParticipant(
				user=participant_user,
				amount=share,
				is_payer=(key == str(user.id)),
			)
			participant_docs.append(part_doc)
			participant_map[key] = part_doc

		payer_key = str(user.id)
		if payer_key not in participant_map:
			participant_docs.insert(0, ExpenseParticipant(user=user, amount=0, is_payer=True))
		else:
			participant_map[payer_key].is_payer = True

		unique_participants = {str(part.user.id) for part in participant_docs}
		if len(unique_participants) < 2:
			return Response({"error": "Add at least one friend to split with."}, status=400)

		assigned_total = round(sum(part.amount for part in participant_docs), 2)
		if abs(assigned_total - total_amount) > 0.05:
			return Response({"error": "Assigned shares must match the total amount."}, status=400)

		expense = Expense(
			payer=user,
			note=note,
			group_name=group_label,
			total_amount=total_amount,
			participants=participant_docs,
		)
		expense.save()

		for part in participant_docs:
			if str(part.user.id) == payer_key:
				continue
			delta = round(part.amount, 2)
			if delta <= 0:
				continue
			services.ensure_friendship(user, part.user)
			services.apply_balance_change(user, part.user, delta, group_label)
			services.apply_balance_change(part.user, user, -delta, group_label)

		friend_parts = [part for part in participant_docs if str(part.user.id) != payer_key]
		owed_total = round(sum(part.amount for part in friend_parts), 2)
		friend_names = _list_names(friend_parts) or 'friends'

		Activity(
			user=user,
			actor=user,
			expense=expense,
			summary=f"You logged {expense_title}",
			detail=f"{friend_names} owe you ${owed_total:.2f} total in {group_label}.",
			amount=owed_total,
			status='credited' if owed_total > 0 else 'posted',
		).save()

		for part in friend_parts:
			Activity(
				user=part.user,
				actor=user,
				expense=expense,
				summary=f"{user.name} logged {expense_title}",
				detail=f"You owe ${part.amount:.2f} to {user.name} for {group_label}.",
				amount=round(-part.amount, 2),
				status='due',
			).save()
			services.record_notification(
				part.user,
				user,
				Notification.KIND_EXPENSE,
				f"{user.name} added {expense_title}",
				f"You owe ${part.amount:.2f} for {group_label or services.GROUP_FALLBACK_LABEL}.",
				{
					"expense_id": str(expense.id),
					"group": group_label or services.GROUP_FALLBACK_LABEL,
					"amount": round(float(part.amount or 0), 2),
				},
			)

		_notify_expense_participants(expense, user, friend_parts, group_label, expense_title)

		impact_map = {str(user.id): user}
		for part in participant_docs:
			impact_map[str(part.user.id)] = part.user
		for target in impact_map.values():
			realtime_pubsub.notify_friends_refresh(target, event='expense')
			realtime_pubsub.notify_activity_refresh(target, event='expense')

		return Response(serialize_expense(expense), status=status.HTTP_201_CREATED)


class ExpenseDeleteView(APIView):
	def put(self, request, expense_id):
		expense = Expense.objects(id=expense_id).first()
		if not expense:
			return Response({"error": "Expense not found."}, status=404)
		if str(expense.payer.id) != str(request.user.id):
			return Response({"error": "Only the payer can edit this expense."}, status=403)

		payload = request.data or {}
		new_note = (payload.get('note') if payload.get('note') is not None else expense.note or '').strip()

		raw_group = payload.get('group_name')
		if raw_group is not None:
			new_group_label = services.normalize_group_label(raw_group)
		else:
			new_group_label = expense.group_name or services.GROUP_FALLBACK_LABEL

		old_group_label = expense.group_name or services.GROUP_FALLBACK_LABEL
		payer = expense.payer

		old_friend_parts = [p for p in expense.participants if str(p.user.id) != str(payer.id)]

		# Build new_shares: use explicit participant amounts if provided, else proportional fallback
		participants_payload = payload.get('participants')
		if participants_payload is not None:
			new_shares = {}
			for entry in participants_payload:
				uid = str(entry.get('user_id', ''))
				try:
					amount = round(float(entry.get('amount', 0)), 2)
				except (TypeError, ValueError):
					return Response({"error": "Participant amounts must be valid numbers."}, status=400)
				if amount < 0:
					return Response({"error": "Amounts cannot be negative."}, status=400)
				new_shares[uid] = amount
			new_total = round(sum(new_shares.values()), 2)
			if new_total <= 0:
				return Response({"error": "Total must be greater than zero."}, status=400)
		else:
			raw_total = payload.get('total_amount')
			if raw_total is not None:
				try:
					new_total = round(float(raw_total), 2)
				except (TypeError, ValueError):
					return Response({"error": "Total amount must be a valid number."}, status=400)
				if new_total <= 0:
					return Response({"error": "Total amount must be greater than zero."}, status=400)
			else:
				new_total = expense.total_amount
			old_total_shares = sum(p.amount for p in old_friend_parts)
			new_shares = {}
			if old_total_shares > 0:
				for part in old_friend_parts:
					ratio = part.amount / old_total_shares
					new_shares[str(part.user.id)] = round(new_total * ratio, 2)
			elif old_friend_parts:
				per_person = round(new_total / len(old_friend_parts), 2)
				for part in old_friend_parts:
					new_shares[str(part.user.id)] = per_person

		# Reverse old balance changes
		for part in old_friend_parts:
			delta = round(part.amount, 2)
			if delta <= 0:
				continue
			services.apply_balance_change(payer, part.user, -delta, old_group_label)
			services.apply_balance_change(part.user, payer, delta, old_group_label)

		# Apply new balance changes
		for part in old_friend_parts:
			new_amount = new_shares.get(str(part.user.id), 0)
			if new_amount <= 0:
				continue
			services.apply_balance_change(payer, part.user, new_amount, new_group_label)
			services.apply_balance_change(part.user, payer, -new_amount, new_group_label)

		# Rebuild participants list with updated amounts
		new_participants = []
		for part in expense.participants:
			if part.is_payer:
				new_participants.append(ExpenseParticipant(user=part.user, amount=0, is_payer=True))
			else:
				new_amount = new_shares.get(str(part.user.id), part.amount)
				new_participants.append(ExpenseParticipant(user=part.user, amount=new_amount, is_payer=False))

		expense.note = new_note
		expense.group_name = new_group_label
		expense.total_amount = new_total
		expense.participants = new_participants
		expense.save()

		# Update activity records in-place
		expense_title = f'"{new_note}"' if new_note else 'an expense'
		new_owed_total = round(sum(new_shares.values()), 2)
		friend_names = _list_names(old_friend_parts) or 'friends'

		payer_activity = Activity.objects(expense=expense, user=payer).first()
		if payer_activity:
			payer_activity.summary = f"You updated {expense_title}"
			payer_activity.detail = f"{friend_names} owe you ${new_owed_total:.2f} total in {new_group_label}."
			payer_activity.amount = new_owed_total
			payer_activity.save()

		for part in old_friend_parts:
			new_amount = new_shares.get(str(part.user.id), 0)
			part_activity = Activity.objects(expense=expense, user=part.user).first()
			if part_activity:
				part_activity.summary = f"{payer.name} updated {expense_title}"
				part_activity.detail = f"You owe ${new_amount:.2f} to {payer.name} for {new_group_label}."
				part_activity.amount = round(-new_amount, 2)
				part_activity.save()

		impact_ids = {str(payer.id)}
		for part in old_friend_parts:
			impact_ids.add(str(part.user.id))
		for uid in impact_ids:
			user_obj = User.objects(id=uid).first()
			if user_obj:
				realtime_pubsub.notify_friends_refresh(user_obj, event='expense_updated')
				realtime_pubsub.notify_activity_refresh(user_obj, event='expense_updated')

		return Response(serialize_expense(expense), status=200)

	def delete(self, request, expense_id):
		expense = Expense.objects(id=expense_id).first()
		if not expense:
			return Response({"error": "Expense not found."}, status=404)
		if str(expense.payer.id) != str(request.user.id):
			return Response({"error": "Only the person who logged this expense can delete it."}, status=403)

		payer = expense.payer
		group_label = expense.group_name or services.GROUP_FALLBACK_LABEL

		for part in expense.participants:
			if str(part.user.id) == str(payer.id):
				continue
			delta = round(part.amount, 2)
			if delta <= 0:
				continue
			services.apply_balance_change(payer, part.user, -delta, group_label)
			services.apply_balance_change(part.user, payer, delta, group_label)

		Activity.objects(expense=expense).delete()
		expense.delete()

		impact_ids = {str(payer.id)}
		for part in expense.participants:
			impact_ids.add(str(part.user.id))
		for uid in impact_ids:
			user_obj = User.objects(id=uid).first()
			if user_obj:
				realtime_pubsub.notify_friends_refresh(user_obj, event='expense_deleted')
				realtime_pubsub.notify_activity_refresh(user_obj, event='expense_deleted')

		return Response({"message": "Expense deleted."}, status=200)


class ActivityFeedView(APIView):
	def get(self, request):
		try:
			limit = int(request.query_params.get('limit', 40))
		except (TypeError, ValueError):
			limit = 40
		limit = max(1, min(limit, 200))
		offset = 0
		try:
			offset = int(request.query_params.get('offset', 0))
		except (TypeError, ValueError):
			offset = 0
		entries = Activity.objects(user=request.user).order_by('-created_at').skip(offset).limit(limit)
		total = Activity.objects(user=request.user).count()
		return Response({
			"results": [serialize_activity(entry) for entry in entries],
			"total": total,
			"offset": offset,
			"limit": limit,
		})


# ── Debt Simplification helper ────────────────────────────────────────
def _min_cash_flow(people):
	"""
	Greedy minimum cash-flow algorithm.
	people: list of {'id', 'name', 'net'}
	Returns minimal list of {'from_name', 'to_name', 'amount'} transactions.
	"""
	creditors = []  # max-heap: (-net, name, id)
	debtors = []    # min-heap: (net, name, id)  -- net is negative

	for p in people:
		net = round(p['net'], 2)
		if net > 0.01:
			heapq.heappush(creditors, (-net, p['name'], p['id']))
		elif net < -0.01:
			heapq.heappush(debtors, (net, p['name'], p['id']))

	transactions = []
	while creditors and debtors:
		neg_credit, cred_name, cred_id = heapq.heappop(creditors)
		credit = -neg_credit
		debt_val, debt_name, debt_id = heapq.heappop(debtors)

		amount = min(credit, -debt_val)
		transactions.append({
			'from_name': debt_name,
			'to_name': cred_name,
			'amount': round(amount, 2),
		})

		rem_credit = credit - amount
		rem_debt = debt_val + amount
		if rem_credit > 0.01:
			heapq.heappush(creditors, (-rem_credit, cred_name, cred_id))
		if rem_debt < -0.01:
			heapq.heappush(debtors, (rem_debt, debt_name, debt_id))

	return transactions


class SimplifyDebtsView(APIView):
	def get(self, request):
		user = request.user
		friendships = list(Friendship.objects(user=user))

		if not friendships:
			return Response({'transactions': [], 'original_count': 0, 'simplified_count': 0})

		# Build net positions for every person in this user's circle
		# user's net = sum of all friendship balances
		# each friend's net = negation of their friendship balance with user
		user_net = sum(float(f.balance or 0) for f in friendships)
		people = [{'id': str(user.id), 'name': 'You', 'net': round(user_net, 2)}]

		for f in friendships:
			people.append({
				'id': str(f.friend.id),
				'name': f.friend.name,
				'net': round(-float(f.balance or 0), 2),
			})

		# Count non-zero bilateral relationships as "original" transactions
		original_count = sum(1 for f in friendships if abs(float(f.balance or 0)) > 0.01)
		transactions = _min_cash_flow(people)

		return Response({
			'transactions': transactions,
			'original_count': original_count,
			'simplified_count': len(transactions),
		})


class AnalyticsView(APIView):
	def get(self, request):
		user = request.user

		# ── Monthly spending (last 6 months) ──────────────────────────
		expenses = list(
			Expense.objects(participants__user=user).order_by('-created_at').limit(300)
		)

		monthly = defaultdict(lambda: {'your_share': 0.0, 'count': 0, 'sort_key': 0})

		for exp in expenses:
			if not exp.created_at:
				continue
			dt = exp.created_at if exp.created_at.tzinfo else exp.created_at.replace(tzinfo=timezone.utc)
			key = dt.strftime('%b %Y')
			sort_key = dt.year * 100 + dt.month

			user_part = next((p for p in exp.participants if str(p.user.id) == str(user.id)), None)
			if user_part:
				monthly[key]['your_share'] += float(user_part.amount or 0)
				monthly[key]['count'] += 1
				monthly[key]['sort_key'] = max(monthly[key]['sort_key'], sort_key)

		monthly_list = sorted(
			[{'month': k, 'amount': round(v['your_share'], 2), 'count': v['count']} for k, v in monthly.items()],
			key=lambda x: next((v['sort_key'] for k, v in monthly.items() if k == x['month']), 0),
		)[-6:]

		# ── Friend balance breakdown ───────────────────────────────────
		friendships = list(Friendship.objects(user=user))
		friends_data = sorted(
			[
				{
					'name': f.friend.name,
					'balance': round(float(f.balance or 0), 2),
				}
				for f in friendships
				if abs(float(f.balance or 0)) > 0.01
			],
			key=lambda x: x['balance'],
			reverse=True,
		)

		# ── Summary stats ──────────────────────────────────────────────
		you_owe = round(sum(abs(float(f.balance)) for f in friendships if float(f.balance or 0) < -0.01), 2)
		owed_to_you = round(sum(float(f.balance) for f in friendships if float(f.balance or 0) > 0.01), 2)
		total_expenses = Expense.objects(participants__user=user).count()

		return Response({
			'monthly': monthly_list,
			'friends': friends_data,
			'summary': {
				'total_expenses': total_expenses,
				'you_owe': you_owe,
				'owed_to_you': owed_to_you,
				'net': round(owed_to_you - you_owe, 2),
			},
		})
