import React from 'react';
import type { AppointmentStatus, LeadCategory, SentimentLabel } from '../types';

export const LeadCategoryBadge: React.FC<{ category: LeadCategory | null | undefined }> = ({
  category,
}) => {
  if (!category) {
    return (
      <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-0.5 text-[11px] font-semibold text-zinc-600 ring-1 ring-inset ring-zinc-200/80">
        Unscored
      </span>
    );
  }

  const styles: Record<LeadCategory, string> = {
    HOT: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    WARM: 'bg-amber-50 text-amber-700 ring-amber-200',
    COLD: 'bg-sky-50 text-sky-700 ring-sky-200',
    UNQUALIFIED: 'bg-zinc-100 text-zinc-600 ring-zinc-200',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${styles[category]}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          category === 'HOT'
            ? 'bg-emerald-500'
            : category === 'WARM'
            ? 'bg-amber-500'
            : category === 'COLD'
            ? 'bg-sky-500'
            : 'bg-zinc-400'
        }`}
      />
      {category}
    </span>
  );
};

export const SentimentBadge: React.FC<{ sentiment: SentimentLabel | null | undefined }> = ({
  sentiment,
}) => {
  if (!sentiment) {
    return <span className="text-xs text-zinc-400">—</span>;
  }

  const styles: Record<SentimentLabel, string> = {
    Positive: 'bg-emerald-50 text-emerald-700 ring-emerald-200/80',
    Neutral: 'bg-zinc-100 text-zinc-700 ring-zinc-200/80',
    Negative: 'bg-rose-50 text-rose-700 ring-rose-200/80',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ring-inset ${styles[sentiment]}`}
    >
      {sentiment}
    </span>
  );
};

export const AppointmentStatusBadge: React.FC<{ status: AppointmentStatus }> = ({
  status,
}) => {
  const styles: Record<AppointmentStatus, string> = {
    Confirmed: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
    Completed: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    Cancelled: 'bg-rose-50 text-rose-700 ring-rose-200',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${styles[status]}`}
    >
      {status}
    </span>
  );
};
