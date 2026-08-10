'use client';

import { useAdminNavStore } from '@/lib/store/admin-nav';
import { useAdminStore } from '@/lib/store/app';
import { cn } from '@/lib/utils';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import {
  Activity,
  Server,
  Shield,
  ScrollText,
  ToggleLeft,
  Smartphone,
  Users,
  Settings,
  CheckCircle,
  XCircle,
  AlertTriangle,
  MinusCircle,
  Clock,
  Plus,
  Bell,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// --- Helpers ---

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' });
  const time = d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  return `${date} ${time}`;
}

function formatTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function healthColor(health: string): string {
  switch (health) {
    case 'healthy': return 'bg-green-500';
    case 'degraded': return 'bg-amber-500';
    case 'down': return 'bg-red-500';
    default: return 'bg-gray-400';
  }
}

function healthGlow(health: string): string {
  switch (health) {
    case 'healthy': return 'shadow-[0_0_6px_rgba(34,197,94,0.5)]';
    case 'degraded': return 'shadow-[0_0_6px_rgba(245,158,11,0.5)]';
    case 'down': return 'shadow-[0_0_6px_rgba(239,68,68,0.5)]';
    default: return '';
  }
}

// --- Reusable light-themed card ---

function AdminCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn('rounded-lg border p-4', className)}
      style={{
        background: '#f8f8f6',
        borderColor: '#d4d4d0',
      }}
    >
      {children}
    </div>
  );
}

function StatCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: boolean }) {
  return (
    <AdminCard>
      <div className="text-[11px] font-medium uppercase tracking-wider" style={{ color: '#6b6b6b' }}>
        {label}
      </div>
      <div
        className={cn(
          'text-2xl font-semibold mt-1',
          accent ? 'font-mono' : ''
        )}
        style={{ color: '#1a1a1a' }}
      >
        {value}
      </div>
      {sub && (
        <div className="text-[11px] mt-1" style={{ color: '#6b6b6b' }}>
          {sub}
        </div>
      )}
    </AdminCard>
  );
}

// --- Empty State ---

function EmptyState({ icon: Icon, title, description, action }: {
  icon: React.ElementType;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="admin-surface rounded-lg p-10 flex flex-col items-center justify-center text-center gap-3">
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center"
        style={{ background: 'rgba(180, 83, 9, 0.06)', border: '1px solid rgba(180, 83, 9, 0.12)' }}
      >
        <Icon className="w-5 h-5" style={{ color: '#b45309' }} />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium" style={{ color: '#1a1a1a' }}>{title}</p>
        <p className="text-xs" style={{ color: '#6b6b6b' }}>{description}</p>
      </div>
      {action && (
        <Button
          variant="outline"
          size="sm"
          className="mt-2"
          style={{
            borderColor: '#d4d4d0',
            color: '#b45309',
          }}
          onClick={action.onClick}
        >
          <Plus className="w-4 h-4 mr-1.5" />
          {action.label}
        </Button>
      )}
    </div>
  );
}

// --- Page Components ---

