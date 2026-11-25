# SalesPilot AI

**Autonomous AI Sales Voice Agent with Agentic AI, Retrieval-Augmented Generation, Intelligent Lead Qualification, and CRM Automation**

SalesPilot AI is a full-stack B2B sales automation MVP built with **React + TypeScript + Tailwind CSS**, **FastAPI + SQLAlchemy + SQLite**, **Google Gemini tool calling**, **Sentence Transformers + FAISS RAG**, and **Web Speech API voice interaction**.

---

## Core Modules

1. **Overview Dashboard** — Real database-derived pipeline KPIs, tier distribution chart, and recent activity feed.
2. **Live AI Voice Agent** — Modular browser STT/TTS voice console, live interim transcript, duplicate-submit guard, tool-call trace badges, and real-time Intelligence Inspector.
3. **Lead Management CRM** — Searchable, filterable prospect pipeline with manual lead creation and automatic scoring.
4. **Lead Details** — 360-degree prospect view with explainable score breakdown, objections, linked appointments, and call summaries.
5. **Appointment Scheduling** — Non-conflicting time slot checks and double-booking-safe booking (`HTTP 409` conflict guard).
6. **Conversation History** — Multi-turn transcript audit log with tool usage and one-click call summary generation.
7. **AI Call Summaries** — Persistent post-call structured executive summaries.
8. **Knowledge Base** — Indexed company documentation (`knowledge_base/*.md`), FAISS semantic search tester, and index rebuild control.
9. **Business Analytics** — SQLite-calculated conversion rates, tier counts, and text-sentiment distribution.
10. **Settings** — Browser TTS voice/rate preferences, live service diagnostics, and methodology transparency.

---

## Technology Stack

- **Frontend:** React 18, TypeScript, Vite 6, Tailwind CSS 3, Recharts 2, Lucide React
- **Backend:** Python 3.13, FastAPI, Pydantic v2, SQLAlchemy 2, Uvicorn
- **AI & Agentic Orchestration:** Google Gemini API (`google-genai`) with autonomous function calling + Pydantic structured outputs
- **RAG Pipeline:** `sentence-transformers` (`all-MiniLM-L6-v2`), `faiss-cpu` (`IndexFlatIP` cosine similarity)
- **Voice Interface:** Modular `SpeechToTextProvider` & `TextToSpeechProvider` interfaces (Browser Web Speech API default)
- **Database:** SQLite (MVP), PostgreSQL-compatible SQLAlchemy models for production

---

## Quick Start

### 1. Environment Configuration

```powershell
Copy-Item .env.example .env
```

Edit `.env` and set your Google AI Studio key:
```env
GEMINI_API_KEY=your_actual_gemini_api_key
```
> **Note:** If `GEMINI_API_KEY` is missing or left as the placeholder, `POST /api/agent/chat` intentionally returns `HTTP 503` (`GEMINI_API_KEY_MISSING`) with setup instructions rather than fabricating AI responses.

### 2. Backend Setup & Run

```powershell
# Activate virtual environment (or create with: python -m venv .venv)
.\.venv\Scripts\Activate.ps1

# Install verified dependencies
pip install -r backend\requirements.txt

# Start FastAPI server
cd backend
..\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
OpenAPI Swagger UI: `http://127.0.0.1:8000/docs`

### 3. Frontend Setup & Run

```powershell
cd frontend
npm install
npm run dev
```
Web Application: `http://127.0.0.1:5173`

### 4. Run Automated Tests

```powershell
.\.venv\Scripts\python.exe -m pytest -v
```

---

## Documentation

- [Executive Project Report](PROJECT_REPORT.md)
- [System Architecture Diagrams](architecture/SYSTEM_ARCHITECTURE.md)
- [Setup & Environment Guide](docs/SETUP.md)
- [100k Production Architecture & Scalability](docs/ARCHITECTURE_AND_SCALABILITY.md)
- [Security & Commercial Feasibility](docs/SECURITY_AND_COMMERCIAL_FEASIBILITY.md)
- [Interview Guide & Live Demo Script](docs/INTERVIEW_GUIDE.md)

---

## Important Transparency Notes

- **Prototype Scoring Model:** Lead qualification (`0–100`, `HOT/WARM/COLD`) uses an explainable rule-based rubric for MVP demonstration, not a scientifically validated predictive model.
- **Text-Based Sentiment:** Sentiment and objection detection analyze conversation transcript text only and do not claim acoustic vocal emotion recognition.
- **Scalability Scope:** The MVP runs on single-node SQLite + local FAISS and has not been load-tested for 100,000 users; see [ARCHITECTURE_AND_SCALABILITY.md](docs/ARCHITECTURE_AND_SCALABILITY.md) for the production architecture.
