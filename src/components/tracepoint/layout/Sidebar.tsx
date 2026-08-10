'use client';

import { cn } from '@/lib/utils';
import { useNavStore, useAuthStore } from '@/lib/store/app';
import type { AppView } from '@/lib/types';
import {
  Radar,
  Search,
  Clock,
  Smartphone,
  Shield,
  Settings,
  FileText,
  LayoutDashboard,
  ChevronLeft,
  ChevronRight,
  Crosshair,
} from 'lucide-react';

interface NavItem {
  view: AppView;
  label: string;
  icon: React.ElementType;
  badge?: number;
}

const navItems: NavItem[] = [
  { view: 'dashboard', label: 'Command', icon: LayoutDashboard },
  { view: 'investigation', label: 'Investigate', icon: Crosshair },
  { view: 'history', label: 'History', icon: Clock },
  { view: 'devices', label: 'Devices', icon: Smartphone },
  { view: 'reports', label: 'Reports', icon: FileText },
  { view: 'admin', label: 'Admin', icon: Shield },
  { view: 'settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const { currentView, sidebarOpen, navigate, toggleSidebar } = useNavStore();
  const user = useAuthStore((s) => s.user);

  if (!user) return null;

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen flex flex-col border-r border-tp-border bg-sidebar transition-all duration-300',
        sidebarOpen ? 'w-56' : 'w-14'
      )}
    >
      {/* Logo area */}
      <div className="flex items-center gap-3 border-b border-tp-border px-3 h-14">
        <div className="flex items-center justify-center w-8 h-8 rounded bg-tp-amber/10 border border-tp-amber/30">
          <Radar className="w-4 h-4 text-tp-amber" />
        </div>
        {sidebarOpen && (
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-tp-amber tracking-wider uppercase">Tracepoint</span>
            <span className="text-[10px] text-tp-text-dim tracking-widest uppercase">Intelligence Platform</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-2 px-2 space-y-0.5">
        {navItems.map((item) => {
          const isActive = currentView === item.view;
          const Icon = item.icon;
          return (
            <button
              key={item.view}
              onClick={() => navigate(item.view)}
              className={cn(
                'w-full flex items-center gap-3 px-2.5 py-2 rounded text-sm transition-colors relative',
                isActive
                  ? 'bg-tp-amber/10 text-tp-amber'
                  : 'text-tp-text-dim hover:text-tp-text hover:bg-tp-surface-hover'
              )}
              title={!sidebarOpen ? item.label : undefined}
            >
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-tp-amber rounded-r" />
              )}
              <Icon className="w-4 h-4 flex-shrink-0" />
              {sidebarOpen && <span className="truncate">{item.label}</span>}
              {sidebarOpen && item.badge && (
                <span className="ml-auto text-[10px] font-mono bg-tp-amber/20 text-tp-amber px-1.5 py-0.5 rounded">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* User info + collapse */}
      <div className="border-t border-tp-border p-2 space-y-1">
        {sidebarOpen && (
          <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-tp-surface">
            <div className="w-6 h-6 rounded-full bg-tp-olive flex items-center justify-center text-[10px] font-mono text-tp-amber">
              {user.displayName?.[0] || user.email[0].toUpperCase()}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs text-tp-text truncate">{user.displayName || 'Analyst'}</span>
              <span className="text-[10px] text-tp-text-dim truncate font-mono uppercase">{user.role}</span>
            </div>
          </div>
        )}
        <button
          onClick={toggleSidebar}
          className="w-full flex items-center justify-center gap-1 px-2 py-1.5 rounded text-tp-text-dim hover:text-tp-text hover:bg-tp-surface-hover text-xs transition-colors"
        >
          {sidebarOpen ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          {sidebarOpen && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
