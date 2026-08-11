'use client';

import { useEffect, useState, useCallback } from 'react';
import { Monitor, Smartphone, Globe, Shield, Wifi, Cpu, Clock, Fingerprint, Copy, Check, AlertTriangle } from 'lucide-react';

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
  canvasHash: string;
  webglHash: string;
  fonts: string[];
  hardwareConcurrency: number;
  maxTouchPoints: number;
}

function parseBrowser(ua: string): { browser: string; version: string } {
  try {
    if (ua.includes('Firefox/')) return { browser: 'Firefox', version: ua.split('Firefox/')[1]?.split(' ')[0] || '' };
    if (ua.includes('Edg/')) return { browser: 'Edge', version: ua.split('Edg/')[1]?.split(' ')[0] || '' };
    if (ua.includes('OPR/') || ua.includes('Opera/')) return { browser: 'Opera', version: (ua.split('OPR/')[1] || ua.split('Opera/')[1])?.split(' ')[0] || '' };
    if (ua.includes('Chrome/')) return { browser: 'Chrome', version: ua.split('Chrome/')[1]?.split(' ')[0] || '' };
    if (ua.includes('Safari/') && !ua.includes('Chrome')) return { browser: 'Safari', version: ua.split('Version/')[1]?.split(' ')[0] || '' };
  } catch {}
  return { browser: 'Unknown', version: '' };
}

function parseOS(ua: string): { os: string; version: string } {
  try {
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
  } catch {}
  return { os: 'Unknown', version: '' };
}

function detectDevice(ua: string): string {
  try {
    if (/Mobi|Android.*Mobile|iPhone|iPod/.test(ua)) return 'Mobile';
    if (/iPad|Android(?!.*Mobile)|Tablet/.test(ua)) return 'Tablet';
  } catch {}
  return 'Desktop';
}

function getCanvasFingerprint(): string {
  try {
    if (typeof document === 'undefined') return 'unavailable';
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 50;
    const ctx = canvas.getContext('2d');
    if (!ctx) return 'unavailable';
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillStyle = '#f60';
    ctx.fillRect(50, 1, 100, 30);
    ctx.fillStyle = '#069';
    ctx.fillText('Tracepoint fp', 2, 15);
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
    ctx.fillText('Tracepoint fp', 4, 17);
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = 'rgb(255,0,255)';
    ctx.beginPath();
    ctx.arc(50, 25, 20, 0, Math.PI * 2, true);
    ctx.fill();
    ctx.fillStyle = 'rgb(0,255,255)';
    ctx.beginPath();
    ctx.arc(100, 25, 20, 0, Math.PI * 2, true);
    ctx.fill();
    const dataUrl = canvas.toDataURL();
    let h = 0;
    for (let i = 0; i < dataUrl.length; i++) {
      h = ((h << 5) - h) + dataUrl.charCodeAt(i);
      h = h & h;
    }
    return Math.abs(h).toString(16).padStart(8, '0').toUpperCase();
  } catch {
    return 'unavailable';
  }
}

function getWebGLFingerprint(): string {
  try {
    if (typeof document === 'undefined') return 'unavailable';
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) return 'unavailable';
    const glContext = gl as WebGLRenderingContext;
    const debugInfo = glContext.getExtension('WEBGL_debug_renderer_info');
    const vendor = debugInfo ? glContext.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : 'default';
    const renderer = debugInfo ? glContext.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : 'default';
    const raw = `${vendor}-${renderer}-${glContext.getParameter(glContext.VERSION)}`;
    let h = 0;
    for (let i = 0; i < raw.length; i++) {
      h = ((h << 5) - h) + raw.charCodeAt(i);
      h = h & h;
    }
    return Math.abs(h).toString(16).padStart(8, '0').toUpperCase();
  } catch {
    return 'unavailable';
  }
}

