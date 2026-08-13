// ============================================================
// TRACEPOINT — WhatsApp / Telegram OSINT Module
// Checks if a phone number is registered on messaging platforms.
// Uses web search + known indicators (no unauthorized API access).
// ============================================================

interface MessagingCheckResult {
  platform: string;
  indicator: string;
  isRegistered: boolean | 'unknown';
  evidence: string;
  avatarUrl: string | null;
  lastSeen: string | null;
  username: string | null;
}

/**
 * Check WhatsApp indicators for a phone number.
 * Uses web search to find public references to the number on WhatsApp.
 * Direct WhatsApp API access requires authorization — this uses OSINT only.
 */
export async function checkWhatsApp(phone: string): Promise<MessagingCheckResult> {
  const cleanPhone = phone.replace(/[^0-9+]/g, '');
  
  try {
    // Search for public WhatsApp references
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const res = await fetch(`${origin}/api/serper`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `"${cleanPhone}" whatsapp OR wa.me`, num: 5 }),
    });
    
    if (!res.ok) return unknownResult('WhatsApp', cleanPhone);
    
    const data = await res.json();
    const results = data.organic || [];
    
    // Check if wa.me link appears (strong indicator)
    const hasWaMeLink = results.some((r: { link?: string }) => 
      r.link?.includes('wa.me/') || r.link?.includes('web.whatsapp.com')
    );
    
    // Check for WhatsApp group directories, spam databases
    const hasDirectoryListing = results.some((r: { link?: string; snippet?: string }) => 
      r.link?.includes('whatsapp.com') || 
      (r.snippet?.toLowerCase().includes('whatsapp') && r.snippet?.toLowerCase().includes(cleanPhone.replace('+', '')))
    );
    
    const isRegistered = hasWaMeLink || hasDirectoryListing ? true : 'unknown' as const;
    
    return {
      platform: 'WhatsApp',
      indicator: hasWaMeLink ? 'wa.me link found' : hasDirectoryListing ? 'Directory listing found' : 'No public references',
      isRegistered,
      evidence: results.map((r: { snippet?: string }) => r.snippet || '').filter(Boolean).join(' '),
      avatarUrl: null,
      lastSeen: null,
      username: null,
    };
  } catch {
    return unknownResult('WhatsApp', cleanPhone);
  }
}

/**
 * Check Telegram indicators for a phone number or username.
 * Uses web search + t.me link detection.
 */
export async function checkTelegram(phone: string): Promise<MessagingCheckResult> {
  const cleanPhone = phone.replace(/[^0-9+]/g, '');
  
  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const res = await fetch(`${origin}/api/serper`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `"${cleanPhone}" telegram OR t.me`, num: 5 }),
    });
    
    if (!res.ok) return unknownResult('Telegram', cleanPhone);
    
    const data = await res.json();
    const results = data.organic || [];
    
    // Check for t.me profile links
    const telegramLinks = results.filter((r: { link?: string }) => 
      r.link?.includes('t.me/')
    );
    
    // Extract username from t.me links
    let username: string | null = null;
    for (const r of telegramLinks) {
      const match = r.link?.match(/t\.me\/([a-zA-Z0-9_]{5,})/);
      if (match && match[1] !== 'joinchat' && match[1] !== 'share') {
        username = match[1];
        break;
      }
    }
    
    const isRegistered = telegramLinks.length > 0 ? true : 'unknown' as const;
    
    return {
      platform: 'Telegram',
      indicator: username ? `t.me/${username}` : telegramLinks.length > 0 ? 'Telegram links found' : 'No public references',
      isRegistered,
      evidence: results.map((r: { snippet?: string }) => r.snippet || '').filter(Boolean).join(' '),
      avatarUrl: null,
      lastSeen: null,
      username,
    };
  } catch {
    return unknownResult('Telegram', cleanPhone);
  }
}

/**
 * Check Signal indicators for a phone number.
 */
export async function checkSignal(phone: string): Promise<MessagingCheckResult> {
  const cleanPhone = phone.replace(/[^0-9+]/g, '');
  
  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const res = await fetch(`${origin}/api/serper`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `"${cleanPhone}" signal messenger`, num: 5 }),
    });
    
    if (!res.ok) return unknownResult('Signal', cleanPhone);
    
    const data = await res.json();
    const results = data.organic || [];
    const hasSignalRef = results.some((r: { snippet?: string }) => 
      r.snippet?.toLowerCase().includes('signal')
    );
    
    return {
      platform: 'Signal',
      indicator: hasSignalRef ? 'Signal references found' : 'No public references',
      isRegistered: hasSignalRef ? true : 'unknown' as const,
      evidence: results.map((r: { snippet?: string }) => r.snippet || '').filter(Boolean).join(' '),
      avatarUrl: null,
      lastSeen: null,
      username: null,
    };
  } catch {
    return unknownResult('Signal', cleanPhone);
  }
}

/**
 * Run all messaging platform checks.
 */
export async function checkAllMessagingPlatforms(phone: string): Promise<MessagingCheckResult[]> {
  const [whatsapp, telegram, signal] = await Promise.allSettled([
    checkWhatsApp(phone),
    checkTelegram(phone),
    checkSignal(phone),
  ]);

  const results: MessagingCheckResult[] = [];
  for (const r of [whatsapp, telegram, signal]) {
    if (r.status === 'fulfilled') results.push(r.value);
  }
  return results;
}

function unknownResult(platform: string, phone: string): MessagingCheckResult {
  return {
    platform,
    indicator: 'Check unavailable',
    isRegistered: 'unknown',
    evidence: '',
    avatarUrl: null,
    lastSeen: null,
    username: null,
  };
}

export type { MessagingCheckResult };
