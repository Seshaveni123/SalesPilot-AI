# Security Architecture & Commercial Feasibility

---

## Part A: Security & Privacy Controls

| Control Area | MVP Status | Production Hardening Standard |
| :--- | :--- | :--- |
| **API Key Security** | Read strictly from `.env` via `pydantic-settings`; never hardcoded or returned in API payloads | Store in cloud Secrets Manager (AWS Secrets Manager / GCP Secret Manager) with automatic key rotation |
| **Environment Variables** | `.env` excluded by [.gitignore](file:///c:/Users/SESHAVENI/Downloads/SalesPilot-AI/.gitignore); `.env.example` provides safe template | Inject secrets via Kubernetes Secrets / IAM workload identity at runtime |
| **Input Validation** | Strict Pydantic v2 schemas (`max_length`, regex date formats, non-empty checks) returning `422` | Add payload size caps, prompt-injection delimiters, and WAF rules |
| **ORM & SQL Injection Safety** | 100% parameterized SQLAlchemy 2.x ORM queries; zero raw string-interpolated SQL | Enforce least-privilege DB roles and `pgbouncer` TLS connections |
| **Authentication** | Not enforced in local MVP | OAuth 2.0 / OIDC + short-lived JWT access tokens and refresh rotation |
| **Authorization (RBAC)** | Single-workspace MVP | Tenant-scoped RBAC (`tenant_id` enforcement on every query; Admin vs. Sales Rep vs. Read-Only) |
| **PII Protection** | Contact fields (`name`, `email`, `phone`) stored only in CRM tables | Field-level encryption or KMS-backed DB encryption + masked UI display for restricted roles |
| **Customer Consent** | UI explicitly indicates microphone activation and browser permission prompt | Explicit pre-call disclosure banner/audio prompt ("This AI-assisted session may be transcribed and summarized") |
| **Data Retention** | Persistent SQLite records | Configurable retention TTL (e.g., 90/365 days) with automated GDPR/CCPA deletion workflows |
| **Rate Limiting** | Duplicate-submission guard on frontend | Gateway + per-tenant Redis rate limiting to prevent LLM quota exhaustion / DoS |
| **Safe Logging** | Logs exception class names only; never logs `GEMINI_API_KEY` or raw secrets | Redact emails, phone numbers, and bearer tokens before shipping structured logs |

---

## Part B: Commercial Feasibility & Unit Economics

### 1. Monetization Models
- **B2B SaaS Subscriptions:** Tiered monthly/annual seats + conversation quotas (e.g., Starter `$299/mo`, Growth `$899/mo`, Enterprise `$2,400+/mo`).
- **Usage-Based / Conversation Overage Pricing:** Per-completed-conversation or per-qualified-lead overage billing beyond plan quotas.
- **Voice-Minute Billing (Enterprise Telephony):** Per-minute billing when paired with dedicated SIP/telephony & cloud STT/TTS providers.
- **Enterprise Licenses & Compliance Add-Ons:** Annual contracts covering SSO/SAML, dedicated vector DB isolation, SOC 2 Type II documentation, and custom SLAs.
- **CRM Integration Connectors:** Add-on or Growth/Enterprise tier upsells for bi-directional HubSpot, Salesforce, and Zoho synchronization.

### 2. Verified Provider Pricing & Transparent Cost Modeling

- **Verified Google Gemini 2.5 Flash Standard Paid Tier Pricing** (`ai.google.dev`):
  - **Text Input:** `$0.30` per 1,000,000 tokens
  - **Output (including thinking tokens):** `$2.50` per 1,000,000 tokens
  - **Free Tier:** Available at `$0` subject to standard rate limits for prototyping/evaluation.
- **Modeling Assumptions (Explicit Estimates — Not Measured Production Telemetry):**
  - Assume an average 6-turn sales conversation uses ~`8,000` input tokens (system prompt + tool schemas + RAG chunks + history) and ~`1,200` output tokens.
  - **Estimated LLM Cost per Conversation:**
    - Input: `0.008M * $0.30 = $0.0024`
    - Output: `0.0012M * $2.50 = $0.0030`
    - **Total Gemini 2.5 Flash LLM cost ≈ `$0.0054` (~0.54 cents) per conversation** (browser Web Speech STT/TTS has `$0` marginal API cost).
  - *If upgraded in production to dedicated cloud STT/TTS + telephony (assumed ~$0.03–$0.08/min over a 4-minute call):* estimated COGS rises to **~$0.13–$0.33 per voice call**, still leaving **>75% gross margin** on a `$299–$899/mo` SaaS tier at typical SMB conversation volumes (500–2,500 conversations/month).
