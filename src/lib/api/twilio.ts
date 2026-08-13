// ============================================================
// TRACEPOINT — Twilio Lookup API Client Proxy
// Calls /api/twilio server-side route to keep credentials safe.
// ============================================================

export interface TwilioLookupResult {
  caller_name?: { first_name: string; last_name: string; caller_name: string };
  carrier?: { mobile_country_code: string; mobile_network_code: string; name: string; type: string };
  line_type_intelligence?: { type: string; mobile_country_code: string; mobile_network_code: string; carrier_name: string };
  call_forwarding?: { enabled: boolean };
  status?: { status: string };
}

/**
 * Look up rich phone metadata via the Twilio Lookup API (server proxy).
 * Returns parsed JSON or null on any failure. Never throws.
 */
export async function lookupTwilio(
  phone: string
): Promise<TwilioLookupResult | null> {
  if (!phone) return null;

  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const response = await fetch(`${origin}/api/twilio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    });

    if (!response.ok) {
      console.error(`[Twilio Proxy] API returned status ${response.status}`);
      return null;
    }

    const data = await response.json();

    // If the server returned an error object, treat as failure
    if (data.error) {
      console.warn(`[Twilio Proxy] ${data.error}`);
      return null;
    }

    return data as TwilioLookupResult;
  } catch (err) {
    console.error('[Twilio Proxy] Request failed:', err);
    return null;
  }
}
