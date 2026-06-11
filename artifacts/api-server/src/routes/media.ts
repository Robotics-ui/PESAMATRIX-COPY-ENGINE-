import { Router, type IRouter } from "express";
import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { db, mediaTable } from "@workspace/db";
import { validateBody } from "../middlewares/validate.js";
import { authenticate } from "../middlewares/authenticate.js";
import { requireRole } from "../middlewares/requireRole.js";

const router: IRouter = Router();

const CreateMediaSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(["image", "video", "youtube", "external"]),
  url: z.string().min(1),
  thumbnailUrl: z.string().optional(),
});

const UpdateMediaSchema = CreateMediaSchema.partial().extend({
  isActive: z.boolean().optional(),
});

// Public: list active media
router.get("/", async (req, res) => {
  const type = req.query["type"] as string | undefined;

  const rows = await db
    .select()
    .from(mediaTable)
    .where(eq(mediaTable.isActive, true))
    .orderBy(desc(mediaTable.createdAt));

  const filtered = type ? rows.filter((r) => r.type === type) : rows;
  res.json({ media: filtered });
});

// Public: single media item
router.get("/:id", async (req, res) => {
  const [row] = await db
    .select()
    .from(mediaTable)
    .where(eq(mediaTable.id, String(req.params["id"])))
    .limit(1);

  if (!row) {
    res.status(404).json({ error: "Media not found" });
    return;
  }
  res.json({ media: row });
});

// Admin: create media
router.post(
  "/",
  authenticate,
  requireRole("admin"),
  validateBody(CreateMediaSchema),
  async (req, res) => {
    const body = req.body as z.infer<typeof CreateMediaSchema>;
    const [row] = await db
      .insert(mediaTable)
      .values({
        title: body.title,
        description: body.description ?? null,
        type: body.type,
        url: body.url,
        thumbnailUrl: body.thumbnailUrl ?? null,
      })
      .returning();

    res.status(201).json({ media: row });
  },
);

// Admin: update media
router.put(
  "/:id",
  authenticate,
  requireRole("admin"),
  validateBody(UpdateMediaSchema),
  async (req, res) => {
    const body = req.body as z.infer<typeof UpdateMediaSchema>;

    const [existing] = await db
      .select()
      .from(mediaTable)
      .where(eq(mediaTable.id, String(req.params["id"])))
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: "Media not found" });
      return;
    }

    const [updated] = await db
      .update(mediaTable)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(mediaTable.id, String(req.params["id"])))
      .returning();

    res.json({ media: updated });
  },
);

// Admin: delete media
router.delete("/:id", authenticate, requireRole("admin"), async (req, res) => {
  const [existing] = await db
    .select()
    .from(mediaTable)
    .where(eq(mediaTable.id, String(req.params["id"])))
    .limit(1);

  if (!existing) {
    res.status(404).json({ error: "Media not found" });
    return;
  }

  await db.delete(mediaTable).where(eq(mediaTable.id, String(req.params["id"])));
  res.json({ message: "Media deleted" });
});

export default router;
