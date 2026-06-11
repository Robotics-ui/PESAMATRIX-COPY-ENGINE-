import { pgTable, uuid, text, timestamp, numeric, pgEnum, index } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { subscriptionsTable } from "./subscriptions";

export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "processing",
  "completed",
  "failed",
  "cancelled",
]);

export const paymentsTable = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    subscriptionId: uuid("subscription_id").references(() => subscriptionsTable.id),
    amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
    phone: text("phone").notNull(),
    status: paymentStatusEnum("status").notNull().default("pending"),
    mpesaRef: text("mpesa_ref"),
    stkPushRef: text("stk_push_ref"),
    checkoutRequestId: text("checkout_request_id"),
    merchantRequestId: text("merchant_request_id"),
    resultCode: text("result_code"),
    resultDesc: text("result_desc"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("payments_user_id_idx").on(t.userId),
    index("payments_status_idx").on(t.status),
    index("payments_checkout_request_id_idx").on(t.checkoutRequestId),
    index("payments_mpesa_ref_idx").on(t.mpesaRef),
  ],
);

export const insertPaymentSchema = createInsertSchema(paymentsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const selectPaymentSchema = createSelectSchema(paymentsTable);
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Payment = typeof paymentsTable.$inferSelect;
