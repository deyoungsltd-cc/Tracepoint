'use client';

import { useAuthStore } from '@/lib/store/app';
import { Bell, LogOut, Search } from 'lucide-react';

interface AdminHeaderProps {
  title: string;
}

export function AdminHeader({ title }: AdminHeaderProps) {
  const { user, logout } = useAuthStore();

  return (
    <header className="h-12 border-b border-border flex items-center px-5 gap-4 shrink-0 bg-background">
      <h1 className="text-[14px] font-semibold tracking-wide text-foreground">
        {title}
      </h1>

      {user?.isDemo && (
        <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-accent text-[#c8a24e] border border-border">
          Demo
        </span>
      )}

      <div className="flex-1" />

      {/* Search */}
      <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-sidebar text-muted-foreground">
        <Search className="w-3.5 h-3.5" />
        <span className="text-[12px]">Search…</span>
      </div>

      {/* Notifications */}
      <button
        className="p-1.5 rounded-md transition-colors hover:text-foreground hover:bg-accent text-muted-foreground relative"
      >
        <Bell className="w-4 h-4" />
        <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#c8a24e]" />
      </button>

      {/* User info + logout */}
      {user && (
        <div className="flex items-center gap-3 pl-3 border-l border-border">
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-[12px] font-medium leading-tight text-foreground">
              {user.displayName}
            </span>
            <span className="text-[10px] uppercase tracking-wider font-medium leading-tight text-[#c8a24e]">
              {user.role}
            </span>
          </div>
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0 bg-accent text-[#c8a24e]">
            {user.displayName?.[0]?.toUpperCase() || 'A'}
          </div>
          <button
            onClick={logout}
            className="p-1.5 rounded-md transition-colors hover:text-foreground hover:bg-accent text-muted-foreground"
            title="Sign out"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </header>
  );
}
