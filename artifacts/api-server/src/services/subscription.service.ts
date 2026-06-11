import { eq, and, gt, desc, count, sum } from "drizzle-orm";
import {
  db,
  subscriptionsTable,
  paymentsTable,
  plansTable,
  adminSettingsTable,
  copyFactoryRelationshipsTable,
  usersTable,
} from "@workspace/db";
import { mpesaService } from "./mpesa.service.js";
import { relationshipService } from "./relationship.service.js";
import { logger } from "../lib/logger.js";
import { addTradingDays, countTradingDaysRemaining, tradingDaysToWeeks } from "../lib/trading-days.js";
import { getMpesaCallbackUrl } from "../lib/mpesa-callback-url.js";

const MASTER_SETTINGS_KEY = "default";

export interface SubscriptionSettings {
  subscriptionFeePerDay: number;
  minimumSubscriptionDays: number;
  maximumSubscriptionDays: number;
  winRate?: number;
  totalTradesCount?: number;
  uptimePercent?: number;
}

export interface PricingPreview {
  planId: string;
  planName: string;
  pricePerDay: number;
  days: number;
  tradingDays: number;
  tradingDaysDescription: string;
  totalAmount: number;
  startDate: Date;
  endDate: Date;
  daysUntilExpiry: number;
  tradingDaysUntilExpiry: number;
  isRenewal: boolean;
  existingEndDate: Date | null;
}

export interface ActiveSubscriptionInfo {
  id: string;
  planId: string;
  planName: string | null;
  status: string;
  isActive: boolean;
  startDate: Date | null;
  endDate: Date | null;
  daysRemaining: number;
  tradingDaysRemaining: number;
  daysTotal: number;
  amountPaid: string;
  copyFactorySubscriberId: string | null;
  isExpired: boolean;
  hasCopyFactoryRelationship: boolean;
}

export interface SubscriptionValidationResult {
  valid: boolean;
  errors: string[];
  plan: { id: string; name: string; pricePerDay: number; minimumDays: number; maximumDays: number } | null;
  effectiveMinDays: number;
  effectiveMaxDays: number;
}

export class SubscriptionService {
  async getSettings(): Promise<SubscriptionSettings> {
    const [settings] = await db
      .select({
        subscriptionFeePerDay: adminSettingsTable.subscriptionFeePerDay,
        minimumSubscriptionDays: adminSettingsTable.minimumSubscriptionDays,
        maximumSubscriptionDays: adminSettingsTable.maximumSubscriptionDays,
      })
      .from(adminSettingsTable)
      .where(eq(adminSettingsTable.key, MASTER_SETTINGS_KEY))
      .limit(1);

    return {
      subscriptionFeePerDay: Number(settings?.subscriptionFeePerDay ?? 100),
      minimumSubscriptionDays: settings?.minimumSubscriptionDays ?? 7,
      maximumSubscriptionDays: settings?.maximumSubscriptionDays ?? 365,
    };
  }

  async updateSettings(
    params: Partial<SubscriptionSettings> & { updatedBy: string },
  ): Promise<SubscriptionSettings> {
    const { updatedBy, ...fields } = params;

    await db
      .update(adminSettingsTable)
      .set({
        ...(fields.subscriptionFeePerDay !== undefined && {
          subscriptionFeePerDay: String(fields.subscriptionFeePerDay),
        }),
        ...(fields.minimumSubscriptionDays !== undefined && {
          minimumSubscriptionDays: fields.minimumSubscriptionDays,
        }),
        ...(fields.maximumSubscriptionDays !== undefined && {
          maximumSubscriptionDays: fields.maximumSubscriptionDays,
        }),
        ...(fields.winRate !== undefined && {
          winRate: String(fields.winRate),
        }),
        ...(fields.totalTradesCount !== undefined && {
          totalTradesCount: fields.totalTradesCount,
        }),
        ...(fields.uptimePercent !== undefined && {
          uptimePercent: String(fields.uptimePercent),
        }),
        updatedAt: new Date(),
        updatedBy,
      })
      .where(eq(adminSettingsTable.key, MASTER_SETTINGS_KEY));

    return this.getSettings();
  }

