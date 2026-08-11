// ============================================================
// TRACEPOINT — Live Device Tracker Client
// Sends GPS pings to the /api/tracker endpoint and subscribes to Realtime updates.
// ============================================================

export interface TrackingPing {
  id: string;
  device_id: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  battery_level: number | null;
  network_type: string | null;
  speed: number | null;
  heading: number | null;
  created_at: string;
}

export interface DeviceTrackerConfig {
  deviceId: string;
 intervalMs?: number;       // Default: 30000 (30s)
  enableHighAccuracy?: boolean;
  onLocation?: (ping: TrackingPing) => void;
  onError?: (error: string) => void;
}

let watchId: number | null = null;
let intervalId: ReturnType<typeof setInterval> | null = null;
let lastPing: TrackingPing | null = null;

/**
 * Send a GPS ping to the tracking server.
 */
async function sendPing(config: DeviceTrackerConfig, position: GeolocationPosition): Promise<TrackingPing | null> {
  try {
    const battery = await getBatteryLevel();
    const connection = getConnectionType();

    const payload = {
      device_id: config.deviceId,
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      battery_level: battery,
      network_type: connection,
      speed: position.coords.speed,
      heading: position.coords.heading,
    };

    const res = await fetch('/api/tracker', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      config.onError?.(`Tracker HTTP ${res.status}`);
      return null;
    }

    const data = await res.json();
    const ping: TrackingPing = {
      id: data.ping_id || crypto.randomUUID(),
      device_id: config.deviceId,
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      battery_level: battery,
      network_type: connection,
      speed: position.coords.speed,
      heading: position.coords.heading,
      created_at: new Date().toISOString(),
    };

    lastPing = ping;
    config.onLocation?.(ping);
    return ping;
  } catch (err) {
    config.onError?.(err instanceof Error ? err.message : 'Tracker error');
    return null;
  }
}

/**
 * Start tracking device location.
 * Uses the Geolocation Watch API for continuous tracking.
 */
export function startTracking(config: DeviceTrackerConfig): void {
  if (!navigator.geolocation) {
    config.onError?.('Geolocation not supported by this browser');
    return;
  }

  const interval = config.intervalMs || 30000;

  // Get initial position immediately
  navigator.geolocation.getCurrentPosition(
    (pos) => sendPing(config, pos),
    (err) => config.onError?.(`Geolocation error: ${err.message}`),
    { enableHighAccuracy: config.enableHighAccuracy ?? true, timeout: 15000, maximumAge: 0 }
  );

  // Watch for position changes
  watchId = navigator.geolocation.watchPosition(
    (pos) => sendPing(config, pos),
    (err) => config.onError?.(`Geolocation error: ${err.message}`),
    { enableHighAccuracy: config.enableHighAccuracy ?? true, timeout: 15000, maximumAge: 0 }
  );

  // Also send periodic pings as fallback (in case watchPosition doesn't fire)
  intervalId = setInterval(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => sendPing(config, pos),
      () => { /* silence periodic errors */ },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
    );
  }, interval);
}

/**
 * Stop tracking device location.
 */
export function stopTracking(): void {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
  lastPing = null;
}

/**
 * Get the last recorded ping.
 */
export function getLastPing(): TrackingPing | null {
  return lastPing;
}

/**
 * Fetch tracking history for a device from the server.
 */
export async function getTrackingHistory(deviceId: string): Promise<TrackingPing[]> {
  try {
    const res = await fetch(`/api/tracker?device_id=${encodeURIComponent(deviceId)}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.pings || [];
  } catch {
    return [];
  }
}

/**
 * Subscribe to real-time tracking updates via Supabase Realtime.
 */
export function subscribeToTrackingUpdates(
  onPing: (ping: TrackingPing) => void
): { unsubscribe: () => void } | null {
  // Dynamic import to avoid SSR issues
  if (typeof window === 'undefined') return null;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return null;

  // This runs client-side only
  let channel: import('@supabase/supabase-js').RealtimeChannel | null = null;

  (async () => {
    const { createClient } = await import('@supabase/supabase-js');
    const client = createClient(supabaseUrl, supabaseKey);
    channel = client.channel('tracking');
    channel
      .on('broadcast', { event: 'ping' }, (payload: { payload: TrackingPing }) => {
        onPing(payload.payload);
      })
      .subscribe();
  })();

  return {
    unsubscribe: () => { channel?.unsubscribe(); },
  };
}

// ---- Helpers ----

async function getBatteryLevel(): Promise<number | null> {
  try {
    const nav = navigator as Navigator & { getBattery?: () => Promise<{ level: number }> };
    if (nav.getBattery) {
      const battery = await nav.getBattery();
      return Math.round(battery.level * 100);
    }
  } catch { /* not supported */ }
  return null;
}

function getConnectionType(): string {
  try {
    const conn = (navigator as Navigator & { connection?: { effectiveType?: string } }).connection;
    return conn?.effectiveType?.toUpperCase() || 'UNKNOWN';
  } catch { return 'UNKNOWN'; }
}
