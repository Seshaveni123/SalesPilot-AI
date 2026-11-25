import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  variant?: 'default' | 'elevated' | 'glass' | 'subtle';
}

const paddingMap = {
  none: '',
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-6',
};

const variantMap = {
  default: 'border border-zinc-200/80 bg-white shadow-card',
  elevated: 'border border-zinc-200/80 bg-white shadow-elevated',
  glass: 'border border-zinc-200/70 bg-white/80 backdrop-blur-md shadow-card',
  subtle: 'border border-zinc-200/70 bg-zinc-50/70',
};

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  padding = 'md',
  variant = 'default',
}) => {
  return (
    <div
      className={`rounded-2xl ${variantMap[variant]} ${paddingMap[padding]} ${className}`}
    >
      {children}
    </div>
  );
};
