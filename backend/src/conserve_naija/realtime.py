"""In-process user event broker for the app WebSocket."""

import asyncio
import uuid
from collections import defaultdict


class UserEventBroker:
    def __init__(self) -> None:
        self._subscribers: defaultdict[uuid.UUID, set[asyncio.Queue[dict]]] = defaultdict(set)

    def subscribe(self, user_id: uuid.UUID) -> asyncio.Queue[dict]:
        queue: asyncio.Queue[dict] = asyncio.Queue(maxsize=32)
        self._subscribers[user_id].add(queue)
        return queue

    def unsubscribe(self, user_id: uuid.UUID, queue: asyncio.Queue[dict]) -> None:
        self._subscribers[user_id].discard(queue)
        if not self._subscribers[user_id]:
            del self._subscribers[user_id]

    async def publish(self, user_id: uuid.UUID, kind: str, payload: dict) -> None:
        for queue in self._subscribers.get(user_id, set()).copy():
            try:
                queue.put_nowait({"kind": kind, "payload": payload})
            except asyncio.QueueFull:
                await queue.get()
                queue.put_nowait({"kind": kind, "payload": payload})
