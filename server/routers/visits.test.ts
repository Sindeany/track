import { describe, expect, it } from "vitest";
import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from "@shared/const";
import type { TrpcContext } from "../_core/context";
import { appRouter } from "../routers";
import { cameraJpegToBuffer, visitCreateSchema } from "./visits";

const validDraft = {
  clientName: "شركة النور",
  employeeName: "أحمد سالم",
  employeeRole: "مدير المشتريات",
  phone: "+966500000000",
  address: "الرياض، حي العليا",
  visitPurpose: "quote",
  report: "تمت مناقشة احتياجات العميل وإرسال نطاق أولي للأسعار.",
  latitude: 24.7136,
  longitude: 46.6753,
  photos: [],
};

function createTestContext(role?: "user" | "admin"): TrpcContext {
  return {
    user: role
      ? {
          id: role === "admin" ? 99 : 1,
          openId: `test-${role}`,
          name: `Test ${role}`,
          email: `${role}@example.com`,
          role,
          loginMethod: "local",
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        }
      : null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
  };
}

describe("visit report validation", () => {
  it("accepts a valid field report without client-controlled date or time", () => {
    expect(visitCreateSchema.parse(validDraft)).toMatchObject(validDraft);
  });

  it("rejects unknown client-controlled capture fields", () => {
    expect(() => visitCreateSchema.parse({ ...validDraft, visitedAt: new Date().toISOString() })).toThrow();
  });

  it("accepts only real JPEG binary payloads from the camera upload flow", () => {
    const validJpegBase64 = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]).toString("base64");
    const bytes = cameraJpegToBuffer(`data:image/jpeg;base64,${validJpegBase64}`);
    expect(bytes[0]).toBe(0xff);
    expect(bytes[1]).toBe(0xd8);
    expect(bytes[2]).toBe(0xff);
    // Reject PNG data URL
    expect(() => cameraJpegToBuffer(`data:image/png;base64,${validJpegBase64}`)).toThrow();
    // Reject non-JPEG bytes disguised with a JPEG data URL prefix ("hello")
    expect(() => cameraJpegToBuffer("data:image/jpeg;base64,aGVsbG8=")).toThrow();
  });

  it("validates photos before creating any visit record in the database", async () => {
    const db = await import("../db");
    const { vi } = await import("vitest");
    const getDbSpy = vi.spyOn(db, "getDb");

    const caller = appRouter.createCaller(createTestContext("user"));
    await expect(
      caller.visits.create({
        ...validDraft,
        photos: ["data:image/jpeg;base64,aGVsbG8="],
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect(getDbSpy).not.toHaveBeenCalled();
  });
});

describe("strict manager permissions enforcement via adminProcedure", () => {
  it("strictly rejects regular users from calling managerList on the server", async () => {
    const caller = appRouter.createCaller(createTestContext("user"));
    await expect(caller.visits.managerList()).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: NOT_ADMIN_ERR_MSG,
    });
  });

  it("strictly rejects regular users from calling managerGet on the server", async () => {
    const caller = appRouter.createCaller(createTestContext("user"));
    await expect(caller.visits.managerGet({ id: 1 })).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: NOT_ADMIN_ERR_MSG,
    });
  });

  it("strictly rejects regular users from adding comments to visits", async () => {
    const caller = appRouter.createCaller(createTestContext("user"));
    await expect(
      caller.visits.addComment({ visitId: 1, body: "ملاحظة غير مصرح بها" })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: NOT_ADMIN_ERR_MSG,
    });
  });

  it("strictly rejects unauthenticated requests to manager endpoints", async () => {
    const caller = appRouter.createCaller(createTestContext());
    await expect(caller.visits.managerList()).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: NOT_ADMIN_ERR_MSG,
    });
  });

  it("strictly rejects unauthenticated requests to representative endpoints with UNAUTHORIZED", async () => {
    const caller = appRouter.createCaller(createTestContext());
    await expect(caller.visits.mine()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      message: UNAUTHED_ERR_MSG,
    });
  });

  it("strictly rejects regular users from deleting a visit", async () => {
    const caller = appRouter.createCaller(createTestContext("user"));
    await expect(caller.visits.delete({ id: 1 })).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: NOT_ADMIN_ERR_MSG,
    });
  });

  it("allows admin to delete a visit", async () => {
    const db = await import("../db");
    const { vi } = await import("vitest");
    vi.spyOn(db, "getVisitForManager").mockResolvedValueOnce({
      id: 1,
      clientName: "شركة النور",
    } as any);
    const deleteSpy = vi.spyOn(db, "deleteVisit").mockResolvedValueOnce(true);

    const caller = appRouter.createCaller(createTestContext("admin"));
    const result = await caller.visits.delete({ id: 1 });

    expect(result.success).toBe(true);
    expect(result.id).toBe(1);
    expect(deleteSpy).toHaveBeenCalledWith(1);
  });
});


