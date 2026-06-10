import logging
from datetime import timezone

from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response

from users.models import Friendship
from expenses.models import Expense, Activity

logger = logging.getLogger(__name__)


def _date(value):
    if not value:
        return 'unknown date'
    dt = value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    return dt.strftime('%b %d, %Y')


def _build_context(user):
    lines = []
    lines.append(f"User: {user.name} (@{getattr(user, 'username', '')})")
    lines.append('')

    friendships = list(Friendship.objects(user=user))
    if friendships:
        net = sum(float(f.balance or 0) for f in friendships)
        you_owe = sum(abs(float(f.balance)) for f in friendships if float(f.balance or 0) < -0.01)
        owed_to_you = sum(float(f.balance) for f in friendships if float(f.balance or 0) > 0.01)
        lines.append(f"Overall: you are owed ${owed_to_you:.2f}, you owe ${you_owe:.2f}, net ${net:+.2f}")
        lines.append('')
        lines.append('Friends & balances:')
        for f in sorted(friendships, key=lambda x: float(x.balance or 0), reverse=True):
            b = round(float(f.balance or 0), 2)
            if b > 0.01:
                tag = f'owes you ${b:.2f}'
            elif b < -0.01:
                tag = f'you owe ${abs(b):.2f}'
            else:
                tag = 'settled'
            lines.append(f'  - {f.friend.name} (@{getattr(f.friend, "username", "")}): {tag}')
    else:
        lines.append('No friends added yet.')
    lines.append('')

    expenses = list(Expense.objects(participants__user=user).order_by('-created_at').limit(25))
    if expenses:
        lines.append('Recent expenses (newest first):')
        for exp in expenses:
            is_payer = str(exp.payer.id) == str(user.id)
            others = [p for p in exp.participants if str(p.user.id) != str(exp.payer.id)]
            other_names = ', '.join(p.user.name for p in others) or 'no one'
            group = f' [{exp.group_name}]' if exp.group_name else ''
            note = exp.note or 'expense'
            payer_label = 'You paid' if is_payer else f'{exp.payer.name} paid'
            lines.append(f'  - {_date(exp.created_at)}: {payer_label} ${exp.total_amount:.2f} for "{note}"{group} with {other_names}')
    else:
        lines.append('No expenses recorded yet.')
    lines.append('')

    activities = list(Activity.objects(user=user).order_by('-created_at').limit(15))
    if activities:
        lines.append('Recent activity:')
        for act in activities:
            lines.append(f'  - {_date(act.created_at)}: {act.summary}. {act.detail}')

    return '\n'.join(lines)


SYSTEM_PROMPT = """\
You are a helpful personal finance assistant embedded in Balance Studio, a shared expense tracking app.

You have been given this user's complete financial snapshot below. Answer questions using ONLY this data — do not invent numbers or assume anything not shown. Be concise, friendly, and specific. Format all money as $X.XX.

If the user asks something unrelated to their finances, politely redirect them to ask about their expenses or balances.

USER FINANCIAL SNAPSHOT:
{context}"""


class AIChatView(APIView):
    def post(self, request):
        message = (request.data.get('message') or '').strip()
        history = request.data.get('history') or []

        if not message:
            return Response({'error': 'Message is required.'}, status=400)
        if len(message) > 600:
            return Response({'error': 'Message too long (max 600 characters).'}, status=400)

        api_key = getattr(settings, 'ANTHROPIC_API_KEY', '')
        if not api_key:
            return Response({'error': 'AI assistant is not configured on the server.'}, status=503)

        try:
            import anthropic
            client = anthropic.Anthropic(api_key=api_key)
            context = _build_context(request.user)

            # Build message list including prior turns for multi-turn conversation
            messages = []
            for turn in history[-6:]:  # keep last 3 exchanges (6 turns) as context
                role = turn.get('role')
                content = turn.get('content', '')
                if role in ('user', 'assistant') and content:
                    messages.append({'role': role, 'content': content})
            messages.append({'role': 'user', 'content': message})

            result = client.messages.create(
                model='claude-haiku-4-5-20251001',
                max_tokens=600,
                system=SYSTEM_PROMPT.format(context=context),
                messages=messages,
            )
            reply = result.content[0].text
            return Response({'reply': reply})

        except Exception as exc:
            logger.exception('AI chat error for user %s: %s', request.user.id, exc)
            return Response({'error': 'AI assistant is unavailable right now. Try again in a moment.'}, status=503)
