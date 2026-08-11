'use client';

import { useNavStore, useAuthStore, useInvestigationStore } from '@/lib/store/app';
import { Globe, Map, List, FileSearch, Bell, Menu, LogOut, Radio } from 'lucide-react';
import type { ViewMode } from '@/lib/types';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/tracepoint/shared/ThemeToggle';

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
  'batch-lookup': 'Batch Lookup',
  history: 'History',
  devices: 'Devices',
  'device-fingerprint': 'Device Fingerprint',
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
    <header className="h-10 border-b border-border bg-background/80 backdrop-blur-sm flex items-center px-3 gap-2.5 shrink-0">
      <button onClick={toggleSidebar} className="lg:hidden p-1 rounded hover:bg-accent text-muted-foreground transition-colors">
        <Menu className="w-3.5 h-3.5" />
      </button>

      {/* Status indicator */}
      <div className="flex items-center gap-1.5">
        <Radio className="w-3 h-3 text-[#4a9e5a] opacity-60" />
        <span className="mono-label" style={{ fontSize: '0.5625rem' }}>TRACEPOINT</span>
      </div>

      <div className="w-px h-4 bg-border" />

      <h1 className="text-[12px] font-medium text-foreground tracking-wide">{titles[currentView] || 'Tracepoint'}</h1>

      {isRunning && progress && (
        <div className="hidden sm:flex items-center gap-2 ml-1">
          <div className="progress-track w-20">
            <div className="progress-fill" style={{ width: `${progress.progress}%` }} />
          </div>
          <span className="mono-value text-[10px]">{progress.progress}%</span>
        </div>
      )}

      <div className="flex-1" />

      {showViews && (
        <div className="hidden md:flex items-center gap-px bg-accent/60 rounded p-0.5">
          {views.map(({ mode, label, icon: Icon }) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={cn(
                'flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-all duration-150',
                viewMode === mode
                  ? 'bg-[#c8a24e]/10 text-[#c8a24e] shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="w-3 h-3" />
              <span className="hidden lg:inline">{label}</span>
            </button>
          ))}
        </div>
      )}

      <ThemeToggle />

      <button className="p-1 rounded hover:bg-accent text-muted-foreground relative transition-colors">
        <Bell className="w-3.5 h-3.5" />
        <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-[#c8a24e] rounded-full" />
      </button>

      <button onClick={logout} className="p-1 rounded hover:bg-accent text-muted-foreground transition-colors" title="Sign out">
        <LogOut className="w-3.5 h-3.5" />
      </button>
    </header>
  );
}