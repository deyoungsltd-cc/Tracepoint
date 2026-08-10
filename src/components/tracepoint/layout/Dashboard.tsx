'use client';

import { useEffect, Suspense } from 'react';
import { useNavStore, useInvestigationStore, useGlobeStore, useAdminStore } from '@/lib/store/app';
import { GlobeView } from '@/components/tracepoint/globe/GlobeView';
import { Crosshair, Clock, Activity, Globe2, MapPin, BarChart3 } from 'lucide-react';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { listInvestigations } from '@/lib/supabase/data';

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

  useEffect(() => {
    if (isSupabaseConfigured()) {
      listInvestigations().then((invs) => {
        if (invs.length > 0) {
          useInvestigationStore.setState({ investigations: invs });
        }
      });
    }
  }, []);

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

  const confColor = avgConf && avgConf >= 80 ? 'color: #4a9e5a' : avgConf ? 'color: #c8a24e' : 'color: #707870';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 12, height: '100%' }} className="lg:flex-row">
      {/* Left */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flexShrink: 0 }} className="w-full lg:w-64 xl:w-72">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div className="surface" style={{ padding: 10 }}>
            <div className="mono-label" style={{ fontSize: 9 }}>Investigations</div>
            <div style={{ fontSize: 18, fontWeight: 600, fontFamily: 'monospace', marginTop: 2 }}>{completed.length}</div>
          </div>
          <div className="surface" style={{ padding: 10 }}>
            <div className="mono-label" style={{ fontSize: 9 }}>Avg Confidence</div>
            <div style={{ fontSize: 18, fontWeight: 600, fontFamily: 'monospace', marginTop: 2, color: avgConf && avgConf >= 80 ? '#4a9e5a' : avgConf ? '#c8a24e' : '#707870' }}>
              {avgConf ? `${avgConf}%` : '—'}
            </div>
          </div>
        </div>

        <div className="surface" style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button
            onClick={() => navigate('investigation')}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 4, border: '1px solid rgba(200,162,78,0.15)', background: 'rgba(200,162,78,0.06)', color: '#c8a24e', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}
          >
            <Crosshair style={{ width: 14, height: 14 }} /> New Investigation
          </button>
          <button
            onClick={loadDemoInvestigation}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 4, border: 'none', background: 'transparent', color: '#707870', fontSize: 12, cursor: 'pointer' }}
          >
            <Activity style={{ width: 14, height: 14 }} /> Load Demo
          </button>
          <button
            onClick={() => navigate('history')}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 4, border: 'none', background: 'transparent', color: '#707870', fontSize: 12, cursor: 'pointer' }}
          >
            <Clock style={{ width: 14, height: 14 }} /> View History
          </button>
        </div>

        <div className="surface" style={{ padding: 10, flex: 1 }}>
          <div className="mono-label" style={{ fontSize: 9, marginBottom: 8 }}>Providers</div>
          {providers.slice(0, 5).map((p) => {
            const dotColor = p.health === 'healthy' ? '#4a9e5a' : p.health === 'down' ? '#c44040' : '#707870';
            return (
              <div key={p.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor }} />
                  <span style={{ fontSize: 11 }}>{p.name}</span>
                </div>
                <span style={{ fontSize: 10, fontFamily: 'monospace', color: p.isEnabled ? '#4a9e5a' : 'rgba(112,120,112,0.3)' }}>{p.isEnabled ? 'ON' : 'OFF'}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Center: Globe */}
      <div style={{ flex: 1, minHeight: 350 }} className="lg:min-h-0">
        <div className="globe-bg" style={{ width: '100%', height: '100%', borderRadius: 'var(--radius)', border: '1px solid var(--border)', overflow: 'hidden', position: 'relative' }}>
          {viewMode === 'globe' && (
            <Suspense fallback={
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ textAlign: 'center' }}>
                  <Globe2 style={{ width: 24, height: 24, color: '#c8a24e', margin: '0 auto 8px' }} className="animate-pulse" />
                  <div className="mono-label" style={{ fontSize: 10 }}>Loading globe...</div>
                </div>
              </div>
            }>
              <GlobeView />
            </Suspense>
          )}
          {viewMode !== 'globe' && (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ textAlign: 'center' }}>
                <BarChart3 style={{ width: 32, height: 32, color: 'rgba(112,120,112,0.15)', margin: '0 auto 8px' }} />
                <p style={{ fontSize: 12, color: '#707870' }}>{viewMode === 'map2d' ? '2D Map' : viewMode === 'list' ? 'List View' : 'Evidence View'}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flexShrink: 0 }} className="w-full lg:w-64 xl:w-72">
        <div className="surface" style={{ padding: 10, flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <div className="mono-label" style={{ fontSize: 9 }}>Recent</div>
            <button onClick={() => navigate('history')} style={{ fontSize: 10, color: '#c8a24e', background: 'none', border: 'none', cursor: 'pointer' }}>All</button>
          </div>
          {recent.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <BarChart3 style={{ width: 24, height: 24, color: 'rgba(112,120,112,0.12)', margin: '0 auto 8px' }} />
              <p style={{ fontSize: 11, color: '#707870' }}>No investigations</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {recent.map((inv) => {
                const confCol = inv.confidence && inv.confidence >= 80 ? '#4a9e5a' : inv.confidence && inv.confidence >= 50 ? '#c8a24e' : '#707870';
                return (
                  <button
                    key={inv.id}
                    onClick={() => navigate('investigation-detail', inv.id)}
                    className={inv.isDemoData ? 'demo-mark relative' : ''}
                    style={{ width: '100%', textAlign: 'left', padding: 10, borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: '#181b19', cursor: 'pointer' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                      <span style={{ fontSize: 11, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {inv.inputName || inv.inputPhone || inv.inputEmail || 'Unknown'}
                      </span>
                      <span style={{ fontSize: 10, fontFamily: 'monospace', color: confCol }}>{inv.confidence || 0}%</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className="source-badge">{inv.depth}</span>
                      <span style={{ fontSize: 10, color: '#707870' }}>{inv.identityCount} id · {inv.evidenceCount} ev</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="surface" style={{ padding: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
            <span style={{ color: '#707870' }}>Database</span>
            <span style={{ color: isSupabaseConfigured() ? '#4a9e5a' : '#c8a24e' }}>
              {isSupabaseConfigured() ? 'Supabase connected' : 'Offline mode'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardView() {
  return <DashboardContent />;
}
