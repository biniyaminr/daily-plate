import { sqliteTable, text, integer, primaryKey } from "drizzle-orm/sqlite-core";
export const progress = sqliteTable("progress", {
 userId: text("user_id").notNull(), kind: text("kind").notNull(),
 payload: text("payload").notNull(), revision: integer("revision").notNull(),
 updatedAt: text("updated_at").notNull(),
}, t => [primaryKey({columns:[t.userId,t.kind]})]);