function OverviewPage() {
  const { providers, securityEvents, auditEvents, featureFlags } = useAdminStore();
  const healthy = providers.filter((p) => p.health === 'healthy').length;
  const enabled = providers.filter((p) => p.isEnabled).length;
  const unresolved = securityEvents.filter((e) => !e.resolved).length;

  return (
    <div className="space-y-5">
      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Providers"
          value={`${healthy}/${providers.length}`}
          sub={`${enabled} enabled`}
          accent
        />
        <StatCard
          label="Security Events"
          value={securityEvents.length}
          sub={`${unresolved} unresolved`}
        />
        <StatCard
          label="Audit Entries"
          value={auditEvents.length}
          sub="total logged"
        />
        <StatCard
          label="Feature Flags"
          value={`${featureFlags.filter((f) => f.isEnabled).length}/${featureFlags.length}`}
          sub="active"
        />
      </div>

      {/* Infrastructure */}
      <AdminCard>
        <h3 className="text-sm font-semibold mb-4" style={{ color: '#1a1a1a' }}>Infrastructure Status</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4" style={{ color: '#6b6b6b' }} />
              <span className="text-sm" style={{ color: '#1a1a1a' }}>Database (Supabase)</span>
            </div>
            <span className={cn('text-xs font-medium px-2.5 py-0.5 rounded-full', isSupabaseConfigured()
              ? 'text-green-700 bg-green-50 border border-green-200'
              : 'text-amber-700 bg-amber-50 border border-amber-200'
            )}>
              {isSupabaseConfigured() ? 'Connected' : 'Not configured'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4" style={{ color: '#6b6b6b' }} />
              <span className="text-sm" style={{ color: '#1a1a1a' }}>Authentication</span>
            </div>
            <span className={cn('text-xs font-medium px-2.5 py-0.5 rounded-full', isSupabaseConfigured()
              ? 'text-green-700 bg-green-50 border border-green-200'
              : 'text-amber-700 bg-amber-50 border border-amber-200'
            )}>
              {isSupabaseConfigured() ? 'Active (Email + Google OAuth)' : 'Demo mode only'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4" style={{ color: '#6b6b6b' }} />
              <span className="text-sm" style={{ color: '#1a1a1a' }}>System Health</span>
            </div>
            <span className="text-xs font-medium px-2.5 py-0.5 rounded-full text-green-700 bg-green-50 border border-green-200">
              Operational
            </span>
          </div>
        </div>
      </AdminCard>

      {/* Recent activity */}
      <AdminCard>
        <h3 className="text-sm font-semibold mb-3" style={{ color: '#1a1a1a' }}>Recent Activity</h3>
        <div className="space-y-2">
          {auditEvents.slice(0, 5).map((evt) => (
            <div key={evt.id} className="flex items-center justify-between py-2 border-b last:border-b-0" style={{ borderColor: '#e8e8e4' }}>
              <div className="flex items-center gap-3">
                <span
                  className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded"
                  style={{ background: 'rgba(180, 83, 9, 0.06)', color: '#b45309' }}
                >
                  {evt.action}
                </span>
                <span className="text-sm" style={{ color: '#1a1a1a' }}>{evt.details || '—'}</span>
              </div>
              <span className="text-[11px] font-mono shrink-0 ml-4" style={{ color: '#6b6b6b' }}>
                {formatDateTime(evt.createdAt)}
              </span>
            </div>
          ))}
          {auditEvents.length === 0 && (
            <p className="text-xs text-center py-4" style={{ color: '#6b6b6b' }}>No recent activity</p>
          )}
        </div>
      </AdminCard>
    </div>
  );
}

function ProvidersPage() {
  const { providers } = useAdminStore();

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {providers.map((p) => (
          <AdminCard key={p.name} className="flex items-center gap-4 py-3">
            {/* Health indicator */}
            <div className="flex flex-col items-center gap-1.5 min-w-[4rem]">
              <div
                className={cn('w-2.5 h-2.5 rounded-full', healthColor(p.health), healthGlow(p.health))}
              />
              <span className="text-[10px] uppercase tracking-wider font-medium" style={{ color: '#6b6b6b' }}>
                {p.health}
              </span>
            </div>

            {/* Provider info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2.5">
                <span className="text-sm font-medium" style={{ color: '#1a1a1a' }}>{p.name}</span>
                <span
                  className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded"
                  style={{ background: 'rgba(180, 83, 9, 0.06)', color: '#b45309' }}
                >
                  {p.category}
                </span>
              </div>
              <div className="flex items-center gap-4 mt-1.5">
                <span className="flex items-center gap-1.5 text-[11px]" style={{ color: '#6b6b6b' }}>
                  <Clock className="w-3 h-3" />
                  {formatTime(p.lastChecked)}
                </span>
                {p.latencyMs !== null && (
                  <span className="flex items-center gap-1.5 text-[11px] font-mono" style={{ color: '#6b6b6b' }}>
                    <Activity className="w-3 h-3" />
                    <span style={{ color: p.latencyMs > 500 ? '#dc2626' : p.latencyMs > 300 ? '#d97706' : '#16a34a' }}>
                      {p.latencyMs}ms
                    </span>
                  </span>
                )}
              </div>
            </div>

            {/* Toggle */}
            <div className="flex items-center gap-3">
              <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: p.isEnabled ? '#16a34a' : '#6b6b6b' }}>
                {p.isEnabled ? 'Enabled' : 'Disabled'}
              </span>
              <Switch
                checked={p.isEnabled}
                onCheckedChange={() => {}}
              />
            </div>
          </AdminCard>
        ))}
      </div>
    </div>
  );
}

