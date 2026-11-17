// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  clearVisitDraft,
  enqueuePendingVisit,
  listPendingVisits,
  loadVisitDraft,
  removePendingVisit,
  saveVisitDraft,
} from "./visitOfflineQueue";

describe("visitOfflineQueue resilience without indexedDB", () => {
  it("gracefully returns null/empty and avoids throwing when indexedDB is unavailable", async () => {
    await expect(
      saveVisitDraft({
        clientName: "شركة التجربة",
        employeeName: "أحمد",
        employeeRole: "مدير",
        phone: "0500000000",
        address: "الرياض",
        visitPurpose: "quote",
        report: "تفاصيل تجريبية",
        photos: [],
      }),
    ).resolves.toBeUndefined();

    await expect(loadVisitDraft()).resolves.toBeNull();
    await expect(clearVisitDraft()).resolves.toBeUndefined();
    await expect(listPendingVisits()).resolves.toEqual([]);
    await expect(
      enqueuePendingVisit({
        clientName: "شركة التجربة",
        employeeName: "أحمد",
        employeeRole: "مدير",
        phone: "0500000000",
        address: "الرياض",
        visitPurpose: "quote",
        report: "تفاصيل تجريبية",
        latitude: 24.7136,
        longitude: 46.6753,
        locationAccuracy: 10,
        photos: [],
      }),
    ).resolves.toBeNull();
    await expect(removePendingVisit("missing-id")).resolves.toBeUndefined();
  });
});
