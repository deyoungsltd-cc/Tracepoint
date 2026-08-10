'use client';

import { useNavStore, useAuthStore, useInvestigationStore } from '@/lib/store/app';
import { Globe, Map, List, FileSearch, Bell, Menu, LogOut } from 'lucide-react';
import type { ViewMode } from '@/lib/types';
import { cn } from '@/lib/utils';

const views: Array<{ mode: ViewMode; label: string; icon: React.ElementType }> = [
  { mode: 'globe', label: 'Globe', icon: Globe },
  { mode: 'map2d', label: 'Map', icon: Map },
  { mode: 'list', label: 'List', icon: List },
  { mode: 'evidence', label: 'Evidence', icon: FileSearch },
];

const titles: Record<string, string> = {
  dashboard: 'Dashboard',
  investigation: 'Investigate',
  'investigation-detail': 'Investigation',
  history: 'History',
  devices: 'Devices',
  admin: 'Administration',
  settings: 'Settings',
  reports: 'Reports',
};

export function Header() {
  const { currentView, viewMode, setViewMode, toggleSidebar } = useNavStore();
  const { user, logout } = useAuthStore();
  const { isRunning, progress } = useInvestigationStore();

  if (!user) return null;

  const showViews = ['dashboard', 'investigation-detail'].includes(currentView);

  return (
    <header className="h-11 border-b border-border bg-background flex items-center px-3 gap-3 shrink-0">
      <button onClick={toggleSidebar} className="lg:hidden p-1 rounded hover:bg-accent text-muted-foreground">
        <Menu className="w-4 h-4" />
      </button>

      <h1 className="text-[13px] font-medium text-foreground">{titles[currentView] || 'Tracepoint'}</h1>

      {user.isDemo && (
        <span className="source-badge bg-[#c8a24e]/8 text-[#c8a24e]">DEMO</span>
      )}

      {isRunning && progress && (
        <div className="hidden sm:flex items-center gap-2 ml-2">
          <div className="progress-track w-24">
            <div className="progress-fill" style={{ width: `${progress.progress}%` }} />
          </div>
          <span className="mono-value text-xs">{progress.progress}%</span>
        </div>
      )}

      <div className="flex-1" />

      {showViews && (
        <div className="hidden md:flex items-center gap-0.5 bg-accent rounded p-0.5">
          {views.map(({ mode, label, icon: Icon }) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={cn(
                'flex items-center gap-1 px-2 py-1 rounded text-[11px] transition-colors',
                viewMode === mode ? 'bg-[#c8a24e]/10 text-[#c8a24e]' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="w-3 h-3" />
              <span className="hidden lg:inline">{label}</span>
            </button>
          ))}
        </div>
      )}

      <button className="p-1.5 rounded hover:bg-accent text-muted-foreground relative">
        <Bell className="w-3.5 h-3.5" />
        <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-[#c8a24e] rounded-full" />
      </button>

      <button onClick={logout} className="p-1.5 rounded hover:bg-accent text-muted-foreground" title="Sign out">
        <LogOut className="w-3.5 h-3.5" />
      </button>
    </header>
  );
}