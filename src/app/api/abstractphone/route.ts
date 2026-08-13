// ============================================================
// TRACEPOINT — Server-side AbstractAPI Phone Intelligence Proxy
// Returns mock data when API key is not configured (Demo Mode).
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { generateMockAbstractPhone } from '@/lib/api/mock-data';

export async function POST(request: NextRequest) {
  try {
    const { phone } = await request.json();
    if (!phone || typeof phone !== 'string') {
      return NextResponse.json(
        { error: 'phone field is required and must be a string' },
        { status: 400 }
      );
    }

    const apiKey = process.env.ABSTRACT_API_KEY;

    // --- DEMO MODE: Return mock data when key not configured ---
    if (!apiKey || !apiKey.trim()) {
      console.log('[AbstractPhone] DEMO MODE — returning mock data');
      const mockData = generateMockAbstractPhone(phone);
      return NextResponse.json(mockData, {
        headers: { 'X-Mock': 'true' },
      });
    }

    // Phone Intelligence endpoint (richer than phone validation)
    const url = `https://phoneintelligence.abstractapi.com/v1/?api_key=${apiKey}&phone=${encodeURIComponent(phone)}`;

    const response = await fetch(url);

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      console.error(`[AbstractPhone] ${response.status}: ${body}`);
      return NextResponse.json(
        { error: `AbstractAPI error: ${response.status}` },
        { status: 502 }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error('[AbstractPhone] Error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
