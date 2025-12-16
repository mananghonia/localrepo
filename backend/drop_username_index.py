import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
import django

django.setup()

from mongoengine.connection import get_db

db = get_db()
coll = db['users']
print('Indexes before:', list(coll.index_information().keys()))
try:
    coll.drop_index('username_1')
    print('Dropped username_1 index')
except Exception as exc:
    print('Could not drop index:', exc)
print('Indexes after:', list(coll.index_information().keys()))
