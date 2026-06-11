import { Response, NextFunction } from "express";
import { type AuthRequest } from "./authenticate.js";

export function requireRole(...roles: ("admin" | "subscriber")[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthenticated" });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    next();
  };
}
