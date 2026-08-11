// ============================================================
// TRACEPOINT — AbstractAPI Phone Intelligence Client
// Free alternative to Twilio Lookup.
// https://www.abstractapi.com/phone-intelligence-api
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
  type: string;              // mobile, landline, voip, toll_free, premium_rate, etc.
  carrier: string;
  connected: boolean;        // Is the phone currently connected/active?
  roaming: boolean | null;
  dialling_code: string | null;
  // Phone Intelligence extras (may not always be present)
  risk_score?: number;       // 0-100 fraud risk
  is_sms_enabled?: boolean;
  caller_name?: string;
}

/**
 * Look up a phone number via AbstractAPI Phone Intelligence (server-side proxy).
 * Returns enriched phone data: carrier, line type, location, connection status, risk score.
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
    return data as AbstractPhoneResult;
  } catch {
    return null;
  }
}
