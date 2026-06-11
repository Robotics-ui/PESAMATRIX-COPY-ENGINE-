import { Router, type IRouter } from "express";
import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { db, newsTable } from "@workspace/db";
import { validateBody } from "../middlewares/validate.js";
import { authenticate } from "../middlewares/authenticate.js";
import { requireRole } from "../middlewares/requireRole.js";

const router: IRouter = Router();

const CreateNewsSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  excerpt: z.string().optional(),
  imageUrl: z.string().optional(),
  category: z.enum(["article", "market_update", "economic_calendar"]).default("article"),
  isPublished: z.boolean().default(false),
});

const UpdateNewsSchema = CreateNewsSchema.partial();

// Public: list published news
router.get("/", async (req, res) => {
  const category = req.query["category"] as string | undefined;
  const search = req.query["search"] as string | undefined;

  let rows = await db
    .select()
    .from(newsTable)
    .where(eq(newsTable.isPublished, true))
    .orderBy(desc(newsTable.publishedAt));

  if (category) rows = rows.filter((r) => r.category === category);
  if (search) {
    const q = search.toLowerCase();
    rows = rows.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        (r.excerpt ?? "").toLowerCase().includes(q) ||
        r.content.toLowerCase().includes(q),
    );
  }

  res.json({ news: rows });
});

// Public: single news item
router.get("/:id", async (req, res) => {
  const [row] = await db
    .select()
    .from(newsTable)
    .where(eq(newsTable.id, req.params.id))
    .limit(1);

  if (!row || !row.isPublished) {
    res.status(404).json({ error: "News item not found" });
    return;
  }
  res.json({ news: row });
});

// Admin: list all news
router.get(
  "/admin/all",
  authenticate,
  requireRole("admin"),
  async (_req, res) => {
    const rows = await db
      .select()
      .from(newsTable)
      .orderBy(desc(newsTable.createdAt));
    res.json({ news: rows });
  },
);

// Admin: create news
router.post(
  "/",
  authenticate,
  requireRole("admin"),
  validateBody(CreateNewsSchema),
  async (req, res) => {
    const body = req.body as z.infer<typeof CreateNewsSchema>;
    const [row] = await db
      .insert(newsTable)
      .values({
        title: body.title,
        content: body.content,
        excerpt: body.excerpt ?? null,
        imageUrl: body.imageUrl ?? null,
        category: body.category,
        isPublished: body.isPublished,
        publishedAt: body.isPublished ? new Date() : null,
      })
      .returning();

    res.status(201).json({ news: row });
  },
);

// Admin: update news
router.put(
  "/:id",
  authenticate,
  requireRole("admin"),
  validateBody(UpdateNewsSchema),
  async (req, res) => {
    const body = req.body as z.infer<typeof UpdateNewsSchema>;

    const [existing] = await db
      .select()
      .from(newsTable)
      .where(eq(newsTable.id, req.params.id))
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: "News item not found" });
      return;
    }

    const wasPublished = existing.isPublished;
    const nowPublished = body.isPublished ?? wasPublished;
    const publishedAt =
      !wasPublished && nowPublished ? new Date() : existing.publishedAt;

    const [updated] = await db
      .update(newsTable)
      .set({ ...body, publishedAt, updatedAt: new Date() })
      .where(eq(newsTable.id, req.params.id))
      .returning();

    res.json({ news: updated });
  },
);

// Admin: delete news
router.delete("/:id", authenticate, requireRole("admin"), async (req, res) => {
  const [existing] = await db
    .select()
    .from(newsTable)
    .where(eq(newsTable.id, String(req.params["id"])))
    .limit(1);

  if (!existing) {
    res.status(404).json({ error: "News item not found" });
    return;
  }

  await db.delete(newsTable).where(eq(newsTable.id, String(req.params["id"])));
  res.json({ message: "News item deleted" });
});

export default router;
