import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  ArrowUpRight,
  AudioWaveform,
  BookOpen,
  CalendarCheck,
  Flame,
  MessageSquare,
  RefreshCw,
  TrendingUp,
  Users,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { MetricCard } from '../components/MetricCard';
import { PageHeader } from '../components/PageHeader';
import { SkeletonCard } from '../components/Skeleton';
import { apiClient } from '../services/api';
import type { AnalyticsOverview } from '../types';

export const OverviewPage: React.FC = () => {
  const navigate = useNavigate();
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadOverview = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.getAnalyticsOverview();
      setOverview(data);
    } catch (err) {
      setOverview(null);
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load workspace metrics from the backend service.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadOverview();
  }, []);

  const pipelineChartData = overview
    ? [
        { name: 'HOT', count: overview.hot_leads, color: '#10B981' },
        { name: 'WARM', count: overview.warm_leads, color: '#F59E0B' },
        { name: 'COLD', count: overview.cold_leads, color: '#0EA5E9' },
      ]
    : [];

  const hasPipelineRecords =
    overview !== null &&
    overview.hot_leads + overview.warm_leads + overview.cold_leads > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Revenue Operations"
        title="Command Center"
        description="Monitor live AI voice conversations, lead qualification velocity, and demo conversion metrics."
        actions={
          <>
            <button
              type="button"
              onClick={() => void loadOverview()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-xs font-medium text-zinc-700 shadow-card hover:bg-zinc-50 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => navigate('/voice-agent')}
              className="inline-flex items-center gap-2 rounded-xl bg-zinc-950 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-zinc-800"
            >
              <AudioWaveform className="h-3.5 w-3.5 text-indigo-400" />
              Open Voice Studio
            </button>
          </>
        }
      />

      {error && (
        <div className="flex flex-col justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50/90 px-5 py-3.5 text-sm text-amber-950 sm:flex-row sm:items-center">
          <div>
            <p className="font-semibold">Live backend metrics unavailable</p>
            <p className="text-xs text-amber-800">{error}</p>
          </div>
          <button
            type="button"
            onClick={() => void loadOverview()}
            className="shrink-0 rounded-xl border border-amber-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100"
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* Hero Bento Banner */}
      <Card
        variant="glass"
        className="flex flex-col justify-between gap-5 border-indigo-200/70 bg-gradient-to-r from-white via-indigo-50/35 to-violet-50/35 lg:flex-row lg:items-center"
      >
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-200/70">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-600" />
            Autonomous Sales Pipeline
          </div>
          <h2 className="font-display text-lg font-bold text-zinc-950">
            {overview && overview.total_leads > 0
              ? `${overview.total_leads} active lead${overview.total_leads === 1 ? '' : 's'} tracked across ${overview.total_conversations} session${overview.total_conversations === 1 ? '' : 's'}`
              : 'Ready to qualify inbound prospects in real time'}
          </h2>
          <p className="max-w-2xl text-xs leading-relaxed text-zinc-600">
            Launch Voice Studio to engage prospects over speech or text, retrieve grounded answers from your company Knowledge Base, score leads automatically, and book conflict-free demos.
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2.5">
          <button
            type="button"
            onClick={() => navigate('/leads')}
            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-800 shadow-card hover:bg-zinc-50"
          >
            <Users className="h-3.5 w-3.5 text-zinc-500" />
            View CRM
          </button>
          <button
            type="button"
            onClick={() => navigate('/knowledge-base')}
            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-800 shadow-card hover:bg-zinc-50"
          >
            <BookOpen className="h-3.5 w-3.5 text-indigo-600" />
            Knowledge Base
          </button>
        </div>
      </Card>

      {/* Studio KPI Grid */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Total Leads"
            value={overview ? overview.total_leads : '—'}
            sublabel={
              overview
                ? `${overview.total_conversations} conversation sessions`
                : 'Connect API to load CRM count'
            }
            icon={Users}
            accent="indigo"
          />
          <MetricCard
            label="Hot Prospects"
            value={overview ? overview.hot_leads : '—'}
            sublabel={
              overview
                ? `${overview.warm_leads} warm · ${overview.cold_leads} cold`
                : 'High-intent qualified leads'
            }
            icon={Flame}
            accent="emerald"
          />
          <MetricCard
            label="Confirmed Demos"
            value={overview ? overview.confirmed_appointments : '—'}
            sublabel={
              overview
                ? `${overview.total_appointments} total scheduled slots`
                : 'Synced with scheduling DB'
            }
            icon={CalendarCheck}
            accent="sky"
          />
          <MetricCard
            label="Avg Lead Score"
            value={overview ? `${overview.average_lead_score}/100` : '—'}
            sublabel={
              overview
                ? `${overview.conversion_rate}% demo conversion rate`
                : 'Explainable prototype rubric'
            }
            icon={TrendingUp}
            accent="amber"
          />
        </div>
      )}

      {/* Bento Visualization + Activity Feed */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-8">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="font-display text-base font-bold text-zinc-950">
                Pipeline Tier Distribution
              </h2>
              <p className="text-xs text-zinc-500">
                Database-calculated distribution across HOT, WARM, and COLD qualification tiers
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/analytics')}
              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-indigo-600 hover:bg-indigo-50"
            >
              Deep Analytics
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {hasPipelineRecords ? (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pipelineChartData} margin={{ top: 10, right: 16, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E4E4E7" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#71717A' }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#71717A' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    cursor={{ fill: '#F4F4F5' }}
                    contentStyle={{
                      borderRadius: '0.75rem',
                      border: '1px solid #E4E4E7',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="count" radius={[8, 8, 0, 0]} maxBarSize={64}>
                    {pipelineChartData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState
              icon={TrendingUp}
              title="No qualification records yet"
              description="Start a conversation in Voice Studio or add a CRM lead to see real-time tier distribution charts."
              action={
                <button
                  type="button"
                  onClick={() => navigate('/voice-agent')}
                  className="inline-flex items-center gap-2 rounded-xl bg-zinc-950 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800"
                >
                  <AudioWaveform className="h-3.5 w-3.5 text-indigo-400" />
                  Launch Voice Studio
                </button>
              }
            />
          )}
        </Card>

        <Card className="lg:col-span-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-display text-base font-bold text-zinc-950">
                Recent Activity
              </h2>
              <p className="text-xs text-zinc-500">Latest CRM & booking events</p>
            </div>
            <Activity className="h-4 w-4 text-zinc-400" />
          </div>

          {overview && overview.recent_activity.length > 0 ? (
            <div className="space-y-2.5">
              {overview.recent_activity.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-3 rounded-xl border border-zinc-100 bg-zinc-50/80 p-3"
                >
                  <span
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                      item.type === 'appointment' ? 'bg-emerald-500' : 'bg-indigo-500'
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-zinc-800">{item.description}</p>
                    <p className="mt-0.5 font-mono text-[10px] text-zinc-400">
                      {new Date(item.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={MessageSquare}
              title="No recent activity"
              description="Lead updates and booked appointments will stream here automatically."
            />
          )}
        </Card>
      </div>
    </div>
  );
};
