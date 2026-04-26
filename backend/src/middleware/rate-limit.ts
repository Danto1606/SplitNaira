import rateLimit from "express-rate-limit";
import type { Request, Response } from "express";

function rateLimitHandler(req: Request, res: Response) {
  return res.status(429).json({
    error: "rate_limited",
    code: "RATE_LIMITED",
    message: "Too many requests. Please try again later.",
    requestId: res.locals.requestId as string | undefined
  });
}

/** General read endpoints — 100 requests per 15 minutes. */
export const readLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 15 * 60 * 1000),
  limit: Number(process.env.RATE_LIMIT_MAX ?? 100),
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler
});

/** Write / mutation endpoints — 30 requests per 15 minutes. */
export const writeLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 15 * 60 * 1000),
  limit: Number(process.env.RATE_LIMIT_WRITE_MAX ?? 30),
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler
});

/** Admin endpoints — 20 requests per 15 minutes. */
export const adminLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 15 * 60 * 1000),
  limit: Number(process.env.RATE_LIMIT_ADMIN_MAX ?? 20),
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler
});
