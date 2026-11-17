import { and, asc, count, countDistinct, desc, eq, inArray, like, or, sql, type SQL } from "drizzle-orm";
import { drizzle, type MySql2Database } from "drizzle-orm/mysql2";
import mysql, { type Pool } from "mysql2/promise";
import {
  clients,
  InsertClient,
  InsertUser,
  User,
  users,
  visitComments,
  visitPhotos,
  visits,
  visitPurposeValues,
} from "../drizzle/schema";
import { resolveInitialAdminCredentials } from "./_core/env";
import { startOfZonedMonth, resolveTimeZone } from "./_core/time";
import { storageDelete } from "./storage";
import { lastAdminMutationBlocked, staffDeleteBlocked } from "./staffPolicy";

export type SafeUser = Omit<User, "passwordHash">;

export const safeUserColumns = {
  id: users.id,
  openId: users.openId,
  name: users.name,
  email: users.email,
  loginMethod: users.loginMethod,
  role: users.role,
  isActive: users.isActive,
  sessionVersion: users.sessionVersion,
  createdAt: users.createdAt,
  updatedAt: users.updatedAt,
  lastSignedIn: users.lastSignedIn,
};

export function sanitizeUser(user: User | SafeUser): SafeUser {
  const { passwordHash: _omitted, ...safe } = user as Partial<User>;
  return safe as SafeUser;
}

let _pool: Pool | null = null;
let _db: MySql2Database | null = null;

function buildPoolOptions(connectionString: string): mysql.PoolOptions {
  const parsed = new URL(connectionString);
  const sslParam = parsed.searchParams.get("ssl");
  return {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 3306,
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: parsed.pathname.replace(/^\//, ""),
    connectionLimit: Number(process.env.DB_POOL_SIZE || 10),
    waitForConnections: true,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
    ...(sslParam && sslParam !== "false" ? { ssl: { rejectUnauthorized: sslParam !== "insecure" } } : {}),
  };
}

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _pool = mysql.createPool(buildPoolOptions(process.env.DATABASE_URL));
      _db = drizzle(_pool);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _pool = null;
      _db = null;
    }
  }
  return _db;
}

export async function pingDb(): Promise<boolean> {
  try {
    await getDb();
    if (!_pool) return false;
    await _pool.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}

export async function closeDb(): Promise<void> {
  if (_pool) {
    try {
      await _pool.end();
    } finally {
      _pool = null;
      _db = null;
    }
  }
}

function requireDb(db: Awaited<ReturnType<typeof getDb>>) {
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  return db;
}

export async function getUserById(id: number): Promise<SafeUser | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select(safeUserColumns).from(users).where(eq(users.id, id)).limit(1);
  return result[0];
}

export async function getUserAuthById(id: number): Promise<User | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0];
}

export async function getUserByOpenId(openId: string): Promise<SafeUser | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select(safeUserColumns).from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getUserByEmail(email: string): Promise<SafeUser | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const normalized = email.trim().toLowerCase();
  if (!normalized) return undefined;
  const result = await db.select(safeUserColumns).from(users).where(eq(users.email, normalized)).limit(1);
  return result[0];
}

export async function getUserByLogin(login: string): Promise<User | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const normalized = login.trim().toLowerCase();
  const result = await db
    .select()
    .from(users)
    .where(or(eq(users.openId, normalized), eq(users.email, normalized)))
    .limit(1);
  return result[0];
}

export async function createUserWithPassword(params: {
  openId: string;
  name: string;
  email?: string | null;
  passwordHash: string;
  role: "user" | "admin";
}): Promise<SafeUser> {
  const db = requireDb(await getDb());
  const values: InsertUser = {
    openId: params.openId.trim().toLowerCase(),
    name: params.name.trim(),
    email: params.email ? params.email.trim().toLowerCase() : null,
    passwordHash: params.passwordHash,
    role: params.role,
    loginMethod: "password",
    lastSignedIn: new Date(),
  };
  const result = await db.insert(users).values(values);
  const id = Number((result as unknown as [{ insertId: number }])[0].insertId);
  const created = await getUserById(id);
  if (!created) throw new Error("تعذر إنشاء المستخدم.");
  return created;
}

