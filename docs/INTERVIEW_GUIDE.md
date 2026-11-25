# Technical Interview Preparation & Live Demo Guide

---

## Part 1: 5-Minute Live Interview Demo Script

1. **System Health & Honest Failure Handling (30s):**
   - Show `Settings` or top header `API Online` status. Show `/api/health` returning live database and FAISS index readiness (`rag_indexed: true`).
   - Point out that `gemini_configured` reads strictly from `.env` and fails cleanly with HTTP `503` if unconfigured (no fake AI responses).
2. **Knowledge Base & RAG Retrieval (60s):**
   - Open **Knowledge Base**, show the 4 indexed company documents (18 chunks), and run semantic queries like `"Growth plan pricing"` and `"SOC 2 encryption"` to demonstrate real FAISS cosine similarity scores and excerpts.
   - Run an out-of-domain query to show the system admitting unavailability rather than hallucinating.
3. **Voice & Text Agent Workflow (90s):**
   - Open **AI Voice Agent**, demonstrate browser Web Speech capability badges, start/stop microphone check, and explain the duplicate-submission guard + TTS auto-speak toggle.
   - Show how the Intelligence Inspector updates live with extracted lead details, text sentiment, objections, and retrieved source citations.
4. **CRM, Explainable Scoring & Double-Booking Prevention (90s):**
   - Open **Leads CRM**, add a prospect or open **Lead Details** to show the 0–100 prototype score breakdown (`HOT / WARM / COLD`) and prototype disclaimer.
   - Open **Appointments**, select a date and slot, confirm a booking, then show that the booked slot immediately disappears and duplicate booking is rejected (`409 Conflict`).
   - Open **Call Summaries** and **Analytics** to verify all metrics calculate directly from SQLite records.

---

## Part 2: 20 Technical Interview Questions & Detailed Answers

1. **What problem does SalesPilot AI solve?**
   Sales teams waste hours answering repetitive product questions, capturing discovery fields, scoring leads inconsistently, and manually logging CRM notes and calendar bookings. SalesPilot AI automates inbound voice/text qualification, grounded Q&A, sentiment/objection capture, non-conflicting demo booking, and structured post-call summaries.
2. **What makes this an agentic AI system rather than a simple chatbot?**
   A simple chatbot maps input text to output text in one fixed pass. SalesPilot AI exposes 8 typed `FunctionDeclaration` tools to Gemini so the model autonomously decides which tools to call (`search_knowledge_base`, `save_lead_to_crm`, `check_available_slots`, `book_appointment`, etc.) based on conversational state, while Python executes state changes deterministically.
3. **Why did you keep business operations deterministic in Python instead of letting the LLM do everything?**
   LLMs are probabilistic and cannot enforce transactional database constraints. Keeping slot conflict checks, lead scoring arithmetic, and CRM writes in Python/SQLAlchemy prevents double bookings and hallucinated confirmations.
4. **How does your RAG pipeline prevent product hallucinations?**
   Company docs are chunked (`500` chars, `80` overlap), embedded with `all-MiniLM-L6-v2`, L2-normalized, and indexed in FAISS `IndexFlatIP`. Queries return top-K chunks above `min_score`; if no chunk clears the threshold, the tool returns `status: "no_match"` and instructs Gemini to admit the gap.
5. **Why use `IndexFlatIP` with `faiss.normalize_L2`?**
   Inner product of two unit-length vectors equals their cosine similarity (`[-1, 1]`), measuring semantic angle regardless of chunk length.
6. **How did you solve offline/sandbox HuggingFace latency in `SentenceTransformerEmbedder`?**
   `transformers` checks HuggingFace Hub metadata online on load even when cached. Trying `HF_HUB_OFFLINE=1` + `local_files_only=True` first drops warm search latency to `0.35s` with zero network retry stalls, while falling back cleanly if the model isn't cached yet.
7. **Why separate `generate_with_tools()` and `generate_structured()` in `GeminiClientWrapper`?**
   Gemini models often reject combining function-calling `tools` with `response_mime_type="application/json"` in a single call. Separating the tool-calling loop from the final `StructuredAgentOutput` JSON pass guarantees both autonomous tool selection and Pydantic-validated field extraction.
8. **How do you handle a missing `GEMINI_API_KEY`?**
   `Settings.is_gemini_configured` rejects empty or placeholder keys. `ensure_configured()` raises `GeminiConfigurationError`, and FastAPI's global handler returns HTTP `503` with `GEMINI_API_KEY_MISSING` and setup instructions instead of faking an AI response.
