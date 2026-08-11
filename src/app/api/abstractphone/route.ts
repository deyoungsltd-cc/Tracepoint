// ============================================================
// TRACEPOINT — Server-side AbstractAPI Phone Validation Proxy
// Free alternative to Twilio Lookup (100 calls/month free).
// https://www.abstractapi.com/phone-validation-api
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
        { error: 'AbstractAPI key not configured. Get a free key at https://www.abstractapi.com/phone-validation-api' },
        { status: 500 }
      );
    }

    const url = `https://phonevalidation.abstractapi.com/v1/?api_key=${apiKey}&phone=${encodeURIComponent(phone)}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        // AbstractAPI doesn't need auth headers — key is in query param
      },
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      console.error(`[AbstractPhone] ${response.status}: ${body}`);
      return NextResponse.json(
        { error: `AbstractAPI error: ${response.status}` },
        { status: 502 }
      );
    }

    const data = await response.json();

    // AbstractAPI returns: { "phone": "...", "valid": true, "carrier": "...", ... }
    // Pass through the full response
    return NextResponse.json(data);
  } catch (err) {
    console.error('[AbstractPhone] Error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