export async function updateUserLastSignedIn(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, id));
}

export async function ensureInitialAdmin() {
  const db = await getDb();
  if (!db) return null;
  const existingAdmins = await db.select(safeUserColumns).from(users).where(eq(users.role, "admin")).limit(1);
  if (existingAdmins[0]) return existingAdmins[0];

  const credentials = resolveInitialAdminCredentials();
  const { hashPassword } = await import("./_core/auth");
  const passwordHash = hashPassword(credentials.password);

  return createUserWithPassword({
    openId: credentials.openId,
    name: "مدير النظام",
    email: credentials.email,
    passwordHash,
    role: "admin",
  });
}

export async function listRepresentatives() {
  const db = requireDb(await getDb());
  return db
    .select({
      id: users.id,
      openId: users.openId,
      name: users.name,
      email: users.email,
      role: users.role,
      isActive: users.isActive,
      createdAt: users.createdAt,
      lastSignedIn: users.lastSignedIn,
    })
    .from(users)
    .orderBy(desc(users.createdAt));
}

export async function listStaffWithKPIs() {
  const db = requireDb(await getDb());
  const now = new Date();
  const startOfMonth = startOfZonedMonth(resolveTimeZone(process.env.APP_TIMEZONE), now);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [staffList, aggregatedStats] = await Promise.all([
    db
      .select({
        id: users.id,
        openId: users.openId,
        name: users.name,
        email: users.email,
        role: users.role,
        isActive: users.isActive,
        createdAt: users.createdAt,
        lastSignedIn: users.lastSignedIn,
      })
      .from(users)
      .orderBy(desc(users.createdAt)),
    db
      .select({
        representativeId: visits.representativeId,
        totalVisits: sql<number>`COUNT(*)`,
        thisMonthVisits: sql<number>`SUM(CASE WHEN ${visits.visitedAt} >= ${startOfMonth} THEN 1 ELSE 0 END)`,
        last7DaysVisits: sql<number>`SUM(CASE WHEN ${visits.visitedAt} >= ${sevenDaysAgo} THEN 1 ELSE 0 END)`,
        lastVisitAt: sql<Date | string | null>`MAX(${visits.visitedAt})`,
      })
      .from(visits)
      .groupBy(visits.representativeId),
  ]);

  const statsMap = new Map(aggregatedStats.map(row => [row.representativeId, row]));

  return staffList.map(staff => {
    const stats = statsMap.get(staff.id);
    return {
      ...staff,
      totalVisits: Number(stats?.totalVisits ?? 0),
      thisMonthVisits: Number(stats?.thisMonthVisits ?? 0),
      last7DaysVisits: Number(stats?.last7DaysVisits ?? 0),
      lastVisitAt: stats?.lastVisitAt ? new Date(stats.lastVisitAt) : null,
    };
  });
}

export async function countAdmins(): Promise<number> {
  const db = requireDb(await getDb());
  const rows = await db.select({ total: count() }).from(users).where(eq(users.role, "admin"));
  return Number(rows[0]?.total ?? 0);
}

export async function countVisitsForRepresentative(representativeId: number): Promise<number> {
  const db = requireDb(await getDb());
  const rows = await db
    .select({ total: count() })
    .from(visits)
    .where(eq(visits.representativeId, representativeId));
  return Number(rows[0]?.total ?? 0);
}

export async function updateStaffUser(
  id: number,
  data: { name?: string; email?: string | null; isActive?: boolean; role?: "user" | "admin" },
): Promise<SafeUser | undefined> {
  const current = await getUserById(id);
  if (!current) return undefined;
  if (current.role === "admin" && (data.isActive === false || data.role === "user")) {
    const message = lastAdminMutationBlocked({
      targetRole: "admin",
      adminCount: await countAdmins(),
      nextRole: data.role,
      nextIsActive: data.isActive,
    });
    if (message) throw new Error(message);
  }

  const db = requireDb(await getDb());
  const updateSet: Record<string, unknown> = {};
  if (data.name !== undefined) updateSet.name = data.name.trim();
  if (data.email !== undefined) updateSet.email = data.email ? data.email.trim().toLowerCase() : null;
  if (data.isActive !== undefined) updateSet.isActive = data.isActive;
  if (data.role !== undefined) updateSet.role = data.role;
  updateSet.updatedAt = new Date();

  await db.update(users).set(updateSet).where(eq(users.id, id));
  return getUserById(id);
}

