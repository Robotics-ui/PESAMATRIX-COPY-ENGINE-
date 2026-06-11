import { pgTable, uuid, text, boolean, timestamp, pgEnum, index } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const deploymentStatusEnum = pgEnum("deployment_status", [
  "not_deployed",
  "deploying",
  "deployed",
  "failed",
  "removed",
]);

export const syncStatusEnum = pgEnum("sync_status", [
  "not_synced",
  "synchronizing",
  "synchronized",
  "out_of_sync",
  "error",
]);

export const mt5AccountsTable = pgTable(
  "mt5_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    login: text("login").notNull(),
    broker: text("broker").notNull(),
    server: text("server").notNull(),
    deploymentStatus: deploymentStatusEnum("deployment_status").notNull().default("not_deployed"),
    synchronizationStatus: syncStatusEnum("synchronization_status").notNull().default("not_synced"),
    isMaster: boolean("is_master").notNull().default(false),
    metaApiAccountId: text("meta_api_account_id"),
    region: text("region").notNull().default("london"),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("mt5_accounts_user_id_idx").on(t.userId),
    index("mt5_accounts_deployment_status_idx").on(t.deploymentStatus),
    index("mt5_accounts_meta_api_account_id_idx").on(t.metaApiAccountId),
  ],
);

export const insertMt5AccountSchema = createInsertSchema(mt5AccountsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const selectMt5AccountSchema = createSelectSchema(mt5AccountsTable);
export type InsertMt5Account = z.infer<typeof insertMt5AccountSchema>;
export type Mt5Account = typeof mt5AccountsTable.$inferSelect;
