// ============================================================
// TRACEPOINT — Server-side AbstractAPI Phone Intelligence Proxy
// Free alternative to Twilio Lookup (100 calls/month free).
// Uses the Phone Intelligence endpoint for richer data.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';

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
    if (!apiKey) {
      return NextResponse.json(
        { error: 'AbstractAPI key not configured' },
        { status: 500 }
      );
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
