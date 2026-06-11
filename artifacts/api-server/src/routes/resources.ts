import { Router, type IRouter } from "express";
import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { db, resourcesTable } from "@workspace/db";
import { validateBody } from "../middlewares/validate.js";
import { authenticate } from "../middlewares/authenticate.js";
import { requireRole } from "../middlewares/requireRole.js";

const router: IRouter = Router();

const CreateResourceSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(["pdf", "document", "guide", "ebook", "link"]),
  url: z.string().min(1),
  category: z.string().default("general"),
});

const UpdateResourceSchema = CreateResourceSchema.partial().extend({
  isActive: z.boolean().optional(),
});

// Public: list active resources
router.get("/", async (req, res) => {
  const category = req.query["category"] as string | undefined;
  const search = req.query["search"] as string | undefined;

  let rows = await db
    .select()
    .from(resourcesTable)
    .where(eq(resourcesTable.isActive, true))
    .orderBy(desc(resourcesTable.createdAt));

  if (category) rows = rows.filter((r) => r.category === category);
  if (search) {
    const q = search.toLowerCase();
    rows = rows.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        (r.description ?? "").toLowerCase().includes(q),
    );
  }

  res.json({ resources: rows });
});

// Public: download / track download
router.post("/:id/download", async (req, res) => {
  const id = String(req.params["id"]);
  const [row] = await db
    .select()
    .from(resourcesTable)
    .where(eq(resourcesTable.id, id))
    .limit(1);

  if (!row || !row.isActive) {
    res.status(404).json({ error: "Resource not found" });
    return;
  }

  await db
    .update(resourcesTable)
    .set({ downloadCount: row.downloadCount + 1, updatedAt: new Date() })
    .where(eq(resourcesTable.id, id));

  res.json({ url: row.url });
});

// Admin: create resource
router.post(
  "/",
  authenticate,
  requireRole("admin"),
  validateBody(CreateResourceSchema),
  async (req, res) => {
    const body = req.body as z.infer<typeof CreateResourceSchema>;
    const [row] = await db
      .insert(resourcesTable)
      .values({
        title: body.title,
        description: body.description ?? null,
        type: body.type,
        url: body.url,
        category: body.category,
      })
      .returning();

    res.status(201).json({ resource: row });
  },
);

// Admin: update resource
router.put(
  "/:id",
  authenticate,
  requireRole("admin"),
  validateBody(UpdateResourceSchema),
  async (req, res) => {
    const body = req.body as z.infer<typeof UpdateResourceSchema>;

    const rid = String(req.params["id"]);
    const [existing] = await db
      .select()
      .from(resourcesTable)
      .where(eq(resourcesTable.id, rid))
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: "Resource not found" });
      return;
    }

    const [updated] = await db
      .update(resourcesTable)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(resourcesTable.id, rid))
      .returning();

    res.json({ resource: updated });
  },
);

// Admin: delete resource
router.delete("/:id", authenticate, requireRole("admin"), async (req, res) => {
  const rid = String(req.params["id"]);
  const [existing] = await db
    .select()
    .from(resourcesTable)
    .where(eq(resourcesTable.id, rid))
    .limit(1);

  if (!existing) {
    res.status(404).json({ error: "Resource not found" });
    return;
  }

  await db.delete(resourcesTable).where(eq(resourcesTable.id, rid));
  res.json({ message: "Resource deleted" });
});

// Admin: list all (including inactive)
router.get("/admin/all", authenticate, requireRole("admin"), async (_req, res) => {
  const rows = await db
    .select()
    .from(resourcesTable)
    .orderBy(desc(resourcesTable.createdAt));

  res.json({ resources: rows });
});

export default router;
