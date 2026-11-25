import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  CalendarCheck,
  MessageSquareText,
  RefreshCw,
  TrendingUp,
  Users,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { MetricCard } from '../components/MetricCard';
import { PageHeader } from '../components/PageHeader';
import { ScoreRing } from '../components/ScoreRing';
import { SkeletonCard } from '../components/Skeleton';
import { apiClient } from '../services/api';
import type { AnalyticsOverview } from '../types';

export const AnalyticsPage: React.FC = () => {
  const [data, setData] = useState<AnalyticsOverview | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const overview = await apiClient.getAnalyticsOverview();
      setData(overview);
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : 'Unable to load analytics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAnalytics();
  }, []);

  const tierData = data
    ? [
        { name: 'HOT', value: data.hot_leads, color: '#10B981' },
        { name: 'WARM', value: data.warm_leads, color: '#F59E0B' },
        { name: 'COLD', value: data.cold_leads, color: '#0EA5E9' },
      ]
    : [];

  const sentimentData = data
    ? [
        {
          name: 'Positive',
          value: data.sentiment_distribution.positive,
          color: '#10B981',
        },
        {
          name: 'Neutral',
          value: data.sentiment_distribution.neutral,
          color: '#71717A',
        },
        {
          name: 'Negative',
          value: data.sentiment_distribution.negative,
          color: '#F43F5E',
        },
      ]
    : [];

  const hasLeads = data !== null && data.total_leads > 0;
  const totalSentiment = data
    ? data.sentiment_distribution.positive +
      data.sentiment_distribution.neutral +
      data.sentiment_distribution.negative
    : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Executive Telemetry"
        title="Business Analytics"
        description="Real-time pipeline conversion rates, lead tier distributions, and text sentiment breakdowns calculated directly from SQLite."
        actions={
          <button
            type="button"
            onClick={() => void loadAnalytics()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-xs font-medium text-zinc-700 shadow-card hover:bg-zinc-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Recalculate
          </button>
        }
      />

      {error ? (
        <EmptyState
          icon={BarChart3}
          tone="warning"
          title="Analytics service unavailable"
          description={error}
        />
      ) : loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label="Total Pipeline Leads"
              value={data ? data.total_leads : '—'}
              sublabel="Stored in CRM database"
              icon={Users}
              accent="indigo"
            />
            <MetricCard
              label="Total Conversations"
              value={data ? data.total_conversations : '—'}
              sublabel="Multi-turn voice & text sessions"
              icon={MessageSquareText}
              accent="sky"
            />
            <MetricCard
              label="Confirmed Demos"
              value={data ? data.confirmed_appointments : '—'}
              sublabel={`${data?.total_appointments ?? 0} total bookings`}
              icon={CalendarCheck}
              accent="emerald"
            />
            <MetricCard
              label="Demo Conversion Rate"
              value={data ? `${data.conversion_rate}%` : '—'}
              sublabel="Confirmed demos / total leads"
              icon={TrendingUp}
              accent="amber"
            />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <Card className="lg:col-span-5">
              <h2 className="font-display text-base font-bold text-zinc-950">
                Lead Tier Distribution
              </h2>
              <p className="mb-4 text-xs text-zinc-500">
                Calculated from stored qualification scores
              </p>
              {hasLeads ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={tierData} margin={{ top: 10, right: 12, left: -16, bottom: 0 }}>
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
                      <Bar dataKey="value" radius={[8, 8, 0, 0]} maxBarSize={56}>
                        {tierData.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState
                  icon={BarChart3}
                  title="No lead records to chart"
                  description="Analytics charts populate strictly from persisted database records."
                />
              )}
            </Card>

            <Card className="lg:col-span-4">
              <h2 className="font-display text-base font-bold text-zinc-950">
                Text Sentiment Breakdown
              </h2>
              <p className="mb-4 text-xs text-zinc-500">
                Aggregated across analyzed customer transcripts
              </p>
              {totalSentiment > 0 ? (
                <div className="space-y-4">
                  <div className="h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={sentimentData}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={52}
                          outerRadius={80}
                          paddingAngle={4}
                        >
                          {sentimentData.map((entry) => (
                            <Cell key={entry.name} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    {sentimentData.map((item) => (
                      <div key={item.name} className="rounded-xl bg-zinc-50 p-2 ring-1 ring-inset ring-zinc-200/70">
                        <span className="block text-[10px] font-medium text-zinc-500">
                          {item.name}
                        </span>
                        <span className="font-mono text-sm font-bold text-zinc-950">
                          {item.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <EmptyState
                  icon={BarChart3}
                  title="No sentiment assessments yet"
                  description="Sentiment distributions appear once conversations are analyzed."
                />
              )}
            </Card>

            <Card className="flex flex-col justify-between lg:col-span-3">
              <div>
                <h2 className="font-display text-base font-bold text-zinc-950">
                  Average Score
                </h2>
                <p className="text-xs text-zinc-500">
                  Mean prototype score across all leads
                </p>
              </div>
              <div className="my-6 flex flex-col items-center justify-center">
                <ScoreRing
                  score={data ? Math.round(data.average_lead_score) : null}
                  category={
                    data && data.average_lead_score >= 70
                      ? 'HOT'
                      : data && data.average_lead_score >= 40
                      ? 'WARM'
                      : 'COLD'
                  }
                  size={112}
                />
              </div>
              <p className="rounded-xl bg-zinc-50 p-3 text-[11px] leading-relaxed text-zinc-500 ring-1 ring-inset ring-zinc-200/70">
                All KPIs and charts compute directly from SQLite database rows with zero fabricated data.
              </p>
            </Card>
          </div>
        </>
      )}
    </div>
  );
};