export async function resetStaffPassword(id: number, passwordHash: string) {
  const db = requireDb(await getDb());
  await db.update(users).set({
    passwordHash,
    sessionVersion: sql`${users.sessionVersion} + 1`,
    updatedAt: new Date(),
  }).where(eq(users.id, id));
  return true;
}

export async function deleteStaffUser(id: number, currentAdminId: number) {
  if (id === currentAdminId) {
    throw new Error("لا يمكن حذف الحساب الحالي الذي تم تسجيل الدخول به.");
  }
  const db = requireDb(await getDb());
  const target = await getUserById(id);
  if (!target) throw new Error("المستخدم غير موجود.");
  if (target.role === "admin") {
    const message = lastAdminMutationBlocked({
      targetRole: "admin",
      adminCount: await countAdmins(),
      deleting: true,
    });
    if (message) throw new Error(message);
  }
  const visitMessage = staffDeleteBlocked(await countVisitsForRepresentative(id));
  if (visitMessage) throw new Error(visitMessage);

  // Delete physical photos of all visits belonging to this staff member
  const staffVisits = await db.select({ id: visits.id }).from(visits).where(eq(visits.representativeId, id));
  if (staffVisits.length > 0) {
    const visitIds = staffVisits.map(v => v.id);
    const photos = await db.select().from(visitPhotos).where(inArray(visitPhotos.visitId, visitIds));
    await Promise.all(photos.map(p => storageDelete(p.objectKey)));
  }

  // Deleting user cascades down to visits, visitPhotos, and visitComments in MySQL
  await db.delete(users).where(eq(users.id, id));
  return true;
}

export async function getOrCreateDemoUser(role: "user" | "admin"): Promise<SafeUser> {
  const db = requireDb(await getDb());
  const demo =
    role === "admin"
      ? { openId: "field-visits-demo-manager", name: "مدير تجريبي", email: "manager@demo.local", role: "admin" as const }
      : { openId: "field-visits-demo-representative", name: "مندوب تجريبي", email: "representative@demo.local", role: "user" as const };

  await db
    .insert(users)
    .values({ ...demo, loginMethod: "demo", lastSignedIn: new Date() })
    .onDuplicateKeyUpdate({
      set: { name: demo.name, email: demo.email, loginMethod: "demo", role: demo.role, lastSignedIn: new Date() },
    });

  const user = await getUserByOpenId(demo.openId);
  if (!user) throw new Error("تعذر إعداد حساب التجربة.");
  return user;
}

export async function addVisitComment(values: { visitId: number; managerId: number; body: string }) {
  const db = requireDb(await getDb());
  await db.insert(visitComments).values(values);
}

async function hydrateVisits<T extends { id: number }>(rows: T[]) {
  if (!rows.length) return [];
  const db = requireDb(await getDb());
  const ids = rows.map(row => row.id);
  const [photos, comments] = await Promise.all([
    db.select().from(visitPhotos).where(inArray(visitPhotos.visitId, ids)),
    db
      .select({
        id: visitComments.id,
        visitId: visitComments.visitId,
        body: visitComments.body,
        createdAt: visitComments.createdAt,
        managerName: users.name,
      })
      .from(visitComments)
      .innerJoin(users, eq(visitComments.managerId, users.id))
      .where(inArray(visitComments.visitId, ids))
      .orderBy(desc(visitComments.createdAt)),
  ]);

  return rows.map(row => ({
    ...row,
    photos: photos.filter(photo => photo.visitId === row.id),
    comments: comments.filter(comment => comment.visitId === row.id),
  }));
}

