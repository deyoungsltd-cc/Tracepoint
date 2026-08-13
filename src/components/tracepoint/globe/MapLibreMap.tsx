'use client';

import { useEffect, useRef, useCallback } from 'react';
import type { GlobeMarker } from '@/lib/types';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

interface MapLibreMapProps {
  markers: GlobeMarker[];
  className?: string;
  onMarkerClick?: (marker: GlobeMarker) => void;
}

const MARKER_COLORS: Record<string, string> = {
  identity: '#c8a24e',
  business: '#4a9e5a',
  source: '#6b8cce',
  location: '#c44040',
  default: '#707870',
};

export default function MapLibreMap({ markers, className = '' }: MapLibreMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const initAttempted = useRef(false);

  const initMap = useCallback(() => {
    const container = mapContainer.current;
    if (!container || mapRef.current || initAttempted.current) return;

    // Check container has actual dimensions
    const rect = container.getBoundingClientRect();
    if (rect.width < 10 || rect.height < 10) {
      console.warn('[MapLibre] Container too small, retrying...', rect.width, rect.height);
      return false;
    }

    initAttempted.current = true;

    try {
      const map = new maplibregl.Map({
        container,
        style: {
          version: 8,
          name: 'Tracepoint Dark',
          sources: {
            'osm-tiles': {
              type: 'raster',
              tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
              tileSize: 256,
              attribution: '&copy; OpenStreetMap contributors',
            },
          },
          layers: [
            {
              id: 'osm-tiles-layer',
              type: 'raster',
              source: 'osm-tiles',
              minzoom: 0,
              maxzoom: 19,
            },
          ],
        },
        center: [0, 20],
        zoom: 2,
        minZoom: 1,
        maxZoom: 16,
        attributionControl: false,
      });

      map.on('load', () => {
        // Force recalculation after tiles load
        setTimeout(() => { try { map.resize(); } catch {} }, 200);
        console.log('[MapLibre] Map loaded successfully');
      });

      // Handle resize events
      const handleResize = () => { try { map.resize(); } catch {} };
      window.addEventListener('resize', handleResize);

      // ResizeObserver for container dimension changes (critical for mobile)
      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
            try { map.resize(); } catch {}
          }
        }
      });
      resizeObserver.observe(container);

      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
      map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

      mapRef.current = map;

      cleanupRef.current = () => {
        window.removeEventListener('resize', handleResize);
        resizeObserver.disconnect();
        try { map.remove(); } catch {}
        mapRef.current = null;
        initAttempted.current = false;
      };

      return true;
    } catch (err) {
      console.error('[MapLibre] Failed to initialize map:', err);
      initAttempted.current = false;
      return false;
    }
  }, []);

  // Initialize map with retry logic
  useEffect(() => {
    // Try immediately
    const immediateResult = initMap();

    // If container too small, retry with delays (handles mobile layout timing)
    if (!immediateResult) {
      const timers = [
        setTimeout(initMap, 100),
        setTimeout(initMap, 300),
        setTimeout(initMap, 600),
        setTimeout(initMap, 1000),
      ];
      return () => timers.forEach(clearTimeout);
    }

    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    };
  }, [initMap]);

  // Update markers when they change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear all markers from previous render
    if ((map as any)._tpMarkers) {
      (map as any)._tpMarkers.forEach((m: any) => m.remove());
    }
    const tpMarkers: any[] = [];

    if (markers.length === 0) return;

    const bounds = new maplibregl.LngLatBounds();

    for (const marker of markers) {
      if (marker.lat == null || marker.lng == null) continue;

      const el = document.createElement('div');
      const color = MARKER_COLORS[marker.type] || MARKER_COLORS.default;

      el.style.cssText = `
        width: 10px; height: 10px; border-radius: 50%;
        background: ${color};
        box-shadow: 0 0 8px ${color}66, 0 0 20px ${color}22;
        border: 1.5px solid ${color}aa;
        cursor: pointer;
      `;

      const popup = new maplibregl.Popup({
        offset: 12,
        closeButton: false,
        className: 'tp-maplibre-popup',
      }).setHTML(
        `<div style="font-family:var(--font-geist-mono),monospace;font-size:11px;color:#d4d4cc;">
          <div style="font-weight:600;margin-bottom:2px;">${marker.label || 'Unknown'}</div>
          <div style="color:#707870;font-size:10px;">${marker.lat.toFixed(4)}, ${marker.lng.toFixed(4)}</div>
          ${marker.confidence ? `<div style="color:${color};font-size:10px;margin-top:3px;">${marker.confidence}% confidence</div>` : ''}
        </div>`
      );

      const mapMarker = new maplibregl.Marker({ element: el })
        .setLngLat([marker.lng, marker.lat])
        .setPopup(popup)
        .addTo(map);

      tpMarkers.push(mapMarker);
      bounds.extend([marker.lng, marker.lat]);
    }

    (map as any)._tpMarkers = tpMarkers;

    if (markers.length > 1) {
      map.fitBounds(bounds, { padding: 50, maxZoom: 6, duration: 1000 });
    } else if (markers.length === 1 && markers[0].lat != null && markers[0].lng != null) {
      map.flyTo({ center: [markers[0].lng, markers[0].lat], zoom: 5, duration: 1000 });
    }
  }, [markers]);

  return (
    <>
      <style>{`
        .tp-maplibre-popup .maplibregl-popup-content {
          background: #151917;
          border: 1px solid #232823;
          border-radius: 3px;
          padding: 8px 10px;
          box-shadow: 0 4px 24px rgba(0,0,0,0.5);
        }
        .tp-maplibre-popup .maplibregl-popup-tip {
          border-top-color: #151917;
        }
        .tp-maplibre-popup .maplibregl-popup-close-button {
          display: none;
        }
        .maplibregl-ctrl-attrib { font-size: 8px !important; background: rgba(12,14,13,0.85) !important; color: #5e665c !important; }
        .maplibregl-ctrl-attrib a { color: #5e665c !important; }
        .maplibregl-ctrl-group { background: #151917 !important; border: 1px solid #232823 !important; border-radius: 3px !important; }
        .maplibregl-ctrl-group button { border-color: #232823 !important; }
        .maplibregl-ctrl-group button span { background: #cdd1c8 !important; }
        .maplibregl-map { width: 100% !important; height: 100% !important; min-height: 250px !important; }
        .tp-globe-container, .tp-globe-container > div { width: 100% !important; height: 100% !important; min-height: 250px !important; }
      `}</style>
      <div
        ref={mapContainer}
        className={className || ''}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          minHeight: '250px',
        }}
      />
    </>
  );
}
