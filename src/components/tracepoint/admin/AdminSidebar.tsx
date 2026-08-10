'use client';

import { cn } from '@/lib/utils';
import {
  Shield,
  LayoutDashboard,
  Server,
  ShieldAlert,
  ScrollText,
  ToggleLeft,
  Smartphone,
  Users,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Settings,
} from 'lucide-react';

type AdminPage = 'overview' | 'providers' | 'security' | 'audit' | 'features' | 'devices' | 'settings';

interface AdminNav {
  id: AdminPage;
  label: string;
  icon: React.ElementType;
}

const adminNavItems: AdminNav[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'providers', label: 'Providers', icon: Server },
  { id: 'security', label: 'Security', icon: ShieldAlert },
  { id: 'audit', label: 'Audit Log', icon: ScrollText },
  { id: 'features', label: 'Features', icon: ToggleLeft },
  { id: 'devices', label: 'Devices', icon: Smartphone },
  { id: 'settings', label: 'Settings', icon: Settings },
];

interface AdminSidebarProps {
  activePage: AdminPage;
  onPageChange: (page: AdminPage) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onBackToApp: () => void;
}

export function AdminSidebar({
  activePage,
  onPageChange,
  collapsed,
  onToggleCollapse,
  onBackToApp,
}: AdminSidebarProps) {
  return (
    <aside
      className={cn(
        'h-screen flex flex-col border-r border-border transition-all duration-200 shrink-0 bg-sidebar',
        collapsed ? 'w-14' : 'w-56'
      )}
    >
      {/* Brand header */}
      <div className="flex items-center gap-2.5 px-3 h-12 border-b border-border shrink-0">
        <div className="flex items-center justify-center w-7 h-7 rounded shrink-0 bg-accent">
          <Shield className="w-3.5 h-3.5 text-[#c8a24e]" />
        </div>
        {!collapsed && (
          <div className="flex flex-col min-w-0">
            <span className="text-[13px] font-semibold tracking-wide leading-tight text-foreground">
              Tracepoint
            </span>
            <span className="text-[10px] font-medium uppercase tracking-widest text-[#c8a24e]">
              Admin
            </span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        {adminNavItems.map((item) => {
          const isActive = activePage === item.id;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              onClick={() => onPageChange(item.id)}
              className={cn(
                'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] transition-all duration-150',
                isActive
                  ? 'font-medium bg-accent text-[#c8a24e] [box-shadow:inset_3px_0_0_#c8a24e]'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-2 space-y-1 border-t border-border">
        {!collapsed && (
          <button
            onClick={onBackToApp}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[12px] transition-colors text-muted-foreground hover:text-foreground hover:bg-accent"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to App
          </button>
        )}
        <button
          onClick={onToggleCollapse}
          className="w-full flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-[11px] transition-colors text-muted-foreground hover:text-foreground hover:bg-accent"
        >
          {collapsed ? (
            <ChevronRight className="w-3.5 h-3.5" />
          ) : (
            <>
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
