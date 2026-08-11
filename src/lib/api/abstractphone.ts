// ============================================================
// TRACEPOINT — AbstractAPI Phone Validation Client
// Free alternative to Twilio Lookup.
// https://www.abstractapi.com/phone-validation-api
// ============================================================

export interface AbstractPhoneResult {
  phone: string;
  valid: boolean;
  format: {
    international: string;
    local: string;
    national: string;
    rfc3966: string;
    e164: string;
  };
  country: {
    code: string;
    name: string;
    prefix: string;
  };
  location: string;
  type: string;           // mobile, landline, voip, toll_free, etc.
  carrier: string;
  connected: boolean;     // Is the phone currently connected/active?
  roaming: boolean | null;
  dialling_code: string | null;
}

/**
 * Look up a phone number via AbstractAPI (server-side proxy).
 * Returns enriched phone data: carrier, line type, location, connection status.
 */
export async function lookupAbstractPhone(phone: string): Promise<AbstractPhoneResult | null> {
  try {
    const res = await fetch('/api/abstractphone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    });

    if (!res.ok) return null;
    const data = await res.json();

    // The API returns the result nested under the phone number key
    // e.g. { "+1234567890": { valid: true, carrier: "...", ... } }
    // But our proxy extracts the inner object, so we just return data directly.
    return data as AbstractPhoneResult;
  } catch {
    return null;
  }
}
