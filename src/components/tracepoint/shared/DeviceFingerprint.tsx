'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { Monitor, Smartphone, Globe, Shield, Wifi, Cpu, Clock, Fingerprint } from 'lucide-react';

interface FingerprintData {
  userAgent: string;
  browser: string;
  browserVersion: string;
  os: string;
  osVersion: string;
  device: string;
  screenResolution: string;
  viewportSize: string;
  colorDepth: number;
  pixelRatio: number;
  timezone: string;
  timezoneOffset: string;
  language: string;
  languages: string[];
  cookiesEnabled: boolean;
  doNotTrack: boolean;
  online: boolean;
  connectionType: string;
  cores: number;
  memory: number;
  touchSupport: boolean;
  platform: string;
  ip: string | null;
}

function parseBrowser(ua: string): { browser: string; version: string } {
  if (ua.includes('Firefox/')) return { browser: 'Firefox', version: ua.split('Firefox/')[1]?.split(' ')[0] || '' };
  if (ua.includes('Edg/')) return { browser: 'Edge', version: ua.split('Edg/')[1]?.split(' ')[0] || '' };
  if (ua.includes('Chrome/')) return { browser: 'Chrome', version: ua.split('Chrome/')[1]?.split(' ')[0] || '' };
  if (ua.includes('Safari/') && !ua.includes('Chrome')) return { browser: 'Safari', version: ua.split('Version/')[1]?.split(' ')[0] || '' };
  return { browser: 'Unknown', version: '' };
}

function parseOS(ua: string): { os: string; version: string } {
  if (ua.includes('Windows NT 10')) return { os: 'Windows', version: '10/11' };
  if (ua.includes('Windows NT 6.3')) return { os: 'Windows', version: '8.1' };
  if (ua.includes('Mac OS X')) {
    const v = ua.match(/Mac OS X ([\d_.]+)/)?.[1]?.replace(/_/g, '.') || '';
    return { os: 'macOS', version: v };
  }
  if (ua.includes('Linux')) return { os: 'Linux', version: '' };
  if (ua.includes('Android')) {
    const v = ua.match(/Android ([\d.]+)/)?.[1] || '';
    return { os: 'Android', version: v };
  }
  if (ua.includes('iPhone') || ua.includes('iPad')) {
    const v = ua.match(/OS ([\d_]+)/)?.[1]?.replace(/_/g, '.') || '';
    return { os: 'iOS', version: v };
  }
  return { os: 'Unknown', version: '' };
}

function detectDevice(ua: string): string {
  if (/Mobi|Android.*Mobile|iPhone|iPod/.test(ua)) return 'Mobile';
  if (/iPad|Android(?!.*Mobile)|Tablet/.test(ua)) return 'Tablet';
  return 'Desktop';
}

function computeFingerprint(): { data: FingerprintData; hash: string } {
  if (typeof navigator === 'undefined') {
    return { data: null as unknown as FingerprintData, hash: '' };
  }
  const ua = navigator.userAgent;
  const { browser, version: browserVersion } = parseBrowser(ua);
  const { os, version: osVersion } = parseOS(ua);
  const nav = navigator as any;
  const conn = nav.connection || nav.mozConnection || nav.webkitConnection;

  const fp: FingerprintData = {
    userAgent: ua,
    browser,
    browserVersion,
    os,
    osVersion,
    device: detectDevice(ua),
    screenResolution: `${screen.width}x${screen.height}`,
    viewportSize: `${window.innerWidth}x${window.innerHeight}`,
    colorDepth: screen.colorDepth,
    pixelRatio: window.devicePixelRatio,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    timezoneOffset: `UTC${new Date().getTimezoneOffset() > 0 ? '-' : '+'}${String(Math.abs(Math.floor(new Date().getTimezoneOffset() / 60))).padStart(2, '0')}:${String(Math.abs(new Date().getTimezoneOffset() % 60)).padStart(2, '0')}`,
    language: navigator.language,
    languages: [...navigator.languages],
    cookiesEnabled: navigator.cookieEnabled,
    doNotTrack: navigator.doNotTrack === '1',
    online: navigator.onLine,
    connectionType: conn?.effectiveType || 'unknown',
    cores: navigator.hardwareConcurrency || 0,
    memory: nav.deviceMemory || 0,
    touchSupport: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
    platform: navigator.platform || '',
    ip: null,
  };

  const raw = `${fp.browser}-${fp.os}-${fp.screenResolution}-${fp.timezone}-${fp.cores}-${fp.pixelRatio}-${fp.colorDepth}-${fp.language}`;
  let h = 0;
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i);
    h = ((h << 5) - h) + char;
    h = h & h;
  }
  const hash = Math.abs(h).toString(16).padStart(8, '0').toUpperCase();

  return { data: fp, hash };
}

