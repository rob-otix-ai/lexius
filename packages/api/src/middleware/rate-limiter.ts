import type { Request, Response, NextFunction } from "express";

interface RateLimitStore {
  [ip: string]: { count: number; resetAt: number };
}

const store: RateLimitStore = {};

export function rateLimiter(options: { windowMs?: number; max?: number } = {}) {
  const windowMs = options.windowMs ?? 60_000;  // 1 minute
  const max = options.max ?? 100;               // 100 requests per window

  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
    const now = Date.now();

    if (!store[ip] || store[ip].resetAt < now) {
      store[ip] = { count: 1, resetAt: now + windowMs };
    } else {
      store[ip].count++;
    }

    res.setHeader("X-RateLimit-Limit", max);
    res.setHeader("X-RateLimit-Remaining", Math.max(0, max - store[ip].count));
    res.setHeader("X-RateLimit-Reset", Math.ceil(store[ip].resetAt / 1000));

    if (store[ip].count > max) {
      res.status(429).json({ error: "Too many requests. Try again later." });
      return;
    }

    next();
  };
}
