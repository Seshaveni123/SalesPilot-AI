export type LeadCategory = 'HOT' | 'WARM' | 'COLD' | 'UNQUALIFIED';
export type SentimentLabel = 'Positive' | 'Neutral' | 'Negative';
export type AppointmentStatus = 'Confirmed' | 'Completed' | 'Cancelled';

export interface Lead {
  id: number;
  name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  company_size: string | null;
  product_interest: string | null;
  budget: string | null;
  requirements: string | null;
  timeline: string | null;
  lead_score: number;
  lead_category: LeadCategory;
  sentiment: SentimentLabel | null;
  urgency: string | null;
  objections: string[];
  created_at: string;
  updated_at: string;
}

export interface ConversationMessage {
  id: number;
  session_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  tools_used?: string[];
  retrieved_sources?: RetrievedSource[];
  created_at: string;
}

export interface ConversationSession {
  session_id: string;
  lead_id: number | null;
  lead_name: string | null;
  company: string | null;
  channel: 'voice' | 'text';
  sentiment: SentimentLabel | null;
  message_count: number;
  started_at: string;
  last_message_at: string;
}

export interface RetrievedSource {
  document_name: string;
  chunk_id: string;
  score: number;
  excerpt: string;
}

export interface Appointment {
  id: number;
  lead_id: number;
  lead_name: string | null;
  company: string | null;
  scheduled_date: string;
  scheduled_time: string;
  topic: string | null;
  status: AppointmentStatus;
  created_at: string;
}

export interface CallSummary {
  id: number;
  session_id: string;
  lead_id: number | null;
  customer_name: string | null;
  company: string | null;
  requirements: string | null;
  product_interest: string | null;
  budget: string | null;
  sentiment: SentimentLabel | null;
  lead_score: number | null;
  lead_category: LeadCategory | null;
  objections: string[];
  next_action: string | null;
  appointment_status: string | null;
  created_at: string;
}

export interface KnowledgeDocument {
  id: string;
  filename: string;
  title: string;
  category: string;
  chunk_count: number;
  character_count: number;
  updated_at: string;
}

export interface AnalyticsOverview {
  total_leads: number;
  hot_leads: number;
  warm_leads: number;
  cold_leads: number;
  total_appointments: number;
  confirmed_appointments: number;
  total_conversations: number;
  conversion_rate: number;
  average_lead_score: number;
  sentiment_distribution: {
    positive: number;
    neutral: number;
    negative: number;
  };
  recent_activity: Array<{
    id: string;
    type: 'lead' | 'appointment' | 'conversation' | 'summary';
    description: string;
    timestamp: string;
  }>;
}

export interface SystemHealth {
  status: 'online' | 'degraded' | 'offline';
  gemini_configured: boolean;
  database_connected: boolean;
  rag_indexed: boolean;
  checked_at: string;
  error?: string;
}

export interface LeadContextSchema {
  name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  company_size: string | null;
  product_interest: string | null;
  budget: string | null;
  requirements: string | null;
  timeline: string | null;
  lead_score: number | null;
  lead_category: LeadCategory | null;
  sentiment: SentimentLabel | null;
  objections: string[];
}

export interface ChatResponse {
  session_id: string;
  reply: string;
  tools_used: string[];
  retrieved_sources: RetrievedSource[];
  lead_context: LeadContextSchema;
  follow_up_intent: string | null;
}

export interface LeadDetails {
  lead: Lead;
  qualification_breakdown: string[];
  model_disclaimer: string;
  appointments: Appointment[];
  summaries: CallSummary[];
}

export interface VoicePreferences {
  autoSpeak: boolean;
  speechRate: number;
  selectedVoiceURI: string;
  recognitionLang: string;
}
