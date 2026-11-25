import logging
import socket
from typing import Any, List, Optional

import httpx
from google import genai
from google.genai import errors, types

from app.config import Settings

logger = logging.getLogger(__name__)

FALLBACK_MODELS = ("gemini-3.5-flash-lite", "gemini-3.5-flash")


class GeminiConfigurationError(Exception):
    """Raised when GEMINI_API_KEY is missing or unconfigured."""

    def __init__(self, message: Optional[str] = None):
        super().__init__(
            message
            or (
                "GEMINI_API_KEY is not configured. Copy .env.example to .env "
                "(in the project root or backend/.env), set a valid GEMINI_API_KEY, "
                "and restart the backend server."
            )
        )


class GeminiServiceError(Exception):
    """Raised when an upstream Gemini API request fails."""


def _format_api_error(exc: errors.APIError, model_name: str) -> str:
    code = getattr(exc, "code", None)
    if code in (401, 403):
        return (
            "Gemini API authentication failed (HTTP "
            f"{code}). Verify that GEMINI_API_KEY in .env is valid and active."
        )
    if code == 400:
        return (
            "Gemini API rejected the request (HTTP 400). "
            "Check that GEMINI_API_KEY is valid and the request payload is supported."
        )
    if code == 404:
        return (
            f"Configured Gemini model '{model_name}' was not found or is deprecated (HTTP 404). "
            "Verify GEMINI_MODEL in .env (e.g. gemini-3.5-flash-lite)."
        )
    if code == 429:
        return "Gemini API rate limit or quota exceeded (HTTP 429). Retry shortly."
    if code in (503, 504):
        return f"Gemini model '{model_name}' is temporarily overloaded or timed out (HTTP {code}). Retry shortly."
    return f"Gemini API request failed (HTTP {code or 'unknown'})."


def _format_network_error(exc: Exception) -> str:
    """Return actionable, credential-safe messages for transport-level failures."""
    if isinstance(exc, httpx.ProxyError):
        return (
            "Gemini could not connect through the configured proxy. Verify HTTP_PROXY/"
            "HTTPS_PROXY settings or allow generativelanguage.googleapis.com:443."
        )
    if isinstance(exc, (httpx.ConnectTimeout, httpx.ReadTimeout, httpx.WriteTimeout)):
        return (
            "Gemini request timed out. Verify that generativelanguage.googleapis.com:443 "
            "is reachable and retry."
        )
    if isinstance(exc, (httpx.ConnectError, socket.gaierror)):
        return (
            "Gemini connection failed. Check DNS and firewall/proxy access to "
            "generativelanguage.googleapis.com:443."
        )
    return f"Gemini API request failed ({type(exc).__name__})."


class GeminiClientWrapper:
    """Thin, testable wrapper around the official google-genai SDK."""

    def __init__(self, settings: Settings):
        self.settings = settings
        self._client: Optional[genai.Client] = None

    def ensure_configured(self) -> None:
        if not self.settings.is_gemini_configured:
            raise GeminiConfigurationError()

    def _get_client(self) -> genai.Client:
        self.ensure_configured()
        if self._client is None:
            self._client = genai.Client(
                api_key=self.settings.gemini_api_key.strip(),
                http_options=types.HttpOptions(timeout=25000),
            )
        return self._client

    def _candidate_models(self) -> List[str]:
        primary = self.settings.gemini_model
        models = [primary]
        for fb in FALLBACK_MODELS:
            if fb not in models:
                models.append(fb)
        return models

    def generate_with_tools(
        self,
        contents: List[types.Content],
        system_instruction: str,
        tools: List[types.Tool],
    ) -> Any:
        """Invoke Gemini with function-calling tools enabled."""
        client = self._get_client()
        candidates = self._candidate_models()
        last_api_error: Optional[errors.APIError] = None
        last_model = candidates[0]

        for idx, model_name in enumerate(candidates):
            last_model = model_name
            try:
                return client.models.generate_content(
                    model=model_name,
                    contents=contents,
                    config=types.GenerateContentConfig(
                        system_instruction=system_instruction,
                        tools=tools,
                        temperature=0.3,
                    ),
                )
            except GeminiConfigurationError:
                raise
            except errors.APIError as exc:
                last_api_error = exc
                code = getattr(exc, "code", None)
                logger.warning(
                    "Gemini APIError in tool generation: model=%s status=%s",
                    model_name,
                    code,
                )
                if code in (503, 504) and idx < len(candidates) - 1:
                    continue
                raise GeminiServiceError(_format_api_error(exc, model_name)) from exc
            except Exception as exc:
                logger.error("Gemini tool generation failed: %s", type(exc).__name__)
                raise GeminiServiceError(_format_network_error(exc)) from exc

        raise GeminiServiceError(_format_api_error(last_api_error, last_model))  # type: ignore[arg-type]

    def generate_structured(
        self,
        prompt: str,
        system_instruction: str,
        response_schema: Any,
    ) -> str:
        """Invoke Gemini with JSON schema enforcement for structured outputs."""
        client = self._get_client()
        candidates = self._candidate_models()
        last_api_error: Optional[errors.APIError] = None
        last_model = candidates[0]

        for idx, model_name in enumerate(candidates):
            last_model = model_name
            try:
                response = client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        system_instruction=system_instruction,
                        response_mime_type="application/json",
                        response_schema=response_schema,
                        temperature=0.1,
                    ),
                )
                return response.text or ""
            except GeminiConfigurationError:
                raise
            except errors.APIError as exc:
                last_api_error = exc
                code = getattr(exc, "code", None)
                logger.warning(
                    "Gemini APIError in structured generation: model=%s status=%s",
                    model_name,
                    code,
                )
                if code in (503, 504) and idx < len(candidates) - 1:
                    continue
                raise GeminiServiceError(_format_api_error(exc, model_name)) from exc
            except Exception as exc:
                logger.error("Gemini structured generation failed: %s", type(exc).__name__)
                raise GeminiServiceError(_format_network_error(exc)) from exc

        raise GeminiServiceError(_format_api_error(last_api_error, last_model))  # type: ignore[arg-type]
