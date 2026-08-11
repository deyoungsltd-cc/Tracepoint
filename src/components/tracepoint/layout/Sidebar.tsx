'use client';

import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useNavStore, useAuthStore } from '@/lib/store/app';
import type { AppView } from '@/lib/types';
import {
  Radar, Search, Clock, Smartphone, Shield, Settings, FileText, LayoutDashboard,
  ChevronLeft, ChevronRight, LogOut, Crosshair, Database, Activity, Layers, Fingerprint, Eye,
} from 'lucide-react';

interface NavItem {
  view: AppView;
  label: string;
  icon: React.ElementType;
  adminOnly?: boolean;
}

const userNav: NavItem[] = [
  { view: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { view: 'investigation', label: 'Investigate', icon: Crosshair },
  { view: 'batch-lookup', label: 'Batch Lookup', icon: Layers },
  { view: 'history', label: 'History', icon: Clock },
  { view: 'watchlist', label: 'Watchlist', icon: Eye },
  { view: 'devices', label: 'Devices', icon: Smartphone },
  { view: 'device-fingerprint', label: 'Fingerprint', icon: Fingerprint },
  { view: 'reports', label: 'Reports', icon: FileText },
  { view: 'settings', label: 'Settings', icon: Settings },
];

const adminNav: NavItem[] = [
  { view: 'admin', label: 'Admin', icon: Shield, adminOnly: true },
];

export function Sidebar() {
   const { currentView, sidebarOpen, navigate, toggleSidebar } = useNavStore();
  const user = useAuthStore((s) => s.user);
  const router = useRouter();

  if (!user) return null;

  const items = user.role === 'admin' ? [...userNav, ...adminNav] : userNav;

  const handleNavClick = (view: AppView) => {
    if (view === 'admin') {
      router.push('/admin');
    } else {
      navigate(view);
    }
  };

  return (
    <aside
      className={cn(
        'h-screen flex flex-col border-r border-border bg-sidebar transition-all duration-200 shrink-0',
        sidebarOpen ? 'w-48' : 'w-11'
      )}
    >
      {/* Brand */}
      <div className="flex items-center gap-2 px-2.5 h-10 border-b border-border shrink-0">
        <div className="flex items-center justify-center w-6 h-6 rounded bg-[#c8a24e]/10 border border-[#c8a24e]/15 shrink-0">
          <Radar className="w-3 h-3 text-[#c8a24e]" />
        </div>
        {sidebarOpen && (
          <div className="flex flex-col min-w-0">
            <span className="text-[11px] font-semibold text-foreground tracking-wider leading-tight">TRACEPOINT</span>
            <span className="text-[8px] text-muted-foreground tracking-widest leading-tight">INTELLIGENCE</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-1.5 px-1 space-y-px overflow-y-auto">
        {items.map((item) => {
          const isActive = currentView === item.view;
          const Icon = item.icon;
          return (
            <button
              key={item.view}
              onClick={() => handleNavClick(item.view)}
              className={cn(
                'w-full flex items-center gap-2 px-2 py-1.5 rounded text-[11px] transition-all duration-150',
                isActive
                  ? 'bg-[#c8a24e]/8 text-[#c8a24e] border-l border-l-[#c8a24e]'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/60 border-l border-l-transparent'
              )}
              title={!sidebarOpen ? item.label : undefined}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              {sidebarOpen && <span className="font-medium">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-border p-1 space-y-px">
        {sidebarOpen && user.displayName && (
          <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-accent/40 mb-0.5">
            <div className="w-5 h-5 rounded bg-[#1f2420] border border-border flex items-center justify-center text-[9px] mono-value">
              {user.displayName[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="text-[10px] text-foreground truncate leading-tight font-medium">{user.displayName}</div>
              <div className="mono-label" style={{ fontSize: '0.5rem' }}>{user.role}</div>
            </div>
          </div>
        )}
        <button
          onClick={toggleSidebar}
          className="w-full flex items-center justify-center gap-1 px-2 py-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent/60 text-[10px] transition-colors"
        >
          {sidebarOpen ? <ChevronLeft className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          {sidebarOpen && <span className="mono-label" style={{ fontSize: '0.5rem' }}>COLLAPSE</span>}
        </button>
      </div>
    </aside>
  );
}
