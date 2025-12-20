from __future__ import annotations

from channels.generic.websocket import AsyncJsonWebsocketConsumer


class UserStreamConsumer(AsyncJsonWebsocketConsumer):
    """Single stream per authenticated user for realtime updates."""

    async def connect(self):
        user = self.scope.get('user')
        if not user or not getattr(user, 'is_authenticated', False):
            await self.close(code=4401)
            return
        self.user_id = str(getattr(user, 'id', ''))
        if not self.user_id:
            await self.close(code=4403)
            return
        self.group_name = f"user_{self.user_id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        await self.send_json({
            "topic": "connection",
            "event": "ready",
        })

    async def disconnect(self, code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive_json(self, content, **kwargs):
        if not isinstance(content, dict):
            return
        if content.get('action') == 'ping':
            await self.send_json({"topic": "connection", "event": "pong"})

    async def push_event(self, event):
        payload = event.get('payload') if isinstance(event, dict) else None
        if payload:
            await self.send_json(payload)
