import React from 'react';
import type { LeadCategory } from '../types';

interface ScoreRingProps {
  score: number | null | undefined;
  category: LeadCategory | null | undefined;
  size?: number;
}

export const ScoreRing: React.FC<ScoreRingProps> = ({
  score,
  category,
  size = 76,
}) => {
  const numericScore = typeof score === 'number' ? Math.max(0, Math.min(100, score)) : 0;
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (numericScore / 100) * circumference;

  const strokeColor =
    category === 'HOT'
      ? '#10B981'
      : category === 'WARM'
      ? '#F59E0B'
      : category === 'COLD'
      ? '#0EA5E9'
      : '#A1A1AA';

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#F4F4F5"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={score !== null && score !== undefined ? offset : circumference}
          className="transition-all duration-500 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-base font-bold text-zinc-950 tabular-nums">
          {score !== null && score !== undefined ? score : '—'}
        </span>
        <span className="text-[9px] font-semibold uppercase tracking-wider text-zinc-400">
          Score
        </span>
      </div>
    </div>
  );
};
