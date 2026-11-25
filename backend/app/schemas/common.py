from typing import Optional

from pydantic import BaseModel


class HealthResponse(BaseModel):
    """Health diagnostic payload returned by /api/health."""

    status: str
    gemini_configured: bool
    database_connected: bool
    rag_indexed: bool
    environment: str


class ErrorResponse(BaseModel):
    """Structured error response returned by API exception handlers."""

    detail: str
    error_code: str
    setup_instructions: Optional[str] = None
