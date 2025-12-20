"""
ASGI config for backend project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.2/howto/deployment/asgi/
"""

import os

from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import AllowedHostsOriginValidator
from django.core.asgi import get_asgi_application

from realtime.auth import JWTAuthMiddleware
from realtime.routing import websocket_urlpatterns

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')

django_asgi_app = get_asgi_application()

application = ProtocolTypeRouter({
	'http': django_asgi_app,
	'websocket': AllowedHostsOriginValidator(
		JWTAuthMiddleware(
			URLRouter(websocket_urlpatterns)
		)
	),
})
