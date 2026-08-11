// ============================================================
// TRACEPOINT — AbstractAPI Phone Intelligence Client
// Free alternative to Twilio Lookup.
// https://www.abstractapi.com/phone-intelligence-api
// ============================================================

/** Normalized output — what the pipeline expects */
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
  connected: boolean | null;  // Is the phone currently connected/active?
  roaming: boolean | null;
  dialling_code: string | null;
  // Phone Intelligence extras (may not always be present)
  risk_score?: number;        // 0-100 fraud risk
  risk_level?: string;
  is_sms_enabled?: boolean;
  caller_name?: string;
  is_voip?: boolean;
  line_status?: string;
}

/** Raw response from AbstractAPI Phone Intelligence v1 */
interface AbstractApiRawResponse {
  phone_number?: string;
  phone_format?: {
    international?: string;
    national?: string;
    local?: string;
    e164?: string;
    rfc3966?: string;
  };
  phone_carrier?: {
    name?: string;
    line_type?: string;
    mcc?: string | number;
    mnc?: string;
  };
  phone_location?: {
    country_name?: string;
    country_code?: string;
    country_prefix?: string;
    region?: string;
    city?: string;
    timezone?: string;
  };
  phone_validation?: {
    is_valid?: boolean;
    line_status?: string;
    is_voip?: boolean;
  };
  phone_registration?: {
    name?: string | null;
    type?: string | null;
  };
  phone_risk?: {
    risk_level?: string;
    risk_score?: number;
    is_disposable?: boolean;
    is_abuse_detected?: boolean;
  };
  phone_messaging?: {
    sms_domain?: string;
    sms_email?: string;
  };
  phone_breaches?: any;
  // Legacy flat format (some older plans)
  valid?: boolean;
  format?: { international?: string; local?: string; national?: string; rfc3966?: string; e164?: string };
  country?: { code?: string; name?: string; prefix?: string };
  location?: string;
  type?: string;
  carrier?: string;
  connected?: boolean;
  roaming?: boolean | null;
  dialling_code?: string | null;
  risk_score?: number;
  is_sms_enabled?: boolean;
  caller_name?: string;
}

/**
 * Normalize the AbstractAPI response into a flat, predictable shape.
 * AbstractAPI changed their response format — this handles both old and new.
 */
function normalizeAbstractResponse(raw: AbstractApiRawResponse): AbstractPhoneResult {
  // New nested format
  if (raw.phone_validation || raw.phone_carrier || raw.phone_location) {
    const isValid = raw.phone_validation?.is_valid ?? false;
    const lineType = raw.phone_carrier?.line_type || 'unknown';
    const carrierName = raw.phone_carrier?.name || '';
    const city = raw.phone_location?.city || '';
    const region = raw.phone_location?.region || '';
    const location = [city, region].filter(Boolean).join(', ');
    const lineStatus = raw.phone_validation?.line_status || '';
    const isVoip = raw.phone_validation?.is_voip ?? false;
    const connected = lineStatus === 'connected' ? true : lineStatus === 'disconnected' ? false : null;
    const riskScore = raw.phone_risk?.risk_score;
    const riskLevel = raw.phone_risk?.risk_level;
    const callerName = raw.phone_registration?.name || undefined;

    return {
      phone: raw.phone_number || '',
      valid: isValid,
      format: {
        international: raw.phone_format?.international || raw.format?.international || '',
        local: raw.phone_format?.local || raw.format?.local || '',
        national: raw.phone_format?.national || raw.format?.national || '',
        rfc3966: raw.phone_format?.rfc3966 || raw.format?.rfc3966 || '',
        e164: raw.phone_format?.e164 || raw.format?.e164 || '',
      },
      country: {
        code: raw.phone_location?.country_code || raw.country?.code || '',
        name: raw.phone_location?.country_name || raw.country?.name || '',
        prefix: raw.phone_location?.country_prefix || raw.country?.prefix || '',
      },
      location,
      type: isVoip ? 'voip' : lineType,
      carrier: carrierName,
      connected,
      roaming: null,
      dialling_code: null,
      risk_score: riskScore,
      risk_level: riskLevel,
      caller_name: callerName,
      is_voip: isVoip,
      line_status: lineStatus,
    };
  }

  // Legacy flat format fallback
  return {
    phone: raw.phone_number || '',
    valid: raw.valid ?? false,
    format: {
      international: raw.format?.international || '',
      local: raw.format?.local || '',
      national: raw.format?.national || '',
      rfc3966: raw.format?.rfc3966 || '',
      e164: raw.format?.e164 || '',
    },
    country: {
      code: raw.country?.code || '',
      name: raw.country?.name || '',
      prefix: raw.country?.prefix || '',
    },
    location: raw.location || '',
    type: raw.type || 'unknown',
    carrier: raw.carrier || '',
    connected: raw.connected ?? null,
    roaming: raw.roaming ?? null,
    dialling_code: raw.dialling_code ?? null,
    risk_score: raw.risk_score,
    caller_name: raw.caller_name,
    is_voip: raw.type === 'voip',
    line_status: raw.connected ? 'connected' : 'unknown',
  };
}

/**
 * Look up a phone number via AbstractAPI Phone Intelligence (server-side proxy).
 * Returns normalized enriched phone data.
 */
export async function lookupAbstractPhone(phone: string): Promise<AbstractPhoneResult | null> {
  try {
    const res = await fetch('/api/abstractphone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    });

    if (!res.ok) {
      console.error(`[AbstractPhone] API returned ${res.status}`);
      return null;
    }
    const raw = await res.json() as AbstractApiRawResponse;
    const normalized = normalizeAbstractResponse(raw);
    console.log(`[AbstractPhone] Normalized: valid=${normalized.valid}, type=${normalized.type}, carrier=${normalized.carrier}, location=${normalized.location}, risk=${normalized.risk_level}`);
    return normalized;
  } catch (err) {
    console.error('[AbstractPhone] fetch failed:', err);
    return null;
  }
}
