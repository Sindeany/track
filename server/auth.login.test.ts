import { describe, expect, it, vi } from "vitest";
import { COOKIE_NAME } from "../shared/const";
import { createSessionToken, hashPassword, verifyPassword, verifySessionToken } from "./_core/auth";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";
import { appRouter } from "./routers";

type SetCookieCall = {
  name: string;
  val: string;
  options: Record<string, unknown>;
};

function createMockContext(user: TrpcContext["user"] = null): {
  ctx: TrpcContext;
  setCookies: SetCookieCall[];
} {
  const setCookies: SetCookieCall[] = [];

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      cookie: (name: string, val: string, options: Record<string, unknown>) => {
        setCookies.push({ name, val, options });
      },
      clearCookie: () => {},
    } as unknown as TrpcContext["res"],
  };

  return { ctx, setCookies };
}

describe("auth cryptography and token utilities", () => {
  it("hashes password with salt and verifies successfully", () => {
    const password = "SuperSecretPassword123";
    const hash = hashPassword(password);

    expect(hash).toContain(":");
    expect(verifyPassword(password, hash)).toBe(true);
    expect(verifyPassword("WrongPassword", hash)).toBe(false);
    expect(verifyPassword("", hash)).toBe(false);
    expect(verifyPassword(password, "invalid-hash")).toBe(false);
  });

  it("creates and verifies a signed session token", () => {
    const token = createSessionToken({ userId: 42, role: "admin" });
    const verified = verifySessionToken(token);

    expect(verified).not.toBeNull();
    expect(verified?.userId).toBe(42);
    expect(verified?.role).toBe("admin");
  });

  it("rejects tampered session tokens", () => {
    const token = createSessionToken({ userId: 42, role: "admin" });
    const tampered = token.slice(0, -4) + "XXXX";
    expect(verifySessionToken(tampered)).toBeNull();
  });

  it("rejects expired session tokens", () => {
    const expiredToken = createSessionToken({ userId: 42, role: "user" }, undefined, -1000);
    expect(verifySessionToken(expiredToken)).toBeNull();
  });
});

describe("auth.login procedure", () => {
  it("rejects login with invalid credentials", async () => {
    vi.spyOn(db, "getUserByLogin").mockResolvedValue(undefined);

    const { ctx } = createMockContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.login({ login: "nonexistent", password: "password123" }),
    ).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      message: "اسم المستخدم أو كلمة المرور غير صحيحة.",
    });
  });

  it("authenticates valid user and sets session cookie", async () => {
    const rawPassword = "ValidPassword123";
    const passwordHash = hashPassword(rawPassword);

    const mockUser: any = {
      id: 5,
      openId: "sales_rep_1",
      name: "أحمد مندوب",
      email: "rep1@sindean.local",
      passwordHash,
      role: "user" as const,
      loginMethod: "password",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    };

    vi.spyOn(db, "getUserByLogin").mockResolvedValue(mockUser);
    vi.spyOn(db, "updateUserLastSignedIn").mockResolvedValue(undefined);

    const { ctx, setCookies } = createMockContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.login({ login: "sales_rep_1", password: rawPassword });

    expect(result.success).toBe(true);
    expect(result.user.id).toBe(5);
    expect(result.user.openId).toBe("sales_rep_1");
    expect(setCookies).toHaveLength(1);
    expect(setCookies[0]?.name).toBe(COOKIE_NAME);

    const verified = verifySessionToken(setCookies[0]?.val);
    expect(verified?.userId).toBe(5);
    expect(verified?.role).toBe("user");
  });
});

describe("auth.createUser management procedure", () => {
  it("strictly forbids regular users from creating new users", async () => {
    const regularUser: any = {
      id: 1,
      openId: "user1",
      role: "user",
    };

    const { ctx } = createMockContext(regularUser);
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.createUser({
        openId: "new_rep",
        name: "مندوب جديد",
        password: "password123",
        role: "user",
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("allows administrators to create new users with hashed password", async () => {
    const adminUser: any = {
      id: 99,
      openId: "admin",
      role: "admin",
    };

    vi.spyOn(db, "getUserByOpenId").mockResolvedValue(undefined);
    vi.spyOn(db, "createUserWithPassword").mockImplementation(async (params: any) => ({
      id: 10,
      openId: params.openId,
      name: params.name,
      email: params.email ?? null,
      role: params.role,
      passwordHash: params.passwordHash,
      loginMethod: "password",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    }));

    const { ctx } = createMockContext(adminUser);
    const caller = appRouter.createCaller(ctx);

    const created = await caller.auth.createUser({
      openId: "new_rep",
      name: "مندوب جديد",
      password: "password123",
      role: "user",
    });

    expect(created.id).toBe(10);
    expect(created.openId).toBe("new_rep");
    expect(created.name).toBe("مندوب جديد");
    expect(created.role).toBe("user");
  });
});