export function DeviceFingerprint() {
  const initial = useMemo(() => computeFingerprint(), []);
  const [data, setData] = useState<FingerprintData | null>(initial.data);
  const [hash] = useState(initial.hash);

  // Fetch public IP asynchronously
  useEffect(() => {
    fetch('https://api.ipify.org?format=json')
      .then(r => r.json())
      .then(d => setData(prev => prev ? { ...prev, ip: d.ip } : prev))
      .catch(() => {});
  }, []);

  if (!data) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="w-5 h-5 border-2 border-[#c8a24e]/20 border-t-[#c8a24e] rounded-full animate-spin" />
      </div>
    );
  }

  const isMobile = data.device === 'Mobile';
  const DeviceIcon = isMobile ? Smartphone : Monitor;

  const sections = [
    {
      title: 'Browser',
      icon: Globe,
      items: [
        { label: 'Browser', value: `${data.browser} ${data.browserVersion}` },
        { label: 'Engine', value: data.userAgent.includes('Gecko/') ? 'Gecko' : 'WebKit/Blink' },
        { label: 'Language', value: data.language },
        { label: 'Languages', value: data.languages.join(', ') },
        { label: 'Cookies', value: data.cookiesEnabled ? 'Enabled' : 'Disabled' },
        { label: 'DNT', value: data.doNotTrack ? 'Enabled' : 'Disabled' },
      ],
    },
    {
      title: 'System',
      icon: Cpu,
      items: [
        { label: 'OS', value: `${data.os} ${data.osVersion}` },
        { label: 'Platform', value: data.platform },
        { label: 'Device Type', value: data.device },
        { label: 'CPU Cores', value: String(data.cores) },
        { label: 'Memory', value: data.memory ? `${data.memory} GB` : 'N/A' },
        { label: 'Touch', value: data.touchSupport ? 'Supported' : 'Not available' },
      ],
    },
    {
      title: 'Display',
      icon: Monitor,
      items: [
        { label: 'Screen', value: data.screenResolution },
        { label: 'Viewport', value: data.viewportSize },
        { label: 'Pixel Ratio', value: `${data.pixelRatio}x` },
        { label: 'Color Depth', value: `${data.colorDepth}-bit` },
      ],
    },
    {
      title: 'Network',
      icon: Wifi,
      items: [
        { label: 'Status', value: data.online ? 'Online' : 'Offline' },
        { label: 'Connection', value: data.connectionType.toUpperCase() },
        { label: 'IP Address', value: data.ip || 'Detecting...' },
      ],
    },
    {
      title: 'Locale',
      icon: Clock,
      items: [
        { label: 'Timezone', value: data.timezone },
        { label: 'UTC Offset', value: data.timezoneOffset },
      ],
    },
  ];

  return (
    <div className="p-4 h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Device Fingerprint</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Client-side device intelligence for your current session</p>
          </div>
          <div className="flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 text-[#4a9e5a]" />
            <span className="intel-badge text-[#4a9e5a] bg-[#4a9e5a]/8 border border-[#4a9e5a]/15">SECURE</span>
          </div>
        </div>

        {/* Fingerprint Hash Card */}
        <div className="surface p-4 mb-4 surface-highlight relative">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-[#c8a24e]/10 border border-[#c8a24e]/15 flex items-center justify-center">
              <Fingerprint className="w-5 h-5 text-[#c8a24e]" />
            </div>
            <div className="flex-1">
              <div className="mono-label mb-1">Session Fingerprint</div>
              <div className="text-base font-mono font-semibold text-[#c8a24e] tracking-wider">TP-{hash}</div>
            </div>
            <div className="flex items-center gap-2">
              <DeviceIcon className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">{data.device}</span>
            </div>
          </div>
        </div>

        {/* Sections Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {sections.map((section) => (
            <div key={section.title} className="surface p-3">
              <div className="flex items-center gap-1.5 mb-2.5">
                <section.icon className="w-3 h-3 text-[#c8a24e]" />
                <span className="mono-label">{section.title}</span>
              </div>
              <div className="space-y-1.5">
                {section.items.map((item) => (
                  <div key={item.label} className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">{item.label}</span>
                    <span className="text-[10px] text-foreground font-mono truncate ml-2 max-w-[160px]" title={item.value}>
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* User Agent (collapsed) */}
        <details className="mt-4 surface">
          <summary className="p-3 text-[10px] text-muted-foreground cursor-pointer hover:text-foreground transition-colors mono-label">
            Raw User Agent
          </summary>
          <div className="px-3 pb-3">
            <code className="text-[9px] text-foreground/60 font-mono break-all leading-relaxed block p-2 bg-accent rounded">
              {data.userAgent}
            </code>
          </div>
        </details>
      </div>
    </div>
  );
}
