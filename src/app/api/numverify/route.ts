// ============================================================
// TRACEPOINT — Server-side NumVerify Phone Validation Proxy
// ============================================================

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const phone = request.nextUrl.searchParams.get('phone');
    if (!phone) return NextResponse.json({ error: 'phone required' }, { status: 400 });

    const apiKey = process.env.NUMVERIFY_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'NumVerify API key not configured' }, { status: 500 });

    const params = new URLSearchParams({ access_key: apiKey, number: phone });
    const response = await fetch(`https://apilayer.net/api/validate?${params.toString()}`);

    if (!response.ok) {
      console.error(`[NumVerify] ${response.status}: ${response.statusText}`);
      return NextResponse.json({ error: `NumVerify API error: ${response.status}` }, { status: 502 });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error('[NumVerify] Error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
