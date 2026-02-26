'use client';

import type { PerDiemBadge as BadgeType } from '@/types';
import { cn } from '@/lib/utils';

interface Props {
  badge: BadgeType;
  delta: number;
  size?: 'sm' | 'md' | 'lg';
}

const badgeConfig = {
  under: {
    bg: 'bg-green-50',
    border: 'border-green-200',
    text: 'text-green-700',
    icon: '🟢',
    label: 'Under Budget',
  },
  near: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-700',
    icon: '🟡',
    label: 'Near Limit',
  },
  over: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-700',
    icon: '🔴',
    label: 'Over Budget',
  },
};

export function PerDiemBadge({ badge, delta, size = 'md' }: Props) {
  const config = badgeConfig[badge];

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-1.5 text-base',
  };

  const deltaSign = delta >= 0 ? '+' : '';
  const deltaFormatted = `${deltaSign}$${Math.abs(delta).toFixed(0)}`;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border font-semibold',
        config.bg,
        config.border,
        config.text,
        sizeClasses[size]
      )}
    >
      <span>{config.icon}</span>
      <span>{deltaFormatted}</span>
    </span>
  );
}
