# SalesPilot AI — Security, Privacy & Compliance

SalesPilot AI is designed with strict data protection and enterprise governance practices.

## Data Security & Encryption
- **Encryption in Transit:** All API and dashboard traffic uses TLS 1.2+ HTTPS encryption in production deployments.
- **Encryption at Rest:** Production PostgreSQL databases and object storage volumes use AES-256 encryption.
- **API Key & Secret Management:** Third-party LLM keys and database credentials are stored exclusively in environment secrets managers and never logged or exposed in client responses.

## Privacy & AI Governance
- **No Training on Customer Data:** Customer conversation transcripts, CRM records, and uploaded knowledge base documents are never used to train public foundation models.
- **PII Handling:** Personally identifiable information (names, emails, phone numbers) is stored strictly for CRM workflow fulfillment and supports configurable retention policies.
- **Grounded Factuality:** The AI assistant only cites product specifications and pricing present in the approved Knowledge Base and explicitly states when information is unavailable.

## Compliance Roadmap & Standards
- Enterprise plans include SOC 2 Type II audit documentation, GDPR Data Processing Agreements (DPA), and configurable data residency options (US and EU).
- SAML 2.0 Single Sign-On (Okta, Azure AD, Google Workspace) is supported on Enterprise deployments.
