'use client';

import Link from 'next/link';
import { UserButton } from '@clerk/nextjs';
import { Menu } from 'lucide-react';

interface DashboardHeaderProps {
  onMenuClick: () => void;
}

export function DashboardHeader({ onMenuClick }: DashboardHeaderProps) {
  return (
    <header className="sticky top-0 z-30 bg-white border-b border-gray-100 lg:hidden">
      <div className="h-16 flex items-center justify-between px-4">
        <button
          onClick={onMenuClick}
          className="p-2 -ml-2 rounded-xl text-gray-600 hover:bg-gray-100 transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>

        <Link href="/" className="text-lg font-extrabold tracking-tight">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand-500 to-brand-700">
            Perdiemify
          </span>
        </Link>

        <UserButton afterSignOutUrl="/" />
      </div>
    </header>
  );
}
