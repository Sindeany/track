import net from "node:net";
import type { AddressInfo } from "node:net";
import { describe, expect, it } from "vitest";
import { resolveInitialAdminCredentials } from "./_core/env";
import { resolveListenPort } from "./_core/index";
import { startOfZonedMonth } from "./_core/time";
import { lastAdminMutationBlocked, staffDeleteBlocked } from "./staffPolicy";

describe("production admin credentials", () => {
  it("requires an explicit username in production and keeps the dev default", () => {
    expect(() =>
      resolveInitialAdminCredentials({
        NODE_ENV: "production",
        INITIAL_ADMIN_PASSWORD: "UniqueProductionPassword!",
      }),
    ).toThrow(/INITIAL_ADMIN_OPENID/);

    expect(
      resolveInitialAdminCredentials({
        NODE_ENV: "production",
        INITIAL_ADMIN_OPENID: "admin",
        INITIAL_ADMIN_PASSWORD: "UniqueProductionPassword!",
      }).openId,
    ).toBe("admin");

    expect(resolveInitialAdminCredentials({ NODE_ENV: "development" }).openId).toBe("admin");
  });
});

describe("staff safety policy", () => {
  it("blocks the last admin and representatives who still have visits", () => {
    expect(
      lastAdminMutationBlocked({ targetRole: "admin", adminCount: 1, deleting: true }),
    ).toMatch(/آخر مدير/);
    expect(
      lastAdminMutationBlocked({ targetRole: "admin", adminCount: 2, deleting: true }),
    ).toBeNull();
    expect(staffDeleteBlocked(2)).toMatch(/تقارير زيارات/);
    expect(staffDeleteBlocked(0)).toBeNull();
  });
});

describe("business timezone", () => {
  it("starts the month at midnight in Asia/Riyadh", () => {
    expect(startOfZonedMonth("Asia/Riyadh", new Date("2026-11-17T12:00:00.000Z")).toISOString()).toBe(
      "2026-10-31T21:00:00.000Z",
    );
    expect(startOfZonedMonth("Asia/Riyadh", new Date("2026-10-31T20:30:00.000Z")).toISOString()).toBe(
      "2026-09-30T21:00:00.000Z",
    );
  });
});

describe("production listen port", () => {
  it("fails when the preferred port is already taken", async () => {
    const holder = net.createServer();
    await new Promise<void>((resolve, reject) => {
      holder.once("error", reject);
      holder.listen(0, () => resolve());
    });
    const port = (holder.address() as AddressInfo).port;
    await expect(resolveListenPort(port, true)).rejects.toThrow(/already in use/);
    await new Promise<void>(resolve => holder.close(() => resolve()));
  });
});
