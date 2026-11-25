# Production Architecture & Scalability Plan (100,000 Registered Users)

> **Important MVP Scope Note:** The current SalesPilot AI MVP runs on a single-node FastAPI + SQLite + local FAISS architecture and has **not** been load-tested for 100,000 users. This document defines the target production architecture required to scale reliably to 100,000 registered users.

---

## 1. Registered Users vs. Simultaneous Active Voice Sessions

A critical capacity-planning distinction is **registered user accounts** versus **concurrent active voice sessions**:

- **100,000 Registered Users (B2B SaaS / Sales Reps & Prospects):**
  - If 10–15% of registered accounts are Daily Active Users (10,000–15,000 DAU) and each runs a few short sessions per day, peak simultaneous active sessions are typically **200 to 1,500 concurrent sessions**—not 100,000 simultaneous audio streams.
  - Database storage, multi-tenant isolation, authentication, and async CRM/summary processing are the primary concerns.
- **100,000 Simultaneous Active Voice Sessions (Extreme Real-Time Load):**
  - Would require ~100,000 persistent WebSocket/WebRTC audio connections, dedicated GPU inference clusters or enterprise STT/TTS streaming gateways, and massive upstream LLM tokens-per-minute (TPM) quotas—representing an order-of-magnitude larger infrastructure footprint than 100,000 registered SaaS users.

---

## 2. Production Component Blueprint

| Layer | MVP Implementation | Target Production Architecture (100k Users) |
| :--- | :--- | :--- |
| **Ingress & Routing** | Local Vite / Uvicorn | **Cloud Load Balancer (ALB/NGINX)** with TLS 1.3 termination, health checks, and WebSocket upgrade support |
| **Compute** | Single Uvicorn process | **Stateless Horizontally Scaled FastAPI Pods** running behind Gunicorn/Uvicorn workers |
| **Autoscaling** | Manual | **Kubernetes Horizontal Pod Autoscaler (HPA)** scaling on CPU, memory, request latency, and active WebSocket/queue depth |
| **Session Cache** | SQLite `memory_json` | **Redis Cluster** for sub-millisecond active session state, short-term turn buffers, and distributed locks |
| **Primary Database** | SQLite (`salespilot.db`) | **Managed PostgreSQL** (Primary + Read Replicas, PgBouncer connection pooling, `SERIALIZABLE` / row-level locking `SELECT FOR UPDATE` for slot booking) |
| **Vector Search (RAG)** | Local `faiss-cpu` file | **Dedicated Vector Database** (e.g., **Qdrant**, **Pinecone**, or **PostgreSQL + pgvector**) with tenant metadata filtering and zero-downtime reindexing |
| **Async Processing** | Synchronous request path | **Message Queue (RabbitMQ / SQS / Redis Streams) + Background Workers** for post-call summary generation, document chunking/embedding, and external CRM webhook sync |
| **Rate Limiting** | None in MVP | **Redis-backed Sliding Window / Token Bucket Rate Limiter** per API key, tenant, and IP at the API gateway |
| **Authentication** | Open local demo | **JWT / OAuth 2.0 / OIDC** with tenant-scoped RBAC (`admin`, `sales_rep`, `viewer`) |
| **Monitoring & Metrics** | `/api/health` | **Prometheus + Grafana + OpenTelemetry** tracking p95/p99 endpoint latency, LLM error rates, tool execution duration, and DB pool saturation |
| **Logging** | Python `logging` stdout | **Centralized Structured JSON Logging** (ELK / CloudWatch / Loki) with PII redaction and correlation request IDs |
| **Data Privacy** | Local `.env` & SQLite | **Encrypted-at-rest volumes (AES-256)**, TLS in transit, tenant isolation (`tenant_id` row filtering), and automated data retention/deletion jobs |

---

## 3. Why Stateless FastAPI + Redis + Workers Matters

1. **Zero Sticky-Session Bottlenecks:** Because active conversation state lives in Redis/PostgreSQL rather than in-process Python memory, Kubernetes can freely route requests across pods or scale pods down without dropping ongoing conversations.
2. **Non-Blocking Heavy Work:** Embedding large PDFs or pushing webhooks to Salesforce/HubSpot happens asynchronously in background workers via the message queue, keeping live voice/chat API response latency low.
3. **Concurrency-Safe Booking:** In production PostgreSQL, `book_appointment` uses a partial unique index (`UNIQUE (scheduled_date, scheduled_time) WHERE status = 'Confirmed'`) plus transactional locking to guarantee zero double bookings even under concurrent requests.
