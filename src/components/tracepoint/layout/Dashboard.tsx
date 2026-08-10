'use client';

import { useEffect, Suspense } from 'react';
import { useNavStore, useInvestigationStore, useGlobeStore, useAdminStore } from '@/lib/store/app';
import type { GlobeMarker, GlobeArc } from '@/lib/types';
import { GlobeView } from '@/components/tracepoint/globe/GlobeView';
import {
  Activity, AlertTriangle, Clock, FileSearch, Globe2, MapPin, Zap, Shield, BarChart3,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useSettingsStore } from '@/lib/store/app';

function DashboardContent() {
  const { navigate, viewMode } = useNavStore();
  const { investigations, loadDemoInvestigation } = useInvestigationStore();
  const { settings } = useSettingsStore();
  const { providers } = useAdminStore();
  const { markers, setMarkers, arcs, setArcs } = useGlobeStore();

  useEffect(() => {
    if (markers.length === 0) {
      const demoMarkers: GlobeMarker[] = [
        { id: 'm1', lat: 37.7749, lng: -122.4194, label: 'San Francisco', type: 'identity', confidence: 94 },
        { id: 'm2', lat: 40.7128, lng: -74.006, label: 'New York', type: 'business', confidence: 87 },
        { id: 'm3', lat: 51.5074, lng: -0.1278, label: 'London', type: 'source', confidence: 72 },
        { id: 'm4', lat: 6.5244, lng: 3.3792, label: 'Lagos', type: 'identity', confidence: 65 },
        { id: 'm5', lat: 52.52, lng: 13.405, label: 'Berlin', type: 'business', confidence: 81 },
        { id: 'm6', lat: 9.0579, lng: 7.4951, label: 'Abuja', type: 'source', confidence: 58 },
        { id: 'm7', lat: 48.8566, lng: 2.3522, label: 'Paris', type: 'identity', confidence: 76 },
        { id: 'm8', lat: 1.3521, lng: 103.8198, label: 'Singapore', type: 'business', confidence: 89 },
      ];
      const demoArcs: GlobeArc[] = [
        { id: 'a1', startLat: 37.77, startLng: -122.42, endLat: 51.51, endLng: -0.13, color: '#f59e0b' },
        { id: 'a2', startLat: 40.71, startLng: -74.01, endLat: 6.52, endLng: 3.38, color: '#22c55e' },
        { id: 'a3', startLat: 52.52, startLng: 13.41, endLat: 9.06, endLng: 7.50, color: '#f59e0b' },
      ];
      setMarkers(demoMarkers);
      setArcs(demoArcs);
    }
  }, [markers.length, setMarkers, setArcs]);

  const healthyProviders = providers.filter((p) => p.health === 'healthy').length;
  const totalProviders = providers.length;
  const completedInvestigations = investigations.filter((i) => i.status === 'completed');
  const recentInvestigations = completedInvestigations.slice(0, 5);

  return (
    <div className="flex flex-col lg:flex-row gap-4 p-4 h-full">
      {/* LEFT: Controls + Stats */}
      <div className="lg:w-72 xl:w-80 flex flex-col gap-4 shrink-0">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="tp-panel rounded p-3">
            <div className="tp-hud text-[9px] mb-1">Investigations</div>
            <div className="tp-hud-value text-xl">{completedInvestigations.length}</div>
          </div>
          <div className="tp-panel rounded p-3">
            <div className="tp-hud text-[9px] mb-1">Providers</div>
            <div className="flex items-baseline gap-1">
              <span className="tp-hud-value text-xl">{healthyProviders}</span>
              <span className="tp-hud text-[10px]">/ {totalProviders}</span>
            </div>
          </div>
          <div className="tp-panel rounded p-3">
            <div className="tp-hud text-[9px] mb-1">Avg Confidence</div>
            <div className="tp-hud-value text-xl">
              {completedInvestigations.length > 0
                ? Math.round(completedInvestigations.reduce((s, i) => s + (i.confidence || 0), 0) / completedInvestigations.length)
                : '--'}%
            </div>
          </div>
          <div className="tp-panel rounded p-3">
            <div className="tp-hud text-[9px] mb-1">Conflicts</div>
            <div className="tp-hud-value text-xl text-tp-red">
              {completedInvestigations.filter((i) => i.hasConflicts).length}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="tp-panel rounded p-3 space-y-2">
          <div className="tp-hud text-[9px] mb-2">Quick Actions</div>
          <button
            onClick={() => navigate('investigation')}
            className="w-full flex items-center gap-2 px-3 py-2 rounded bg-tp-amber/10 border border-tp-amber/20 text-tp-amber text-xs font-medium hover:bg-tp-amber/15 transition-colors"
          >
            <Zap className="w-3.5 h-3.5" />
            New Investigation
          </button>
          <button
            onClick={loadDemoInvestigation}
            className="w-full flex items-center gap-2 px-3 py-2 rounded bg-tp-surface hover:bg-tp-surface-hover text-tp-text-dim text-xs transition-colors"
          >
            <Activity className="w-3.5 h-3.5" />
            Load Demo Investigation
          </button>
          <button
            onClick={() => navigate('history')}
            className="w-full flex items-center gap-2 px-3 py-2 rounded bg-tp-surface hover:bg-tp-surface-hover text-tp-text-dim text-xs transition-colors"
          >
            <Clock className="w-3.5 h-3.5" />
            View History
          </button>
        </div>

        {/* Provider Health */}
        <div className="tp-panel rounded p-3 flex-1">
          <div className="tp-hud text-[9px] mb-3">Provider Status</div>
          <div className="space-y-2">
            {providers.slice(0, 6).map((p) => (
              <div key={p.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      p.health === 'healthy' ? 'bg-tp-green' :
                      p.health === 'degraded' ? 'bg-tp-amber' :
                      p.health === 'down' ? 'bg-tp-red' : 'bg-tp-text-dim/30'
                    }`}
                  />\n                  <span className="text-[11px] text-tp-text truncate">{p.name}</span>
                </div>
                <span className={`text-[10px] font-mono uppercase shrink-0 ${
                  p.isEnabled ? 'text-tp-green' : 'text-tp-text-dim/40'
                }`}>
                  {p.isEnabled ? 'ON' : 'OFF'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CENTER: Globe / Map / List */}
      <div className="flex-1 min-h-[400px] lg:min-h-0">
        <div className="tp-globe-container w-full h-full rounded-lg overflow-hidden border border-tp-border relative">
          {viewMode === 'globe' && (
            <Suspense fallback={
              <div className="w-full h-full flex items-center justify-center bg-[#121614]">
                <div className="flex flex-col items-center gap-3">
                  <Globe2 className="w-8 h-8 text-tp-amber animate-pulse" />
                  <span className="tp-hud text-xs">Loading 3D Globe...</span>
                </div>
              </div>
            }>
              <GlobeView />
            </Suspense>
          )}
          {viewMode === 'map2d' && (
            <div className="w-full h-full flex items-center justify-center bg-[#121614]">
              <div className="text-center space-y-3">
                <MapPin className="w-10 h-10 text-tp-text-dim mx-auto" />
                <p className="text-sm text-tp-text-dim">2D Map View</p>
                <p className="text-xs text-tp-text-dim/60">
                  {settings.mapboxToken
                    ? 'Mapbox GL JS will render here'
                    : 'Configure Mapbox token in Settings to enable 2D maps'
                  }
                </p>
              </div>
            </div>
          )}
          {viewMode === 'list' && (
            <div className="w-full h-full overflow-y-auto p-4">
              <div className="space-y-2">
                {markers.map((m) => (
                  <div key={m.id} className="tp-panel rounded p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${
                        m.type === 'identity' ? 'bg-tp-amber' :
                        m.type === 'business' ? 'bg-tp-green' :
                        m.type === 'device' ? 'bg-cyan-400' : 'bg-tp-text-dim'
                      }`} />\n                      <div>
                        <div className="text-xs text-tp-text">{m.label}</div>
                        <div className="tp-hud text-[9px]">
                          {m.lat.toFixed(4)}, {m.lng.toFixed(4)}
                        </div>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[10px] border-tp-border text-tp-text-dim">
                      {m.type}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
          {viewMode === 'evidence' && (
            <div className="w-full h-full flex items-center justify-center bg-[#121614]">
              <div className="text-center space-y-3">
                <FileSearch className="w-10 h-10 text-tp-text-dim mx-auto" />
                <p className="text-sm text-tp-text-dim">Evidence View</p>
                <p className="text-xs text-tp-text-dim/60">Select an investigation to view evidence</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: Activity + Status */}
      <div className="lg:w-72 xl:w-80 flex flex-col gap-4 shrink-0">
        {/* System Status */}
        <div className="tp-panel rounded p-3">
          <div className="tp-hud text-[9px] mb-3">System Status</div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-tp-text">Security</span>
              <span className="flex items-center gap-1.5 text-[10px] text-tp-green">
                <div className="w-1.5 h-1.5 rounded-full bg-tp-green tp-pulse" />
                NOMINAL
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-tp-text">Data Integrity</span>
              <span className="flex items-center gap-1.5 text-[10px] text-tp-green">
                <div className="w-1.5 h-1.5 rounded-full bg-tp-green" />
                ENFORCED
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-tp-text">Demo Mode</span>
              <span className="flex items-center gap-1.5 text-[10px] text-tp-amber">
                <AlertTriangle className="w-3 h-3" />
                ACTIVE
              </span>
            </div>
          </div>
        </div>

        {/* Recent Investigations */}
        <div className="tp-panel rounded p-3 flex-1">
          <div className="flex items-center justify-between mb-3">
            <div className="tp-hud text-[9px]">Recent Activity</div>
            <button
              onClick={() => navigate('history')}
              className="text-[10px] text-tp-amber hover:underline"
            >
              View All
            </button>
          </div>
          {recentInvestigations.length === 0 ? (
            <div className="text-center py-8">
              <BarChart3 className="w-8 h-8 text-tp-text-dim/30 mx-auto mb-2" />
              <p className="text-xs text-tp-text-dim">No investigations yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentInvestigations.map((inv) => (
                <button
                  key={inv.id}
                  onClick={() => navigate('investigation-detail', inv.id)}
                  className="w-full text-left tp-panel rounded p-2.5 hover:bg-tp-surface-hover transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-tp-text truncate max-w-[160px]">
                      {inv.inputName || inv.inputPhone || inv.inputEmail || 'Unknown'}
                    </span>
                    <span className={`text-[10px] font-mono uppercase shrink-0 ${
                      inv.confidence && inv.confidence >= 80 ? 'text-tp-green' :
                      inv.confidence && inv.confidence >= 50 ? 'text-tp-amber' : 'text-tp-text-dim'
                    }`}>
                      {inv.confidence ? `${inv.confidence}%` : '--'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="tp-source-tag">{inv.depth}</span>
                    <span className="text-[10px] text-tp-text-dim">
                      {inv.identityCount} identities · {inv.evidenceCount} evidence
                    </span>
                  </div>
                  <div className="tp-hud text-[9px] mt-1">
                    {new Date(inv.createdAt).toLocaleString()}
                  </div>
                </button>
              ))}
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
