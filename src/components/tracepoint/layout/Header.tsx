'use client';

import { useNavStore, useAuthStore, useInvestigationStore } from '@/lib/store/app';
import {
  Globe, Map, List, FileSearch, Bell, Menu, LogOut, AlertTriangle,
} from 'lucide-react';
import type { ViewMode } from '@/lib/types';
import { cn } from '@/lib/utils';

const viewModes: Array<{ mode: ViewMode; label: string; icon: React.ElementType }> = [
  { mode: 'globe', label: '3D Command', icon: Globe },
  { mode: 'map2d', label: '2D Map', icon: Map },
  { mode: 'list', label: 'List', icon: List },
  { mode: 'evidence', label: 'Evidence', icon: FileSearch },
];

export function Header() {
  const { currentView, viewMode, setViewMode, toggleSidebar } = useNavStore();
  const { user, logout } = useAuthStore();
  const { isRunning, progress } = useInvestigationStore();

  if (!user) return null;

  const viewLabels: Record<string, string> = {
    dashboard: 'Command Center',
    investigation: 'Investigation Workspace',
    'investigation-detail': 'Investigation Detail',
    history: 'Investigation History',
    devices: 'Device Authorizations',
    admin: 'System Administration',
    settings: 'Platform Settings',
    reports: 'Reports',
  };

  const showViewSwitcher = ['dashboard', 'investigation-detail'].includes(currentView);

  return (
    <header className="sticky top-0 z-30 h-14 border-b border-tp-border bg-background/80 backdrop-blur-sm flex items-center px-4 gap-4">
      {/* Mobile menu toggle */}
      <button
        onClick={toggleSidebar}
        className="lg:hidden p-1.5 rounded hover:bg-tp-surface-hover text-tp-text-dim"
      >
        <Menu className="w-4 h-4" />
      </button>

      {/* View title */}
      <div className="flex items-center gap-2">
        <h1 className="text-sm font-semibold text-tp-text tracking-wide">
          {viewLabels[currentView] || 'Tracepoint'}
        </h1>
        {user.isDemo && (
          <span className="tp-source-tag bg-tp-amber/10 border border-tp-amber/20 text-tp-amber">
            DEMO
          </span>
        )}
      </div>

      {/* Progress bar when running */}
      {isRunning && progress && (
        <div className="flex items-center gap-3 ml-4">
          <div className="tp-progress-track w-32">
            <div className="tp-progress-fill" style={{ width: `${progress.progress}%` }} />
          </div>
          <span className="tp-hud text-tp-amber">
            {progress.progress}%
          </span>
          <span className="text-xs text-tp-text-dim max-w-[200px] truncate hidden sm:block">
            {progress.message}
          </span>
        </div>
      )}

      <div className="flex-1" />

      {/* View mode switcher */}
      {showViewSwitcher && (
        <div className="hidden md:flex items-center gap-0.5 bg-tp-surface rounded p-0.5">
          {viewModes.map(({ mode, label, icon: Icon }) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-colors',
                viewMode === mode
                  ? 'bg-tp-amber/15 text-tp-amber'
                  : 'text-tp-text-dim hover:text-tp-text'
              )}
              title={label}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">{label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Right actions */}
      <div className="flex items-center gap-1">
        <button className="p-1.5 rounded hover:bg-tp-surface-hover text-tp-text-dim relative">
          <Bell className="w-4 h-4" />
          <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-tp-amber rounded-full" />
        </button>

        {user.isDemo && (
          <div className="flex items-center gap-1 px-2 py-1 rounded bg-tp-amber/5 border border-tp-amber/20">
            <AlertTriangle className="w-3 h-3 text-tp-amber" />
            <span className="text-[10px] font-mono text-tp-amber uppercase tracking-wider">Demo Mode</span>
          </div>
        )}

        <button
          onClick={logout}
          className="p-1.5 rounded hover:bg-tp-surface-hover text-tp-text-dim"
          title="Sign out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
