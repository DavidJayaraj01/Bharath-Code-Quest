"""
WebSocket connection manager for broadcasting real-time events.
"""

from typing import Dict, List, Set
from fastapi import WebSocket
import json
import asyncio


class ConnectionManager:
    """Manages WebSocket connections grouped by channel (e.g., 'doctor_queue', 'surveillance', 'chat:{id}')."""

    def __init__(self):
        self._channels: Dict[str, List[WebSocket]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket, channel: str):
        await websocket.accept()
        async with self._lock:
            if channel not in self._channels:
                self._channels[channel] = []
            self._channels[channel].append(websocket)

    async def disconnect(self, websocket: WebSocket, channel: str):
        async with self._lock:
            if channel in self._channels:
                self._channels[channel] = [
                    ws for ws in self._channels[channel] if ws != websocket
                ]
                if not self._channels[channel]:
                    del self._channels[channel]

    async def broadcast(self, channel: str, message: dict):
        """Send a JSON message to all connections on a channel."""
        async with self._lock:
            connections = list(self._channels.get(channel, []))
        
        dead: List[WebSocket] = []
        for ws in connections:
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        
        # Clean up dead connections
        if dead:
            async with self._lock:
                if channel in self._channels:
                    self._channels[channel] = [
                        ws for ws in self._channels[channel] if ws not in dead
                    ]

    async def send_personal(self, websocket: WebSocket, message: dict):
        """Send a JSON message to a single connection."""
        try:
            await websocket.send_json(message)
        except Exception:
            pass


# Singleton instance
manager = ConnectionManager()
