'use client';

import { useState } from 'react';
import { useAdminStore, useAuthStore, useNavStore } from '@/lib/store/app';
import { cn } from '@/lib/utils';
import {
  Shield, Users, Activity, Server, Flag, Smartphone,
  ChevronLeft, ArrowLeft, AlertTriangle, CheckCircle, XCircle, Clock,
} from 'lucide-react';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { listAllUsers } from '@/lib/supabase/data';
import { useEffect } from 'react';

type AdminTab = 'overview' | 'users' | 'providers' | 'security' | 'audit' | 'features';

const tabs: Array<{ id: AdminTab; label: string; icon: React.ElementType }> = [
  { id: 'overview', label: 'Overview', icon: Activity },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'providers', label: 'Providers', icon: Server },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'audit', label: 'Audit', icon: Clock },
  { id: 'features', label: 'Features', icon: Flag },
];

export default function AdminView() {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const user = useAuthStore((s) => s.user);
  const { navigate } = useNavStore();
  const { providers, securityEvents, auditEvents, featureFlags } = useAdminStore();

  if (!user || user.role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-muted-foreground">Access denied. Admin role required.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-[#0d0f0e]">
      {/* Admin sidebar — own layout, own visual language */}
      <aside className="w-48 border-r border-[#1e2120] bg-[#111312] flex flex-col shrink-0">
        <div className="flex items-center gap-2 px-3 h-11 border-b border-[#1e2120]">
          <Shield className="w-3.5 h-3.5 text-[#c8a24e]" />
          <span className="text-xs font-medium text-foreground">Administration</span>
        </div>
        <nav className="flex-1 py-1.5 px-1.5 space-y-0.5">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'w-full flex items-center gap-2 px-2 py-1.5 rounded text-[12px] transition-colors',
                  activeTab === tab.id
                    ? 'bg-[#c8a24e]/8 text-[#c8a24e]'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </nav>
        <div className="p-2 border-t border-[#1e2120]">
          <button
            onClick={() => navigate('dashboard')}
            className="w-full flex items-center gap-1.5 px-2 py-1 rounded text-[11px] text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <ArrowLeft className="w-3 h-3" />
            Back to App
          </button>
        </div>
      </aside>

      {/* Admin content */}
      <main className="flex-1 overflow-y-auto p-4">
        {activeTab === 'overview' && <AdminOverview />}
        {activeTab === 'users' && <AdminUsers />}
        {activeTab === 'providers' && <AdminProviders />}
        {activeTab === 'security' && <AdminSecurity />}
        {activeTab === 'audit' && <AdminAudit />}
        {activeTab === 'features' && <AdminFeatures />}
      </main>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-[#181b19] border border-[#2a2e2a] rounded p-3">
      <div className="text-[10px] text-muted-foreground font-mono uppercase tracking-wide">{label}</div>
      <div className="text-xl font-semibold text-foreground font-mono mt-0.5">{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

function AdminOverview() {
  const { providers, securityEvents, auditEvents, featureFlags } = useAdminStore();
  const healthy = providers.filter((p) => p.health === 'healthy').length;
  const enabled = providers.filter((p) => p.isEnabled).length;
  const unresolved = securityEvents.filter((e) => !e.resolved).length;

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-medium text-foreground">System Overview</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Providers" value={`${healthy}/${providers.length}`} sub={`${enabled} enabled`} />
        <Stat label="Security Events" value={securityEvents.length} sub={`${unresolved} unresolved`} />
        <Stat label="Audit Entries" value={auditEvents.length} />
        <Stat label="Features" value={`${featureFlags.filter((f) => f.isEnabled).length}/${featureFlags.length}`} sub="active" />
      </div>

      {/* DB Status */}
      <div className="bg-[#181b19] border border-[#2a2e2a] rounded p-4">
        <h3 className="text-xs font-medium text-foreground mb-3">Infrastructure</h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Database (Supabase)</span>
            <span className={isSupabaseConfigured() ? 'text-[#4a9e5a]' : 'text-[#c8a24e]'}>
              {isSupabaseConfigured() ? 'Connected' : 'Not configured'}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Authentication</span>
            <span className={isSupabaseConfigured() ? 'text-[#4a9e5a]' : 'text-[#c8a24e]'}>
              {isSupabaseConfigured() ? 'Active (Email + Google OAuth)' : 'Demo mode only'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminUsers() {
  return (
    <div className="space-y-4">
      <h2 className="text-sm font-medium text-foreground">User Management</h2>
      <div className="bg-[#181b19] border border-[#2a2e2a] rounded p-4">
        <p className="text-xs text-muted-foreground">
          {isSupabaseConfigured()
            ? 'Users are managed through Supabase Auth. Visit your Supabase dashboard to manage users, roles, and permissions.'
            : 'Configure Supabase to enable user management.'}
        </p>
      </div>
    </div>
  );
}

function AdminProviders() {
  const { providers } = useAdminStore();
  return (
    <div className="space-y-4">
      <h2 className="text-sm font-medium text-foreground">Provider Status</h2>
      <div className="space-y-2">
        {providers.map((p) => (
          <div key={p.name} className="bg-[#181b19] border border-[#2a2e2a] rounded p-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full ${
                p.health === 'healthy' ? 'bg-[#4a9e5a]' :
                p.health === 'degraded' ? 'bg-[#c8a24e]' :
                p.health === 'down' ? 'bg-[#c44040]' : 'bg-muted-foreground/30'
              }`} />
              <div>
                <div className="text-xs text-foreground">{p.name}</div>
                <div className="source-badge mt-0.5">{p.category}</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {p.latencyMs && <span className="mono-label text-[10px]">{p.latencyMs}ms</span>}
              <span className={`text-[10px] font-mono uppercase ${p.isEnabled ? 'text-[#4a9e5a]' : 'text-muted-foreground/40'}`}>
                {p.isEnabled ? 'on' : 'off'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AdminSecurity() {
  const { securityEvents } = useAdminStore();
  const severityColors: Record<string, string> = { low: 'text-muted-foreground', medium: 'text-[#c8a24e]', high: 'text-[#c44040]', critical: 'text-[#c44040] pulse-dot' };
  return (
    <div className="space-y-4">
      <h2 className="text-sm font-medium text-foreground">Security Events</h2>
      {securityEvents.length === 0 ? (
        <div className="bg-[#181b19] border border-[#2a2e2a] rounded p-6 text-center">
          <Shield className="w-6 h-6 text-muted-foreground/20 mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">No security events</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {securityEvents.map((e) => (
            <div key={e.id} className={`bg-[#181b19] border border-[#2a2e2a] rounded p-3 ${!e.resolved ? 'border-l-2 border-l-[#c44040]' : ''}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={severityColors[e.severity] || 'text-muted-foreground'}>
                    {e.severity === 'critical' || e.severity === 'high' ? <XCircle className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                  </span>
                  <span className="text-xs text-foreground font-mono">{e.eventType}</span>
                </div>
                <span className="text-[10px] text-muted-foreground">{new Date(e.createdAt).toLocaleString()}</span>
              </div>
              {e.details && <p className="text-[11px] text-muted-foreground mt-1.5">{e.details}</p>}
              {e.ip && <p className="mono-label text-[9px] mt-1">IP: {e.ip}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AdminAudit() {
  const { auditEvents } = useAdminStore();
  return (
    <div className="space-y-4">
      <h2 className="text-sm font-medium text-foreground">Audit Log</h2>
      <div className="bg-[#181b19] border border-[#2a2e2a] rounded overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[#2a2e2a]">
              <th className="text-left px-3 py-2 mono-label text-[9px] font-medium">Time</th>
              <th className="text-left px-3 py-2 mono-label text-[9px] font-medium">Action</th>
              <th className="text-left px-3 py-2 mono-label text-[9px] font-medium">Resource</th>
              <th className="text-left px-3 py-2 mono-label text-[9px] font-medium">Details</th>
            </tr>
          </thead>
          <tbody>
            {auditEvents.map((e) => (
              <tr key={e.id} className="border-b border-[#2a2e2a]/50 hover:bg-accent/50">
                <td className="px-3 py-2 mono-label text-[10px] whitespace-nowrap">{new Date(e.createdAt).toLocaleString()}</td>
                <td className="px-3 py-2"><span className="source-badge">{e.action}</span></td>
                <td className="px-3 py-2 text-muted-foreground font-mono text-[11px]">{e.resource || '—'}</td>
                <td className="px-3 py-2 text-muted-foreground max-w-[250px] truncate">{e.details || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AdminFeatures() {
  const { featureFlags } = useAdminStore();
  return (
    <div className="space-y-4">
      <h2 className="text-sm font-medium text-foreground">Feature Flags</h2>
      <div className="space-y-1.5">
        {featureFlags.map((f) => (
          <div key={f.key} className="bg-[#181b19] border border-[#2a2e2a] rounded p-3 flex items-center justify-between">
            <div>
              <div className="text-xs text-foreground font-mono">{f.key}</div>
              {f.config && <div className="text-[10px] text-muted-foreground mt-0.5 font-mono">{JSON.stringify(f.config)}</div>}
            </div>
            <div className={`w-2 h-2 rounded-full ${f.isEnabled ? 'bg-[#4a9e5a]' : 'bg-muted-foreground/30'}`} />
          </div>
        ))}
      </div>
    </div>
  );
}
