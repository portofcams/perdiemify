import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatSavings(amount: number): string {
  if (amount > 0) return `You pocket ${formatCurrency(amount)}`;
  if (amount < 0) return `${formatCurrency(Math.abs(amount))} over per diem`;
  return 'Breaks even';
}