function SecurityPage() {
  const { securityEvents } = useAdminStore();

  if (securityEvents.length === 0) {
    return <EmptyState icon={Shield} title="No security events" description="All clear — no security events recorded." />;
  }

  return (
    <div className="space-y-3">
      {securityEvents.map((evt) => (
        <AdminCard
          key={evt.id}
          className={cn('py-3', !evt.resolved && 'border-l-2')}
          style={{
            background: '#f8f8f6',
            borderColor: !evt.resolved ? '#dc2626' : '#d4d4d0',
          }}
        >
          <div className="flex items-start gap-4">
            {/* Severity icon */}
            <div className="pt-0.5">
              {evt.severity === 'critical' ? (
                <XCircle className="w-5 h-5 text-red-500" />
              ) : evt.severity === 'high' ? (
                <XCircle className="w-5 h-5 text-red-500" />
              ) : evt.severity === 'medium' ? (
                <AlertTriangle className="w-5 h-5 text-amber-500" />
              ) : (
                <MinusCircle className="w-5 h-5 text-gray-400" />
              )}
            </div>

            {/* Event details */}
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium" style={{ color: '#1a1a1a' }}>
                  {evt.eventType.replace(/_/g, ' ').toUpperCase()}
                </span>
                <span
                  className={cn(
                    'text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded',
                    evt.severity === 'low' && 'bg-gray-100 text-gray-600',
                    evt.severity === 'medium' && 'bg-amber-50 text-amber-700 border border-amber-200',
                    evt.severity === 'high' && 'bg-red-50 text-red-700 border border-red-200',
                    evt.severity === 'critical' && 'bg-red-100 text-red-700 border border-red-300',
                  )}
                >
                  {evt.severity.toUpperCase()}
                </span>
              </div>
              {evt.details && (
                <p className="text-xs leading-relaxed" style={{ color: '#6b6b6b' }}>{evt.details}</p>
              )}
              <div className="flex items-center gap-4">
                {evt.ip && (
                  <span className="flex items-center gap-1 text-[11px] font-mono" style={{ color: '#6b6b6b' }}>
                    <Activity className="w-3 h-3" />
                    {evt.ip}
                  </span>
                )}
                <span className="flex items-center gap-1 text-[11px]" style={{ color: '#6b6b6b' }}>
                  <Clock className="w-3 h-3" />
                  {formatDateTime(evt.createdAt)}
                </span>
              </div>
            </div>

            {/* Resolve toggle */}
            <div className="flex flex-col items-center gap-1.5 pt-0.5">
              <Switch checked={evt.resolved} onCheckedChange={() => {}} />
              <span
                className="text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: evt.resolved ? '#16a34a' : '#dc2626' }}
              >
                {evt.resolved ? 'Resolved' : 'Open'}
              </span>
            </div>
          </div>
        </AdminCard>
      ))}
    </div>
  );
}

