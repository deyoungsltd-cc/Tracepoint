// ============================================================
// TRACEPOINT — Provider Health Check API
// Tests each API provider's connectivity and returns status.
// ============================================================

import { NextResponse } from 'next/server';

interface ProviderHealth {
  name: string;
  isConfigured: boolean;
  isHealthy: boolean;
  latencyMs: number | null;
  error: string | null;
}

export async function GET() {
  const results: ProviderHealth[] = [];

  // 1. NumVerify
  try {
    const key = !!process.env.NUMVERIFY_API_KEY;
    const t0 = Date.now();
    const res = await fetch(`https://apilayer.net/api/validate?access_key=${process.env.NUMVERIFY_API_KEY}&number=+14155552671`);
    const ms = Date.now() - t0;
    const data = await res.json();
    results.push({ name: 'NumVerify', isConfigured: key, isHealthy: res.ok, latencyMs: ms, error: res.ok ? null : `${res.status}: ${JSON.stringify(data).substring(0, 100)}` });
  } catch (e: any) {
    results.push({ name: 'NumVerify', isConfigured: !!process.env.NUMVERIFY_API_KEY, isHealthy: false, latencyMs: null, error: e.message });
  }

  // 2. AbstractAPI
  try {
    const key = !!process.env.ABSTRACT_API_KEY;
    const t0 = Date.now();
    const res = await fetch(`https://phoneintelligence.abstractapi.com/v1/?api_key=${process.env.ABSTRACT_API_KEY}&phone=+14155552671`);
    const ms = Date.now() - t0;
    const data = await res.json();
    results.push({ name: 'AbstractAPI', isConfigured: key, isHealthy: res.ok, latencyMs: ms, error: res.ok ? null : `${res.status}: ${JSON.stringify(data).substring(0, 100)}` });
  } catch (e: any) {
    results.push({ name: 'AbstractAPI', isConfigured: !!process.env.ABSTRACT_API_KEY, isHealthy: false, latencyMs: null, error: e.message });
  }

  // 3. Serper
  try {
    const key = !!(process.env.SERPER_API_KEY || process.env.NEXT_PUBLIC_SERPER_API_KEY);
    const t0 = Date.now();
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-KEY': process.env.SERPER_API_KEY || '' },
      body: JSON.stringify({ q: 'test', num: 1 }),
    });
    const ms = Date.now() - t0;
    results.push({ name: 'Serper', isConfigured: key, isHealthy: res.ok, latencyMs: ms, error: res.ok ? null : `${res.status}` });
  } catch (e: any) {
    results.push({ name: 'Serper', isConfigured: !!(process.env.SERPER_API_KEY), isHealthy: false, latencyMs: null, error: e.message });
  }

  // 4. OpenAI
  try {
    const key = !!process.env.OPENAI_API_KEY;
    const t0 = Date.now();
    const res = await fetch('https://api.openai.com/v1/models', {
      headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
    });
    const ms = Date.now() - t0;
    results.push({ name: 'OpenAI', isConfigured: key, isHealthy: res.ok, latencyMs: ms, error: res.ok ? null : `${res.status}` });
  } catch (e: any) {
    results.push({ name: 'OpenAI', isConfigured: !!process.env.OPENAI_API_KEY, isHealthy: false, latencyMs: null, error: e.message });
  }

  // 5. Supabase
  try {
    const url = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const t0 = Date.now();
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/profiles?select=id&limit=1`, {
      headers: { 'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '', 'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''}` },
    });
    const ms = Date.now() - t0;
    results.push({ name: 'Supabase', isConfigured: url && key, isHealthy: res.ok || res.status === 200, latencyMs: ms, error: res.ok ? null : `status ${res.status}` });
  } catch (e: any) {
    results.push({ name: 'Supabase', isConfigured: !!(process.env.NEXT_PUBLIC_SUPABASE_URL), isHealthy: false, latencyMs: null, error: e.message });
  }

  const allConfigured = results.every(r => r.isConfigured);
  const allHealthy = results.every(r => r.isHealthy);

  return NextResponse.json({
    status: allHealthy ? 'healthy' : allConfigured ? 'degraded' : 'misconfigured',
    providers: results,
    timestamp: new Date().toISOString(),
  });
}
