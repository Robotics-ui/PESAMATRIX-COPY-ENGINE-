import { pgTable, uuid, text, boolean, timestamp, numeric, pgEnum, index } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { metaApiAccountsTable } from "./metaApiAccounts";
import { subscriptionsTable } from "./subscriptions";

export const cfRelationshipStatusEnum = pgEnum("cf_relationship_status", [
  "pending",
  "active",
  "paused",
  "removed",
  "error",
]);

export const copyFactoryRelationshipsTable = pgTable(
  "copy_factory_relationships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    subscriberUserId: uuid("subscriber_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    subscriberMetaApiAccountId: uuid("subscriber_meta_api_account_id")
      .notNull()
      .references(() => metaApiAccountsTable.id, { onDelete: "cascade" }),
    masterMetaApiAccountId: uuid("master_meta_api_account_id")
      .notNull()
      .references(() => metaApiAccountsTable.id),
    subscriptionId: uuid("subscription_id").references(() => subscriptionsTable.id),
    copyFactoryStrategyId: text("copy_factory_strategy_id").notNull(),
    copyFactorySubscriberId: text("copy_factory_subscriber_id"),
    status: cfRelationshipStatusEnum("status").notNull().default("pending"),
    multiplier: numeric("multiplier", { precision: 5, scale: 2 }).notNull().default("1.0"),
    isActive: boolean("is_active").notNull().default(false),
    activatedAt: timestamp("activated_at", { withTimezone: true }),
    deactivatedAt: timestamp("deactivated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("cf_relationships_subscriber_user_id_idx").on(t.subscriberUserId),
    index("cf_relationships_status_idx").on(t.status),
    index("cf_relationships_subscription_id_idx").on(t.subscriptionId),
    index("cf_relationships_strategy_id_idx").on(t.copyFactoryStrategyId),
  ],
);

export const insertCopyFactoryRelationshipSchema = createInsertSchema(copyFactoryRelationshipsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const selectCopyFactoryRelationshipSchema = createSelectSchema(copyFactoryRelationshipsTable);
export type InsertCopyFactoryRelationship = z.infer<typeof insertCopyFactoryRelationshipSchema>;
export type CopyFactoryRelationship = typeof copyFactoryRelationshipsTable.$inferSelect;
