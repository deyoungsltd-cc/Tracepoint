'use client';

import { useAuthStore } from '@/lib/store/app';
import { Bell, LogOut, Search } from 'lucide-react';

interface AdminHeaderProps {
  title: string;
}

export function AdminHeader({ title }: AdminHeaderProps) {
  const { user, logout } = useAuthStore();

  return (
    <header
      className="h-12 border-b flex items-center px-5 gap-4 shrink-0"
      style={{
        background: '#f8f8f6',
        borderColor: '#d4d4d0',
      }}
    >
      <h1 className="text-[14px] font-semibold tracking-wide" style={{ color: '#1a1a1a' }}>
        {title}
      </h1>

      {user?.isDemo && (
        <span
          className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded"
          style={{
            background: 'rgba(180, 83, 9, 0.08)',
            color: '#b45309',
            border: '1px solid rgba(180, 83, 9, 0.15)',
          }}
        >
          Demo
        </span>
      )}

      <div className="flex-1" />

      {/* Search */}
      <div
        className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-md border"
        style={{
          background: '#f3f3f0',
          borderColor: '#d4d4d0',
          color: '#6b6b6b',
        }}
      >
        <Search className="w-3.5 h-3.5" />
        <span className="text-[12px]">Search…</span>
      </div>

      {/* Notifications */}
      <button
        className="p-1.5 rounded-md transition-colors hover:bg-white/80 relative"
        style={{ color: '#525252' }}
      >
        <Bell className="w-4 h-4" />
        <span
          className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full"
          style={{ background: '#b45309' }}
        />
      </button>

      {/* User info + logout */}
      {user && (
        <div className="flex items-center gap-3 pl-3 border-l" style={{ borderColor: '#d4d4d0' }}>
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-[12px] font-medium leading-tight" style={{ color: '#1a1a1a' }}>
              {user.displayName}
            </span>
            <span
              className="text-[10px] uppercase tracking-wider font-medium leading-tight"
              style={{ color: '#b45309' }}
            >
              {user.role}
            </span>
          </div>
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0"
            style={{ background: 'rgba(180, 83, 9, 0.08)', color: '#b45309' }}
          >
            {user.displayName?.[0]?.toUpperCase() || 'A'}
          </div>
          <button
            onClick={logout}
            className="p-1.5 rounded-md transition-colors hover:bg-white/80"
            style={{ color: '#6b6b6b' }}
            title="Sign out"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </header>
  );
}
