from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from users.models import Friendship, User
from users import services

from .models import Activity, Expense, ExpenseParticipant


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
		"total_amount": round(expense.total_amount, 2),
		"created_at": expense.created_at.isoformat() if expense.created_at else None,
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
	return {
		"id": str(entry.id),
		"summary": entry.summary,
		"detail": entry.detail,
		"status": entry.status,
		"amount": round(entry.amount or 0, 2),
		"created_at": entry.created_at.isoformat() if entry.created_at else None,
		"expense": {
			"id": str(entry.expense.id),
			"note": entry.expense.note or '',
			"total_amount": round(entry.expense.total_amount, 2),
		},
	}


def _list_names(parts):
	names = [part.user.name for part in parts]
	if not names:
		return ''
	if len(names) == 1:
		return names[0]
	return ', '.join(names[:-1]) + f" & {names[-1]}"


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
			Friendship.objects(user=user, friend=part.user).update_one(inc__balance=delta)
			Friendship.objects(user=part.user, friend=user).update_one(inc__balance=-delta)

		friend_parts = [part for part in participant_docs if str(part.user.id) != payer_key]
		owed_total = round(sum(part.amount for part in friend_parts), 2)
		friend_names = _list_names(friend_parts) or 'friends'

		Activity(
			user=user,
			actor=user,
			expense=expense,
			summary=f"You logged {expense_title}",
			detail=f"{friend_names} owe you ${owed_total:.2f} total.",
			amount=owed_total,
			status='credited' if owed_total > 0 else 'posted',
		).save()

		for part in friend_parts:
			Activity(
				user=part.user,
				actor=user,
				expense=expense,
				summary=f"{user.name} logged {expense_title}",
				detail=f"You owe ${part.amount:.2f} to {user.name}.",
				amount=round(-part.amount, 2),
				status='due',
			).save()

		return Response(serialize_expense(expense), status=status.HTTP_201_CREATED)


class ActivityFeedView(APIView):
	def get(self, request):
		entries = Activity.objects(user=request.user).order_by('-created_at').limit(40)
		return Response({"results": [serialize_activity(entry) for entry in entries]})
