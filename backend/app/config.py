from functools import lru_cache
from pathlib import Path
from typing import List

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


BACKEND_DIR = Path(__file__).resolve().parents[1]
PROJECT_ROOT = Path(__file__).resolve().parents[2]
ROOT_ENV_FILE = PROJECT_ROOT / ".env"
BACKEND_ENV_FILE = BACKEND_DIR / ".env"

PLACEHOLDER_KEYS = {"", "your_gemini_api_key_here", "your_actual_gemini_api_key"}


def _clean_secret(value: str) -> str:
    return (value or "").strip().strip('"').strip("'").strip()


def _is_valid_key_value(value: str) -> bool:
    cleaned = _clean_secret(value)
    return bool(cleaned) and cleaned not in PLACEHOLDER_KEYS


def _resolve_sqlite_url(url: str) -> str:
    if not url.startswith("sqlite:///"):
        return url
    raw_path = url.replace("sqlite:///", "", 1)
    if raw_path == ":memory:":
        return url
    path_obj = Path(raw_path)
    if not path_obj.is_absolute():
        path_obj = (PROJECT_ROOT / path_obj).resolve()
    return f"sqlite:///{path_obj.as_posix()}"


def _resolve_project_path(raw_path: str) -> str:
    path_obj = Path(raw_path)
    if not path_obj.is_absolute():
        path_obj = (PROJECT_ROOT / path_obj).resolve()
    return str(path_obj)


class Settings(BaseSettings):
    """
    Application settings loaded reliably from OS environment variables,
    `SalesPilot-AI/.env`, and `SalesPilot-AI/backend/.env` regardless of working directory.
    """

    app_name: str = "SalesPilot AI"
    app_env: str = "development"
    app_debug: bool = True
    api_host: str = "127.0.0.1"
    api_port: int = 8000
    app_timezone: str = "Asia/Kolkata"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.5-flash-lite"

    database_url: str = f"sqlite:///{(PROJECT_ROOT / 'backend' / 'salespilot.db').as_posix()}"

    embedding_model: str = "all-MiniLM-L6-v2"
    faiss_index_path: str = str(PROJECT_ROOT / "backend" / "data" / "faiss_index")
    knowledge_base_dir: str = str(PROJECT_ROOT / "knowledge_base")
    rag_chunk_size: int = 500
    rag_chunk_overlap: int = 80
    rag_top_k: int = 4

    model_config = SettingsConfigDict(
        # Load backend/.env first, then project root .env (root takes precedence).
        # Both files are optional; missing files are ignored by pydantic-settings.
        env_file=(str(BACKEND_ENV_FILE), str(ROOT_ENV_FILE)),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @model_validator(mode="after")
    def _normalize_config(self) -> "Settings":
        self.gemini_api_key = _clean_secret(self.gemini_api_key)
        self.gemini_model = (self.gemini_model or "gemini-3.5-flash-lite").strip()
        self.database_url = _resolve_sqlite_url(self.database_url)
        self.faiss_index_path = _resolve_project_path(self.faiss_index_path)
        self.knowledge_base_dir = _resolve_project_path(self.knowledge_base_dir)
        return self

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def is_gemini_configured(self) -> bool:
        return _is_valid_key_value(self.gemini_api_key)


@lru_cache
def get_settings() -> Settings:
    return Settings()