9. **How is conversation memory maintained across turns and server restarts?**
   `ConversationManager` persists every message in `conversation_messages` and stores extracted structured facts (`name`, `company`, `budget`, `requirements`, `timeline`) in `conversation_sessions.memory_json` in SQLite.
10. **Explain your lead qualification model and its limitations.**
    It is an explainable prototype rule-based rubric (`0–100` points across identity, product fit/requirements, budget, timeline, and company size; `HOT >= 70`, `WARM >= 40`, `COLD < 40`). It is transparent and auditable, and we explicitly document that it is not a scientifically validated ML conversion model.
11. **How does sentiment analysis work, and what does it NOT claim?**
    `analyze_customer_text()` performs text-based polarity, negation, objection category (`Pricing / Budget`, `Security / Compliance`, etc.), purchase interest, and urgency analysis on the transcript. It explicitly does not claim acoustic vocal emotion recognition.
12. **How do you prevent double booking in appointment scheduling?**
    `appointment_service.book_appointment()` validates the slot and queries SQLite for an existing `Confirmed` appointment at `(scheduled_date, scheduled_time)` before inserting, raising `AppointmentConflictError` (`409 Conflict`). In production PostgreSQL, we would add a partial unique index + `SELECT FOR UPDATE`.
13. **Why design browser STT/TTS behind `SpeechToTextProvider` and `TextToSpeechProvider` interfaces?**
    Browser Web Speech API is great for a zero-cost MVP, but production telephony needs dedicated providers (Deepgram, Whisper, ElevenLabs). Clean interfaces in [voiceService.ts](file:///c:/Users/SESHAVENI/Downloads/SalesPilot-AI/frontend/src/services/voiceService.ts) allow swapping providers without changing React UI components.
14. **How does the Voice Agent UI prevent audio feedback loops and duplicate submissions?**
    `startListening()` calls `stopSpeaking()` so the mic doesn't capture TTS audio, and `useVoiceAgent` combines a synchronous `inFlightRef` lock with a `2.5s` duplicate-text guard.
15. **What Windows + Python 3.13 compatibility issue did you uncover and solve during testing?**
    Verified `--only-binary=:all:` wheels (`faiss-cpu==1.16.0`, `torch==2.15.0`, `sqlalchemy==2.1.9`) for Python 3.13.4, and discovered that `pytest`'s `faulthandler` plugin + `Scripts/pytest.exe` shim caused intermittent `_swigfaiss` DLL init errors (`0xc0000008`), fixed via `pytest.ini` (`-p no:faulthandler`) and `python.exe -m pytest`.
16. **How would you scale this MVP to 100,000 registered users?**
    Separate 100k registered SaaS users (~200–1,500 peak concurrent sessions) from 100k simultaneous audio streams. Move to stateless FastAPI pods on Kubernetes HPA behind a Load Balancer, Redis for session caching and rate limits, PostgreSQL with connection pooling/read replicas, a dedicated Vector DB (Qdrant/pgvector), and message queues + workers for summaries and embeddings.
17. **What security controls are in place now vs. needed for production?**
    MVP already has `.env` secret isolation, `.gitignore` rules, Pydantic input validation, SQLAlchemy ORM parameterization, and safe exception logging. Production adds OAuth2/JWT auth, tenant-scoped RBAC, Redis rate limiting, PII retention policies, and explicit voice consent prompts.
18. **How is the analytics dashboard guaranteed to be accurate?**
    Every metric (`total_leads`, `hot_leads`, `conversion_rate`, `average_lead_score`, `sentiment_distribution`) is computed dynamically from SQLite rows via SQLAlchemy in `get_analytics_overview()`. Empty tables return `0`s—never hardcoded demo numbers.
19. **How would you unit-test an LLM orchestrator deterministically without spending API credits?**
    By injecting a mock/fake `GeminiClientWrapper` via FastAPI `app.dependency_overrides[get_orchestrator]` that returns scripted `function_calls` and JSON payloads, allowing full end-to-end testing of tool dispatch, SQLite persistence, and API responses offline.
20. **What is the biggest bottleneck in the MVP today?**
    Cold-loading PyTorch + `all-MiniLM-L6-v2` into memory takes ~`17–23s` on the first semantic query (`0.35s` thereafter), and SQLite serializes writes on a single file. Pre-warming the embedding service or hosting embeddings/Qdrant as a dedicated microservice eliminates cold-start latency.
