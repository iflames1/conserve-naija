import asyncio
import uuid

import pytest

from conserve_naija.realtime import UserEventBroker


@pytest.mark.asyncio
async def test_broker_publishes_only_to_subscribed_user() -> None:
    broker = UserEventBroker()
    owner = uuid.uuid4()
    other = uuid.uuid4()
    owner_queue = broker.subscribe(owner)
    other_queue = broker.subscribe(other)

    await broker.publish(owner, "session.updated", {"status": "connected"})

    assert await asyncio.wait_for(owner_queue.get(), timeout=0.1) == {
        "kind": "session.updated",
        "payload": {"status": "connected"},
    }
    assert other_queue.empty()
