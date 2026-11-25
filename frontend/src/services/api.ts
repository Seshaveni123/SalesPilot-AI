import type {
  AnalyticsOverview,
  Appointment,
  CallSummary,
  ChatResponse,
  ConversationMessage,
  ConversationSession,
  KnowledgeDocument,
  Lead,
  LeadDetails,
  RetrievedSource,
  SystemHealth,
} from '../types';

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api';

export class ApiError extends Error {
  status: number;

  constructor(message: string, status = 0) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...(options?.headers || {}),
      },
      ...options,
    });

    if (!response.ok) {
      let detail = `Request failed with status ${response.status}`;
      try {
        const body = await response.json();
        if (body?.detail) {
          detail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail);
        }
      } catch {
        // Ignore non-JSON error payloads
      }
      throw new ApiError(detail, response.status);
    }

    return (await response.json()) as T;
  } catch (err) {
    if (err instanceof ApiError) {
      throw err;
    }
    throw new ApiError(
      'Unable to reach the SalesPilot API server. Ensure the backend service is running.',
      0
    );
  }
}

export const apiClient = {
  async getHealth(): Promise<SystemHealth> {
    try {
      const data = await request<{
        status: string;
        gemini_configured: boolean;
        database_connected: boolean;
        rag_indexed: boolean;
      }>('/health');
      return {
        status: data.status === 'ok' ? 'online' : 'degraded',
        gemini_configured: Boolean(data.gemini_configured),
        database_connected: Boolean(data.database_connected),
        rag_indexed: Boolean(data.rag_indexed),
        checked_at: new Date().toISOString(),
      };
    } catch (err) {
      return {
        status: 'offline',
        gemini_configured: false,
        database_connected: false,
        rag_indexed: false,
        checked_at: new Date().toISOString(),
        error: err instanceof Error ? err.message : 'Service unavailable',
      };
    }
  },

  sendAgentChat: (payload: {
    session_id: string;
    message: string;
    channel: 'voice' | 'text';
  }) =>
    request<ChatResponse>('/agent/chat', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getAnalyticsOverview: () => request<AnalyticsOverview>('/analytics/overview'),

  getLeads: () => request<Lead[]>('/leads'),
  getLead: (leadId: number) => request<Lead>(`/leads/${leadId}`),
  getLeadDetails: (leadId: number) => request<LeadDetails>(`/leads/${leadId}/details`),
  createLead: (payload: {
    name?: string;
    email?: string;
    phone?: string;
    company?: string;
    company_size?: string;
    product_interest?: string;
    budget?: string;
    requirements?: string;
    timeline?: string;
  }) =>
    request<Lead>('/leads', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateLead: (
    leadId: number,
    payload: Partial<Omit<Lead, 'id' | 'created_at' | 'updated_at'>>
  ) =>
    request<Lead>(`/leads/${leadId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  getAppointments: () => request<Appointment[]>('/appointments'),
  getAvailableSlots: (date: string) =>
    request<{ date: string; available_slots: string[] }>(
      `/appointments/slots?date=${encodeURIComponent(date)}`
    ),
  bookAppointment: (payload: {
    lead_id: number;
    scheduled_date: string;
    scheduled_time: string;
    topic?: string;
  }) =>
    request<Appointment>('/appointments', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getConversations: () => request<ConversationSession[]>('/conversations'),
  getConversationMessages: (sessionId: string) =>
    request<ConversationMessage[]>(
      `/conversations/${encodeURIComponent(sessionId)}/messages`
    ),

  getCallSummaries: () => request<CallSummary[]>('/summaries'),
  generateCallSummary: (sessionId: string) =>
    request<CallSummary>(`/summaries/generate/${encodeURIComponent(sessionId)}`, {
      method: 'POST',
    }),

  getKnowledgeDocuments: () => request<KnowledgeDocument[]>('/knowledge/documents'),
  reindexKnowledgeBase: () =>
    request<{ status: string; indexed_chunks: number }>('/knowledge/reindex', {
      method: 'POST',
    }),
  queryKnowledgeBase: (query: string) =>
    request<{ query: string; available: boolean; sources: RetrievedSource[] }>(
      '/knowledge/search',
      {
        method: 'POST',
        body: JSON.stringify({ query }),
      }
    ),
};
