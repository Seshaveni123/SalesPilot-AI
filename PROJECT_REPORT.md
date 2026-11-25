# SalesPilot AI — Executive Project Report

**Project Title:** Autonomous AI Sales Voice Agent with Agentic AI, Retrieval-Augmented Generation, Intelligent Lead Qualification, and CRM Automation  
**Track:** Fortivex AI – Round 3 Advanced AI Project Challenge  

---

## 1. Problem & Solution Summary
Inbound sales teams spend substantial time answering repetitive product questions, capturing discovery fields, scoring lead readiness, scheduling non-conflicting demos, and updating CRM records. **SalesPilot AI** automates this end-to-end inbound workflow through a modular React voice/text interface connected to a FastAPI backend, Google Gemini tool-calling agent orchestration, a local FAISS + Sentence Transformers RAG knowledge base, and persistent SQLite CRM storage.

## 2. Core Architecture & Implemented Capabilities
- **Frontend (React, TypeScript, Vite, Tailwind CSS, Recharts):** 10-module enterprise workspace (*Overview, AI Voice Agent, Leads CRM, Lead Details, Appointments, Conversations, Call Summaries, Knowledge Base, Analytics, Settings*) backed by modular Web Speech API STT/TTS adapters (`voiceService.ts`) with duplicate-submission guards and honest offline/error states.
- **Agentic AI Orchestration (FastAPI + `google-genai`):** `SalesAgentOrchestrator` exposes 8 typed function-calling tools (`search_knowledge_base`, `get_customer_context`, `save_lead_to_crm`, `qualify_lead`, `analyze_sentiment`, `check_available_slots`, `book_appointment`, `generate_call_summary`) to Gemini, separates autonomous tool execution from Pydantic `StructuredAgentOutput` extraction, and fails cleanly (`HTTP 503`) when `GEMINI_API_KEY` is unconfigured.
- **Retrieval-Augmented Generation (Sentence Transformers + FAISS):** Ingests 4 company knowledge documents (`18` overlapping chunks), encodes `384`-d embeddings via `all-MiniLM-L6-v2`, normalizes vectors into `faiss.IndexFlatIP` for cosine similarity retrieval, surfaces source citations, and admits unavailability when similarity scores fall below threshold.
- **Deterministic Sales Automation (Python + SQLAlchemy + SQLite):**
  - **Lead Qualification:** Transparent `0–100` prototype rule-based scoring (`HOT >= 70`, `WARM 40–69`, `COLD < 40`) with per-criterion breakdown.
  - **Text Sentiment & Objections:** Transcript-based polarity, negation, purchase interest, urgency, and objection detection (no acoustic vocal emotion claims).
  - **Appointment Scheduling:** Slot availability filtering and `HTTP 409` double-booking prevention linked to CRM leads.
  - **Call Summaries & Analytics:** Persistent structured summaries and SQLite-calculated conversion/pipeline metrics.

## 3. Verification Summary
- **Automated Test Suite (`python -m pytest -v`):** **14 passed, 0 failed** covering health diagnostics, missing-API-key `503` handling, validation errors, RAG chunking/FAISS retrieval, qualification tiers, text sentiment, appointment double-booking prevention, 360-degree lead profiles, and a full 3-turn end-to-end voice workflow.
- **Frontend Build (`npm run build`):** `tsc -b && vite build` passed with **exit code `0`** (`2025` modules).
- **Live Stack Verification:** Verified Uvicorn (`127.0.0.1:8000`) + Vite (`127.0.0.1:5173`) serving live health, document listing (`4` docs), and real `all-MiniLM-L6-v2` FAISS retrieval (`0.35s` warm latency).

## 4. Known Limitations & Production Path
- Live Gemini LLM generation requires setting `GEMINI_API_KEY` in `.env`; automated agent tests validate tool loops via deterministic mocked Gemini clients, while RAG, SQLite, scoring, sentiment, booking, and summaries ran live.
- The MVP targets single-node local evaluation and has **not** been load-tested for 100,000 users. Production scaling to 100,000 registered users requires stateless Kubernetes FastAPI pods, Redis session caching, PostgreSQL with connection pooling/locking, a dedicated vector database (Qdrant/pgvector), async worker queues, OAuth2/JWT RBAC, and cloud STT/TTS adapters (detailed in [ARCHITECTURE_AND_SCALABILITY.md](docs/ARCHITECTURE_AND_SCALABILITY.md)).
