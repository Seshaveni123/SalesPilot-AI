import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { Card } from './Card';

interface MetricCardProps {
  label: string;
  value: string | number;
  sublabel?: string;
  icon: LucideIcon;
  accent?: 'indigo' | 'emerald' | 'amber' | 'sky' | 'zinc';
}

const accentStyles = {
  indigo: 'bg-indigo-50 text-indigo-600 ring-indigo-200/60',
  emerald: 'bg-emerald-50 text-emerald-600 ring-emerald-200/60',
  amber: 'bg-amber-50 text-amber-600 ring-amber-200/60',
  sky: 'bg-sky-50 text-sky-600 ring-sky-200/60',
  zinc: 'bg-zinc-100 text-zinc-700 ring-zinc-200/80',
};

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  sublabel,
  icon: Icon,
  accent = 'indigo',
}) => {
  return (
    <Card className="group relative overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:border-zinc-300/90 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            {label}
          </p>
          <p className="mt-2.5 font-display text-3xl font-bold tracking-tight text-zinc-950 tabular-nums">
            {value}
          </p>
          {sublabel && (
            <p className="mt-1.5 truncate text-xs text-zinc-500">{sublabel}</p>
          )}
        </div>
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset transition-transform duration-200 group-hover:scale-105 ${accentStyles[accent]}`}
        >
          <Icon className="h-4.5 w-4.5" />
        </div>
      </div>
    </Card>
  );
};
