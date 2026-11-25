import logging
import os
import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.agents.gemini_client import GeminiConfigurationError, GeminiServiceError
from app.api.routes import get_vector_store, router as api_router
from app.config import get_settings
from app.database.session import init_db
from app.schemas.common import ErrorResponse

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)


def _prewarm_rag() -> None:
    try:
        settings = get_settings()
        vs = get_vector_store(settings)
        vs.ensure_loaded()
        vs.embedder._get_model()
        logger.info("RAG embedding model pre-warmed.")
    except Exception as exc:
        logger.warning("RAG pre-warm skipped: %s", type(exc).__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    if "PYTEST_CURRENT_TEST" not in os.environ:
        threading.Thread(target=_prewarm_rag, daemon=True).start()
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title=settings.app_name,
        version="0.2.0",
        description="Autonomous AI Sales Voice Agent API",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/", tags=["System"])
    async def root() -> dict[str, str]:
        """Stable backend identity endpoint used by the launcher and browser checks."""
        return {
            "service": settings.app_name,
            "status": "ok",
            "api_base": "/api",
            "docs": "/docs",
        }

    @app.exception_handler(GeminiConfigurationError)
    async def gemini_config_handler(
        _request: Request, exc: GeminiConfigurationError
    ) -> JSONResponse:
        payload = ErrorResponse(
            detail=str(exc),
            error_code="GEMINI_API_KEY_MISSING",
            setup_instructions=(
                "1. Copy .env.example to .env at the project root (or backend/.env). "
                "2. Set GEMINI_API_KEY=<your_google_ai_studio_key>. "
                "3. Restart the FastAPI server."
            ),
        )
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content=payload.model_dump(),
        )

    @app.exception_handler(GeminiServiceError)
    async def gemini_service_handler(
        _request: Request, exc: GeminiServiceError
    ) -> JSONResponse:
        payload = ErrorResponse(
            detail=str(exc),
            error_code="GEMINI_UPSTREAM_ERROR",
        )
        return JSONResponse(
            status_code=status.HTTP_502_BAD_GATEWAY,
            content=payload.model_dump(),
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        _request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            content={
                "detail": "Request validation failed.",
                "error_code": "VALIDATION_ERROR",
                "errors": exc.errors(),
            },
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(
        _request: Request, exc: Exception
    ) -> JSONResponse:
        logger.exception("Unhandled server exception: %s", type(exc).__name__)
        payload = ErrorResponse(
            detail="An unexpected internal server error occurred.",
            error_code="INTERNAL_SERVER_ERROR",
        )
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=payload.model_dump(),
        )

    app.include_router(api_router)
    return app


app = create_app()
