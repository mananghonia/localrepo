from datetime import datetime

from mongoengine import (
	BooleanField,
	CASCADE,
	DateTimeField,
	Document,
	EmbeddedDocument,
	EmbeddedDocumentField,
	FloatField,
	ListField,
	ReferenceField,
	StringField,
)


class ExpenseParticipant(EmbeddedDocument):
	user = ReferenceField('User', required=True)
	amount = FloatField(required=True, min_value=0)
	is_payer = BooleanField(default=False)


class Expense(Document):
	payer = ReferenceField('User', required=True)
	note = StringField()
	total_amount = FloatField(required=True, min_value=0)
	participants = ListField(EmbeddedDocumentField(ExpenseParticipant))
	created_at = DateTimeField(default=datetime.utcnow)

	meta = {
		'collection': 'expenses',
		'indexes': ['payer', '-created_at', 'participants.user'],
	}


class Activity(Document):
	user = ReferenceField('User', required=True, reverse_delete_rule=CASCADE)
	actor = ReferenceField('User', required=True)
	expense = ReferenceField('Expense', required=True, reverse_delete_rule=CASCADE)
	summary = StringField(required=True)
	detail = StringField()
	amount = FloatField()
	status = StringField(default='posted')
	created_at = DateTimeField(default=datetime.utcnow)

	meta = {
		'collection': 'activity_entries',
		'indexes': ['user', '-created_at'],
	}
