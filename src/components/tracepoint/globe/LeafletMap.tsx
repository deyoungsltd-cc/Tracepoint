'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { DeviceLocation, GlobeMarker } from '@/lib/types';

interface LeafletMapProps {
  markers?: GlobeMarker[];
  locations?: DeviceLocation[];
  className?: string;
}

// Dark tile layer (free, no API key needed)
const DARK_TILES = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const TILE_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>';

// Amber marker icon
function createMarkerIcon(color = '#c8a24e') {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="28" viewBox="0 0 20 28"><path d="M10 0C4.48 0 0 4.48 0 10c0 7.5 10 18 10 18s10-10.5 10-18C20 4.48 15.52 0 10 0z" fill="${color}" stroke="#0f1110" stroke-width="1.5"/><circle cx="10" cy="10" r="4" fill="#0f1110"/></svg>`;
  return L.divIcon({
    html: svg,
    className: 'tp-map-marker',
    iconSize: [20, 28],
    iconAnchor: [10, 28],
    popupAnchor: [0, -28],
  });
}

export default function LeafletMap({ markers = [], locations = [], className = '' }: LeafletMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [20, 0],
      zoom: 2,
      zoomControl: false,
      attributionControl: false,
      preferCanvas: true,
    });

    L.tileLayer(DARK_TILES, { attribution: TILE_ATTR, maxZoom: 18 }).addTo(map);
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Add globe markers
    markers.forEach((m) => {
      const color = m.status === 'live' ? '#22c55e' : m.status === 'alert' ? '#ef4444' : '#c8a24e';
      const icon = createMarkerIcon(color);
      const marker = L.marker([m.lat, m.lng], { icon }).addTo(map);
      if (m.label) marker.bindPopup(`<div style="color:#d4d4cc;font-family:monospace;font-size:11px;background:#181b19;padding:4px 8px;border:1px solid #2a2e2a;border-radius:4px;">${m.label}</div>`);
    });

    // Add device locations
    locations.forEach((loc) => {
      if (!loc.latitude || !loc.longitude) return;
      const color = loc.status === 'live' ? '#22c55e' : loc.status === 'last_known' ? '#c8a24e' : '#707870';
      const icon = createMarkerIcon(color);
      const marker = L.marker([loc.latitude, loc.longitude], { icon }).addTo(map);
      const popupContent = `
        <div style="color:#d4d4cc;font-family:monospace;font-size:11px;background:#181b19;padding:6px 8px;border:1px solid #2a2e2a;border-radius:4px;min-width:160px;">
          <div style="color:#707870;font-size:9px;margin-bottom:4px;">${loc.provider?.replace(/_/g, ' ')?.toUpperCase() || 'LOCATION'}</div>
          <div style="margin-bottom:2px;">${loc.address || 'Unknown location'}</div>
          ${loc.deviceStatus ? `<div style="color:#707870;font-size:10px;">Status: ${loc.deviceStatus}</div>` : ''}
          ${loc.batteryLevel != null ? `<div style="color:#707870;font-size:10px;">Battery: ${Math.round(loc.batteryLevel)}%</div>` : ''}
          ${loc.timestamp ? `<div style="color:#707870;font-size:9px;margin-top:4px;">${new Date(loc.timestamp).toLocaleString()}</div>` : ''}
        </div>
      `;
      marker.bindPopup(popupContent);
    });

    // Fit bounds if we have markers
    const allPoints = [
      ...markers.map(m => [m.lat, m.lng]),
      ...locations.filter(l => l.latitude && l.longitude).map(l => [l.latitude!, l.longitude!]),
    ];
    if (allPoints.length > 0) {
      map.fitBounds(L.latLngBounds(allPoints as L.LatLngTuple[]), { padding: [40, 40], maxZoom: 12 });
    }

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [markers, locations]);

  return (
    <div ref={containerRef} className={className} style={{ width: '100%', height: '100%', background: '#0f1110' }} />
  );
}
