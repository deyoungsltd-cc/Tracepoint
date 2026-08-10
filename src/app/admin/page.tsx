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
  if (!iso) return '\u2014';
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

// --- Reusable card ---

function AdminCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('surface p-4', className)}>
      {children}
    </div>
  );
}

function StatCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: boolean }) {
  return (
    <AdminCard>
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          'text-2xl font-semibold mt-1 text-foreground',
          accent ? 'font-mono' : ''
        )}
      >
        {value}
      </div>
      {sub && (
        <div className="text-[11px] mt-1 text-muted-foreground">
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
    <div className="surface rounded-lg p-10 flex flex-col items-center justify-center text-center gap-3">
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center bg-[#c8a24e]/8 border border-[#c8a24e]/15"
      >
        <Icon className="w-5 h-5 text-[#c8a24e]" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      {action && (
        <Button
          variant="outline"
          size="sm"
          className="mt-2 border-border text-[#c8a24e]"
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
        <h3 className="text-sm font-semibold mb-4 text-foreground">Infrastructure Status</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-foreground">Database (Supabase)</span>
            </div>
            <span className={cn('text-xs font-medium px-2.5 py-0.5 rounded-full', isSupabaseConfigured()
              ? 'text-green-400 bg-green-500/10 border border-green-500/20'
              : 'text-amber-400 bg-amber-500/10 border border-amber-500/20'
            )}>
              {isSupabaseConfigured() ? 'Connected' : 'Not configured'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-foreground">Authentication</span>
            </div>
            <span className={cn('text-xs font-medium px-2.5 py-0.5 rounded-full', isSupabaseConfigured()
              ? 'text-green-400 bg-green-500/10 border border-green-500/20'
              : 'text-amber-400 bg-amber-500/10 border border-amber-500/20'
            )}>
              {isSupabaseConfigured() ? 'Active (Email + Google OAuth)' : 'Demo mode only'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-foreground">System Health</span>
            </div>
            <span className="text-xs font-medium px-2.5 py-0.5 rounded-full text-green-400 bg-green-500/10 border border-green-500/20">
              Operational
            </span>
          </div>
        </div>
      </AdminCard>

      {/* Recent activity */}
      <AdminCard>
        <h3 className="text-sm font-semibold mb-3 text-foreground">Recent Activity</h3>
        <div className="space-y-2">
          {auditEvents.slice(0, 5).map((evt) => (
            <div key={evt.id} className="flex items-center justify-between py-2 border-b last:border-b-0 border-border">
              <div className="flex items-center gap-3">
                <span
                  className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-[#c8a24e]/8 text-[#c8a24e]"
                >
                  {evt.action}
                </span>
                <span className="text-sm text-foreground">{evt.details || '\u2014'}</span>
              </div>
              <span className="text-[11px] font-mono shrink-0 ml-4 text-muted-foreground">
                {formatDateTime(evt.createdAt)}
              </span>
            </div>
          ))}
          {auditEvents.length === 0 && (
            <p className="text-xs text-center py-4 text-muted-foreground">No recent activity</p>
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
              <span className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">
                {p.health}
              </span>
            </div>

            {/* Provider info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2.5">
                <span className="text-sm font-medium text-foreground">{p.name}</span>
                <span
                  className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-[#c8a24e]/8 text-[#c8a24e]"
                >
                  {p.category}
                </span>
              </div>
              <div className="flex items-center gap-4 mt-1.5">
                <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  {formatTime(p.lastChecked)}
                </span>
                {p.latencyMs !== null && (
                  <span className="flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground">
                    <Activity className="w-3 h-3" />
                    <span className={cn(
                      p.latencyMs > 500 ? 'text-red-500' : p.latencyMs > 300 ? 'text-amber-500' : 'text-green-500'
                    )}>
                      {p.latencyMs}ms
                    </span>
                  </span>
                )}
              </div>
            </div>

            {/* Toggle */}
            <div className="flex items-center gap-3">
              <span className={cn('text-[10px] uppercase tracking-wider font-semibold', p.isEnabled ? 'text-green-500' : 'text-muted-foreground')}>
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
    return <EmptyState icon={Shield} title="No security events" description="All clear \u2014 no security events recorded." />;
  }

  return (
    <div className="space-y-3">
      {securityEvents.map((evt) => (
        <AdminCard
          key={evt.id}
          className={cn('py-3', !evt.resolved && 'border-l-2 border-l-red-500')}
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
                <span className="text-sm font-medium text-foreground">
                  {evt.eventType.replace(/_/g, ' ').toUpperCase()}
                </span>
                <span
                  className={cn(
                    'text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded',
                    evt.severity === 'low' && 'bg-muted text-muted-foreground',
                    evt.severity === 'medium' && 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
                    evt.severity === 'high' && 'bg-red-500/10 text-red-400 border border-red-500/20',
                    evt.severity === 'critical' && 'bg-red-500/15 text-red-400 border border-red-500/25',
                  )}
                >
                  {evt.severity.toUpperCase()}
                </span>
              </div>
              {evt.details && (
                <p className="text-xs leading-relaxed text-muted-foreground">{evt.details}</p>
              )}
              <div className="flex items-center gap-4">
                {evt.ip && (
                  <span className="flex items-center gap-1 text-[11px] font-mono text-muted-foreground">
                    <Activity className="w-3 h-3" />
                    {evt.ip}
                  </span>
                )}
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  {formatDateTime(evt.createdAt)}
                </span>
              </div>
            </div>

            {/* Resolve toggle */}
            <div className="flex flex-col items-center gap-1.5 pt-0.5">
              <Switch checked={evt.resolved} onCheckedChange={() => {}} />
              <span
                className={cn(
                  'text-[10px] font-semibold uppercase tracking-wider',
                  evt.resolved ? 'text-green-500' : 'text-red-500'
                )}
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
          <TableRow className="border-border">
            <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-[#c8a24e]">
              Timestamp
            </TableHead>
            <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-[#c8a24e]">
              Action
            </TableHead>
            <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-[#c8a24e]">
              Resource
            </TableHead>
            <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-[#c8a24e]">
              User
            </TableHead>
            <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-[#c8a24e]">
              Details
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {auditEvents.map((evt) => (
            <TableRow
              key={evt.id}
              className="transition-colors hover:bg-accent border-border"
            >
              <TableCell className="font-mono text-[11px] text-muted-foreground">
                {formatDateTime(evt.createdAt)}
              </TableCell>
              <TableCell>
                <span
                  className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-[#c8a24e]/8 text-[#c8a24e]"
                >
                  {evt.action}
                </span>
              </TableCell>
              <TableCell className="font-mono text-xs text-foreground">
                {evt.resource || '\u2014'}
              </TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">
                {evt.userId || '\u2014'}
              </TableCell>
              <TableCell className="text-xs max-w-xs truncate text-muted-foreground">
                {evt.details || '\u2014'}
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
              <ToggleLeft className="w-4 h-4 shrink-0 text-[#c8a24e]" />
              <span className="font-mono text-sm text-foreground">{flag.key}</span>
            </div>
            {flag.config && (
              <div className="mt-2 ml-6">
                <pre
                  className="text-[11px] font-mono rounded-md px-3 py-2 overflow-x-auto border bg-accent text-muted-foreground border-border"
                >
                  {JSON.stringify(flag.config, null, 2)}
                </pre>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <span
              className={cn(
                'text-[10px] uppercase tracking-wider font-semibold',
                flag.isEnabled ? 'text-green-500' : 'text-muted-foreground'
              )}
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
            className="w-9 h-9 rounded-md flex items-center justify-center shrink-0 bg-[#c8a24e]/8 border border-[#c8a24e]/15"
          >
            <Smartphone className="w-4 h-4 text-[#c8a24e]" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5">
              <span className="text-sm font-medium text-foreground">
                {device.deviceName || 'Unknown Device'}
              </span>
              <span
                className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-[#c8a24e]/8 text-[#c8a24e]"
              >
                {device.provider}
              </span>
            </div>
            {device.lastUsedAt && (
              <span className="flex items-center gap-1.5 mt-1 text-[11px] text-muted-foreground">
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
            <span className={cn('text-[11px] font-semibold uppercase tracking-wider', device.isActive ? 'text-green-500' : 'text-muted-foreground')}>
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
        <h3 className="text-sm font-semibold mb-4 text-foreground">General Settings</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between py-2 border-b border-border">
            <div>
              <div className="text-sm text-foreground">Session Timeout</div>
              <div className="text-xs mt-0.5 text-muted-foreground">Auto-logout after inactivity</div>
            </div>
            <span className="text-sm font-mono text-foreground">30 min</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-border">
            <div>
              <div className="text-sm text-foreground">Max Concurrent Sessions</div>
              <div className="text-xs mt-0.5 text-muted-foreground">Maximum allowed logged-in sessions</div>
            </div>
            <span className="text-sm font-mono text-foreground">3</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <div>
              <div className="text-sm text-foreground">Maintenance Mode</div>
              <div className="text-xs mt-0.5 text-muted-foreground">Temporarily disable user access</div>
            </div>
            <Switch checked={false} onCheckedChange={() => {}} />
          </div>
        </div>
      </AdminCard>

      <AdminCard>
        <h3 className="text-sm font-semibold mb-4 text-foreground">Notifications</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between py-2 border-b border-border">
            <div>
              <div className="text-sm text-foreground">Security Alerts</div>
              <div className="text-xs mt-0.5 text-muted-foreground">Receive notifications for security events</div>
            </div>
            <Switch checked={true} onCheckedChange={() => {}} />
          </div>
          <div className="flex items-center justify-between py-2 border-b border-border">
            <div>
              <div className="text-sm text-foreground">Provider Alerts</div>
              <div className="text-xs mt-0.5 text-muted-foreground">Get notified when providers go down</div>
            </div>
            <Switch checked={true} onCheckedChange={() => {}} />
          </div>
          <div className="flex items-center justify-between py-2">
            <div>
              <div className="text-sm text-foreground">Audit Digest</div>
              <div className="text-xs mt-0.5 text-muted-foreground">Daily summary of audit events</div>
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
