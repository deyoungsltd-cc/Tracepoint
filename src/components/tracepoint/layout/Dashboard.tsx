'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useNavStore, useInvestigationStore, useGlobeStore, useAdminStore } from '@/lib/store/app';
import { Crosshair, Clock, Activity, Globe2, BarChart3, Database, Shield, Layers, ChevronDown, ChevronUp } from 'lucide-react';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { listInvestigations } from '@/lib/supabase/data';
import dynamic from 'next/dynamic';
import { ConfidenceMeter } from '@/components/tracepoint/shared/ConfidenceMeter';

const GlobeView = dynamic(() => import('@/components/tracepoint/globe/GlobeView').then(m => ({ default: m.GlobeView })), { ssr: false });
const MapLibreMap = dynamic(() => import('@/components/tracepoint/globe/MapLibreMap'), { ssr: false });

function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return /Mobi|Android.*Mobile|iPhone|iPod|iPad/i.test(navigator.userAgent) || window.innerWidth < 768;
}

function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
  } catch { return false; }
}

class GlobeErrorBoundary extends React.Component<React.PropsWithChildren, { hasError: boolean; error?: string }> {
  state = { hasError: false, error: '' };
  static getDerivedStateFromError(e: any) { return { hasError: true, error: e?.message || 'WebGL not available' }; }
  componentDidCatch(e: any) {
    console.warn('[Globe] WebGL failed, falling back to 2D map:', e?.message);
  }
  render() {
    if (this.state.hasError) return <MapFallback />;
    return this.props.children;
  }
}

function MapFallback() {
  const markers = useGlobeStore((s) => s.markers);
  return <MapLibreMap markers={markers} />;
}

interface DbSetupStatus {
  configured: boolean;
  tablesExist?: boolean;
  error?: string;
  fix?: string;
  instructions?: string[];
  projectRef?: string;
}

