'use client';

import { useAdminStore } from '@/lib/store/app';
import type { ProviderHealth } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import {
  Server,
  ShieldAlert,
  ScrollText,
  ToggleLeft,
  Smartphone,
  Plus,
  Clock,
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  MinusCircle,
} from 'lucide-react';

// --- Helpers ---

function formatTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString('en-US', {
    month: '2-digit',
    day: '2-digit',
  });
  const time = d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  return `${date} ${time}`;
}

function healthColor(health: ProviderHealth): string {
  switch (health) {
    case 'healthy':
      return 'bg-tp-green';
    case 'degraded':
      return 'bg-tp-amber';
    case 'down':
      return 'bg-tp-red';
    default:
      return 'bg-tp-text-dim';
  }
}

function healthGlow(health: ProviderHealth): string {
  switch (health) {
    case 'healthy':
      return 'shadow-[0_0_6px_rgba(34,197,94,0.5)]';
    case 'degraded':
      return 'shadow-[0_0_6px_rgba(245,158,11,0.5)]';
    case 'down':
      return 'shadow-[0_0_6px_rgba(239,68,68,0.5)]';
    default:
      return '';
  }
}

function severityClasses(severity: string): string {
  switch (severity) {
    case 'low':
      return 'bg-tp-text-dim/20 text-tp-text-dim border-tp-text-dim/30';
    case 'medium':
      return 'bg-tp-amber/15 text-tp-amber border-tp-amber/30';
    case 'high':
      return 'bg-tp-red/15 text-tp-red border-tp-red/30';
    case 'critical':
      return 'bg-tp-red/20 text-tp-red border-tp-red/40 tp-pulse';
    default:
      return 'bg-tp-text-dim/20 text-tp-text-dim border-tp-text-dim/30';
  }
}

// --- Prototypical handlers ---

function handleProviderToggle(_providerName: string, _enabled: boolean) {
  // Prototype: toggle provider enabled state
}

function handleSecurityResolve(_eventId: string, _resolved: boolean) {
  // Prototype: resolve/unresolve security event
}

function handleFeatureFlagToggle(_key: string, _enabled: boolean) {
  // Prototype: toggle feature flag
}

// --- Sub-components ---

function ProvidersTab() {
  const providers = useAdminStore((s) => s.providers);

  return (
    <div className="space-y-3">
      {providers.map((p) => (
        <div
          key={p.name}
          className="tp-panel tp-bracket-card rounded-sm p-4 flex items-center gap-4 transition-colors hover:bg-tp-surface-hover"
        >
          {/* Health dot */}
          <div className="flex flex-col items-center gap-1.5 min-w-[3rem]">
            <div
              className={cn(
                'w-2.5 h-2.5 rounded-full transition-colors',
                healthColor(p.health),
                healthGlow(p.health)
              )}
            />\n            <span className="tp-hud text-[10px]">{p.health}</span>
          </div>

          {/* Provider info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5">
              <span className="text-sm font-medium text-tp-text truncate">
                {p.name}
              </span>
              <span className="tp-source-tag">{p.category}</span>
            </div>
            <div className="flex items-center gap-4 mt-1.5">
              <span className="tp-hud flex items-center gap-1.5">
                <Clock className="w-3 h-3" />
                {formatTime(p.lastChecked)}
              </span>
              {p.latencyMs !== null && (
                <span className="tp-hud flex items-center gap-1.5">
                  <Activity className="w-3 h-3" />
                  <span className={cn(p.latencyMs > 500 ? 'text-tp-red' : p.latencyMs > 300 ? 'text-tp-amber' : 'text-tp-green')}>
                    {p.latencyMs}ms
                  </span>
                </span>
              )}
            </div>
          </div>

          {/* Toggle */}
          <Switch
            checked={p.isEnabled}
            onCheckedChange={(checked) => handleProviderToggle(p.name, checked)}
          />
        </div>
      ))}
    </div>
  );
}

