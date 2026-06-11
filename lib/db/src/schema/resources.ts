import { pgTable, uuid, text, boolean, timestamp, integer, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const resourceTypeEnum = pgEnum("resource_type", ["pdf", "document", "guide", "ebook", "link"]);

export const resourcesTable = pgTable("resources", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  description: text("description"),
  type: resourceTypeEnum("type").notNull(),
  url: text("url").notNull(),
  category: text("category").notNull().default("general"),
  isActive: boolean("is_active").notNull().default(true),
  downloadCount: integer("download_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertResourceSchema = createInsertSchema(resourcesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const selectResourceSchema = createSelectSchema(resourcesTable);
export type InsertResource = z.infer<typeof insertResourceSchema>;
export type Resource = typeof resourcesTable.$inferSelect;
