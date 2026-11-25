# SalesPilot AI — System Architecture Diagrams

## 1. MVP End-to-End Architecture

```mermaid
flowchart LR
    User["Prospect / Sales Rep Browser"] -->|Mic STT & Speaker TTS| VoiceUI["React + Vite + Tailwind UI\n(Web Speech API)"]
    VoiceUI -->|REST JSON over HTTP| API["FastAPI Backend\n(Pydantic Validation + CORS)"]

    subgraph AgentCore["Agentic AI & Automation Layer"]
        Orch["SalesAgentOrchestrator\n(Tool Loop + Structured Output)"]
        Tools["AgentToolDispatcher\n(8 Deterministic Tools)"]
        Qual["Lead Qualification\n(Prototype Rule Rubric)"]
        Sent["Text Sentiment & Objections"]
        Appt["Appointment Service\n(Double-Booking Guard)"]
        Summ["Call Summary Generator"]
    end

    API --> Orch
    Orch <-->|Function Calling + JSON Schema| Gemini["Google Gemini API\n(gemini-2.5-flash)"]
    Orch --> Tools
    Tools --> Qual
    Tools --> Sent
    Tools --> Appt
    Tools --> Summ

    Tools -->|Cosine Similarity Top-K| FAISS["FAISS IndexFlatIP\n+ all-MiniLM-L6-v2"]
    FAISS -->|Reads Chunks| KB["knowledge_base/*.md"]
    Tools -->|SQLAlchemy ORM| DB[("SQLite MVP DB\nsalespilot.db")]
    Orch -->|Session Memory & Transcripts| DB
```

---

## 2. Autonomous Tool-Calling & Booking Sequence

```mermaid
sequenceDiagram
    participant U as Customer (Browser Voice/Text)
    participant F as React VoiceAgentPage
    participant A as FastAPI /api/agent/chat
    participant O as SalesAgentOrchestrator
    participant G as Gemini API
    participant T as Python Tools / RAG / SQLite

    U->>F: Speaks or types inquiry
    F->>A: POST /api/agent/chat (session_id, message)
    A->>O: handle_turn()
    O->>G: ensure_configured() + generate_with_tools()
    G-->>O: function_calls: [search_knowledge_base, save_lead_to_crm]
    O->>T: Execute deterministic RAG search + SQLite upsert
    T-->>O: Grounded chunks + updated Lead score
    O->>G: FunctionResponse parts
    G-->>O: Draft grounded sales response
    O->>G: generate_structured(StructuredAgentOutput)
    G-->>O: Validated JSON {reply, extracted fields}
    O->>T: Persist sentiment, memory, assistant message
    O-->>A: ChatResponse (reply, tools_used, sources, lead_context)
    A-->>F: HTTP 200 JSON
    F->>U: Plays TTS response + updates Intelligence Inspector
```

---

## 3. Target Production Architecture (100,000 Registered Users)

```mermaid
flowchart TB
    Clients["Web & Voice Clients\n(100k Registered Users)"] --> WAF["CDN / WAF / Rate Limiter"]
    WAF --> LB["L7 Load Balancer\n(TLS Termination)"]

    subgraph K8s["Kubernetes Cluster (HPA Autoscaling)"]
        API1["FastAPI Pod 1"]
        API2["FastAPI Pod N"]
        Worker["Async Celery / RQ Workers\n(Summaries, Indexing, CRM Webhooks)"]
    end

    LB --> API1
    LB --> API2

    API1 & API2 <--> Redis[("Redis Cluster\nSession Cache & Rate Limits")]
    API1 & API2 <--> PG[("PostgreSQL Primary + Read Replica\nCRM, Leads, Appointments")]
    API1 & API2 <--> VDB[("Dedicated Vector DB\nQdrant / pgvector / Pinecone")]
    API1 & API2 --> MQ["Message Queue\n(RabbitMQ / Redis Streams / SQS)"]
    MQ --> Worker
    Worker --> PG
    Worker --> VDB
    API1 & API2 & Worker --> Obs["Observability Stack\n(Prometheus, Grafana, OpenTelemetry, Structured Logs)"]
```
