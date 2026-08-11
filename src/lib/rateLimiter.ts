// ============================================================
// TRACEPOINT — In-memory rate limiter
// Per-instance only (serverless-safe). Useful for burst protection.
// ============================================================

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

const DEFAULT_LIMIT = 30;
const DEFAULT_WINDOW_MS = 60_000; // 1 minute
const CLEANUP_INTERVAL_MS = 300_000; // 5 minutes
let lastCleanup = Date.now();

/**
 * Check rate limit for a given IP address.
 * Auto-cleans expired entries every 5 minutes.
 */
export function checkRateLimit(
  ip: string,
  limit: number = DEFAULT_LIMIT,
  windowMs: number = DEFAULT_WINDOW_MS,
): RateLimitResult {
  const now = Date.now();

  // Periodic cleanup of expired entries
  if (now - lastCleanup > CLEANUP_INTERVAL_MS) {
    for (const [key, entry] of store) {
      if (now >= entry.resetAt) {
        store.delete(key);
      }
    }
    lastCleanup = now;
  }

  const existing = store.get(ip);

  // If no entry or window expired, start fresh
  if (!existing || now >= existing.resetAt) {
    const resetAt = now + windowMs;
    store.set(ip, { count: 1, resetAt });
    return { allowed: true, remaining: limit - 1, resetAt };
  }

  // Within window — check count
  const entry = existing;
  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count += 1;
  return { allowed: true, remaining: limit - entry.count, resetAt: entry.resetAt };
}

/**
 * Next.js middleware-compatible helper.
 * Returns a NextResponse with 429 if rate limited, or null if allowed.
 * Adds standard rate-limit headers to the response.
 */
export function rateLimitMiddleware(
  request: Request,
  limit?: number,
  windowMs?: number,
): { response: Response; headers: Record<string, string> } | null {
  // Extract IP from common proxy headers, falling back to remote addr
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const ip = forwarded?.split(',')[0]?.trim() || realIp || 'unknown';

  const result = checkRateLimit(ip, limit, windowMs);

  const headers: Record<string, string> = {
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
  };

  if (!result.allowed) {
    const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);
    return {
      response: new Response(
        JSON.stringify({ error: 'Too many requests', retryAfter }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(retryAfter),
            ...headers,
          },
        },
      ),
      headers,
    };
  }

  return null;
}
