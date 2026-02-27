import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// In-memory rate limit store
// NOTE: In production with multiple Vercel serverless instances, replace with
// Vercel KV or Upstash Redis for shared state across instances.
// For low-volume MVP, in-memory is acceptable — each instance gets its own limit.
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 10; // 10 checkout session creations per minute per IP

export function proxy(request: NextRequest) {
  // Only rate-limit the checkout session creation endpoint
  if (request.nextUrl.pathname !== '/api/create-checkout-session') {
    return NextResponse.next();
  }

  // Only rate-limit POST requests
  if (request.method !== 'POST') {
    return NextResponse.next();
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown';

  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (entry && now < entry.resetTime) {
    if (entry.count >= MAX_REQUESTS) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait a moment and try again.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((entry.resetTime - now) / 1000)),
          },
        }
      );
    }
    entry.count++;
  } else {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
  }

  // Cleanup stale entries every ~100 requests to prevent memory leak
  if (rateLimitMap.size > 1000) {
    for (const [key, val] of rateLimitMap.entries()) {
      if (now > val.resetTime) {
        rateLimitMap.delete(key);
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/api/create-checkout-session',
};
