import React from 'react';

export const SkeletonLine: React.FC<{ className?: string }> = ({ className = 'h-4 w-full' }) => (
  <div className={`animate-pulse rounded-md bg-zinc-200/70 ${className}`} />
);

export const SkeletonCard: React.FC = () => (
  <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-card space-y-3">
    <SkeletonLine className="h-3 w-24" />
    <SkeletonLine className="h-7 w-16" />
    <SkeletonLine className="h-3 w-40" />
  </div>
);
