import { Router, type IRouter } from "express";
import { db, subscriptionsTable, paymentsTable, adminSettingsTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";

const router: IRouter = Router();

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
