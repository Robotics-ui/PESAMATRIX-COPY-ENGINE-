import { pgTable, uuid, text, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const newsCategoryEnum = pgEnum("news_category", ["article", "market_update", "economic_calendar"]);

export const newsTable = pgTable("news", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  excerpt: text("excerpt"),
  imageUrl: text("image_url"),
  category: newsCategoryEnum("category").notNull().default("article"),
  isPublished: boolean("is_published").notNull().default(false),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertNewsSchema = createInsertSchema(newsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const selectNewsSchema = createSelectSchema(newsTable);
export type InsertNews = z.infer<typeof insertNewsSchema>;
export type NewsItem = typeof newsTable.$inferSelect;
