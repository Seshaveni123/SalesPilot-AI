import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
  tone?: 'neutral' | 'warning' | 'error';
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  action,
  tone = 'neutral',
}) => {
  const iconTone =
    tone === 'error'
      ? 'bg-rose-50 text-rose-600 ring-rose-200/70'
      : tone === 'warning'
      ? 'bg-amber-50 text-amber-600 ring-amber-200/70'
      : 'bg-zinc-100 text-zinc-500 ring-zinc-200/80';

  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/50 px-6 py-12 text-center">
      <div
        className={`mb-3.5 flex h-11 w-11 items-center justify-center rounded-xl ring-1 ring-inset ${iconTone}`}
      >
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="font-display text-sm font-semibold text-zinc-900">{title}</h3>
      <p className="mt-1.5 max-w-md text-xs leading-relaxed text-zinc-500">
        {description}
      </p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
};
