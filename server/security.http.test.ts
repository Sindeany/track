import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { createSessionToken } from "./_core/auth";
import { COOKIE_NAME } from "@shared/const";
import * as db from "./db";
import { createApp } from "./_core/index";

describe("HTTP security middleware & health probe", () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    const app = await createApp();
    server = http.createServer(app);
    await new Promise<void>(resolve => {
      server.listen(0, "127.0.0.1", () => resolve());
    });
    const addr = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    await new Promise<void>(resolve => server.close(() => resolve()));
  });

  it("blocks unauthenticated requests to /uploads with 401", async () => {
    const res = await fetch(`${baseUrl}/uploads/visit-photos/1/sample.jpg`);
    expect(res.status).toBe(401);
  });

  it("blocks a representative from accessing another representative's uploads with 403", async () => {
    vi.spyOn(db, "getUserById").mockResolvedValueOnce({
      id: 2,
      openId: "rep2",
      name: "Rep Two",
      email: "rep2@example.com",
      role: "user",
      loginMethod: "password",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    });

    const token = createSessionToken({ userId: 2, role: "user" });
    const res = await fetch(`${baseUrl}/uploads/visit-photos/99/sample.jpg`, {
      headers: { cookie: `${COOKIE_NAME}=${token}` },
    });
    expect(res.status).toBe(403);
  });

  it("exposes /api/health with security headers", async () => {
    vi.spyOn(db, "pingDb").mockResolvedValueOnce(true);
    const res = await fetch(`${baseUrl}/api/health`);
    expect(res.status).toBe(200);
    expect(res.headers.get("x-frame-options")).toBe("DENY");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    const body = (await res.json()) as { ok: boolean; db: string };
    expect(body.ok).toBe(true);
    expect(body.db).toBe("connected");
  });

  it("forbids demo mode in production and test environments", async () => {
    const { isDemoModeEnabled } = await import("./_core/context");
    const prevEnv = process.env.NODE_ENV;
    const prevDemo = process.env.DEMO_MODE_ENABLED;
    try {
      process.env.DEMO_MODE_ENABLED = "true";
      process.env.NODE_ENV = "production";
      expect(isDemoModeEnabled()).toBe(false);
      process.env.NODE_ENV = "test";
      expect(isDemoModeEnabled()).toBe(false);
      process.env.NODE_ENV = "development";
      expect(isDemoModeEnabled()).toBe(true);
    } finally {
      process.env.NODE_ENV = prevEnv;
      process.env.DEMO_MODE_ENABLED = prevDemo;
    }
  });
});