  async validateRequest(planId: string, days: number): Promise<SubscriptionValidationResult> {
    const errors: string[] = [];

    const [plan] = await db
      .select()
      .from(plansTable)
      .where(and(eq(plansTable.id, planId), eq(plansTable.isActive, true)))
      .limit(1);

    if (!plan) {
      return { valid: false, errors: ["Plan not found or inactive"], plan: null, effectiveMinDays: 1, effectiveMaxDays: 365 };
    }

    const adminSettings = await this.getSettings();
    const effectiveMinDays = Math.max(plan.minimumDays, adminSettings.minimumSubscriptionDays);
    const effectiveMaxDays = Math.min(plan.maximumDays, adminSettings.maximumSubscriptionDays);

    if (!Number.isInteger(days) || days < 1) {
      errors.push("Days must be a positive integer");
    } else {
      if (days < effectiveMinDays) errors.push(`Minimum subscription is ${effectiveMinDays} trading days`);
      if (days > effectiveMaxDays) errors.push(`Maximum subscription is ${effectiveMaxDays} trading days`);
    }

    return {
      valid: errors.length === 0,
      errors,
      plan: {
        id: plan.id,
        name: plan.name,
        pricePerDay: Number(plan.pricePerDay),
        minimumDays: plan.minimumDays,
        maximumDays: plan.maximumDays,
      },
      effectiveMinDays,
      effectiveMaxDays,
    };
  }

  /**
   * Calculate pricing preview using trading days (Mon–Fri only).
   * endDate is calculated by adding N trading days to startDate, skipping weekends.
   */
  async getPricingPreview(params: {
    userId: string;
    planId: string;
    days: number;
  }): Promise<PricingPreview> {
    const { userId, planId, days } = params;

    const validation = await this.validateRequest(planId, days);
    if (!validation.valid) throw new Error(validation.errors.join("; "));

    const plan = validation.plan!;
    const totalAmount = plan.pricePerDay * days;

    const [existing] = await db
      .select({ endDate: subscriptionsTable.endDate })
      .from(subscriptionsTable)
      .where(
        and(
          eq(subscriptionsTable.userId, userId),
          eq(subscriptionsTable.status, "active"),
          eq(subscriptionsTable.isActive, true),
          gt(subscriptionsTable.endDate, new Date()),
        ),
      )
      .orderBy(desc(subscriptionsTable.endDate))
      .limit(1);

    const now = new Date();
    const isRenewal = !!existing?.endDate && existing.endDate > now;
    const startDate = isRenewal ? existing.endDate! : now;

    // Use trading days for end date calculation
    const endDate = addTradingDays(startDate, days);
    const daysUntilExpiry = Math.ceil((endDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    const tradingDaysUntilExpiry = countTradingDaysRemaining(endDate);

    return {
      planId,
      planName: plan.name,
      pricePerDay: plan.pricePerDay,
      days,
      tradingDays: days,
      tradingDaysDescription: tradingDaysToWeeks(days),
      totalAmount,
      startDate,
      endDate,
      daysUntilExpiry,
      tradingDaysUntilExpiry,
      isRenewal,
      existingEndDate: existing?.endDate ?? null,
    };
  }

  async getActiveSubscription(userId: string): Promise<ActiveSubscriptionInfo | null> {
    const [row] = await db
      .select({
        sub: subscriptionsTable,
        plan: plansTable,
      })
      .from(subscriptionsTable)
      .leftJoin(plansTable, eq(plansTable.id, subscriptionsTable.planId))
      .where(
        and(
          eq(subscriptionsTable.userId, userId),
          eq(subscriptionsTable.status, "active"),
          eq(subscriptionsTable.isActive, true),
        ),
      )
      .orderBy(desc(subscriptionsTable.endDate))
      .limit(1);

    if (!row) return null;

    const now = new Date();
    const endDate = row.sub.endDate;
    const isExpired = endDate ? endDate <= now : false;
    const daysRemaining = endDate
      ? Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)))
      : 0;
    const tradingDaysRemaining = endDate ? countTradingDaysRemaining(endDate) : 0;

    const [cfRelationship] = await db
      .select({ id: copyFactoryRelationshipsTable.id })
      .from(copyFactoryRelationshipsTable)
      .where(
        and(
          eq(copyFactoryRelationshipsTable.subscriberUserId, userId),
          eq(copyFactoryRelationshipsTable.isActive, true),
        ),
      )
      .limit(1);

