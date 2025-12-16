import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
import django

django.setup()

from users.models import User

email = 'maddy748496@gmail.com'
username = 'manan'

print('Email exists:', bool(User.objects(email=email).first()))
print('Username exists:', bool(User.objects(username=username).first()))
