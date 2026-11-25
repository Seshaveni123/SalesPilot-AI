# Setup & Environment Guide

## Verified Local Toolchain

- **OS:** Windows
- **Python:** 3.13.4 (virtual environment created at `.venv/`)
- **Node.js:** v24.14.0
- **npm:** 11.9.0
- **Git:** 2.53.0

## Python 3.13 Compatibility Notes

Because Python 3.13 is a recent release, AI/ML packages with native C/C++ extensions (such as `faiss-cpu`, `torch`, `numpy`, and `sentence-transformers`) must be verified for pre-built Python 3.13 Windows (`cp313-win_amd64`) wheels before installation, rather than downgrading the system Python installation.

## Environment Variables

Copy `.env.example` to `.env` at the project root (or `backend/.env` — both are automatically discovered regardless of startup directory):

- `GEMINI_API_KEY`: Required for live Gemini LLM calls. Obtain a key from Google AI Studio (`https://aistudio.google.com/`). Never hardcode or commit this key. When missing, `/api/agent/chat` intentionally fails with HTTP `503` (`GEMINI_API_KEY_MISSING`) instead of inventing fake responses.
- `DATABASE_URL`: Defaults to local SQLite (`sqlite:///./backend/salespilot.db`).
- `VITE_API_BASE_URL`: Backend API URL consumed by the Vite React frontend (`http://127.0.0.1:8000/api`).

## Running the Backend API

```powershell
# Activate root virtual environment
.\.venv\Scripts\Activate.ps1

# Install backend dependencies (if not already installed)
pip install -r backend\requirements.txt

# Start FastAPI with Uvicorn from the backend directory
cd backend
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Interactive OpenAPI docs are available at `http://127.0.0.1:8000/docs`.

## Running Automated Backend Tests

```powershell
.\.venv\Scripts\python.exe -m pytest -v
```

*(Note: Using `python.exe -m pytest` avoids a Windows `Scripts\pytest.exe` launcher DLL initialization quirk with `faiss-cpu`, and `pytest.ini` sets `-p no:faulthandler`.)*
