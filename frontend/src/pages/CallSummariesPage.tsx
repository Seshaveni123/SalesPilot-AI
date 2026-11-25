import React, { useEffect, useState } from 'react';
import { FileText, RefreshCw } from 'lucide-react';
import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { LeadCategoryBadge, SentimentBadge } from '../components/StatusBadge';
import { apiClient } from '../services/api';
import type { CallSummary } from '../types';

export const CallSummariesPage: React.FC = () => {
  const [summaries, setSummaries] = useState<CallSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadSummaries = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.getCallSummaries();
      setSummaries(data);
    } catch (err) {
      setSummaries([]);
      setError(
        err instanceof Error ? err.message : 'Unable to load call summaries.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSummaries();
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Call Summaries"
        description="Structured post-call executive briefs capturing requirements, objections, scoring, and next actions."
        actions={
          <button
            type="button"
            onClick={() => void loadSummaries()}
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
          icon={FileText}
          tone="warning"
          title="Call summaries unavailable"
          description={error}
        />
      ) : summaries.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No call summaries generated yet"
          description="Structured AI summaries are persisted automatically once a sales conversation concludes or a summary is requested."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {summaries.map((sum) => (
            <Card key={sum.id} className="space-y-4">
              <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">
                    {sum.customer_name || 'Unnamed Prospect'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {sum.company || 'Company unknown'} · Session{' '}
                    <code className="font-mono">{sum.session_id}</code>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <SentimentBadge sentiment={sum.sentiment} />
                  <LeadCategoryBadge category={sum.lead_category} />
                </div>
              </div>

              <dl className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <dt className="text-slate-500">Product Interest</dt>
                  <dd className="mt-0.5 font-medium text-slate-900">
                    {sum.product_interest || '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Budget</dt>
                  <dd className="mt-0.5 font-medium text-slate-900">
                    {sum.budget || '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Lead Score</dt>
                  <dd className="mt-0.5 font-mono font-semibold text-slate-900">
                    {sum.lead_score !== null ? `${sum.lead_score}/100` : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Appointment Status</dt>
                  <dd className="mt-0.5 font-medium text-slate-900">
                    {sum.appointment_status || 'Not scheduled'}
                  </dd>
                </div>
              </dl>

              <div className="text-xs">
                <p className="font-semibold text-slate-700">Requirements</p>
                <p className="mt-1 text-slate-600">
                  {sum.requirements || 'No requirements recorded.'}
                </p>
              </div>

              <div className="rounded-lg border border-brand-100 bg-brand-50/50 p-3 text-xs">
                <p className="font-semibold text-brand-900">Recommended Next Action</p>
                <p className="mt-0.5 text-brand-800">
                  {sum.next_action || 'Follow up with prospect.'}
                </p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
