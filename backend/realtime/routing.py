from django.urls import re_path

from .consumers import UserStreamConsumer

websocket_urlpatterns = [
    re_path(r'ws/live/$', UserStreamConsumer.as_asgi()),
]
