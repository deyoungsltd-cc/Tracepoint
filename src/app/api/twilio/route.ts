// ============================================================
// TRACEPOINT — Server-side Twilio Lookup API Proxy
// ============================================================

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { phone } = await request.json();
    if (!phone || typeof phone !== 'string') {
      return NextResponse.json({ error: 'phone field is required and must be a string' }, { status: 400 });
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (!accountSid || !authToken) {
      return NextResponse.json({ error: 'Twilio credentials not configured' }, { status: 500 });
    }

    const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    const fields = 'caller_name,line_type_intelligence,carrier,call_forwarding,status,identity_match';
    const url = `https://lookups.twilio.com/v2/PhoneNumbers/${encodeURIComponent(phone)}?Fields=${fields}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Basic ${credentials}`,
      },
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      console.error(`[Twilio] ${response.status}: ${body}`);
      return NextResponse.json(
        { error: `Twilio API error: ${response.status}` },
        { status: 502 }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error('[Twilio] Error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