export type VisitPurpose = (typeof visitPurposeValues)[number];

export type VisitListOptions = {
  page?: number;
  pageSize?: number;
  search?: string;
  purpose?: VisitPurpose;
  representativeId?: number;
};

export async function listVisitsForRepresentative(
  representativeId: number,
  options: VisitListOptions = {},
) {
  const db = requireDb(await getDb());
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 20));
  const search = options.search?.trim();

  const conditions: SQL[] = [eq(visits.representativeId, representativeId)];
  if (options.purpose) {
    conditions.push(eq(visits.visitPurpose, options.purpose));
  }
  if (search) {
    const pattern = `%${search}%`;
    const searchCond = or(
      like(visits.clientName, pattern),
      like(visits.employeeName, pattern),
      like(visits.address, pattern),
    );
    if (searchCond) conditions.push(searchCond);
  }

  const whereClause = and(...conditions);

  const [countResult, rows] = await Promise.all([
    db.select({ total: count() }).from(visits).where(whereClause),
    db
      .select()
      .from(visits)
      .where(whereClause)
      .orderBy(desc(visits.visitedAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
  ]);

  const total = Number(countResult[0]?.total ?? 0);
  const items = await hydrateVisits(rows);
  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getVisitForRepresentative(id: number, representativeId: number) {
  const db = requireDb(await getDb());
  const rows = await db.select().from(visits).where(eq(visits.id, id)).limit(1);
  if (!rows[0] || rows[0].representativeId !== representativeId) return undefined;
  return (await hydrateVisits(rows))[0];
}

export async function listVisitsForManager(options: VisitListOptions = {}) {
  const db = requireDb(await getDb());
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 20));
  const search = options.search?.trim();

  const conditions: SQL[] = [];
  if (options.purpose) {
    conditions.push(eq(visits.visitPurpose, options.purpose));
  }
  if (options.representativeId) {
    conditions.push(eq(visits.representativeId, options.representativeId));
  }
  if (search) {
    const pattern = `%${search}%`;
    const searchCond = or(
      like(visits.clientName, pattern),
      like(visits.address, pattern),
      like(visits.employeeName, pattern),
      like(users.name, pattern),
    );
    if (searchCond) conditions.push(searchCond);
  }

  const whereClause = conditions.length ? and(...conditions) : undefined;

  const [countResult, rows] = await Promise.all([
    db
      .select({ total: count() })
      .from(visits)
      .innerJoin(users, eq(visits.representativeId, users.id))
      .where(whereClause),
    db
      .select({
        id: visits.id,
        representativeId: visits.representativeId,
        clientName: visits.clientName,
        employeeName: visits.employeeName,
        employeeRole: visits.employeeRole,
        phone: visits.phone,
        address: visits.address,
        visitPurpose: visits.visitPurpose,
        report: visits.report,
        latitude: visits.latitude,
        longitude: visits.longitude,
        locationAccuracy: visits.locationAccuracy,
        visitedAt: visits.visitedAt,
        createdAt: visits.createdAt,
        updatedAt: visits.updatedAt,
        representativeName: users.name,
        representativeEmail: users.email,
      })
      .from(visits)
      .innerJoin(users, eq(visits.representativeId, users.id))
      .where(whereClause)
      .orderBy(desc(visits.visitedAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
  ]);

  const total = Number(countResult[0]?.total ?? 0);
  const items = await hydrateVisits(rows);
  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getManagerVisitsSummary() {
  const db = requireDb(await getDb());
  const [visitAgg, commentAgg] = await Promise.all([
    db
      .select({
        totalVisits: count(),
        activeReps: countDistinct(visits.representativeId),
      })
      .from(visits),
    db
      .select({
        commentedVisits: countDistinct(visitComments.visitId),
      })
      .from(visitComments),
  ]);

  return {
    totalVisits: Number(visitAgg[0]?.totalVisits ?? 0),
    activeReps: Number(visitAgg[0]?.activeReps ?? 0),
    commentedVisits: Number(commentAgg[0]?.commentedVisits ?? 0),
  };
}

const EXPORT_ROW_LIMIT = 1000;

export async function listAllVisitsForExport(options: Omit<VisitListOptions, "page" | "pageSize"> = {}) {
  const result = await listVisitsForManager({ ...options, page: 1, pageSize: EXPORT_ROW_LIMIT });
  return {
    items: result.items,
    total: result.total,
    truncated: result.total > result.items.length,
  };
}

export async function getVisitForManager(id: number) {
  const db = requireDb(await getDb());
  const rows = await db
    .select({
      id: visits.id,
      representativeId: visits.representativeId,
      clientName: visits.clientName,
      employeeName: visits.employeeName,
      employeeRole: visits.employeeRole,
      phone: visits.phone,
      address: visits.address,
      visitPurpose: visits.visitPurpose,
      report: visits.report,
      latitude: visits.latitude,
      longitude: visits.longitude,
      locationAccuracy: visits.locationAccuracy,
      visitedAt: visits.visitedAt,
      createdAt: visits.createdAt,
      updatedAt: visits.updatedAt,
      representativeName: users.name,
      representativeEmail: users.email,
    })
    .from(visits)
    .innerJoin(users, eq(visits.representativeId, users.id))
    .where(eq(visits.id, id))
    .limit(1);
  return (await hydrateVisits(rows))[0];
}

export async function deleteVisit(id: number) {
  const db = requireDb(await getDb());

  // Delete physical photos from disk
  const photos = await db.select().from(visitPhotos).where(eq(visitPhotos.visitId, id));
  await Promise.all(photos.map(p => storageDelete(p.objectKey)));

  // Deleting visit cascades down to visitPhotos and visitComments in MySQL
  await db.delete(visits).where(eq(visits.id, id));
  return true;
}

export async function searchClients(query = "") {
  const db = requireDb(await getDb());
  const trimmed = query.trim();
  if (!trimmed) {
    return db.select().from(clients).orderBy(desc(clients.updatedAt)).limit(10);
  }
  return db
    .select()
    .from(clients)
    .where(like(clients.name, `%${trimmed}%`))
    .orderBy(desc(clients.updatedAt))
    .limit(10);
}

export async function listClients() {
  const db = requireDb(await getDb());
  return db.select().from(clients).orderBy(asc(clients.name));
}

export async function getClientById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
  return result[0];
}

export async function upsertClientFromVisit(params: {
  name: string;
  address: string;
  contactPerson?: string | null;
  contactRole?: string | null;
  phone: string;
}) {
  const db = await getDb();
  if (!db) return;
  const name = params.name.trim();
  if (!name) return;

  const values: InsertClient = {
    name,
    address: params.address.trim(),
    contactPerson: params.contactPerson?.trim() || null,
    contactRole: params.contactRole?.trim() || null,
    phone: params.phone.trim(),
  };

  const updateSet: Record<string, unknown> = {
    address: values.address,
    phone: values.phone,
    updatedAt: new Date(),
  };
  if (values.contactPerson) updateSet.contactPerson = values.contactPerson;
  if (values.contactRole) updateSet.contactRole = values.contactRole;

  await db.insert(clients).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function updateClient(
  id: number,
  params: { name?: string; address?: string; contactPerson?: string | null; contactRole?: string | null; phone?: string },
) {
  const db = requireDb(await getDb());
  const updateSet: Record<string, unknown> = { updatedAt: new Date() };
  if (params.name !== undefined) updateSet.name = params.name.trim();
  if (params.address !== undefined) updateSet.address = params.address.trim();
  if (params.contactPerson !== undefined) updateSet.contactPerson = params.contactPerson?.trim() || null;
  if (params.contactRole !== undefined) updateSet.contactRole = params.contactRole?.trim() || null;
  if (params.phone !== undefined) updateSet.phone = params.phone.trim();

  await db.update(clients).set(updateSet).where(eq(clients.id, id));
  return getClientById(id);
}

export async function deleteClient(id: number) {
  const db = requireDb(await getDb());
  await db.delete(clients).where(eq(clients.id, id));
  return true;
}
