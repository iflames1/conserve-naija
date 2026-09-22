"""Authenticated realtime session updates."""

import asyncio
import json
import uuid

import jwt
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from conserve_naija.config import get_settings
from conserve_naija.realtime import UserEventBroker

router = APIRouter()
broker = UserEventBroker()


@router.websocket("/api/v1/ws/app")
async def app_socket(websocket: WebSocket) -> None:
    await websocket.accept()
    await websocket.send_json({"kind": "connected", "payload": {}})
    user_id: uuid.UUID | None = None
    queue: asyncio.Queue[dict] | None = None
    try:
        first = await websocket.receive_json()
        if first.get("kind") != "auth":
            await websocket.close(code=1008, reason="authentication required")
            return
        token = first.get("payload", {}).get("token", "")
        claims = jwt.decode(token, get_settings().jwt_secret, algorithms=["HS256"])
        user_id = uuid.UUID(str(claims["sub"]))
        queue = broker.subscribe(user_id)
        await websocket.send_json({"kind": "authenticated", "payload": {"userId": str(user_id)}})
        while True:
            receive_task = asyncio.create_task(websocket.receive_json())
            event_task = asyncio.create_task(queue.get())
            done, pending = await asyncio.wait(
                {receive_task, event_task}, return_when=asyncio.FIRST_COMPLETED
            )
            for task in pending:
                task.cancel()
            completed = done.pop()
            message = completed.result()
            if completed is event_task:
                await websocket.send_json(message)
                continue
            if message.get("kind") == "ping":
                await websocket.send_json({"kind": "pong", "payload": {}})
            elif message.get("kind") not in {"subscribe", "unsubscribe"}:
                await websocket.send_json({"kind": "error", "payload": {"code": "bad_request"}})
    except (WebSocketDisconnect, ValueError, KeyError, jwt.InvalidTokenError, json.JSONDecodeError):
        return
    finally:
        if user_id is not None and queue is not None:
            broker.unsubscribe(user_id, queue)
