"""ASGI entrypoint for the Conserve Naija backend."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from conserve_naija.api.auth import router as auth_router
from conserve_naija.api.routes import router as api_router
from conserve_naija.api.websocket import router as websocket_router
from conserve_naija.config import get_settings

__version__ = "0.1.0"


def create_app() -> FastAPI:
    """Build the application.

    Kept as a factory so tests can construct an isolated app instance rather
    than importing a module-level singleton.
    """
    settings = get_settings()

    app = FastAPI(
        title=settings.app_name,
        version=__version__,
        description="Recycling sessions, machine measurements and the Conserve Points ledger.",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(api_router)
    app.include_router(auth_router)
    app.include_router(websocket_router)

    @app.get("/health", tags=["system"])
    async def health() -> dict[str, str]:
        """Liveness probe used by Railway and by the deployment pipeline."""
        return {"status": "ok", "environment": settings.environment}

    return app


app = create_app()
