import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  CalendarClock,
  CheckCircle2,
  FileText,
  Info,
  Mail,
  Phone,
  UserCheck,
} from 'lucide-react';
import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import {
  AppointmentStatusBadge,
  LeadCategoryBadge,
  SentimentBadge,
} from '../components/StatusBadge';
import { apiClient } from '../services/api';
import type { Lead, LeadDetails } from '../types';

export const LeadDetailsPage: React.FC = () => {
  const { leadId } = useParams<{ leadId?: string }>();
  const navigate = useNavigate();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [details, setDetails] = useState<LeadDetails | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const allLeads = await apiClient.getLeads();
        setLeads(allLeads);
        const targetId = leadId
          ? Number(leadId)
          : allLeads.length > 0
          ? allLeads[0].id
          : null;
        if (targetId && !Number.isNaN(targetId)) {
          const full = await apiClient.getLeadDetails(targetId);
          setDetails(full);
        } else {
          setDetails(null);
        }
      } catch (err) {
        setDetails(null);
        setError(err instanceof Error ? err.message : 'Unable to fetch lead profile.');
      } finally {
        setLoading(false);
      }
    };
    void fetchData();
  }, [leadId]);

  const lead = details?.lead || null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lead Details"
        description="360-degree prospect profile, explainable qualification breakdown, linked appointments, and call summaries."
        actions={
          <button
            type="button"
            onClick={() => navigate('/leads')}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Leads CRM
          </button>
        }
      />

      {leads.length > 0 && (
        <Card padding="sm" className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <label htmlFor="lead-selector" className="text-xs font-semibold text-slate-600">
              Select Prospect:
            </label>
            <select
              id="lead-selector"
              value={lead?.id ?? ''}
              onChange={(e) => navigate(`/lead-details/${e.target.value}`)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-900 focus:border-brand-500 focus:outline-none"
            >
              {leads.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name || `Lead #${l.id}`} — {l.company || 'Unknown Company'}
                </option>
              ))}
            </select>
          </div>
          {lead && (
            <button
              type="button"
              onClick={() => navigate('/appointments')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
            >
              <CalendarClock className="h-3.5 w-3.5" />
              Schedule Appointment
            </button>
          )}
        </Card>
      )}

      {error ? (
        <EmptyState
          icon={UserCheck}
          tone="warning"
          title="Lead profile unavailable"
          description={error}
        />
      ) : loading ? (
        <Card>
          <p className="text-sm text-slate-500">Loading prospect profile...</p>
        </Card>
      ) : !lead || !details ? (
        <EmptyState
          icon={UserCheck}
          title="No lead selected"
          description="Select a prospect from the Leads CRM or conduct a new AI Voice Agent session to generate a lead record."
          action={
            <button
              type="button"
              onClick={() => navigate('/leads')}
              className="rounded-lg bg-brand-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-brand-700"
            >
              Browse Leads CRM
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Contact & Objections */}
          <div className="space-y-4">
            <Card className="space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    {lead.name || 'Unnamed Prospect'}
                  </h2>
                  <p className="text-xs text-slate-500">Lead ID #{lead.id}</p>
                </div>
                <LeadCategoryBadge category={lead.lead_category} />
              </div>

              <div className="space-y-2.5 border-t border-slate-100 pt-4 text-xs text-slate-700">
                <div className="flex items-center gap-2.5">
                  <Building2 className="h-4 w-4 text-slate-400" />
                  <span>
                    {lead.company || 'Company unknown'}
                    {lead.company_size ? ` (${lead.company_size})` : ''}
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Mail className="h-4 w-4 text-slate-400" />
                  <span>{lead.email || 'No email recorded'}</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Phone className="h-4 w-4 text-slate-400" />
                  <span>{lead.phone || 'No phone recorded'}</span>
                </div>
              </div>
            </Card>

            <Card className="space-y-2.5">
              <h3 className="text-sm font-semibold text-slate-900">
                Recorded Objections & Urgency
              </h3>
              <p className="text-xs text-slate-600">
                Urgency: <span className="font-semibold text-slate-900">{lead.urgency || '—'}</span>
              </p>
              {lead.objections.length > 0 ? (
                <ul className="space-y-1.5">
                  {lead.objections.map((obj, idx) => (
                    <li
                      key={idx}
                      className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900"
                    >
                      {obj}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-400">No objections flagged.</p>
              )}
            </Card>
          </div>

          {/* Qualification, Appointments, Summaries */}
          <div className="space-y-6 lg:col-span-2">
            <Card className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">
                    Qualification & Requirements
                  </h3>
                  <p className="text-xs text-slate-500">
                    Extracted business needs and transparent scoring breakdown
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <SentimentBadge sentiment={lead.sentiment} />
                  <span className="font-mono text-lg font-bold text-slate-900 tabular-nums">
                    {lead.lead_score}/100
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 text-xs sm:grid-cols-3">
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <span className="text-slate-500">Product Interest</span>
                  <p className="mt-1 font-semibold text-slate-900">
                    {lead.product_interest || '—'}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <span className="text-slate-500">Stated Budget</span>
                  <p className="mt-1 font-semibold text-slate-900">{lead.budget || '—'}</p>
                </div>
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <span className="text-slate-500">Purchase Timeline</span>
                  <p className="mt-1 font-semibold text-slate-900">{lead.timeline || '—'}</p>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Captured Requirements
                </h4>
                <p className="mt-1.5 rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700">
                  {lead.requirements || 'No detailed requirements captured yet.'}
                </p>
              </div>

              {details.qualification_breakdown.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Score Breakdown
                  </h4>
                  <ul className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                    {details.qualification_breakdown.map((item, idx) => (
                      <li
                        key={idx}
                        className="flex items-center gap-2 rounded-md border border-slate-100 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-600">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                <span>{details.model_disclaimer}</span>
              </div>
            </Card>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Card>
                <div className="mb-3 flex items-center gap-2">
                  <CalendarClock className="h-4 w-4 text-brand-600" />
                  <h3 className="text-sm font-semibold text-slate-900">
                    Linked Appointments ({details.appointments.length})
                  </h3>
                </div>
                {details.appointments.length > 0 ? (
                  <div className="space-y-2">
                    {details.appointments.map((appt) => (
                      <div
                        key={appt.id}
                        className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-2.5 text-xs"
                      >
                        <div>
                          <p className="font-mono font-semibold text-slate-800">
                            {appt.scheduled_date} · {appt.scheduled_time}
                          </p>
                          <p className="text-slate-500">{appt.topic || 'Product Demo'}</p>
                        </div>
                        <AppointmentStatusBadge status={appt.status} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">No appointments booked yet.</p>
                )}
              </Card>

              <Card>
                <div className="mb-3 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-brand-600" />
                  <h3 className="text-sm font-semibold text-slate-900">
                    Call Summaries ({details.summaries.length})
                  </h3>
                </div>
                {details.summaries.length > 0 ? (
                  <div className="space-y-2">
                    {details.summaries.map((sum) => (
                      <div
                        key={sum.id}
                        className="rounded-lg border border-slate-100 bg-slate-50 p-2.5 text-xs"
                      >
                        <p className="font-semibold text-slate-800">
                          {sum.next_action || 'Follow up'}
                        </p>
                        <p className="mt-0.5 font-mono text-[11px] text-slate-500">
                          {new Date(sum.created_at).toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">No call summaries generated yet.</p>
                )}
              </Card>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
