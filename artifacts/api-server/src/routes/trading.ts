import { Router, type IRouter } from "express";
import { eq, desc, and, gte, count, sum, sql } from "drizzle-orm";
import {
  db,
  tradeSyncsTable,
  subscriptionsTable,
  plansTable,
  adminSettingsTable,
} from "@workspace/db";
import { authenticate } from "../middlewares/authenticate.js";
import type { AuthRequest } from "../middlewares/authenticate.js";

const router: IRouter = Router();

/**
 * GET /trading/signals
 * Recent copied trade signals for the authenticated subscriber.
 */
router.get("/signals", authenticate, async (req: AuthRequest, res) => {
  const signals = await db
    .select()
    .from(tradeSyncsTable)
    .where(eq(tradeSyncsTable.subscriberUserId, req.user!.userId))
    .orderBy(desc(tradeSyncsTable.createdAt))
    .limit(50);

  res.json({ signals, total: signals.length });
});

/**
 * GET /trading/performance
 * Win rate, profit totals, weekly chart data for the subscriber.
 */
router.get("/performance", authenticate, async (req: AuthRequest, res) => {
  const allTrades = await db
    .select({
      id: tradeSyncsTable.id,
      profit: tradeSyncsTable.profit,
      pips: tradeSyncsTable.pips,
      type: tradeSyncsTable.type,
      createdAt: tradeSyncsTable.createdAt,
    })
    .from(tradeSyncsTable)
    .where(
      and(
        eq(tradeSyncsTable.subscriberUserId, req.user!.userId),
        eq(tradeSyncsTable.type, "close"),
      ),
    )
    .orderBy(desc(tradeSyncsTable.createdAt));

  const closedTrades = allTrades.filter((t) => t.type === "close");
  const totalTrades = closedTrades.length;
  const winningTrades = closedTrades.filter(
    (t) => t.profit !== null && parseFloat(t.profit) > 0,
  ).length;
  const losingTrades = totalTrades - winningTrades;
  const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

  const totalProfit = closedTrades.reduce(
    (acc, t) => acc + (t.profit ? parseFloat(t.profit) : 0),
    0,
  );
  const totalPips = closedTrades.reduce(
    (acc, t) => acc + (t.pips ? parseFloat(t.pips) : 0),
    0,
  );

  // Build weekly aggregated data (last 8 weeks)
  const weekMap: Record<string, { week: string; profit: number; trades: number }> = {};
  const now = new Date();
  for (let i = 7; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 7);
    const weekLabel = `W${d.getMonth() + 1}/${d.getDate()}`;
    weekMap[weekLabel] = { week: weekLabel, profit: 0, trades: 0 };
  }

  for (const trade of closedTrades) {
    const tradeDate = new Date(trade.createdAt);
    const daysAgo = Math.floor(
      (now.getTime() - tradeDate.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (daysAgo <= 56) {
      const weekIndex = Math.floor(daysAgo / 7);
      const d = new Date(now);
      d.setDate(d.getDate() - weekIndex * 7);
      const weekLabel = `W${d.getMonth() + 1}/${d.getDate()}`;
      if (weekMap[weekLabel]) {
        weekMap[weekLabel].profit += trade.profit ? parseFloat(trade.profit) : 0;
        weekMap[weekLabel].trades += 1;
      }
    }
  }

  res.json({
    totalTrades,
    winningTrades,
    losingTrades,
    winRate: Math.round(winRate * 10) / 10,
    totalProfit: Math.round(totalProfit * 100) / 100,
    totalPips: Math.round(totalPips * 10) / 10,
    weeklyData: Object.values(weekMap),
  });
});

/**
 * GET /trading/dashboard
 * Aggregated dashboard summary for the subscriber.
 */
router.get("/dashboard", authenticate, async (req: AuthRequest, res) => {
  const userId = req.user!.userId;

  // Get total signals count and this week's count
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const [totalSignalsRow, weekSignalsRow, allClosedTrades] = await Promise.all([
    db
      .select({ count: count() })
      .from(tradeSyncsTable)
      .where(eq(tradeSyncsTable.subscriberUserId, userId)),
    db
      .select({ count: count() })
      .from(tradeSyncsTable)
      .where(
        and(
          eq(tradeSyncsTable.subscriberUserId, userId),
          gte(tradeSyncsTable.createdAt, oneWeekAgo),
        ),
      ),
    db
      .select({ profit: tradeSyncsTable.profit })
      .from(tradeSyncsTable)
      .where(
        and(
          eq(tradeSyncsTable.subscriberUserId, userId),
          eq(tradeSyncsTable.type, "close"),
        ),
      ),
  ]);

  const totalSignals = Number(totalSignalsRow[0]?.count ?? 0);
  const signalsThisWeek = Number(weekSignalsRow[0]?.count ?? 0);

  const closedTrades = allClosedTrades;
  const totalClosed = closedTrades.length;
  const winning = closedTrades.filter(
    (t) => t.profit !== null && parseFloat(t.profit) > 0,
  ).length;
  const winRate = totalClosed > 0 ? (winning / totalClosed) * 100 : 0;

  const totalProfit = closedTrades.reduce(
    (acc, t) => acc + (t.profit ? parseFloat(t.profit) : 0),
    0,
  );

  // Get active subscription
  const [activeSub] = await db
    .select({
      subscription: subscriptionsTable,
      plan: plansTable,
    })
    .from(subscriptionsTable)
    .leftJoin(plansTable, eq(plansTable.id, subscriptionsTable.planId))
    .where(
      and(
        eq(subscriptionsTable.userId, userId),
        eq(subscriptionsTable.isActive, true),
      ),
    )
    .orderBy(desc(subscriptionsTable.endDate))
    .limit(1);

  let daysRemaining: number | null = null;
  let subscriptionEndDate: Date | null = null;
  let activePlan: string | null = null;

  if (activeSub?.subscription?.endDate) {
    const now = new Date();
    const end = new Date(activeSub.subscription.endDate);
    const diffMs = end.getTime() - now.getTime();
    daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    subscriptionEndDate = end;
    activePlan = activeSub.plan?.name ?? null;
  }

  res.json({
    totalSignals,
    signalsThisWeek,
    winRate: Math.round(winRate * 10) / 10,
    winRateChange: 0,
    activePlan,
    totalProfit: Math.round(totalProfit * 100) / 100,
    profitChangePercent: 0,
    isSubscriptionActive: !!activeSub?.subscription?.isActive,
    daysRemaining,
    subscriptionEndDate: subscriptionEndDate?.toISOString() ?? null,
  });
});

export default router;
