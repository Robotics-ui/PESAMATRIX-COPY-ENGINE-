import { pgTable, uuid, text, boolean, timestamp, pgEnum, index } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { mt5AccountsTable } from "./mt5Accounts";

export const metaApiStateEnum = pgEnum("meta_api_state", [
  "created",
  "provisioning",
  "deployed",
  "undeployed",
  "error",
]);

export const metaApiAccountsTable = pgTable(
  "meta_api_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    mt5AccountId: uuid("mt5_account_id")
      .notNull()
      .references(() => mt5AccountsTable.id, { onDelete: "cascade" }),
    metaApiId: text("meta_api_id").notNull().unique(),
    state: metaApiStateEnum("state").notNull().default("created"),
    connectionStatus: text("connection_status"),
    isMaster: boolean("is_master").notNull().default(false),
    region: text("region").notNull().default("london"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("meta_api_accounts_user_id_idx").on(t.userId),
    index("meta_api_accounts_mt5_account_id_idx").on(t.mt5AccountId),
    index("meta_api_accounts_meta_api_id_idx").on(t.metaApiId),
  ],
);

export const insertMetaApiAccountSchema = createInsertSchema(metaApiAccountsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const selectMetaApiAccountSchema = createSelectSchema(metaApiAccountsTable);
export type InsertMetaApiAccount = z.infer<typeof insertMetaApiAccountSchema>;
export type MetaApiAccount = typeof metaApiAccountsTable.$inferSelect;
