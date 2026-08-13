// ============================================================
// TRACEPOINT — NumVerify Phone Validation API Integration
// ============================================================

export interface NumVerifyResult {
  valid: boolean;
  number: string;
  local_format: string;
  international_format: string;
  country_prefix: string;
  country_code: string;
  country_name: string;
  location: string;
  carrier: string;
  line_type: string;
}

/**
 * Validate a phone number using the NumVerify API.
 * Returns null on any error (network, API error, invalid response).
 */
export async function validatePhone(
  phone: string,
  apiKey: string
): Promise<NumVerifyResult | null> {
  if (!phone || !apiKey) return null;

  try {
    const params = new URLSearchParams({
      access_key: apiKey,
      number: phone,
    });

    const response = await fetch(
      `https://apilayer.net/api/validate?${params.toString()}`,
      {
        method: 'GET',
        headers: { Accept: 'application/json' },
      }
    );

    if (!response.ok) {
      console.error(
        `[NumVerify] API returned status ${response.status}: ${response.statusText}`
      );
      return null;
    }

    const data = await response.json();

    // NumVerify returns { success: false, error: { ... } } on failures
    if (data.success === false) {
      console.error(
        `[NumVerify] API error: ${data.error?.info || data.error?.type || 'Unknown error'}`
      );
      return null;
    }

    return {
      valid: Boolean(data.valid),
      number: data.number || '',
      local_format: data.local_format || '',
      international_format: data.international_format || '',
      country_prefix: data.country_prefix || '',
      country_code: data.country_code || '',
      country_name: data.country_name || '',
      location: data.location || '',
      carrier: data.carrier || '',
      line_type: data.line_type || '',
    };
  } catch (err) {
    console.error('[NumVerify] Request failed:', err);
    return null;
  }
}
