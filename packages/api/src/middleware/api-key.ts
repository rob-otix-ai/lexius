import type { Request, Response, NextFunction } from "express";

export function apiKeyAuth(options: { headerName?: string; envVar?: string } = {}) {
  const headerName = options.headerName ?? "x-api-key";
  const envVar = options.envVar ?? "LEXIUS_API_KEY";
  const expectedKey = process.env[envVar];

  // If no API key configured, skip auth (open mode)
  if (!expectedKey) {
    return (_req: Request, _res: Response, next: NextFunction) => next();
  }

  return (req: Request, res: Response, next: NextFunction) => {
    const providedKey = req.headers[headerName];
    if (providedKey !== expectedKey) {
      res.status(401).json({ error: "Invalid or missing API key." });
      return;
    }
    next();
  };
}
