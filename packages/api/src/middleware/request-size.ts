import type { Request, Response, NextFunction } from "express";

export function requestSizeLimit(maxBytes: number = 1_048_576) {  // 1MB default
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = parseInt(req.headers["content-length"] ?? "0", 10);
    if (contentLength > maxBytes) {
      res.status(413).json({ error: `Request body too large. Maximum ${maxBytes} bytes.` });
      return;
    }
    next();
  };
}
