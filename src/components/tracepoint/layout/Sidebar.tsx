'use client';

import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useNavStore, useAuthStore } from '@/lib/store/app';
import type { AppView } from '@/lib/types';
import {
  Radar, Search, Clock, Smartphone, Shield, Settings, FileText, LayoutDashboard,
  ChevronLeft, ChevronRight, LogOut, Crosshair, Users, Database, AlertTriangle, Activity,
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
  { view: 'history', label: 'History', icon: Clock },
  { view: 'devices', label: 'Devices', icon: Smartphone },
  { view: 'reports', label: 'Reports', icon: FileText },
  { view: 'settings', label: 'Settings', icon: Settings },
];

const adminNav: NavItem[] = [
  { view: 'admin', label: 'Admin Panel', icon: Shield, adminOnly: true },
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
        sidebarOpen ? 'w-52' : 'w-12'
      )}
    >
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-3 h-12 border-b border-border shrink-0">
        <div className="flex items-center justify-center w-7 h-7 rounded bg-[#c8a24e]/10 shrink-0">
          <Radar className="w-3.5 h-3.5 text-[#c8a24e]" />
        </div>
        {sidebarOpen && (
          <span className="text-[13px] font-semibold text-foreground tracking-wide">Tracepoint</span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-2 px-1.5 space-y-0.5 overflow-y-auto">
        {items.map((item) => {
          const isActive = currentView === item.view;
          const Icon = item.icon;
          return (
            <button
              key={item.view}
              onClick={() => handleNavClick(item.view)}
              className={cn(
                'w-full flex items-center gap-2.5 px-2 py-1.5 rounded text-[13px] transition-colors',
                isActive
                  ? 'bg-[#c8a24e]/8 text-[#c8a24e]'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              )}
              title={!sidebarOpen ? item.label : undefined}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {sidebarOpen && <span>{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-border p-1.5 space-y-0.5">
        {sidebarOpen && user.displayName && (
          <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-accent mb-1">
            <div className="w-5 h-5 rounded-full bg-[#252925] flex items-center justify-center text-[10px] mono-value">
              {user.displayName[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="text-[11px] text-foreground truncate leading-tight">{user.displayName}</div>
              <div className="mono-label text-[9px] leading-tight">{user.role}</div>
            </div>
          </div>
        )}
        <button
          onClick={toggleSidebar}
          className="w-full flex items-center justify-center gap-1 px-2 py-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent text-[11px] transition-colors"
        >
          {sidebarOpen ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          {sidebarOpen && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
