import { asc, desc, eq, inArray, like, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { clients, InsertClient, InsertUser, InsertVisit, users, visitComments, visitPhotos, visits } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

function requireDb(db: Awaited<ReturnType<typeof getDb>>) {
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  return db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  for (const field of ["name", "email", "loginMethod", "passwordHash"] as const) {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  }
  values.role = user.role ?? (user.openId === ENV.ownerOpenId ? "admin" : "user");
  updateSet.role = values.role;
  values.lastSignedIn = user.lastSignedIn ?? new Date();
  updateSet.lastSignedIn = values.lastSignedIn;
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0];
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getUserByLogin(login: string) {
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
}) {
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
  const existingAdmins = await db.select().from(users).where(eq(users.role, "admin")).limit(1);
  if (existingAdmins[0]) return existingAdmins[0];

  const adminOpenId = (process.env.INITIAL_ADMIN_OPENID || "admin").trim().toLowerCase();
  const adminEmail = (process.env.INITIAL_ADMIN_EMAIL || "admin@sindean.local").trim().toLowerCase();
  const adminPassword = process.env.INITIAL_ADMIN_PASSWORD || "Admin@123456";

  const { hashPassword } = await import("./_core/auth");
  const passwordHash = hashPassword(adminPassword);

  return createUserWithPassword({
    openId: adminOpenId,
    name: "مدير النظام",
    email: adminEmail,
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
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const staffList = await db
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

  const allVisits = await db
    .select({
      id: visits.id,
      representativeId: visits.representativeId,
      visitedAt: visits.visitedAt,
    })
    .from(visits);

  return staffList.map(staff => {
    const userVisits = allVisits.filter(v => v.representativeId === staff.id);
    const totalVisits = userVisits.length;
    const thisMonthVisits = userVisits.filter(v => v.visitedAt >= startOfMonth).length;
    const last7DaysVisits = userVisits.filter(v => v.visitedAt >= sevenDaysAgo).length;

    let lastVisitAt: Date | null = null;
    for (const v of userVisits) {
      if (!lastVisitAt || v.visitedAt > lastVisitAt) {
        lastVisitAt = v.visitedAt;
      }
    }

    return {
      ...staff,
      totalVisits,
      thisMonthVisits,
      last7DaysVisits,
      lastVisitAt,
    };
  });
}

export async function updateStaffUser(
  id: number,
  data: { name?: string; email?: string | null; isActive?: boolean; role?: "user" | "admin" }
) {
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
  await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, id));
  return true;
}

export async function getOrCreateDemoUser(role: "user" | "admin") {
  const db = requireDb(await getDb());
  const demo = role === "admin"
    ? { openId: "field-visits-demo-manager", name: "مدير تجريبي", email: "manager@demo.local", role: "admin" as const }
    : { openId: "field-visits-demo-representative", name: "مندوب تجريبي", email: "representative@demo.local", role: "user" as const };

  await db.insert(users).values({ ...demo, loginMethod: "demo", lastSignedIn: new Date() }).onDuplicateKeyUpdate({
    set: { name: demo.name, email: demo.email, loginMethod: "demo", role: demo.role, lastSignedIn: new Date() },
  });

  const user = await getUserByOpenId(demo.openId);
  if (!user) throw new Error("تعذر إعداد حساب التجربة.");
  return user;
}

export async function createVisit(values: InsertVisit) {
  const db = requireDb(await getDb());
  const result = await db.insert(visits).values(values);
  return Number((result as unknown as [{ insertId: number }])[0].insertId);
}

export async function addVisitPhotos(values: Array<{ visitId: number; objectKey: string; objectUrl: string }>) {
  if (!values.length) return;
  const db = requireDb(await getDb());
  await db.insert(visitPhotos).values(values);
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
    db.select({
      id: visitComments.id,
      visitId: visitComments.visitId,
      body: visitComments.body,
      createdAt: visitComments.createdAt,
      managerName: users.name,
    }).from(visitComments).innerJoin(users, eq(visitComments.managerId, users.id)).where(inArray(visitComments.visitId, ids)).orderBy(desc(visitComments.createdAt)),
  ]);

  return rows.map(row => ({
    ...row,
    photos: photos.filter(photo => photo.visitId === row.id),
    comments: comments.filter(comment => comment.visitId === row.id),
  }));
}

export async function listVisitsForRepresentative(representativeId: number) {
  const db = requireDb(await getDb());
  const rows = await db.select().from(visits).where(eq(visits.representativeId, representativeId)).orderBy(desc(visits.visitedAt));
  return hydrateVisits(rows);
}

export async function getVisitForRepresentative(id: number, representativeId: number) {
  const db = requireDb(await getDb());
  const rows = await db.select().from(visits).where(eq(visits.id, id)).limit(1);
  if (!rows[0] || rows[0].representativeId !== representativeId) return undefined;
  return (await hydrateVisits(rows))[0];
}

export async function listVisitsForManager() {
  const db = requireDb(await getDb());
  const rows = await db.select({
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
  }).from(visits).innerJoin(users, eq(visits.representativeId, users.id)).orderBy(desc(visits.visitedAt));
  return hydrateVisits(rows);
}

export async function getVisitForManager(id: number) {
  const db = requireDb(await getDb());
  const rows = await db.select({
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
  }).from(visits).innerJoin(users, eq(visits.representativeId, users.id)).where(eq(visits.id, id)).limit(1);
  return rows[0] ? (await hydrateVisits(rows))[0] : undefined;
}

export async function searchClients(query = "") {
  const db = requireDb(await getDb());
  const trimmed = query.trim();
  if (!trimmed) {
    return db
      .select()
      .from(clients)
      .orderBy(desc(clients.updatedAt))
      .limit(10);
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
  params: { name?: string; address?: string; contactPerson?: string | null; contactRole?: string | null; phone?: string }
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