function detectFonts(): string[] {
  const detected: string[] = [];
  try {
    if (typeof document === 'undefined' || !document.body) return detected;
    const baseFonts = ['monospace', 'sans-serif', 'serif'];
    const testFonts = ['Arial', 'Verdana', 'Helvetica', 'Times New Roman', 'Georgia', 'Courier New', 'Comic Sans MS', 'Impact', 'Trebuchet MS', 'Palatino', 'Lucida Console', 'Segoe UI', 'Roboto', 'Open Sans', 'Noto Sans'];
    const span = document.createElement('span');
    span.style.position = 'absolute';
    span.style.left = '-9999px';
    span.style.fontSize = '72px';
    span.textContent = 'mmmmmmmmmmlli';
    document.body.appendChild(span);
    for (const font of testFonts) {
      try {
        for (const base of baseFonts) {
          span.style.fontFamily = `'${font}', ${base}`;
          const width = span.offsetWidth;
          span.style.fontFamily = `${base}`;
          const baseWidth = span.offsetWidth;
          if (width !== baseWidth) {
            detected.push(font);
            break;
          }
        }
      } catch {
        // skip individual font test failures
      }
    }
    document.body.removeChild(span);
  } catch {
    // font detection unavailable in this environment
  }
  return detected;
}

function safeStr(val: unknown, fallback: string = ''): string {
  return typeof val === 'string' ? val : fallback;
}