function SecurityTab() {
  const securityEvents = useAdminStore((s) => s.securityEvents);

  if (securityEvents.length === 0) {
    return (
      <div className="tp-panel rounded-sm p-8 flex flex-col items-center justify-center text-center gap-3">
        <ShieldAlert className="w-8 h-8 text-tp-text-dim" />
        <p className="tp-hud">No security events recorded</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {securityEvents.map((evt) => (
        <div
          key={evt.id}
          className={cn(
            'tp-panel rounded-sm p-4 flex items-start gap-4 transition-colors',
            !evt.resolved && 'border-l-2 border-l-tp-red'
          )}
        >
          {/* Severity icon */}
          <div className="pt-0.5">
            {evt.severity === 'critical' ? (
              <XCircle className="w-5 h-5 text-tp-red tp-pulse" />
            ) : evt.severity === 'high' ? (
              <AlertTriangle className="w-5 h-5 text-tp-red" />
            ) : evt.severity === 'medium' ? (
              <AlertTriangle className="w-5 h-5 text-tp-amber" />
            ) : (
              <MinusCircle className="w-5 h-5 text-tp-text-dim" />
            )}
          </div>

          {/* Event details */}
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-tp-text">
                {evt.eventType.replace(/_/g, ' ').toUpperCase()}
              </span>
              <span
                className={cn(
                  'tp-hud rounded-sm border px-1.5 py-0.5 text-[10px]',
                  severityClasses(evt.severity)
                )}
              >
                {evt.severity.toUpperCase()}
              </span>
            </div>
            {evt.details && (
              <p className="text-xs text-tp-text-dim leading-relaxed">
                {evt.details}
              </p>
            )}
            <div className="flex items-center gap-4">
              {evt.ip && (
                <span className="tp-hud flex items-center gap-1">
                  <Activity className="w-3 h-3" />
                  {evt.ip}
                </span>
              )}
              <span className="tp-hud flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatDateTime(evt.createdAt)}
              </span>
            </div>
          </div>

          {/* Resolved toggle */}
          <div className="flex flex-col items-center gap-1.5 pt-0.5">
            <Switch
              checked={evt.resolved}
              onCheckedChange={(checked) => handleSecurityResolve(evt.id, checked)}
            />\n            <span className="tp-hud text-[10px]">
              {evt.resolved ? 'RESOLVED' : 'OPEN'}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function AuditTab() {
  const auditEvents = useAdminStore((s) => s.auditEvents);

  if (auditEvents.length === 0) {
    return (
      <div className="tp-panel rounded-sm p-8 flex flex-col items-center justify-center text-center gap-3">
        <ScrollText className="w-8 h-8 text-tp-text-dim" />
        <p className="tp-hud">No audit events recorded</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="border-tp-border hover:bg-transparent">
          <TableHead className="tp-hud text-tp-amber text-[11px]">Timestamp</TableHead>
          <TableHead className="tp-hud text-tp-amber text-[11px]">Action</TableHead>
          <TableHead className="tp-hud text-tp-amber text-[11px]">Resource</TableHead>
          <TableHead className="tp-hud text-tp-amber text-[11px]">User</TableHead>
          <TableHead className="tp-hud text-tp-amber text-[11px]">Details</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {auditEvents.map((evt) => (
          <TableRow key={evt.id} className="border-tp-border hover:bg-tp-surface-hover">
            <TableCell className="tp-hud font-mono text-[11px]">
              {formatDateTime(evt.createdAt)}
            </TableCell>
            <TableCell>
              <span className="tp-source-tag">{evt.action}</span>
            </TableCell>
            <TableCell className="font-mono text-xs text-tp-text">
              {evt.resource || '—'}
            </TableCell>
            <TableCell className="font-mono text-xs text-tp-text-dim">
              {evt.userId || '—'}
            </TableCell>
            <TableCell className="text-xs text-tp-text-dim max-w-xs truncate">
              {evt.details || '—'}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function FeatureFlagsTab() {
  const featureFlags = useAdminStore((s) => s.featureFlags);

  return (
    <div className="space-y-2">
      {featureFlags.map((flag) => (
        <div
          key={flag.key}
          className="tp-panel tp-bracket-card rounded-sm p-4 flex items-center gap-4 transition-colors hover:bg-tp-surface-hover"
        >
          {/* Flag key */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5">
              <ToggleLeft className="w-4 h-4 text-tp-amber flex-shrink-0" />
              <span className="font-mono text-sm text-tp-text">
                {flag.key}
              </span>
            </div>
            {flag.config && (
              <div className="mt-2 ml-6">
                <pre className="tp-hud text-[10px] bg-tp-olive-dim/50 rounded-sm px-2.5 py-1.5 overflow-x-auto border border-tp-border">
                  {JSON.stringify(flag.config, null, 2)}
                </pre>
              </div>
            )}
          </div>

          {/* Toggle */}
          <Switch
            checked={flag.isEnabled}
            onCheckedChange={(checked) => handleFeatureFlagToggle(flag.key, checked)}
          />
        </div>
      ))}
    </div>
  );
}

function DeviceAuthorizationsTab() {
  const deviceAuthorizations = useAdminStore((s) => s.deviceAuthorizations);

  if (deviceAuthorizations.length === 0) {
    return (
      <div className="tp-panel rounded-sm p-12 flex flex-col items-center justify-center text-center gap-4">
        <div className="w-14 h-14 rounded-full bg-tp-olive-dim border border-tp-border flex items-center justify-center">
          <Smartphone className="w-6 h-6 text-tp-text-dim" />
        </div>
        <div className="space-y-1">
          <p className="text-sm text-tp-text-dim">
            No devices authorized yet
          </p>
          <p className="tp-hud text-[11px]">
            Authorize a device provider to enable location tracking
          </p>
        </div>
        <Button
          variant="outline"
          className="mt-2 border-tp-border text-tp-amber hover:bg-tp-amber/10 hover:text-tp-amber"
        >
          <Plus className="w-4 h-4" />
          Authorize Device
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {deviceAuthorizations.map((device) => (
        <div
          key={device.id}
          className="tp-panel tp-bracket-card rounded-sm p-4 flex items-center gap-4 transition-colors hover:bg-tp-surface-hover"
        >
          {/* Provider icon placeholder */}
          <div className="w-9 h-9 rounded-sm bg-tp-olive-dim border border-tp-border flex items-center justify-center">
            <Smartphone className="w-4 h-4 text-tp-amber" />
          </div>

          {/* Device info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5">
              <span className="text-sm font-medium text-tp-text truncate">
                {device.deviceName || 'Unknown Device'}
              </span>
              <span className="tp-source-tag">{device.provider}</span>
            </div>
            {device.lastUsedAt && (
              <span className="tp-hud mt-1 flex items-center gap-1.5">
                <Clock className="w-3 h-3" />
                Last used {formatTime(device.lastUsedAt)}
              </span>
            )}
          </div>

          {/* Status indicator */}
          <div className="flex items-center gap-2">
            <div
              className={cn(
                'w-2 h-2 rounded-full',
                device.isActive
                  ? 'bg-tp-green shadow-[0_0_6px_rgba(34,197,94,0.5)]'
                  : 'bg-tp-text-dim'
              )}
            />\n            <span className="tp-hud text-[11px]">
              {device.isActive ? 'ACTIVE' : 'INACTIVE'}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// --- Main Component ---

const tabItems = [
  { value: 'providers', label: 'Providers', icon: Server },
  { value: 'security', label: 'Security', icon: ShieldAlert },
  { value: 'audit', label: 'Audit', icon: ScrollText },
  { value: 'features', label: 'Features', icon: ToggleLeft },
  { value: 'devices', label: 'Devices', icon: Smartphone },
] as const;

export default function AdminDashboard() {
  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-tp-border bg-tp-surface/50">
        <ShieldAlert className="w-4 h-4 text-tp-amber" />
        <h1 className="text-sm font-semibold tracking-wider uppercase text-tp-amber">
          System Administration
        </h1>
        <div className="flex-1" />
        <span className="tp-hud text-[10px]">All subsystems visible</span>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="providers" className="flex-1 flex flex-col overflow-hidden">
        <div className="px-5 pt-3">
          <TabsList className="bg-tp-surface border border-tp-border rounded-sm h-9">
            {tabItems.map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="data-[state=active]:bg-tp-amber/15 data-[state=active]:text-tp-amber text-tp-text-dim hover:text-tp-text rounded-sm gap-1.5 text-xs font-mono uppercase tracking-wider h-7 px-3 transition-colors"
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        <TabsContent
          value="providers"
          className="flex-1 overflow-y-auto px-5 py-4"
        >
          <ProvidersTab />
        </TabsContent>

        <TabsContent
          value="security"
          className="flex-1 overflow-y-auto px-5 py-4"
        >
          <SecurityTab />
        </TabsContent>

        <TabsContent
          value="audit"
          className="flex-1 overflow-y-auto px-5 py-4"
        >
          <AuditTab />
        </TabsContent>

        <TabsContent
          value="features"
          className="flex-1 overflow-y-auto px-5 py-4"
        >
          <FeatureFlagsTab />
        </TabsContent>

        <TabsContent
          value="devices"
          className="flex-1 overflow-y-auto px-5 py-4"
        >
          <DeviceAuthorizationsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}