import { pgTable, uuid, text, integer, timestamp, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const adminSettingsTable = pgTable("admin_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: text("key").notNull().unique(),
  subscriptionFeePerDay: numeric("subscription_fee_per_day", {
    precision: 10,
    scale: 2,
  })
    .notNull()
    .default("100"),
  minimumSubscriptionDays: integer("minimum_subscription_days").notNull().default(7),
  maximumSubscriptionDays: integer("maximum_subscription_days").notNull().default(365),
  copyFactoryStrategyId: text("copy_factory_strategy_id"),
  masterMt5Login: text("master_mt5_login"),
  masterMetaApiAccountId: text("master_meta_api_account_id"),
  mpesaShortcode: text("mpesa_shortcode"),
  winRate: numeric("win_rate", { precision: 5, scale: 2 }).notNull().default("74.0"),
  totalTradesCount: integer("total_trades_count").notNull().default(50000),
  uptimePercent: numeric("uptime_percent", { precision: 5, scale: 2 }).notNull().default("99.9"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: uuid("updated_by"),
});

export const insertAdminSettingsSchema = createInsertSchema(adminSettingsTable).omit({
  id: true,
  updatedAt: true,
});
export const selectAdminSettingsSchema = createSelectSchema(adminSettingsTable);
export type InsertAdminSettings = z.infer<typeof insertAdminSettingsSchema>;
export type AdminSettings = typeof adminSettingsTable.$inferSelect;
