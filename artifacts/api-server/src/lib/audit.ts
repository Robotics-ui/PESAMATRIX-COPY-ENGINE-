import { db, auditLogsTable } from "@workspace/db";
import type { Request } from "express";

type AuditAction = typeof auditLogsTable.$inferInsert["action"];

export async function logAudit(
  action: AuditAction,
  req: Request,
  options: {
    userId?: string;
    targetId?: string;
    targetType?: string;
    metadata?: Record<string, unknown>;
  } = {},
): Promise<void> {
  try {
    await db.insert(auditLogsTable).values({
      action,
      userId: options.userId ?? null,
      targetId: options.targetId ?? null,
      targetType: options.targetType ?? null,
      metadata: options.metadata ?? null,
      ipAddress: req.ip ?? req.socket?.remoteAddress ?? null,
      userAgent: req.headers["user-agent"] ?? null,
    });
  } catch {
  }
}
