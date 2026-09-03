import { decimal, index, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  passwordHash: varchar("passwordHash", { length: 255 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const visitPurposeValues = ["quote", "follow_up", "complaint_follow_up", "other"] as const;

export const visits = mysqlTable("visits", {
  id: int("id").autoincrement().primaryKey(),
  representativeId: int("representativeId").notNull().references(() => users.id, { onDelete: "cascade" }),
  clientName: varchar("clientName", { length: 180 }).notNull(),
  employeeName: varchar("employeeName", { length: 180 }).notNull(),
  employeeRole: varchar("employeeRole", { length: 180 }).notNull(),
  phone: varchar("phone", { length: 32 }).notNull(),
  address: text("address").notNull(),
  visitPurpose: mysqlEnum("visitPurpose", visitPurposeValues).notNull(),
  report: text("report").notNull(),
  latitude: decimal("latitude", { precision: 10, scale: 7 }).notNull(),
  longitude: decimal("longitude", { precision: 10, scale: 7 }).notNull(),
  locationAccuracy: int("locationAccuracy"),
  visitedAt: timestamp("visitedAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [
  index("visits_representative_visited_idx").on(table.representativeId, table.visitedAt),
  index("visits_visited_idx").on(table.visitedAt),
]);

export const visitPhotos = mysqlTable("visitPhotos", {
  id: int("id").autoincrement().primaryKey(),
  visitId: int("visitId").notNull().references(() => visits.id, { onDelete: "cascade" }),
  objectKey: varchar("objectKey", { length: 512 }).notNull(),
  objectUrl: varchar("objectUrl", { length: 768 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("visit_photos_visit_idx").on(table.visitId)]);

export const visitComments = mysqlTable("visitComments", {
  id: int("id").autoincrement().primaryKey(),
  visitId: int("visitId").notNull().references(() => visits.id, { onDelete: "cascade" }),
  managerId: int("managerId").notNull().references(() => users.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("visit_comments_visit_idx").on(table.visitId)]);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Visit = typeof visits.$inferSelect;
export type InsertVisit = typeof visits.$inferInsert;
