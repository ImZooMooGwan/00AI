import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  visibility: text("visibility").notNull().default("unlisted"),
  status: text("status").notNull().default("ready_for_domain"),
  publicUrl: text("public_url").notNull(),
  activeDeploymentId: text("active_deployment_id"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const deployments = sqliteTable("deployments", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id),
  version: integer("version").notNull(),
  storagePath: text("storage_path").notNull(),
  fileCount: integer("file_count").notNull(),
  totalSize: integer("total_size").notNull(),
  status: text("status").notNull().default("stored"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});
