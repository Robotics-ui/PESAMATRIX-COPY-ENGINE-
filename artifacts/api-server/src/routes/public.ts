import { Router, type IRouter } from "express";
import { db, subscriptionsTable, paymentsTable, adminSettingsTable, plansTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";

const router: IRouter = Router();

/**
 * GET /public/plans
 * Returns active subscription plans for the landing/subscribe page.
 */
router.get("/plans", async (_req, res) => {
  const plans = await db
    .select()
    .from(plansTable)
    .where(eq(plansTable.isActive, true))
    .orderBy(plansTable.pricePerDay);

  res.json({ plans });
});

/**
 * GET /public/stats
 * Returns live platform stats for the public landing page.
 * No authentication required.
 */
router.get("/stats", async (_req, res) => {
  const [
    [activeSubRow],
    [completedPayRow],
    [settings],
  ] = await Promise.all([
    db
      .select({ count: count() })
      .from(subscriptionsTable)
      .where(eq(subscriptionsTable.status, "active")),
    db
      .select({ count: count() })
      .from(paymentsTable)
      .where(eq(paymentsTable.status, "completed")),
    db
      .select({
        winRate: adminSettingsTable.winRate,
        totalTradesCount: adminSettingsTable.totalTradesCount,
        uptimePercent: adminSettingsTable.uptimePercent,
        updatedAt: adminSettingsTable.updatedAt,
      })
      .from(adminSettingsTable)
      .where(eq(adminSettingsTable.key, "default"))
      .limit(1),
  ]);

  res.json({
    activeSubscribers: Number(activeSubRow?.count ?? 0),
    completedPayments: Number(completedPayRow?.count ?? 0),
    winRate: parseFloat(settings?.winRate ?? "74.0"),
    totalTradesCount: Number(settings?.totalTradesCount ?? 50000),
    uptimePercent: parseFloat(settings?.uptimePercent ?? "99.9"),
    lastUpdated: settings?.updatedAt ?? new Date(),
  });
});

export default router;
