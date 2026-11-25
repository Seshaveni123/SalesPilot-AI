import React, { useEffect, useState } from 'react';
import { FileText, MessageSquareText, RefreshCw, Wrench } from 'lucide-react';
import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { SentimentBadge } from '../components/StatusBadge';
import { apiClient } from '../services/api';
import type { ConversationMessage, ConversationSession } from '../types';

export const ConversationsPage: React.FC = () => {
  const [sessions, setSessions] = useState<ConversationSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [generating, setGenerating] = useState<boolean>(false);
  const [statusNote, setStatusNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadSessions = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.getConversations();
      setSessions(data);
      if (data.length > 0 && !selectedSessionId) {
        setSelectedSessionId(data[0].session_id);
      }
    } catch (err) {
      setSessions([]);
      setError(
        err instanceof Error ? err.message : 'Unable to load conversation history.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSessions();
  }, []);

  useEffect(() => {
    if (!selectedSessionId) {
      setMessages([]);
      return;
    }
    const fetchMessages = async () => {
      try {
        const msgs = await apiClient.getConversationMessages(selectedSessionId);
        setMessages(msgs);
      } catch {
        setMessages([]);
      }
    };
    void fetchMessages();
  }, [selectedSessionId]);

  const handleGenerateSummary = async () => {
    if (!selectedSessionId || generating) return;
    setGenerating(true);
    setStatusNote(null);
    try {
      await apiClient.generateCallSummary(selectedSessionId);
      setStatusNote('Call summary generated and saved to database.');
    } catch (err) {
      setStatusNote(
        err instanceof Error ? err.message : 'Failed to generate summary.'
      );
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Conversation History"
        description="Audit multi-turn customer transcripts, invoked agent tools, and retrieved source citations."
        actions={
          <button
            type="button"
            onClick={() => void loadSessions()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        }
      />

      {error ? (
        <EmptyState
          icon={MessageSquareText}
          tone="warning"
          title="Conversation logs unavailable"
          description={error}
        />
      ) : sessions.length === 0 ? (
        <EmptyState
          icon={MessageSquareText}
          title="No conversations recorded yet"
          description="All spoken and text sales sessions conducted in the AI Voice Agent module are stored here for inspection."
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card padding="none" className="overflow-hidden">
            <div className="border-b border-slate-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-900">
                Recorded Sessions ({sessions.length})
              </h2>
            </div>
            <div className="divide-y divide-slate-100">
              {sessions.map((sess) => (
                <button
                  key={sess.session_id}
                  type="button"
                  onClick={() => {
                    setStatusNote(null);
                    setSelectedSessionId(sess.session_id);
                  }}
                  className={`w-full px-4 py-3 text-left transition-colors ${
                    selectedSessionId === sess.session_id
                      ? 'bg-brand-50/70'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-900">
                      {sess.lead_name || 'Anonymous Visitor'}
                    </span>
                    <SentimentBadge sentiment={sess.sentiment} />
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {sess.company || sess.session_id} · {sess.message_count} messages
                  </p>
                </button>
              ))}
            </div>
          </Card>

          <Card padding="none" className="flex min-h-[440px] flex-col lg:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-3.5">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Transcript Viewer
                </h2>
                {statusNote && (
                  <p className="text-xs text-emerald-700">{statusNote}</p>
                )}
              </div>
              {selectedSessionId && (
                <button
                  type="button"
                  onClick={() => void handleGenerateSummary()}
                  disabled={generating}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  <FileText className="h-3.5 w-3.5 text-brand-600" />
                  {generating ? 'Generating...' : 'Generate Call Summary'}
                </button>
              )}
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto p-5">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`rounded-xl border p-3.5 text-sm ${
                    m.role === 'user'
                      ? 'border-brand-100 bg-brand-50/50'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-semibold uppercase text-slate-600">
                      {m.role === 'user' ? 'Customer' : 'SalesPilot AI'}
                    </span>
                    <span className="font-mono text-[11px] text-slate-400">
                      {new Date(m.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-slate-800">{m.content}</p>
                  {m.tools_used && m.tools_used.length > 0 && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <Wrench className="h-3 w-3 text-slate-400" />
                      {m.tools_used.map((tool, i) => (
                        <span
                          key={`${tool}_${i}`}
                          className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600"
                        >
                          {tool}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
