import { pgTable, uuid, text, timestamp, numeric, jsonb, pgEnum, index } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { copyFactoryRelationshipsTable } from "./copyFactoryRelationships";

export const tradeSyncTypeEnum = pgEnum("trade_sync_type", [
  "open",
  "close",
  "modify",
]);

export const tradeSyncDirectionEnum = pgEnum("trade_sync_direction", [
  "buy",
  "sell",
]);

export const tradeSyncsTable = pgTable(
  "trade_syncs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    subscriberUserId: uuid("subscriber_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    cfRelationshipId: uuid("cf_relationship_id").references(() => copyFactoryRelationshipsTable.id),
    masterDealId: text("master_deal_id"),
    subscriberDealId: text("subscriber_deal_id"),
    symbol: text("symbol").notNull(),
    type: tradeSyncTypeEnum("type").notNull(),
    direction: tradeSyncDirectionEnum("direction").notNull(),
    volume: numeric("volume", { precision: 10, scale: 2 }),
    openPrice: numeric("open_price", { precision: 18, scale: 8 }),
    closePrice: numeric("close_price", { precision: 18, scale: 8 }),
    stopLoss: numeric("stop_loss", { precision: 18, scale: 8 }),
    takeProfit: numeric("take_profit", { precision: 18, scale: 8 }),
    profit: numeric("profit", { precision: 10, scale: 2 }),
    pips: numeric("pips", { precision: 10, scale: 2 }),
    openedAt: timestamp("opened_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    rawData: jsonb("raw_data"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("trade_syncs_subscriber_user_id_idx").on(t.subscriberUserId),
    index("trade_syncs_symbol_idx").on(t.symbol),
    index("trade_syncs_created_at_idx").on(t.createdAt),
    index("trade_syncs_cf_relationship_id_idx").on(t.cfRelationshipId),
  ],
);

export const insertTradeSyncSchema = createInsertSchema(tradeSyncsTable).omit({
  id: true,
  createdAt: true,
});
export const selectTradeSyncSchema = createSelectSchema(tradeSyncsTable);
export type InsertTradeSync = z.infer<typeof insertTradeSyncSchema>;
export type TradeSync = typeof tradeSyncsTable.$inferSelect;
