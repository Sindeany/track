import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";
import { appRouter } from "./routers";

function createMockContext(user: TrpcContext["user"] = null): TrpcContext {
  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      cookie: () => {},
      clearCookie: () => {},
    } as unknown as TrpcContext["res"],
  };
}

describe("Clients Directory & Autocomplete Router", () => {
  const adminUser = {
    id: 1,
    openId: "admin",
    name: "مدير النظام",
    email: "admin@sindean.com",
    role: "admin" as const,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    loginMethod: "password",
    passwordHash: "salt:hash",
  };

  const repUser = {
    id: 2,
    openId: "rep1",
    name: "أحمد علي",
    email: "ahmad@sindean.com",
    role: "user" as const,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    loginMethod: "password",
    passwordHash: "salt:hash",
  };

  const sampleClient = {
    id: 10,
    name: "شركة الأفق للتجارة",
    address: "الرياض، طريق الملك فهد",
    contactPerson: "سعد الخالدي",
    contactRole: "مدير المشتريات",
    phone: "+966512345678",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it("allows authenticated representative to search clients", async () => {
    vi.spyOn(db, "searchClients").mockResolvedValueOnce([sampleClient]);

    const caller = appRouter.createCaller(createMockContext(repUser));
    const result = await caller.clients.search({ query: "الأفق" });

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("شركة الأفق للتجارة");
    expect(result[0].phone).toBe("+966512345678");
    expect(result[0].contactPerson).toBe("سعد الخالدي");
  });

  it("allows representative to list all clients", async () => {
    vi.spyOn(db, "listClients").mockResolvedValueOnce([sampleClient]);

    const caller = appRouter.createCaller(createMockContext(repUser));
    const result = await caller.clients.list();

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(10);
  });

  it("rejects unauthenticated user from searching clients", async () => {
    const caller = appRouter.createCaller(createMockContext(null));
    await expect(caller.clients.search({ query: "الأفق" })).rejects.toThrow("Please sign in");
  });

  it("allows admin to update client details", async () => {
    vi.spyOn(db, "updateClient").mockResolvedValueOnce({
      ...sampleClient,
      name: "شركة الأفق العالمية",
      phone: "+966599999999",
    });

    const caller = appRouter.createCaller(createMockContext(adminUser));
    const result = await caller.clients.update({
      id: 10,
      name: "شركة الأفق العالمية",
      phone: "+966599999999",
    });

    expect(result.name).toBe("شركة الأفق العالمية");
    expect(result.phone).toBe("+966599999999");
  });

  it("blocks non-admin representative from updating a client", async () => {
    const caller = appRouter.createCaller(createMockContext(repUser));
    await expect(
      caller.clients.update({
        id: 10,
        name: "تعديل غير مسموح",
      })
    ).rejects.toThrow("You do not have required permission");
  });

  it("allows admin to delete a client and blocks representative", async () => {
    vi.spyOn(db, "deleteClient").mockResolvedValueOnce(true);

    const adminCaller = appRouter.createCaller(createMockContext(adminUser));
    const deleteResult = await adminCaller.clients.delete({ id: 10 });
    expect(deleteResult.success).toBe(true);

    const repCaller = appRouter.createCaller(createMockContext(repUser));
    await expect(repCaller.clients.delete({ id: 10 })).rejects.toThrow("You do not have required permission");
  });
});