function AuditPage() {
  const { auditEvents } = useAdminStore();

  if (auditEvents.length === 0) {
    return <EmptyState icon={ScrollText} title="No audit events" description="Audit logging will record all administrative actions here." />;
  }

  return (
    <AdminCard className="p-0 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow style={{ borderColor: '#d4d4d0' }}>
            <TableHead className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#b45309' }}>
              Timestamp
            </TableHead>
            <TableHead className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#b45309' }}>
              Action
            </TableHead>
            <TableHead className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#b45309' }}>
              Resource
            </TableHead>
            <TableHead className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#b45309' }}>
              User
            </TableHead>
            <TableHead className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#b45309' }}>
              Details
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {auditEvents.map((evt) => (
            <TableRow
              key={evt.id}
              className="transition-colors hover:bg-white/60"
              style={{ borderColor: '#e8e8e4' }}
            >
              <TableCell className="font-mono text-[11px]" style={{ color: '#6b6b6b' }}>
                {formatDateTime(evt.createdAt)}
              </TableCell>
              <TableCell>
                <span
                  className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded"
                  style={{ background: 'rgba(180, 83, 9, 0.06)', color: '#b45309' }}
                >
                  {evt.action}
                </span>
              </TableCell>
              <TableCell className="font-mono text-xs" style={{ color: '#1a1a1a' }}>
                {evt.resource || '—'}
              </TableCell>
              <TableCell className="font-mono text-xs" style={{ color: '#6b6b6b' }}>
                {evt.userId || '—'}
              </TableCell>
              <TableCell className="text-xs max-w-xs truncate" style={{ color: '#6b6b6b' }}>
                {evt.details || '—'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </AdminCard>
  );
}

function FeaturesPage() {
  const { featureFlags } = useAdminStore();

  return (
    <div className="space-y-2">
      {featureFlags.map((flag) => (
        <AdminCard key={flag.key} className="flex items-center gap-4 py-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5">
              <ToggleLeft className="w-4 h-4 shrink-0" style={{ color: '#b45309' }} />
              <span className="font-mono text-sm" style={{ color: '#1a1a1a' }}>{flag.key}</span>
            </div>
            {flag.config && (
              <div className="mt-2 ml-6">
                <pre
                  className="text-[11px] font-mono rounded-md px-3 py-2 overflow-x-auto border"
                  style={{
                    background: '#f3f3f0',
                    color: '#6b6b6b',
                    borderColor: '#d4d4d0',
                  }}
                >
                  {JSON.stringify(flag.config, null, 2)}
                </pre>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <span
              className="text-[10px] uppercase tracking-wider font-semibold"
              style={{ color: flag.isEnabled ? '#16a34a' : '#6b6b6b' }}
            >
              {flag.isEnabled ? 'Active' : 'Inactive'}
            </span>
            <Switch checked={flag.isEnabled} onCheckedChange={() => {}} />
          </div>
        </AdminCard>
      ))}
    </div>
  );
}

function DevicesPage() {
  const { deviceAuthorizations } = useAdminStore();

  if (deviceAuthorizations.length === 0) {
    return (
      <EmptyState
        icon={Smartphone}
        title="No devices authorized"
        description="Authorize a device provider to enable location tracking."
        action={{ label: 'Authorize Device', onClick: () => {} }}
      />
    );
  }

  return (
    <div className="space-y-2">
      {deviceAuthorizations.map((device) => (
        <AdminCard key={device.id} className="flex items-center gap-4 py-3">
          <div
            className="w-9 h-9 rounded-md flex items-center justify-center shrink-0"
            style={{ background: 'rgba(180, 83, 9, 0.06)', border: '1px solid rgba(180, 83, 9, 0.12)' }}
          >
            <Smartphone className="w-4 h-4" style={{ color: '#b45309' }} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5">
              <span className="text-sm font-medium" style={{ color: '#1a1a1a' }}>
                {device.deviceName || 'Unknown Device'}
              </span>
              <span
                className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded"
                style={{ background: 'rgba(180, 83, 9, 0.06)', color: '#b45309' }}
              >
                {device.provider}
              </span>
            </div>
            {device.lastUsedAt && (
              <span className="flex items-center gap-1.5 mt-1 text-[11px]" style={{ color: '#6b6b6b' }}>
                <Clock className="w-3 h-3" />
                Last used {formatTime(device.lastUsedAt)}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div
              className={cn(
                'w-2 h-2 rounded-full',
                device.isActive ? 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.5)]' : 'bg-gray-400'
              )}
            />
            <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: device.isActive ? '#16a34a' : '#6b6b6b' }}>
              {device.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
        </AdminCard>
      ))}
    </div>
  );
}

function SettingsPage() {
  return (
    <div className="space-y-5">
      <AdminCard>
        <h3 className="text-sm font-semibold mb-4" style={{ color: '#1a1a1a' }}>General Settings</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between py-2 border-b" style={{ borderColor: '#e8e8e4' }}>
            <div>
              <div className="text-sm" style={{ color: '#1a1a1a' }}>Session Timeout</div>
              <div className="text-xs mt-0.5" style={{ color: '#6b6b6b' }}>Auto-logout after inactivity</div>
            </div>
            <span className="text-sm font-mono" style={{ color: '#1a1a1a' }}>30 min</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b" style={{ borderColor: '#e8e8e4' }}>
            <div>
              <div className="text-sm" style={{ color: '#1a1a1a' }}>Max Concurrent Sessions</div>
              <div className="text-xs mt-0.5" style={{ color: '#6b6b6b' }}>Maximum allowed logged-in sessions</div>
            </div>
            <span className="text-sm font-mono" style={{ color: '#1a1a1a' }}>3</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <div>
              <div className="text-sm" style={{ color: '#1a1a1a' }}>Maintenance Mode</div>
              <div className="text-xs mt-0.5" style={{ color: '#6b6b6b' }}>Temporarily disable user access</div>
            </div>
            <Switch checked={false} onCheckedChange={() => {}} />
          </div>
        </div>
      </AdminCard>

      <AdminCard>
        <h3 className="text-sm font-semibold mb-4" style={{ color: '#1a1a1a' }}>Notifications</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between py-2 border-b" style={{ borderColor: '#e8e8e4' }}>
            <div>
              <div className="text-sm" style={{ color: '#1a1a1a' }}>Security Alerts</div>
              <div className="text-xs mt-0.5" style={{ color: '#6b6b6b' }}>Receive notifications for security events</div>
            </div>
            <Switch checked={true} onCheckedChange={() => {}} />
          </div>
          <div className="flex items-center justify-between py-2 border-b" style={{ borderColor: '#e8e8e4' }}>
            <div>
              <div className="text-sm" style={{ color: '#1a1a1a' }}>Provider Alerts</div>
              <div className="text-xs mt-0.5" style={{ color: '#6b6b6b' }}>Get notified when providers go down</div>
            </div>
            <Switch checked={true} onCheckedChange={() => {}} />
          </div>
          <div className="flex items-center justify-between py-2">
            <div>
              <div className="text-sm" style={{ color: '#1a1a1a' }}>Audit Digest</div>
              <div className="text-xs mt-0.5" style={{ color: '#6b6b6b' }}>Daily summary of audit events</div>
            </div>
            <Switch checked={false} onCheckedChange={() => {}} />
          </div>
        </div>
      </AdminCard>
    </div>
  );
}

// --- Main Page Component ---

export default function AdminPage() {
  const activePage = useAdminNavStore((s) => s.activePage);

  switch (activePage) {
    case 'overview':
      return <OverviewPage />;
    case 'providers':
      return <ProvidersPage />;
    case 'security':
      return <SecurityPage />;
    case 'audit':
      return <AuditPage />;
    case 'features':
      return <FeaturesPage />;
    case 'devices':
      return <DevicesPage />;
    case 'settings':
      return <SettingsPage />;
    default:
      return <OverviewPage />;
  }
}
