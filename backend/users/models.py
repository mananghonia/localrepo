from datetime import datetime

from django.contrib.auth.hashers import check_password, make_password
from mongoengine import (
    BooleanField,
    DateTimeField,
    DictField,
    Document,
    EmailField,
    FloatField,
    IntField,
    ReferenceField,
    StringField,
    CASCADE,
)

class User(Document):
    email = EmailField(required=True, unique=True)
    username = StringField(required=True, unique=True, sparse=True)
    name = StringField(required=True)
    password = StringField(required=True)
    created_at = DateTimeField(default=datetime.utcnow)

    meta = {
        'collection': 'users',
        'indexes': ['email', 'username'],
    }

    def set_password(self, raw_password):
        self.password = make_password(raw_password)

    def check_password(self, raw_password):
        return check_password(raw_password, self.password)

    def __str__(self):
        return f"User({self.email})"

    @property
    def is_authenticated(self):
        return True

    @property
    def is_active(self):
        return True


class Friendship(Document):
    user = ReferenceField('User', required=True, reverse_delete_rule=CASCADE)
    friend = ReferenceField('User', required=True, reverse_delete_rule=CASCADE)
    balance = FloatField(default=0)
    created_at = DateTimeField(default=datetime.utcnow)
    group_balances = DictField(field=FloatField(), default=dict)
    group_labels = DictField(field=StringField(), default=dict)
    group_snapshot_version = IntField(default=0)

    meta = {
        'collection': 'friendships',
        'indexes': [
            {'fields': ['user', 'friend'], 'unique': True},
        ],
    }

    def __str__(self):
        return f"Friendship({self.user_id}->{self.friend_id})"


class FriendInvite(Document):
    STATUS_PENDING = 'pending'
    STATUS_ACCEPTED = 'accepted'
    STATUS_REJECTED = 'rejected'

    inviter = ReferenceField('User', required=True, reverse_delete_rule=CASCADE)
    invitee_user = ReferenceField('User', required=False, null=True, reverse_delete_rule=CASCADE)
    invitee_email = EmailField(required=True)
    note = StringField()
    status = StringField(default=STATUS_PENDING, choices=[STATUS_PENDING, STATUS_ACCEPTED, STATUS_REJECTED])
    created_at = DateTimeField(default=datetime.utcnow)
    responded_at = DateTimeField()

    meta = {
        'collection': 'friend_invites',
        'indexes': [
            {'fields': ['invitee_email', 'status', '-created_at']},
            {'fields': ['inviter', 'invitee_email', 'status']},
        ],
    }

    def mark_status(self, status):
        self.status = status
        self.responded_at = datetime.utcnow()
        self.save()


class FriendSettlement(Document):
    initiator = ReferenceField('User', required=True, reverse_delete_rule=CASCADE)
    counterparty = ReferenceField('User', required=True, reverse_delete_rule=CASCADE)
    group_slug = StringField(required=True)
    group_label = StringField(required=True)
    direction = StringField(required=True, choices=['owes_you', 'you_owe'])
    amount = FloatField(required=True, min_value=0)
    created_at = DateTimeField(default=datetime.utcnow)

    meta = {
        'collection': 'friend_settlements',
        'indexes': [
            {'fields': ['initiator', '-created_at']},
            {'fields': ['counterparty', '-created_at']},
        ],
    }

    def __str__(self):
        return f"FriendSettlement({self.initiator_id}->{self.counterparty_id}:{self.amount})"


class EmailOTP(Document):
    PURPOSE_SIGNUP = 'signup'

    email = EmailField(required=True)
    purpose = StringField(default=PURPOSE_SIGNUP, choices=[PURPOSE_SIGNUP])
    code_hash = StringField(required=True)
    expires_at = DateTimeField(required=True)
    used = BooleanField(default=False)
    created_at = DateTimeField(default=datetime.utcnow)

    meta = {
        'collection': 'email_otps',
        'indexes': [
            {'fields': ['email', 'purpose', '-created_at']},
            {'fields': ['expires_at'], 'expireAfterSeconds': 0},
        ],
    }

    def mark_used(self):
        self.used = True
        self.save()


class PasswordResetToken(Document):
    user = ReferenceField('User', required=True, reverse_delete_rule=CASCADE)
    token_hash = StringField(required=True, unique=True)
    expires_at = DateTimeField(required=True)
    used = BooleanField(default=False)
    created_at = DateTimeField(default=datetime.utcnow)

    meta = {
        'collection': 'password_reset_tokens',
        'indexes': [
            {'fields': ['user', '-created_at']},
            {'fields': ['expires_at'], 'expireAfterSeconds': 0},
            'token_hash',
        ],
    }

    def mark_used(self):
        self.used = True
        self.save()


class Notification(Document):
    KIND_EXPENSE = 'expense_logged'
    KIND_SETTLEMENT = 'settlement_recorded'

    user = ReferenceField('User', required=True, reverse_delete_rule=CASCADE)
    actor = ReferenceField('User', required=True, reverse_delete_rule=CASCADE)
    kind = StringField(required=True, choices=[KIND_EXPENSE, KIND_SETTLEMENT])
    title = StringField(required=True)
    body = StringField()
    data = DictField(default=dict)
    is_read = BooleanField(default=False)
    created_at = DateTimeField(default=datetime.utcnow)

    meta = {
        'collection': 'notifications',
        'indexes': [
            {'fields': ['user', '-created_at']},
            {'fields': ['user', 'is_read']},
        ],
    }

    def __str__(self):
        return f"Notification({self.user_id}:{self.kind})"
