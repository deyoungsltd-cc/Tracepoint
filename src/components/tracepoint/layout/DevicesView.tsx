'use client';

import { useAdminStore } from '@/lib/store/app';
import { Button } from '@/components/ui/button';
import { Smartphone, Plus, Apple, Monitor, Tablet } from 'lucide-react';

const providerIcons: Record<string, React.ElementType> = {
  apple: Apple,
  google: Monitor,
  samsung: Smartphone,
  custom: Tablet,
};

export default function DevicesView() {
  const { deviceAuthorizations } = useAdminStore();

  return (
    <div className="p-4 h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-tp-text">Device Authorizations</h2>
            <p className="text-xs text-tp-text-dim mt-0.5">
              Manage authorized device-finding providers for lost device recovery
            </p>
          </div>
          <Button className="bg-tp-amber hover:bg-tp-amber/90 text-background font-medium text-xs uppercase tracking-wider h-8">
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Authorize Device
          </Button>
        </div>

        {/* Provider info cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          {[
            { provider: 'apple', name: 'Apple Find My', desc: 'iPhone, iPad, Mac via iCloud' },
            { provider: 'google', name: 'Google Find My Device', desc: 'Android devices via Google Account' },
            { provider: 'samsung', name: 'Samsung SmartThings Find', desc: 'Samsung Galaxy devices' },
            { provider: 'custom', name: 'Custom / BYO Provider', desc: 'MDM or custom location API' },
          ].map(({ provider, name, desc }) => {
            const Icon = providerIcons[provider] || Smartphone;
            const isAuth = deviceAuthorizations.some((d) => d.provider === provider && d.isActive);
            return (
              <div key={provider} className="tp-panel rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded ${isAuth ? 'bg-tp-green/10 text-tp-green' : 'bg-tp-surface text-tp-text-dim'}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm text-tp-text font-medium">{name}</div>
                    <div className="text-[11px] text-tp-text-dim mt-0.5">{desc}</div>
                    <div className="mt-2">
                      <span className={`text-[10px] font-mono uppercase ${isAuth ? 'text-tp-green' : 'text-tp-text-dim/50'}`}>
                        {isAuth ? '● AUTHORIZED' : '○ NOT CONNECTED'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Important notice */}
        <div className="tp-panel rounded-lg p-4 border-tp-amber/20">
          <div className="flex items-start gap-2">
            <Smartphone className="w-4 h-4 text-tp-amber mt-0.5 shrink-0" />
            <div className="space-y-1.5">
              <h4 className="text-xs font-medium text-tp-amber">Authorization Required</h4>
              <p className="text-[11px] text-tp-text-dim leading-relaxed">
                Device location is only available when you authenticate ownership or authorized access to the device.
                Tracepoint never attempts to derive private GPS coordinates from a phone number alone.
                All location data comes from legitimate provider APIs with your explicit authorization.
              </p>
              <div className="mt-2 tp-panel rounded p-2 space-y-1">
                <div className="tp-hud text-[9px]">Location Priority</div>
                <div className="text-[11px] text-tp-text-dim">
                  1. LIVE → 2. LAST KNOWN → 3. HISTORICAL → 4. UNAVAILABLE
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Authorized devices list */}
        {deviceAuthorizations.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-medium text-tp-text mb-3">Connected Devices</h3>
            <div className="space-y-2">
              {deviceAuthorizations.map((auth) => (
                <div key={auth.id} className="tp-panel rounded p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${auth.isActive ? 'bg-tp-green' : 'bg-tp-text-dim/30'}`} />
                    <div>
                      <div className="text-xs text-tp-text">{auth.deviceName || auth.deviceId || 'Unknown Device'}</div>
                      <div className="tp-hud text-[9px]">{auth.provider} · Last used: {auth.lastUsedAt ? new Date(auth.lastUsedAt).toLocaleString() : 'Never'}</div>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="text-tp-text-dim hover:text-tp-red text-xs h-7">
                    Disconnect
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}