function StatBlock({ label, value, sub, accent }: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: 'gold' | 'green' | 'red' | 'muted';
}) {
  const colors: Record<string, string> = {
    gold: '#c8a24e',
    green: '#4a9e5a',
    red: '#b83a3a',
    muted: '#5e665c',
  };
  return (
    <div className="surface relative surface-highlight overflow-hidden p-2.5">
      <div className="mono-label">{label}</div>
      <div className="text-base font-semibold font-mono mt-0.5" style={{ color: accent ? colors[accent] : 'var(--foreground)' }}>
        {value}
      </div>
      {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

function DashboardContent() {
  const nav = useNavStore();
  const invStore = useInvestigationStore();
  const adminStore = useAdminStore();
  const globe = useGlobeStore();
  const { investigations } = invStore;
  const { loadPersistedInvestigations } = invStore;
  const { providers } = adminStore;
  const { markers, setMarkers, arcs, setArcs } = globe;
  const { navigate, viewMode } = nav;
  const [dbStatus, setDbStatus] = useState<DbSetupStatus | null>(null);
  const [useFallbackMap, setUseFallbackMap] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showMobilePanel, setShowMobilePanel] = useState<'left' | 'right' | null>(null);

  // Detect mobile once on mount
  useEffect(() => {
    const mobile = isMobileDevice() || !supportsWebGL();
    setIsMobile(isMobile);
    if (mobile || !supportsWebGL()) {
      setUseFallbackMap(true);
    }
  }, []);

  // Load persisted investigations on mount
  useEffect(() => {
    loadPersistedInvestigations();
  }, [loadPersistedInvestigations]);

  // Check DB setup + provider health
  useEffect(() => {
    if (isSupabaseConfigured()) {
      fetch('/api/setup').then(r => r.json()).then(setDbStatus).catch(() => {});
    }
    adminStore.loadAdminData();
  }, []);

  useEffect(() => {
    if (isSupabaseConfigured() && dbStatus?.tablesExist !== false) {
      listInvestigations().then((invs) => {
        if (invs.length > 0) {
          useInvestigationStore.setState({ investigations: invs });
        }
      }).catch(() => {});
    }
  }, [dbStatus]);

  const completed = investigations.filter((i) => i.status === 'completed');
  const recent = completed.slice(0, 6);
  const avgConf = completed.length > 0
    ? Math.round(completed.reduce((s, i) => s + (i.confidence || 0), 0) / completed.length)
    : null;

  const dbConnected = isSupabaseConfigured() && dbStatus?.tablesExist !== false;
  const dbNeedsSetup = isSupabaseConfigured() && dbStatus?.tablesExist === false;
  const healthyProviders = providers.filter(p => p.health === 'healthy' && p.isEnabled).length;

  // ========== LEFT PANEL CONTENT (shared between desktop and mobile sheet) ==========
  const leftPanelContent = (
    <>
      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-2">
        <StatBlock
          label="Investigations"
          value={completed.length}
          sub={`${investigations.filter(i => i.status === 'running').length} active`}
        />
        <StatBlock
          label="Confidence"
          value={avgConf ? `${avgConf}%` : '—'}
          accent={avgConf && avgConf >= 80 ? 'green' : avgConf ? 'gold' : 'muted'}
          sub="avg score"
        />
        <StatBlock
          label="Providers"
          value={`${healthyProviders}/${providers.length}`}
          accent={healthyProviders === providers.length ? 'green' : 'gold'}
          sub="operational"
        />
        <StatBlock
          label="Evidence"
          value={completed.reduce((s, i) => s + i.evidenceCount, 0)}
          sub="total items"
        />
      </div>

      {/* Avg confidence bar */}
      {avgConf !== null && (
        <div className="surface p-2">
          <ConfidenceMeter score={avgConf} size="md" animated />
        </div>
      )}

      {/* Actions */}
      <div className="surface p-2 flex flex-col gap-1">
        <button
          onClick={() => navigate('investigation')}
          className="flex items-center gap-2 px-2.5 py-2 rounded text-[11px] font-medium border border-[#c8a24e]/20 bg-[#c8a24e]/6 text-[#c8a24e] hover:bg-[#c8a24e]/12 transition-all duration-150 text-left"
        >
          <Crosshair className="w-3 h-3 shrink-0" /> New Investigation
        </button>
        <button
          onClick={() => navigate('batch-lookup')}
          className="flex items-center gap-2 px-2.5 py-1.5 rounded text-[11px] text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors text-left"
        >
          <Layers className="w-3 h-3 shrink-0" /> Batch Lookup
        </button>
        <button
          onClick={() => navigate('history')}
          className="flex items-center gap-2 px-2.5 py-1.5 rounded text-[11px] text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors text-left"
        >
          <Clock className="w-3 h-3 shrink-0" /> View History
        </button>
      </div>

      {/* Provider Status */}
      <div className="surface p-2">
        <div className="mono-label mb-2">Data Providers</div>
        {providers.slice(0, 7).map((p) => (
          <div key={p.name} className="flex items-center justify-between py-1">
            <div className="flex items-center gap-1.5">
              <div className={`status-dot ${p.health}`} />
              <span className="text-[10px] text-foreground">{p.name}</span>
            </div>
            <span className="intel-badge" style={{ color: p.isEnabled ? '#4a9e5a' : '#3a3e3a' }}>
              {p.isEnabled ? 'ON' : 'OFF'}
            </span>
          </div>
        ))}
      </div>

      {/* DB Status */}
      <div className="surface p-2">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <Database className="w-3 h-3" /> Database
          </span>
          {dbNeedsSetup ? (
            <span className="intel-badge text-[#c8a24e] bg-[#c8a24e]/8 border border-[#c8a24e]/15">NEEDS SETUP</span>
          ) : dbConnected ? (
            <span className="intel-badge text-[#4a9e5a] bg-[#4a9e5a]/8 border border-[#4a9e5a]/15">CONNECTED</span>
          ) : (
            <span className="intel-badge">LOCAL STORAGE</span>
          )}
        </div>
        {dbNeedsSetup && (
          <div className="mt-1.5 p-1.5 rounded bg-[#c8a24e]/4 border border-[#c8a24e]/10">
            <p className="text-[9px] text-[#c8a24e]/80 mb-1">
              {dbStatus?.fix === 'rls_policy'
                ? 'RLS policy error in Supabase — fix in SQL Editor'
                : 'Run schema in Supabase SQL Editor'}
            </p>
            <a
              href={`https://supabase.com/dashboard/project/${dbStatus?.projectRef}/sql`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[9px] text-[#c8a24e] underline hover:text-foreground transition-colors"
            >
              Open SQL Editor →
            </a>
          </div>
        )}
      </div>
    </>
  );

  // ========== RIGHT PANEL CONTENT ==========
  const rightPanelContent = (
    <>
      <div className="surface p-2">
        <div className="flex justify-between items-center mb-2">
          <div className="mono-label">Recent Investigations</div>
          <button onClick={() => navigate('history')} className="text-[9px] text-[#c8a24e] hover:text-foreground transition-colors bg-transparent border-none cursor-pointer font-medium">
            VIEW ALL →
          </button>
        </div>
        {recent.length === 0 ? (
          <div className="text-center py-8 data-grid-bg rounded">
            <BarChart3 className="w-5 h-5 text-muted-foreground/8 mx-auto mb-2" />
            <p className="text-[10px] text-muted-foreground">No investigations yet</p>
            <p className="text-[9px] text-muted-foreground/60 mt-1">Start your first investigation to see results here</p>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {recent.map((inv) => {
              return (
                <button
                  key={inv.id}
                  onClick={() => { invStore.selectInvestigation(inv.id); navigate('investigation-detail', inv.id); }}
                  style={{ width: '100%', textAlign: 'left', padding: '6px 8px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: '#1a1e1b', cursor: 'pointer' }}
                >
                  <div className="flex justify-between mb-0.5">
                    <span className="text-[10px] text-foreground max-w-[120px] overflow-hidden text-ellipsis whitespace-nowrap">
                      {inv.inputName || inv.inputPhone || inv.inputEmail || 'Unknown'}
                    </span>
                  </div>
                  <ConfidenceMeter score={inv.confidence || 0} size="sm" showLabel={false} />
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="source-badge">{inv.depth}</span>
                    <span className="text-[9px] text-muted-foreground">{inv.identityCount} id · {inv.evidenceCount} ev</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick Stats Footer */}
      <div className="surface p-2">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <Shield className="w-3 h-3" /> System
          </span>
          <span className="intel-badge text-[#4a9e5a] bg-[#4a9e5a]/8 border border-[#4a9e5a]/15">OPERATIONAL</span>
        </div>
      </div>
    </>
  );

  // ========== MOBILE LAYOUT: Map takes full width/height, panels are bottom sheets ==========
  if (isMobile) {
    return (
      <div className="flex flex-col h-full w-full">
        {/* Map / Globe fills entire space */}
        <div className="flex-1 relative min-h-0">
          <div className="globe-bg absolute inset-0 rounded-[var(--radius)] border border-border overflow-hidden">
            {viewMode === 'globe' && (
              useFallbackMap ? (
                <MapLibreMap markers={markers} />
              ) : (
                <GlobeErrorBoundary>
                  <Suspense fallback={
                    <div className="w-full h-full flex items-center justify-center data-grid-bg">
                      <div className="text-center">
                        <Globe2 className="w-5 h-5 text-[#c8a24e] mx-auto mb-2 animate-pulse" />
                        <div className="mono-label">Initializing globe...</div>
                      </div>
                    </div>
                  }>
                    <GlobeView />
                  </Suspense>
                </GlobeErrorBoundary>
              )
            )}
            {viewMode === 'map2d' && (
              <MapLibreMap markers={markers} />
            )}
            {viewMode === 'list' && (
              <div className="w-full h-full overflow-auto p-3">
                {markers.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground text-[10px] data-grid-bg h-full flex items-center justify-center">
                    <div>
                      <Globe2 className="w-6 h-6 text-muted-foreground/10 mx-auto mb-2" />
                      No markers to display
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1">
                    {markers.map((m) => (
                      <div key={m.id} className="surface p-2 flex justify-between items-center">
                        <div>
                          <div className="text-[11px] text-foreground">{m.label}</div>
                          <div className="text-[9px] font-mono text-muted-foreground">{m.lat.toFixed(4)}, {m.lng.toFixed(4)}</div>
                        </div>
                        <span className="mono-value text-[10px]">{m.confidence}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {viewMode === 'evidence' && (
              <div className="w-full h-full flex items-center justify-center data-grid-bg">
                <div className="text-center">
                  <BarChart3 className="w-8 h-8 text-muted-foreground/8 mx-auto mb-2" />
                  <p className="text-[10px] text-muted-foreground">Evidence matrix — run an investigation to populate</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Mobile bottom action bar */}
        <div className="shrink-0 flex gap-1.5 p-2 border-t border-border bg-background/90 backdrop-blur-sm">
          <button
            onClick={() => navigate('investigation')}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded text-[11px] font-medium border border-[#c8a24e]/20 bg-[#c8a24e]/6 text-[#c8a24e]"
          >
            <Crosshair className="w-3 h-3" /> New
          </button>
          <button
            onClick={() => setShowMobilePanel(showMobilePanel === 'left' ? null : 'left')}
            className="flex items-center justify-center gap-1 px-3 py-2 rounded text-[11px] text-muted-foreground border border-border"
          >
            <Activity className="w-3 h-3" /> Stats
          </button>
          <button
            onClick={() => setShowMobilePanel(showMobilePanel === 'right' ? null : 'right')}
            className="flex items-center justify-center gap-1 px-3 py-2 rounded text-[11px] text-muted-foreground border border-border"
          >
            <Clock className="w-3 h-3" /> History
          </button>
        </div>

        {/* Mobile slide-up panel */}
        {showMobilePanel && (
          <div className="shrink-0 max-h-[50vh] overflow-y-auto p-2.5 border-t border-border bg-background flex flex-col gap-2.5 animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between">
              <span className="mono-label">{showMobilePanel === 'left' ? 'Stats & Providers' : 'Recent Investigations'}</span>
              <button onClick={() => setShowMobilePanel(null)} className="text-muted-foreground hover:text-foreground">
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
            {showMobilePanel === 'left' ? leftPanelContent : rightPanelContent}
          </div>
        )}
      </div>
    );
  }

  // ========== DESKTOP LAYOUT: Traditional 3-column ==========
  return (
    <div className="flex flex-col lg:flex-row gap-2.5 p-2.5 h-full">
      {/* Left Panel */}
      <div className="flex flex-col gap-2.5 shrink-0 w-full lg:w-56 xl:w-60">
        {leftPanelContent}
      </div>

      {/* Center: Map / Globe */}
      <div className="flex-1 min-h-[300px] lg:min-h-0 relative">
        <div className="globe-bg absolute inset-0 rounded-[var(--radius)] border border-border overflow-hidden">
          {viewMode === 'globe' && (
            useFallbackMap ? (
              <MapLibreMap markers={markers} />
            ) : (
              <GlobeErrorBoundary>
                <Suspense fallback={
                  <div className="w-full h-full flex items-center justify-center data-grid-bg">
                    <div className="text-center">
                      <Globe2 className="w-5 h-5 text-[#c8a24e] mx-auto mb-2 animate-pulse" />
                      <div className="mono-label">Initializing globe...</div>
                    </div>
                  </div>
                }>
                  <GlobeView />
                </Suspense>
              </GlobeErrorBoundary>
            )
          )}
          {viewMode === 'map2d' && (
            <MapLibreMap markers={markers} />
          )}
          {viewMode === 'list' && (
            <div className="w-full h-full overflow-auto p-3">
              {markers.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground text-[10px] data-grid-bg h-full flex items-center justify-center">
                  <div>
                    <Globe2 className="w-6 h-6 text-muted-foreground/10 mx-auto mb-2" />
                    No markers to display
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  {markers.map((m) => (
                    <div key={m.id} className="surface p-2 flex justify-between items-center">
                      <div>
                        <div className="text-[11px] text-foreground">{m.label}</div>
                        <div className="text-[9px] font-mono text-muted-foreground">{m.lat.toFixed(4)}, {m.lng.toFixed(4)}</div>
                      </div>
                      <span className="mono-value text-[10px]">{m.confidence}%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {viewMode === 'evidence' && (
            <div className="w-full h-full flex items-center justify-center data-grid-bg">
              <div className="text-center">
                <BarChart3 className="w-8 h-8 text-muted-foreground/8 mx-auto mb-2" />
                <p className="text-[10px] text-muted-foreground">Evidence matrix — run an investigation to populate</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex flex-col gap-2.5 shrink-0 w-full lg:w-56 xl:w-60">
        {rightPanelContent}
      </div>
    </div>
  );
}

export default function DashboardView() {
  return <DashboardContent />;
}
