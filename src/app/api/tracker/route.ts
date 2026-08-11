// ============================================================
// TRACEPOINT — Real-time Device GPS Tracking Endpoint
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

type TrackingPing = {
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
};

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function getSupabaseAnonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// ---------- POST: Record a GPS ping ----------
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { device_id, latitude, longitude, accuracy, battery_level, network_type, speed, heading } = body;

    if (!device_id || latitude == null || longitude == null) {
      return NextResponse.json(
        { error: 'device_id, latitude, and longitude are required' },
        { status: 400 }
      );
    }

    const lat = Number(latitude);
    const lng = Number(longitude);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return NextResponse.json({ error: 'latitude and longitude must be numbers' }, { status: 400 });
    }

    const pingId = uuidv4();
    const createdAt = new Date().toISOString();

    const supabase = getSupabaseClient();
    if (supabase) {
      const ping: Record<string, unknown> = {
        id: pingId,
        device_id,
        latitude: lat,
        longitude: lng,
        created_at: createdAt,
      };

      if (accuracy != null) ping.accuracy = Number(accuracy);
      if (battery_level != null) ping.battery_level = Number(battery_level);
      if (network_type != null) ping.network_type = String(network_type);
      if (speed != null) ping.speed = Number(speed);
      if (heading != null) ping.heading = Number(heading);

      const { error: insertError } = await supabase
        .from('tracking_pings')
        .insert(ping);

      if (insertError) {
        console.error('[Tracker] DB insert error:', insertError.message);
        return NextResponse.json({ error: 'Failed to store ping' }, { status: 500 });
      }

      // Broadcast via Supabase Realtime if the channel is available
      try {
        const anonClient = getSupabaseAnonClient();
        if (anonClient) {
          const channel = anonClient.channel('tracking');
          channel.subscribe((status: string) => {
            if (status === 'SUBSCRIBED') {
              channel.send({
                type: 'broadcast',
                event: 'ping',
                payload: ping,
              });
            }
          });
        }
      } catch {
        // Realtime broadcast is best-effort — don't fail the request
      }
    }

    return NextResponse.json({ success: true, ping_id: pingId });
  } catch (err) {
    console.error('[Tracker] POST error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// ---------- GET: Retrieve latest pings for a device ----------
export async function GET(request: NextRequest) {
  try {
    const deviceId = request.nextUrl.searchParams.get('device_id');
    if (!deviceId) {
      return NextResponse.json({ error: 'device_id query param is required' }, { status: 400 });
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      );
    }

    const { data, error } = await supabase
      .from('tracking_pings')
      .select('*')
      .eq('device_id', deviceId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('[Tracker] DB query error:', error.message);
      return NextResponse.json({ error: 'Failed to fetch pings' }, { status: 500 });
    }

    const pings: TrackingPing[] = (data ?? []).map((row: Record<string, unknown>) => ({
      id: row.id as string,
      device_id: row.device_id as string,
      latitude: row.latitude as number,
      longitude: row.longitude as number,
      accuracy: (row.accuracy as number) ?? null,
      battery_level: (row.battery_level as number) ?? null,
      network_type: (row.network_type as string) ?? null,
      speed: (row.speed as number) ?? null,
      heading: (row.heading as number) ?? null,
      created_at: row.created_at as string,
    }));

    return NextResponse.json({ success: true, pings });
  } catch (err) {
    console.error('[Tracker] GET error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