    return {
      id: row.sub.id,
      planId: row.sub.planId,
      planName: row.plan?.name ?? null,
      status: row.sub.status,
      isActive: row.sub.isActive,
      startDate: row.sub.startDate,
      endDate,
      daysRemaining,
      tradingDaysRemaining,
      daysTotal: row.sub.numberOfDays,
      amountPaid: row.sub.amountPaid,
      copyFactorySubscriberId: row.sub.copyFactorySubscriberId,
      isExpired,
      hasCopyFactoryRelationship: !!cfRelationship,
    };
  }

  async initiateRenewal(params: {
    userId: string;
    planId: string;
    days: number;
    phone: string;
  }): Promise<{ paymentId: string; subscriptionId: string; checkoutRequestId: string; amount: number; customerMessage: string; renewalStartDate: Date }> {
    const { userId, planId, days, phone } = params;

    const validation = await this.validateRequest(planId, days);
    if (!validation.valid) throw new Error(validation.errors.join("; "));

    const plan = validation.plan!;
    const totalAmount = plan.pricePerDay * days;

    const [existingActive] = await db
      .select({ endDate: subscriptionsTable.endDate })
      .from(subscriptionsTable)
      .where(
        and(
          eq(subscriptionsTable.userId, userId),
          eq(subscriptionsTable.status, "active"),
          eq(subscriptionsTable.isActive, true),
          gt(subscriptionsTable.endDate, new Date()),
        ),
      )
      .orderBy(desc(subscriptionsTable.endDate))
      .limit(1);

    const now = new Date();
    const renewalStartDate = existingActive?.endDate ?? now;

    // Trading days — end date skips weekends
    const renewalEndDate = addTradingDays(renewalStartDate, days);

    const [newSubscription] = await db
      .insert(subscriptionsTable)
      .values({
        userId,
        planId,
        status: "pending",
        isActive: false,
        numberOfDays: days,
        amountPaid: String(totalAmount),
        startDate: renewalStartDate,
        endDate: renewalEndDate,
      })
      .returning();

    const [payment] = await db
      .insert(paymentsTable)
      .values({
        userId,
        subscriptionId: newSubscription.id,
        amount: String(totalAmount),
        phone: mpesaService.normalizePhone(phone),
        status: "pending",
      })
      .returning();

    try {
      const callbackUrl = getMpesaCallbackUrl();

      const stkResult = await mpesaService.initiateStkPush({
        phone,
        amount: totalAmount,
        accountRef: `RNW-${newSubscription.id.slice(0, 8).toUpperCase()}`,
        description: `PesaMatrix Renewal`,
        callbackUrl,
      });

      await db
        .update(paymentsTable)
        .set({
          status: "processing",
          checkoutRequestId: stkResult.checkoutRequestId,
          merchantRequestId: stkResult.merchantRequestId,
          updatedAt: new Date(),
        })
        .where(eq(paymentsTable.id, payment.id));

      logger.info(
        { userId, subscriptionId: newSubscription.id, renewalStartDate, renewalEndDate, tradingDays: days },
        "Renewal STK push initiated (trading days)",
      );

      return {
        paymentId: payment.id,
        subscriptionId: newSubscription.id,
        checkoutRequestId: stkResult.checkoutRequestId,
        amount: totalAmount,
        customerMessage: stkResult.customerMessage,
        renewalStartDate,
      };
    } catch (err) {
      await db.update(paymentsTable).set({ status: "failed", updatedAt: new Date() }).where(eq(paymentsTable.id, payment.id));
      await db.update(subscriptionsTable).set({ status: "cancelled", updatedAt: new Date() }).where(eq(subscriptionsTable.id, newSubscription.id));
      throw err;
    }
  }

  async activateSubscription(subscriptionId: string): Promise<void> {
    const [sub] = await db
      .select()
      .from(subscriptionsTable)
      .where(eq(subscriptionsTable.id, subscriptionId))
      .limit(1);

    if (!sub) throw new Error("Subscription not found");
    if (sub.status === "active") return;

    const now = new Date();
    const startDate = sub.startDate && sub.startDate > now ? sub.startDate : now;

    // Recalculate end date using trading days from the actual start date
    const endDate =
      sub.endDate && sub.endDate > startDate
        ? sub.endDate
        : addTradingDays(startDate, sub.numberOfDays);

    await db
      .update(subscriptionsTable)
      .set({ status: "active", isActive: true, startDate, endDate, updatedAt: new Date() })
      .where(eq(subscriptionsTable.id, subscriptionId));

    await relationshipService.onSubscriptionActivated({
      subscriptionId,
      userId: sub.userId,
    }).catch((err) => {
      logger.error({ err, subscriptionId }, "CopyFactory attach failed during activation");
    });

    logger.info({ subscriptionId, startDate, endDate, tradingDays: sub.numberOfDays }, "Subscription activated (trading days)");
  }

  async cancelSubscription(params: {
    subscriptionId: string;
    userId: string;
    adminOverride?: boolean;
  }): Promise<void> {
    const { subscriptionId, userId, adminOverride = false } = params;

    const [sub] = await db
      .select()
      .from(subscriptionsTable)
      .where(
        adminOverride
          ? eq(subscriptionsTable.id, subscriptionId)
          : and(eq(subscriptionsTable.id, subscriptionId), eq(subscriptionsTable.userId, userId)),
      )
      .limit(1);

    if (!sub) throw new Error("Subscription not found");
    if (sub.status === "cancelled") return;

    await db
      .update(subscriptionsTable)
      .set({ status: "cancelled", isActive: false, updatedAt: new Date() })
      .where(eq(subscriptionsTable.id, subscriptionId));

    await relationshipService.onSubscriptionExpired({
      subscriptionId,
      userId: sub.userId,
      reason: "cancelled",
    }).catch((err) => {
      logger.error({ err, subscriptionId }, "CopyFactory detach failed during cancellation");
    });

    logger.info({ subscriptionId, userId: sub.userId }, "Subscription cancelled");
  }

  async expireSubscription(subscriptionId: string): Promise<void> {
    const [sub] = await db
      .select()
      .from(subscriptionsTable)
      .where(eq(subscriptionsTable.id, subscriptionId))
      .limit(1);

    if (!sub) throw new Error("Subscription not found");
    if (sub.status === "expired") return;

    await db
      .update(subscriptionsTable)
      .set({ status: "expired", isActive: false, updatedAt: new Date() })
      .where(eq(subscriptionsTable.id, subscriptionId));

    await relationshipService.onSubscriptionExpired({
      subscriptionId,
      userId: sub.userId,
      reason: "expired",
    }).catch((err) => {
      logger.error({ err, subscriptionId }, "CopyFactory detach failed during expiry");
    });

    logger.info({ subscriptionId, userId: sub.userId }, "Subscription manually expired");
  }

  async listAllSubscriptions(params: {
    status?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ subscriptions: unknown[]; total: number }> {
    const { status, limit = 50, offset = 0 } = params;

    const baseQuery = db
      .select({
        subscription: subscriptionsTable,
        plan: plansTable,
        user: {
          id: usersTable.id,
          email: usersTable.email,
          firstName: usersTable.firstName,
          lastName: usersTable.lastName,
          phone: usersTable.phone,
        },
      })
      .from(subscriptionsTable)
      .leftJoin(plansTable, eq(plansTable.id, subscriptionsTable.planId))
      .leftJoin(usersTable, eq(usersTable.id, subscriptionsTable.userId));

    const [rows, [countRow]] = await Promise.all([
      status
        ? baseQuery
            .where(eq(subscriptionsTable.status, status as "active" | "pending" | "expired" | "cancelled"))
            .orderBy(desc(subscriptionsTable.createdAt))
            .limit(limit)
            .offset(offset)
        : baseQuery
            .orderBy(desc(subscriptionsTable.createdAt))
            .limit(limit)
            .offset(offset),
      db.select({ count: count() }).from(subscriptionsTable).then((r) => r),
    ]);

    return { subscriptions: rows, total: Number(countRow?.count ?? 0) };
  }

  async getStats(): Promise<{
    total: number;
    active: number;
    expired: number;
    pending: number;
    cancelled: number;
    totalRevenue: number;
    activeRevenue: number;
  }> {
    const [allRows, revenueRow] = await Promise.all([
      db
        .select({ status: subscriptionsTable.status, count: count() })
        .from(subscriptionsTable)
        .groupBy(subscriptionsTable.status),
      db
        .select({ total: sum(subscriptionsTable.amountPaid) })
        .from(subscriptionsTable)
        .where(eq(subscriptionsTable.status, "active")),
    ]);

    const totalRevenue = await db
      .select({ total: sum(paymentsTable.amount) })
      .from(paymentsTable)
      .where(eq(paymentsTable.status, "completed"));

    const byStatus = Object.fromEntries(allRows.map((r) => [r.status, Number(r.count)]));

    return {
      total: allRows.reduce((s, r) => s + Number(r.count), 0),
      active: byStatus["active"] ?? 0,
      expired: byStatus["expired"] ?? 0,
      pending: byStatus["pending"] ?? 0,
      cancelled: byStatus["cancelled"] ?? 0,
      totalRevenue: Number(totalRevenue[0]?.total ?? 0),
      activeRevenue: Number(revenueRow[0]?.total ?? 0),
    };
  }
}

export const subscriptionService = new SubscriptionService();
