from conserve_naija.db.base import Base
from conserve_naija.models import Deposit, MaterialPrice, RecyclingSession


def test_core_models_are_registered_with_metadata() -> None:
    assert {"users", "organisations", "machines", "deposits"} <= set(Base.metadata.tables)
    assert Deposit.__table__.c.idempotency_key.unique is True
    assert MaterialPrice.__table__.c.price_per_kg_naira is not None
    assert RecyclingSession.__table__.c.otp_digest.unique is True
