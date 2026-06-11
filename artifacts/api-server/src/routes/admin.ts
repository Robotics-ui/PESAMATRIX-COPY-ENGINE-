import { Router, type IRouter } from "express";
import { db, usersTable, auditLogsTable, paymentsTable } from "@workspace/db";
import { desc, eq, count, and } from "drizzle-orm";

const router: IRouter = Router();

router.get("/dashboard", async (_req, res) => {
  const [totalUsers] = await db
    .select({ count: count() })
    .from(usersTable);

  const [adminCount] = await db
    .select({ count: count() })
    .from(usersTable)
    .where(eq(usersTable.role, "admin"));

  const recentUsers = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      role: usersTable.role,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .orderBy(desc(usersTable.createdAt))
    .limit(10);

  const recentActivity = await db
    .select()
    .from(auditLogsTable)
    .orderBy(desc(auditLogsTable.createdAt))
    .limit(20);

  res.json({
    stats: {
      totalUsers: Number(totalUsers?.count ?? 0),
      adminUsers: Number(adminCount?.count ?? 0),
      subscriberUsers: Number(totalUsers?.count ?? 0) - Number(adminCount?.count ?? 0),
    },
    recentUsers,
    recentActivity,
  });
});

router.get("/users", async (_req, res) => {
  const users = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      role: usersTable.role,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      phone: usersTable.phone,
      createdAt: usersTable.createdAt,
      updatedAt: usersTable.updatedAt,
    })
    .from(usersTable)
    .orderBy(desc(usersTable.createdAt));

  res.json({ users });
});

router.get("/users/:id", async (req, res) => {
  const [user] = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      role: usersTable.role,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      phone: usersTable.phone,
      createdAt: usersTable.createdAt,
      updatedAt: usersTable.updatedAt,
    })
    .from(usersTable)
    .where(eq(usersTable.id, req.params.id))
    .limit(1);

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const activity = await db
    .select()
    .from(auditLogsTable)
    .where(eq(auditLogsTable.userId, req.params.id))
    .orderBy(desc(auditLogsTable.createdAt))
    .limit(50);

  res.json({ user, activity });
});

router.get("/audit-logs", async (_req, res) => {
  const logs = await db
    .select()
    .from(auditLogsTable)
    .orderBy(desc(auditLogsTable.createdAt))
    .limit(100);

  res.json({ logs });
});

router.get("/payments", async (req, res) => {
  const page = Math.max(1, parseInt(String(req.query["page"] ?? "1"), 10));
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query["limit"] ?? "20"), 10)));
  const offset = (page - 1) * limit;
  const statusFilter = req.query["status"] as string | undefined;

  const validStatuses = ["pending", "processing", "completed", "failed", "cancelled"] as const;
  type PaymentStatus = typeof validStatuses[number];
  const isValidStatus = (s: string): s is PaymentStatus => (validStatuses as readonly string[]).includes(s);

  const whereClause = statusFilter && isValidStatus(statusFilter)
    ? eq(paymentsTable.status, statusFilter)
    : undefined;

  const [payments, [countRow], statusCounts] = await Promise.all([
    whereClause
      ? db.select().from(paymentsTable).where(whereClause).orderBy(desc(paymentsTable.createdAt)).limit(limit).offset(offset)
      : db.select().from(paymentsTable).orderBy(desc(paymentsTable.createdAt)).limit(limit).offset(offset),
    whereClause
      ? db.select({ count: count() }).from(paymentsTable).where(whereClause)
      : db.select({ count: count() }).from(paymentsTable),
    Promise.all(
      validStatuses.map(async (s) => {
        const [row] = await db
          .select({ count: count() })
          .from(paymentsTable)
          .where(eq(paymentsTable.status, s));
        return { status: s, count: Number(row?.count ?? 0) };
      }),
    ),
  ]);

  const breakdown = Object.fromEntries(statusCounts.map(({ status, count }) => [status, count]));

  res.json({ payments, total: Number(countRow?.count ?? 0), breakdown });
});

export default router;
