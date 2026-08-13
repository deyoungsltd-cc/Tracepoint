// ============================================================
// TRACEPOINT — Server-side Serper.dev Web Search Proxy
// Returns mock data when API key is not configured (Demo Mode).
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { generateMockSerperResults } from '@/lib/api/mock-data';

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json();
    if (!query) return NextResponse.json({ error: 'query required' }, { status: 400 });

    const apiKey = process.env.SERPER_API_KEY || process.env.NEXT_PUBLIC_SERPER_API_KEY;

    // --- DEMO MODE: Return mock data when key not configured ---
    if (!apiKey || !apiKey.trim()) {
      console.log('[Serper] DEMO MODE — returning mock data');
      const mockData = generateMockSerperResults(query);
      return NextResponse.json(mockData, {
        headers: { 'X-Mock': 'true' },
      });
    }

    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-KEY': apiKey },
      body: JSON.stringify({ q: query, num: 10 }),
    });

    if (!response.ok) {
      console.error(`[Serper] ${response.status}: ${response.statusText}`);
      return NextResponse.json({ error: `Serper API error: ${response.status}` }, { status: 502 });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error('[Serper] Error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
