import { pgTable, uuid, text, timestamp, jsonb, pgEnum, index } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const auditActionEnum = pgEnum("audit_action", [
  "user_register",
  "user_login",
  "user_logout",
  "user_update",
  "subscription_created",
  "subscription_activated",
  "subscription_expired",
  "subscription_cancelled",
  "payment_initiated",
  "payment_completed",
  "payment_failed",
  "mt5_account_added",
  "mt5_account_removed",
  "copy_factory_subscriber_added",
  "copy_factory_subscriber_removed",
  "admin_settings_updated",
  "admin_plan_created",
  "admin_plan_updated",
]);

export const auditLogsTable = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => usersTable.id, { onDelete: "set null" }),
    action: auditActionEnum("action").notNull(),
    targetId: text("target_id"),
    targetType: text("target_type"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("audit_logs_user_id_idx").on(t.userId),
    index("audit_logs_action_idx").on(t.action),
    index("audit_logs_created_at_idx").on(t.createdAt),
  ],
);

export const insertAuditLogSchema = createInsertSchema(auditLogsTable).omit({
  id: true,
  createdAt: true,
});
export const selectAuditLogSchema = createSelectSchema(auditLogsTable);
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogsTable.$inferSelect;
