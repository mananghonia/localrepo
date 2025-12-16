from datetime import datetime

from django.contrib.auth.hashers import check_password, make_password
from mongoengine import BooleanField, DateTimeField, Document, EmailField, StringField

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
