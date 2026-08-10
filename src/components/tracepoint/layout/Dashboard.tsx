'use client';

import React, { useEffect, Suspense, lazy } from 'react';
import { useNavStore, useInvestigationStore, useGlobeStore, useAdminStore } from '@/lib/store/app';
import { Crosshair, Clock, Activity, Globe2, BarChart3, Database, AlertCircle } from 'lucide-react';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { listInvestigations } from '@/lib/supabase/data';
import dynamic from 'next/dynamic';
import { useState, useEffect as useEff2 } from 'react';

const GlobeView = dynamic(() => import('@/components/tracepoint/globe/GlobeView').then(m => ({ default: m.GlobeView })), { ssr: false });
const MapLibreMap = dynamic(() => import('@/components/tracepoint/globe/MapLibreMap'), { ssr: false });

class GlobeErrorBoundary extends React.Component<React.PropsWithChildren, { hasError: boolean; error?: string }> {
  state = { hasError: false, error: '' };
  static getDerivedStateFromError(e: any) { return { hasError: true, error: e?.message || 'WebGL not available' }; }
  render() {
    if (this.state.hasError) return <MapFallback />;
    return this.props.children;
  }
}

function MapFallback() {
  const markers = useGlobeStore.getState().markers;
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

function DashboardContent() {
  const nav = useNavStore();
  const invStore = useInvestigationStore();
  const adminStore = useAdminStore();
  const globe = useGlobeStore();
  const { investigations } = invStore;
  const { loadDemoInvestigation } = invStore;
  const { providers } = adminStore;
  const { markers, setMarkers, arcs, setArcs } = globe;
  const { navigate, viewMode } = nav;
  const [dbStatus, setDbStatus] = useState<DbSetupStatus | null>(null);

  // Check DB setup status
  useEff2(() => {
    if (isSupabaseConfigured()) {
      fetch('/api/setup').then(r => r.json()).then(setDbStatus).catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (isSupabaseConfigured() && dbStatus?.tablesExist !== false) {
      listInvestigations().then((invs) => {
        if (invs.length > 0) {
          useInvestigationStore.setState({ investigations: invs });
        }
      });
    }
  }, [dbStatus]);

  useEffect(() => {
    if (markers.length === 0) {
      setMarkers([
        { id: 'm1', lat: 37.77, lng: -122.42, label: 'San Francisco', type: 'identity' as const, confidence: 94 },
        { id: 'm2', lat: 40.71, lng: -74.01, label: 'New York', type: 'business' as const, confidence: 87 },
        { id: 'm3', lat: 51.51, lng: -0.13, label: 'London', type: 'source' as const, confidence: 72 },
        { id: 'm4', lat: 6.52, lng: 3.38, label: 'Lagos', type: 'identity' as const, confidence: 65 },
        { id: 'm5', lat: 52.52, lng: 13.41, label: 'Berlin', type: 'business' as const, confidence: 81 },
      ]);
      setArcs([
        { id: 'a1', startLat: 37.77, startLng: -122.42, endLat: 51.51, endLng: -0.13 },
      ]);
    }
  }, [markers.length, setMarkers, setArcs]);

  const completed = investigations.filter((i) => i.status === 'completed');
  const recent = completed.slice(0, 6);
  const avgConf = completed.length > 0
    ? Math.round(completed.reduce((s, i) => s + (i.confidence || 0), 0) / completed.length)
    : null;

  const dbConnected = isSupabaseConfigured() && dbStatus?.tablesExist !== false;
  const dbNeedsSetup = isSupabaseConfigured() && dbStatus?.tablesExist === false;

  return (
    <div className="flex flex-col lg:flex-row gap-3 p-3 h-full">
      {/* Left Panel */}
      <div className="flex flex-col gap-3 shrink-0 w-full lg:w-60 xl:w-64">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-2">
          <div className="surface p-2.5">
            <div className="mono-label">Investigations</div>
            <div className="text-lg font-semibold font-mono mt-0.5 text-foreground">{completed.length}</div>
          </div>
          <div className="surface p-2.5">
            <div className="mono-label">Avg Confidence</div>
            <div className="text-lg font-semibold font-mono mt-0.5" style={{ color: avgConf && avgConf >= 80 ? '#4a9e5a' : avgConf ? '#c8a24e' : '#707870' }}>
              {avgConf ? `${avgConf}%` : '—'}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="surface p-2.5 flex flex-col gap-1.5">
          <button
            onClick={() => navigate('investigation')}
            className="flex items-center gap-2 px-2.5 py-2 rounded text-xs font-medium border border-[#c8a24e]/15 bg-[#c8a24e]/6 text-[#c8a24e] hover:bg-[#c8a24e]/12 transition-colors text-left"
          >
            <Crosshair className="w-3.5 h-3.5 shrink-0" /> New Investigation
          </button>
          <button
            onClick={loadDemoInvestigation}
            className="flex items-center gap-2 px-2.5 py-2 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors text-left"
          >
            <Activity className="w-3.5 h-3.5 shrink-0" /> Load Demo
          </button>
          <button
            onClick={() => navigate('history')}
            className="flex items-center gap-2 px-2.5 py-2 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors text-left"
          >
            <Clock className="w-3.5 h-3.5 shrink-0" /> View History
          </button>
        </div>

        {/* Providers */}
        <div className="surface p-2.5 flex-1">
          <div className="mono-label mb-2">Providers</div>
          {providers.slice(0, 5).map((p) => {
            const dotColor = p.health === 'healthy' ? '#4a9e5a' : p.health === 'down' ? '#c44040' : '#707870';
            return (
              <div key={p.name} className="flex items-center justify-between mb-1.5 last:mb-0">
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: dotColor }} />
                  <span className="text-[11px] text-foreground">{p.name}</span>
                </div>
                <span className="text-[10px] font-mono" style={{ color: p.isEnabled ? '#4a9e5a' : 'rgba(112,120,112,0.3)' }}>{p.isEnabled ? 'ON' : 'OFF'}</span>
              </div>
            );
          })}
        </div>

        {/* DB Status */}
        <div className="surface p-2.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Database className="w-3 h-3" /> Database
            </span>
            {dbNeedsSetup ? (
              <span className="text-[#c8a24e]">Needs setup</span>
            ) : dbConnected ? (
              <span className="text-[#4a9e5a]">Connected</span>
            ) : (
              <span className="text-[#707870]">Offline</span>
            )}
          </div>
          {dbNeedsSetup && (
            <div className="mt-2 p-2 rounded bg-[#c8a24e]/5 border border-[#c8a24e]/10">
              <p className="text-[10px] text-[#c8a24e] mb-1.5">Tables not found. Run the schema in Supabase SQL Editor.</p>
              <a
                href={`https://supabase.com/dashboard/project/${dbStatus?.projectRef}/sql`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[10px] text-[#c8a24e] underline hover:text-foreground transition-colors"
              >
                Open SQL Editor <span className="text-muted-foreground">→</span>
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Center: Map / Globe / Evidence */}
      <div className="flex-1 min-h-[300px] lg:min-h-0">
        <div className="globe-bg w-full h-full rounded-[var(--radius)] border border-border overflow-hidden relative">
          {viewMode === 'globe' && (
            <GlobeErrorBoundary>
              <Suspense fallback={
                <div className="w-full h-full flex items-center justify-center">
                  <div className="text-center">
                    <Globe2 className="w-6 h-6 text-[#c8a24e] mx-auto mb-2 animate-pulse" />
                    <div className="mono-label">Loading globe...</div>
                  </div>
                </div>
              }>
                <GlobeView />
              </Suspense>
            </GlobeErrorBoundary>
          )}
          {viewMode === 'map2d' && (
            <MapLibreMap markers={markers} />
          )}
          {viewMode === 'list' && (
            <div className="w-full h-full overflow-auto p-4">
              {markers.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground text-xs">No markers to display</div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {markers.map((m) => (
                    <div key={m.id} className="surface p-2.5 flex justify-between items-center">
                      <div>
                        <div className="text-xs text-foreground">{m.label}</div>
                        <div className="text-[10px] font-mono text-muted-foreground">{m.lat.toFixed(4)}, {m.lng.toFixed(4)}</div>
                      </div>
                      <div className="text-[11px] font-mono" style={{ color: m.confidence >= 80 ? '#4a9e5a' : '#c8a24e' }}>{m.confidence}%</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {viewMode === 'evidence' && (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-center">
                <BarChart3 className="w-8 h-8 text-muted-foreground/15 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Evidence matrix — run an investigation to populate</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex flex-col gap-3 shrink-0 w-full lg:w-60 xl:w-64">
        {/* Recent Investigations */}
        <div className="surface p-2.5 flex-1">
          <div className="flex justify-between items-center mb-2">
            <div className="mono-label">Recent</div>
            <button onClick={() => navigate('history')} className="text-[10px] text-[#c8a24e] hover:text-foreground transition-colors bg-transparent border-none cursor-pointer">All</button>
          </div>
          {recent.length === 0 ? (
            <div className="text-center py-6">
              <BarChart3 className="w-6 h-6 text-muted-foreground/10 mx-auto mb-2" />
              <p className="text-[11px] text-muted-foreground">No investigations yet</p>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {recent.map((inv) => {
                const confCol = inv.confidence && inv.confidence >= 80 ? '#4a9e5a' : inv.confidence && inv.confidence >= 50 ? '#c8a24e' : '#707870';
                return (
                  <button
                    key={inv.id}
                    onClick={() => navigate('investigation-detail', inv.id)}
                    className={inv.isDemoData ? 'demo-mark relative' : ''}
                    style={{ width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: '#181b19', cursor: 'pointer' }}
                  >
                    <div className="flex justify-between mb-1">
                      <span className="text-[11px] text-foreground max-w-[130px] overflow-hidden text-ellipsis whitespace-nowrap">
                        {inv.inputName || inv.inputPhone || inv.inputEmail || 'Unknown'}
                      </span>
                      <span className="text-[10px] font-mono" style={{ color: confCol }}>{inv.confidence || 0}%</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="source-badge">{inv.depth}</span>
                      <span className="text-[10px] text-muted-foreground">{inv.identityCount} id · {inv.evidenceCount} ev</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DashboardView() {
  return <DashboardContent />;
}
