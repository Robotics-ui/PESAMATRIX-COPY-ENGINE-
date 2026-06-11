import { Router, type IRouter } from "express";
import { db, usersTable, auditLogsTable } from "@workspace/db";
import { desc, eq, count } from "drizzle-orm";
import { authenticate } from "../middlewares/authenticate.js";
import { requireRole } from "../middlewares/requireRole.js";

const router: IRouter = Router();

router.use(authenticate, requireRole("admin"));

router.get("/admin/dashboard", async (_req, res) => {
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

router.get("/admin/users", async (_req, res) => {
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

router.get("/admin/users/:id", async (req, res) => {
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

router.get("/admin/audit-logs", async (_req, res) => {
  const logs = await db
    .select()
    .from(auditLogsTable)
    .orderBy(desc(auditLogsTable.createdAt))
    .limit(100);

  res.json({ logs });
});

export default router;
