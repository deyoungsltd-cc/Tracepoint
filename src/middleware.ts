// ============================================================
// TRACEPOINT — Next.js Middleware
// - Rate limits all /api/ routes (except /api/setup)
// - Adds security headers to all responses
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rateLimiter';

const RATE_LIMIT_EXCLUDED = ['/api/setup'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // --- Rate limiting on /api/ routes ---
  if (pathname.startsWith('/api/')) {
    const isExcluded = RATE_LIMIT_EXCLUDED.some(
      (excluded) => pathname === excluded || pathname.startsWith(excluded + '/')
    );
    if (!isExcluded) {
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        || request.headers.get('x-real-ip')
        || 'unknown';

      const result = checkRateLimit(ip);

      if (!result.allowed) {
        const retryAfter = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));
        return NextResponse.json(
          { error: 'Too many requests', retryAfter },
          {
            status: 429,
            headers: {
              'Retry-After': String(retryAfter),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': String(result.resetAt),
              'X-Content-Type-Options': 'nosniff',
              'X-Frame-Options': 'DENY',
              'Referrer-Policy': 'strict-origin-when-cross-origin',
            },
          }
        );
      }

      // Allowed — add rate limit info headers
      const response = NextResponse.next();
      response.headers.set('X-RateLimit-Remaining', String(result.remaining));
      response.headers.set('X-RateLimit-Reset', String(result.resetAt));
      response.headers.set('X-Content-Type-Options', 'nosniff');
      response.headers.set('X-Frame-Options', 'DENY');
      response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
      return response;
    }
  }

  // Non-API routes — just add security headers
  const response = NextResponse.next();
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  return response;
}

export const config = {
  matcher: [
    '/api/:path*',
  ],
};
