import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Columns3,
  Plus,
  RefreshCw,
  Search,
  TableProperties,
  Users,
  X,
} from 'lucide-react';
import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { ScoreRing } from '../components/ScoreRing';
import { LeadCategoryBadge, SentimentBadge } from '../components/StatusBadge';
import { apiClient } from '../services/api';
import type { Lead, LeadCategory } from '../types';

const FILTER_OPTIONS: Array<'ALL' | LeadCategory> = ['ALL', 'HOT', 'WARM', 'COLD'];

export const LeadsPage: React.FC = () => {
  const navigate = useNavigate();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | LeadCategory>('ALL');
  const [viewMode, setViewMode] = useState<'table' | 'board'>('table');
  const [drawerLead, setDrawerLead] = useState<Lead | null>(null);

  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formState, setFormState] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    company_size: '',
    product_interest: '',
    budget: '',
    timeline: '',
    requirements: '',
  });

  const loadLeads = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.getLeads();
      setLeads(data);
    } catch (err) {
      setLeads([]);
      setError(err instanceof Error ? err.message : 'Unable to load leads.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadLeads();
  }, []);

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.name.trim() && !formState.company.trim() && !formState.email.trim()) {
      setFormError('Provide at least a prospect name, email, or company name.');
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      const created = await apiClient.createLead({
        name: formState.name.trim() || undefined,
        email: formState.email.trim() || undefined,
        phone: formState.phone.trim() || undefined,
        company: formState.company.trim() || undefined,
        company_size: formState.company_size.trim() || undefined,
        product_interest: formState.product_interest.trim() || undefined,
        budget: formState.budget.trim() || undefined,
        timeline: formState.timeline.trim() || undefined,
        requirements: formState.requirements.trim() || undefined,
      });
      setShowCreateModal(false);
      setFormState({
        name: '',
        email: '',
        phone: '',
        company: '',
        company_size: '',
        product_interest: '',
        budget: '',
        timeline: '',
        requirements: '',
      });
      await loadLeads();
      navigate(`/lead-details/${created.id}`);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create lead.');
    } finally {
      setSaving(false);
    }
  };

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      const matchesCategory =
        categoryFilter === 'ALL' || lead.lead_category === categoryFilter;
      const q = searchQuery.trim().toLowerCase();
      if (!q) return matchesCategory;
      const haystack = [
        lead.name,
        lead.company,
        lead.email,
        lead.product_interest,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return matchesCategory && haystack.includes(q);
    });
  }, [leads, searchQuery, categoryFilter]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Revenue CRM"
        title="Leads Pipeline"
        description="Inspect qualified prospects, prototype qualification scores, and captured business requirements."
        actions={
          <>
            <button
              type="button"
              onClick={() => void loadLeads()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-xs font-medium text-zinc-700 shadow-card hover:bg-zinc-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Sync CRM
            </button>
            <button
              type="button"
              onClick={() => {
                setFormError(null);
                setShowCreateModal(true);
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-zinc-950 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-zinc-800"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Lead
            </button>
          </>
        }
      />

      {/* Filter & View Switch Toolbar */}
      <Card padding="sm" className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative flex-1 md:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search leads, companies, plans..."
            className="w-full rounded-xl border border-zinc-200 bg-zinc-50/70 py-2 pl-9 pr-3 text-sm text-zinc-950 placeholder-zinc-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1 rounded-xl bg-zinc-100 p-1">
            {FILTER_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setCategoryFilter(opt)}
                className={`rounded-lg px-3 py-1 text-xs font-semibold transition-all ${
                  categoryFilter === opt
                    ? 'bg-white text-zinc-950 shadow-sm'
                    : 'text-zinc-600 hover:text-zinc-950'
                }`}
              >
                {opt === 'ALL' ? 'All Tiers' : opt}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 rounded-xl bg-zinc-100 p-1">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium ${
                viewMode === 'table'
                  ? 'bg-white text-zinc-950 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-900'
              }`}
            >
              <TableProperties className="h-3.5 w-3.5" />
              Table
            </button>
            <button
              type="button"
              onClick={() => setViewMode('board')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium ${
                viewMode === 'board'
                  ? 'bg-white text-zinc-950 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-900'
              }`}
            >
              <Columns3 className="h-3.5 w-3.5" />
              Board
            </button>
          </div>
        </div>
      </Card>

      {error ? (
        <EmptyState
          icon={Users}
          tone="warning"
          title="Unable to load CRM leads"
          description={error}
          action={
            <button
              type="button"
              onClick={() => void loadLeads()}
              className="rounded-xl bg-zinc-950 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800"
            >
              Retry
            </button>
          }
        />
      ) : filteredLeads.length === 0 ? (
        <EmptyState
          icon={Users}
          title={leads.length === 0 ? 'No leads captured yet' : 'No matching leads'}
          description={
            leads.length === 0
              ? 'Prospects engaged via Voice Studio or added manually will populate your CRM pipeline.'
              : 'Try adjusting your search keywords or tier filter.'
          }
        />
      ) : viewMode === 'table' ? (
        <Card padding="none" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50/80 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-5 py-3.5">Prospect & Company</th>
                  <th className="px-5 py-3.5">Product Interest</th>
                  <th className="px-5 py-3.5">Budget & Timeline</th>
                  <th className="px-5 py-3.5">Score & Tier</th>
                  <th className="px-5 py-3.5">Sentiment</th>
                  <th className="px-5 py-3.5 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filteredLeads.map((lead) => (
                  <tr
                    key={lead.id}
                    onClick={() => setDrawerLead(lead)}
                    className="cursor-pointer transition-colors hover:bg-indigo-50/35"
                  >
                    <td className="px-5 py-4">
                      <p className="font-semibold text-zinc-950">
                        {lead.name || `Prospect #${lead.id}`}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {lead.company || lead.company_size || 'Company pending'}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-xs font-medium text-zinc-700">
                      {lead.product_interest || '—'}
                    </td>
                    <td className="px-5 py-4 text-xs">
                      <p className="font-medium text-zinc-900">{lead.budget || '—'}</p>
                      <p className="text-zinc-500">{lead.timeline || 'Timeline pending'}</p>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono text-xs font-bold text-zinc-950 tabular-nums">
                          {lead.lead_score}
                        </span>
                        <LeadCategoryBadge category={lead.lead_category} />
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <SentimentBadge sentiment={lead.sentiment} />
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/lead-details/${lead.id}`);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-indigo-600 hover:bg-indigo-50"
                      >
                        Dossier <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {(['HOT', 'WARM', 'COLD'] as const).map((tier) => {
            const tierLeads = filteredLeads.filter((l) => l.lead_category === tier);
            return (
              <Card key={tier} padding="sm" variant="subtle" className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <LeadCategoryBadge category={tier} />
                  <span className="font-mono text-xs font-semibold text-zinc-500">
                    {tierLeads.length}
                  </span>
                </div>
                {tierLeads.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-zinc-200 bg-white/60 p-4 text-center text-xs text-zinc-400">
                    No {tier} leads
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {tierLeads.map((lead) => (
                      <button
                        key={lead.id}
                        type="button"
                        onClick={() => setDrawerLead(lead)}
                        className="w-full rounded-xl border border-zinc-200/80 bg-white p-3.5 text-left shadow-card transition-all hover:border-indigo-300"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-sm text-zinc-950">
                            {lead.name || `Prospect #${lead.id}`}
                          </span>
                          <span className="font-mono text-xs font-bold text-zinc-700">
                            {lead.lead_score}/100
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-zinc-500">
                          {lead.company || lead.company_size || 'Company pending'}
                        </p>
                        <div className="mt-2.5 flex items-center justify-between text-[11px]">
                          <span className="truncate font-medium text-indigo-700">
                            {lead.product_interest || 'General Inquiry'}
                          </span>
                          <SentimentBadge sentiment={lead.sentiment} />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Quick Inspector Slide-Over Drawer */}
      {drawerLead && (
        <div className="fixed inset-0 z-50 flex justify-end bg-zinc-950/35 backdrop-blur-xs">
          <div className="flex h-full w-full max-w-md flex-col border-l border-zinc-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between border-b border-zinc-100 pb-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-600">
                  Lead Quick View · #{drawerLead.id}
                </p>
                <h2 className="mt-0.5 font-display text-lg font-bold text-zinc-950">
                  {drawerLead.name || `Prospect #${drawerLead.id}`}
                </h2>
                <p className="text-xs text-zinc-500">
                  {drawerLead.company || drawerLead.company_size || 'Company pending'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDrawerLead(null)}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto py-5">
              <div className="flex items-center justify-between rounded-2xl bg-zinc-50 p-4 ring-1 ring-inset ring-zinc-200/70">
                <div className="space-y-1.5">
                  <LeadCategoryBadge category={drawerLead.lead_category} />
                  <div>
                    <SentimentBadge sentiment={drawerLead.sentiment} />
                  </div>
                </div>
                <ScoreRing
                  score={drawerLead.lead_score}
                  category={drawerLead.lead_category}
                />
              </div>

              <dl className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl border border-zinc-200/80 p-3">
                  <dt className="text-zinc-400">Product Interest</dt>
                  <dd className="mt-1 font-semibold text-zinc-900">
                    {drawerLead.product_interest || '—'}
                  </dd>
                </div>
                <div className="rounded-xl border border-zinc-200/80 p-3">
                  <dt className="text-zinc-400">Budget</dt>
                  <dd className="mt-1 font-semibold text-zinc-900">
                    {drawerLead.budget || '—'}
                  </dd>
                </div>
                <div className="rounded-xl border border-zinc-200/80 p-3">
                  <dt className="text-zinc-400">Timeline</dt>
                  <dd className="mt-1 font-semibold text-zinc-900">
                    {drawerLead.timeline || '—'}
                  </dd>
                </div>
                <div className="rounded-xl border border-zinc-200/80 p-3">
                  <dt className="text-zinc-400">Email</dt>
                  <dd className="mt-1 truncate font-semibold text-zinc-900">
                    {drawerLead.email || '—'}
                  </dd>
                </div>
              </dl>

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                  Requirements
                </p>
                <p className="mt-1.5 rounded-xl bg-zinc-50 p-3 text-xs leading-relaxed text-zinc-700">
                  {drawerLead.requirements || 'No detailed requirements captured yet.'}
                </p>
              </div>
            </div>

            <div className="flex gap-2.5 border-t border-zinc-100 pt-4">
              <button
                type="button"
                onClick={() => navigate(`/lead-details/${drawerLead.id}`)}
                className="flex-1 rounded-xl bg-zinc-950 px-4 py-2.5 text-xs font-semibold text-white hover:bg-zinc-800"
              >
                Open Full Dossier
              </button>
              <button
                type="button"
                onClick={() => navigate('/appointments')}
                className="rounded-xl border border-zinc-200 px-4 py-2.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
              >
                Book Demo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Lead Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/45 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-6 shadow-elevated">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-base font-bold text-zinc-950">
                Add New CRM Lead
              </h2>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={(e) => void handleCreateLead(e)} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-medium text-zinc-700">Full Name</label>
                  <input
                    type="text"
                    value={formState.name}
                    onChange={(e) => setFormState((s) => ({ ...s, name: e.target.value }))}
                    placeholder="e.g. Ananya Sharma"
                    className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-medium text-zinc-700">Email</label>
                  <input
                    type="email"
                    value={formState.email}
                    onChange={(e) => setFormState((s) => ({ ...s, email: e.target.value }))}
                    placeholder="ananya@company.com"
                    className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-medium text-zinc-700">Phone</label>
                  <input
                    type="text"
                    value={formState.phone}
                    onChange={(e) => setFormState((s) => ({ ...s, phone: e.target.value }))}
                    placeholder="+1 555-0199"
                    className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-medium text-zinc-700">Company</label>
                  <input
                    type="text"
                    value={formState.company}
                    onChange={(e) => setFormState((s) => ({ ...s, company: e.target.value }))}
                    placeholder="Acme Corp"
                    className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-medium text-zinc-700">Company Size</label>
                  <input
                    type="text"
                    value={formState.company_size}
                    onChange={(e) =>
                      setFormState((s) => ({ ...s, company_size: e.target.value }))
                    }
                    placeholder="50 employees"
                    className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-medium text-zinc-700">Product Interest</label>
                  <input
                    type="text"
                    value={formState.product_interest}
                    onChange={(e) =>
                      setFormState((s) => ({ ...s, product_interest: e.target.value }))
                    }
                    placeholder="Growth Plan"
                    className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-medium text-zinc-700">Budget</label>
                  <input
                    type="text"
                    value={formState.budget}
                    onChange={(e) => setFormState((s) => ({ ...s, budget: e.target.value }))}
                    placeholder="$899/month"
                    className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-medium text-zinc-700">Timeline</label>
                  <input
                    type="text"
                    value={formState.timeline}
                    onChange={(e) =>
                      setFormState((s) => ({ ...s, timeline: e.target.value }))
                    }
                    placeholder="This quarter"
                    className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block font-medium text-zinc-700">Requirements</label>
                <textarea
                  rows={2}
                  value={formState.requirements}
                  onChange={(e) =>
                    setFormState((s) => ({ ...s, requirements: e.target.value }))
                  }
                  placeholder="Describe prospect goals and integration requirements..."
                  className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                />
              </div>

              {formError && <p className="text-xs font-medium text-rose-600">{formError}</p>}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-xl border border-zinc-200 px-3.5 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-zinc-950 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save & Score Lead'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
