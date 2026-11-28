import type { NextFunction, Request, Response } from 'express';

export function securityHeaders(
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(self), payment=(), usb=()',
  );
  // Allow iframe embedding in AI Studio preview while blocking MIME sniffing
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  next();
}

interface RateBucket {
  count: number;
  resetAtMs: number;
}

export interface RateLimiterOptions {
  windowMs: number;
  maxRequests: number;
  keyPrefix: string;
  message?: string;
}

export function createRateLimiter(options: RateLimiterOptions) {
  const buckets = new Map<string, RateBucket>();
  const maxBuckets = 2000;

  return function rateLimitMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    const now = Date.now();

    if (buckets.size >= maxBuckets) {
      for (const [k, b] of buckets.entries()) {
        if (now > b.resetAtMs) buckets.delete(k);
      }
      while (buckets.size >= maxBuckets) {
        const oldestKey = buckets.keys().next().value;
        if (oldestKey === undefined) break;
        buckets.delete(oldestKey);
      }
    }

    const clientIp = req.ip || req.socket?.remoteAddress || 'unknown';

    const key = `${options.keyPrefix}:${clientIp}`;
    const existing = buckets.get(key);

    if (!existing || now > existing.resetAtMs) {
      buckets.set(key, {
        count: 1,
        resetAtMs: now + options.windowMs,
      });
      res.setHeader('X-RateLimit-Limit', String(options.maxRequests));
      res.setHeader('X-RateLimit-Remaining', String(options.maxRequests - 1));
      next();
      return;
    }

    if (existing.count >= options.maxRequests) {
      const retryAfterSec = Math.max(
        1,
        Math.ceil((existing.resetAtMs - now) / 1000),
      );
      res.setHeader('Retry-After', String(retryAfterSec));
      res.setHeader('X-RateLimit-Limit', String(options.maxRequests));
      res.setHeader('X-RateLimit-Remaining', '0');
      res.status(429).json({
        error:
          options.message ||
          'Too many requests. Please wait a moment and try again.',
      });
      return;
    }

    existing.count += 1;
    res.setHeader('X-RateLimit-Limit', String(options.maxRequests));
    res.setHeader(
      'X-RateLimit-Remaining',
      String(Math.max(0, options.maxRequests - existing.count)),
    );
    next();
  };
}