function computeFingerprint(): { data: FingerprintData | null; hash: string } {
  try {
    if (typeof navigator === 'undefined' || typeof window === 'undefined' || typeof document === 'undefined') {
      return { data: null, hash: '' };
    }
    const ua = safeStr(navigator.userAgent, '');
    const { browser, version: browserVersion } = parseBrowser(ua);
    const { os, version: osVersion } = parseOS(ua);
    const nav = navigator as any;
    const conn = nav.connection || nav.mozConnection || nav.webkitConnection;

    const canvasHash = getCanvasFingerprint();
    const webglHash = getWebGLFingerprint();
    const fonts = detectFonts();

    let screenW = 0, screenH = 0, colorDepth = 0, pixelRatio = 1;
    let innerW = 0, innerH = 0;
    try { screenW = screen.width; screenH = screen.height; colorDepth = screen.colorDepth; } catch {}
    try { pixelRatio = window.devicePixelRatio || 1; innerW = window.innerWidth; innerH = window.innerHeight; } catch {}

    let timezone = 'Unknown';
    try { timezone = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch {}

    const tzOffset = new Date().getTimezoneOffset();
    const tzSign = tzOffset > 0 ? '-' : '+';
    const absH = Math.abs(Math.floor(tzOffset / 60));
    const absM = Math.abs(tzOffset % 60);
    const timezoneOffset = `UTC${tzSign}${String(absH).padStart(2, '0')}:${String(absM).padStart(2, '0')}`;

    const language = safeStr(navigator.language, 'unknown');
    const languages = Array.isArray(navigator.languages) ? [...navigator.languages] : [language];
    const cookiesEnabled = !!navigator.cookieEnabled;
    const doNotTrack = navigator.doNotTrack === '1';
    const online = !!navigator.onLine;
    const connectionType = conn?.effectiveType ? String(conn.effectiveType) : 'unknown';
    const cores = navigator.hardwareConcurrency || 0;
    const memory = nav.deviceMemory || 0;
    let touchSupport = false;
    try { touchSupport = 'ontouchstart' in window || (navigator.maxTouchPoints || 0) > 0; } catch {}
    const platform = safeStr((navigator as any).platform, '');
    const maxTouchPoints = navigator.maxTouchPoints || 0;

    const fp: FingerprintData = {
      userAgent: ua,
      browser,
      browserVersion,
      os,
      osVersion,
      device: detectDevice(ua),
      screenResolution: `${screenW}x${screenH}`,
      viewportSize: `${innerW}x${innerH}`,
      colorDepth,
      pixelRatio,
      timezone,
      timezoneOffset,
      language,
      languages,
      cookiesEnabled,
      doNotTrack,
      online,
      connectionType,
      cores,
      memory,
      touchSupport,
      platform,
      ip: null,
      canvasHash,
      webglHash,
      fonts,
      hardwareConcurrency: cores,
      maxTouchPoints,
    };

    const raw = `${fp.browser}-${fp.os}-${fp.screenResolution}-${fp.timezone}-${fp.cores}-${fp.pixelRatio}-${fp.colorDepth}-${fp.language}-${fp.canvasHash}-${fp.webglHash}`;
    let h = 0;
    for (let i = 0; i < raw.length; i++) {
      const char = raw.charCodeAt(i);
      h = ((h << 5) - h) + char;
      h = h & h;
    }
    const hash = Math.abs(h).toString(16).padStart(8, '0').toUpperCase();

    return { data: fp, hash };
  } catch (err) {
    console.error('[DeviceFingerprint] computeFingerprint error:', err);
    return { data: null, hash: '' };
  }
}

export function DeviceFingerprint() {
  const [data, setData] = useState<FingerprintData | null>(null);
  const [hash, setHash] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const result = computeFingerprint();
      if (!result.data) {
        setError('Fingerprint computation not available in this environment');
        return;
      }
      setData(result.data);
      setHash(result.hash);
    } catch (err) {
      console.error('[DeviceFingerprint] init error:', err);
      setError('Failed to compute device fingerprint');
    }
  }, []);

  useEffect(() => {
    try {
      fetch('https://api.ipify.org?format=json')
        .then(r => r.json())
        .then(d => setData(prev => prev ? { ...prev, ip: (d && typeof d.ip === 'string') ? d.ip : null } : prev))
        .catch(() => {});
    } catch {
      // IP detection is optional
    }
  }, []);

  const copyHash = useCallback(() => {
    try {
      navigator.clipboard.writeText(`TP-${hash}`).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }).catch(() => {});
    } catch {}
  }, [hash]);

  if (error) {
    return (
      <div className="p-4 h-full overflow-y-auto">
        <div className="max-w-4xl mx-auto">
          <div className="surface p-6 text-center">
            <AlertTriangle className="w-8 h-8 text-[#c8a24e] mx-auto mb-3" />
            <p className="text-sm text-foreground">{error}</p>
            <p className="text-xs text-muted-foreground/60 mt-1">This feature requires a modern browser with JavaScript enabled.</p>
          </div>
        </div>
      </div>
    );
  }

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
        { label: 'Language', value: data.language },
        { label: 'Languages', value: data.languages.slice(0, 5).join(', ') },
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
        { label: 'Touch', value: `${data.maxTouchPoints} points` },
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
    {
      title: 'Fingerprinting',
      icon: Fingerprint,
      items: [
        { label: 'Canvas Hash', value: data.canvasHash },
        { label: 'WebGL Hash', value: data.webglHash },
        { label: 'Fonts Detected', value: `${data.fonts.length} fonts` },
        { label: 'Uniqueness', value: data.canvasHash !== 'unavailable' && data.webglHash !== 'unavailable' ? 'High' : 'Medium' },
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
              <div className="flex items-center gap-2">
                <span className="text-base font-mono font-semibold text-[#c8a24e] tracking-wider">TP-{hash}</span>
                <button
                  onClick={copyHash}
                  className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                  title="Copy hash"
                >
                  {copied ? <Check className="w-3 h-3 text-[#4a9e5a]" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <DeviceIcon className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">{data.device}</span>
            </div>
          </div>
        </div>

        {/* Sub-hashes Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          {[
            { label: 'Canvas', value: data.canvasHash, color: data.canvasHash !== 'unavailable' ? '#4a9e5a' : '#5e665c' },
            { label: 'WebGL', value: data.webglHash, color: data.webglHash !== 'unavailable' ? '#4a9e5a' : '#5e665c' },
            { label: 'Fonts', value: `${data.fonts.length} detected`, color: '#c8a24e' },
            { label: 'Touch', value: `${data.maxTouchPoints} pts`, color: '#5e665c' },
          ].map(item => (
            <div key={item.label} className="surface p-3">
              <div className="mono-label text-[9px] mb-1">{item.label}</div>
              <div className="text-sm font-mono font-medium" style={{ color: item.color }}>{item.value}</div>
            </div>
          ))}
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

        {/* Detected Fonts */}
        {data.fonts.length > 0 && (
          <details className="mt-4 surface">
            <summary className="p-3 text-[10px] text-muted-foreground cursor-pointer hover:text-foreground transition-colors mono-label">
              Detected Fonts ({data.fonts.length})
            </summary>
            <div className="px-3 pb-3 flex flex-wrap gap-1">
              {data.fonts.map(font => (
                <span key={font} className="source-badge">{font}</span>
              ))}
            </div>
          </details>
        )}

        {/* User Agent (collapsed) */}
        <details className="mt-3 surface">
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
