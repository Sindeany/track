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

describe("Staff Management and KPIs Router", () => {
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

  it("allows admin to fetch staff with KPI metrics", async () => {
    vi.spyOn(db, "listStaffWithKPIs").mockResolvedValueOnce([
      {
        id: 2,
        openId: "rep1",
        name: "أحمد علي",
        email: "ahmad@sindean.com",
        role: "user",
        isActive: true,
        createdAt: new Date(),
        lastSignedIn: new Date(),
        totalVisits: 15,
        thisMonthVisits: 8,
        last7DaysVisits: 4,
        lastVisitAt: new Date(),
      },
    ]);

    const caller = appRouter.createCaller(createMockContext(adminUser));
    const result = await caller.auth.listStaffKPIs();

    expect(result).toHaveLength(1);
    expect(result[0].openId).toBe("rep1");
    expect(result[0].totalVisits).toBe(15);
    expect(result[0].thisMonthVisits).toBe(8);
  });

  it("blocks non-admin user from fetching staff KPIs", async () => {
    const caller = appRouter.createCaller(createMockContext(repUser));
    await expect(caller.auth.listStaffKPIs()).rejects.toThrow("You do not have required permission");
  });

  it("allows admin to update user details and active state", async () => {
    vi.spyOn(db, "updateStaffUser").mockResolvedValueOnce({
      id: 2,
      openId: "rep1",
      name: "أحمد علي محدث",
      email: "ahmad_new@sindean.com",
      role: "user",
      isActive: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
      loginMethod: "password",
      passwordHash: "salt:hash",
    });

    const caller = appRouter.createCaller(createMockContext(adminUser));
    const result = await caller.auth.updateUser({
      id: 2,
      name: "أحمد علي محدث",
      email: "ahmad_new@sindean.com",
      isActive: false,
    });

    expect(result.name).toBe("أحمد علي محدث");
    expect(result.isActive).toBe(false);
  });

  it("prevents admin from suspending their own active account", async () => {
    const caller = appRouter.createCaller(createMockContext(adminUser));
    await expect(
      caller.auth.updateUser({
        id: adminUser.id,
        isActive: false,
      })
    ).rejects.toThrow("لا يمكنك تجميد حسابك الحالي");
  });

  it("allows admin to reset a user password", async () => {
    vi.spyOn(db, "getUserById").mockResolvedValueOnce(repUser);
    const resetSpy = vi.spyOn(db, "resetStaffPassword").mockResolvedValueOnce(true);

    const caller = appRouter.createCaller(createMockContext(adminUser));
    const result = await caller.auth.resetPassword({
      userId: 2,
      newPassword: "NewSecurePassword123!",
    });

    expect(result.success).toBe(true);
    expect(resetSpy).toHaveBeenCalledWith(2, expect.stringContaining(":"));
  });

  it("blocks non-admin from resetting passwords", async () => {
    const caller = appRouter.createCaller(createMockContext(repUser));
    await expect(
      caller.auth.resetPassword({
        userId: 1,
        newPassword: "SomePassword123!",
      })
    ).rejects.toThrow("You do not have required permission");
  });

  it("rejects login attempt if user account is suspended (isActive === false)", async () => {
    const { hashPassword } = await import("./_core/auth");
    const validPassword = "CorrectPassword123";
    const passwordHash = hashPassword(validPassword);

    vi.spyOn(db, "getUserByLogin").mockResolvedValueOnce({
      ...repUser,
      passwordHash,
      isActive: false, // Suspended user
    });

    const caller = appRouter.createCaller(createMockContext(null));
    await expect(
      caller.auth.login({
        login: "rep1",
        password: validPassword,
      })
    ).rejects.toThrow("تم تجميد هذا الحساب من قبل الإدارة");
  });
});
