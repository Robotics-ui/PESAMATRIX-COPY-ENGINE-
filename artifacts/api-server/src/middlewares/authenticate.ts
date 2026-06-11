import { Request, Response, NextFunction } from "express";
import { verifyAccessToken, type TokenPayload } from "../lib/auth.js";

export interface AuthRequest extends Request {
  user?: TokenPayload;
}

export function authenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid Authorization header" });
    return;
  }

  const token = authHeader.slice(7);
  try {
    req.user = verifyAccessToken(token);
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired access token" });
  }
}
