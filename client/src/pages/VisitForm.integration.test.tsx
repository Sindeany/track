// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  mutate: vi.fn(),
  onSuccess: null as null | ((result: { id: number }) => void),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    visits: {
      create: {
        useMutation: (options: { onSuccess: (result: { id: number }) => void }) => {
          mocks.onSuccess = options.onSuccess;
          return { mutate: mocks.mutate, isPending: false };
        },
      },
    },
    clients: {
      search: {
        useQuery: () => ({ data: [], isLoading: false }),
      },
    },
  },
}));

vi.mock("@/components/DashboardLayout", () => ({ default: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
vi.mock("wouter", () => ({ useLocation: () => ["/reports/new", vi.fn()] }));

import VisitForm from "./VisitForm";

describe("VisitForm submission success", () => {
  beforeEach(() => {
    mocks.mutate.mockReset();
    mocks.onSuccess = null;
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: (success: PositionCallback) => success({ coords: { latitude: 24.7136, longitude: 46.6753, accuracy: 12 } } as GeolocationPosition),
      },
    });
  });

  it("opens the animated success confirmation after visits.create succeeds", async () => {
    render(<VisitForm />);

    fireEvent.change(screen.getByLabelText("اسم العميل"), { target: { value: "شركة المثال" } });
    fireEvent.change(screen.getByLabelText("العنوان"), { target: { value: "الرياض" } });
    fireEvent.change(screen.getByLabelText("اسم الموظف"), { target: { value: "أحمد" } });
    fireEvent.change(screen.getByLabelText("دور الموظف"), { target: { value: "مدير المشتريات" } });
    fireEvent.change(screen.getByLabelText("رقم الهاتف"), { target: { value: "+966500000000" } });
    fireEvent.change(screen.getByPlaceholderText("اذكر ما تم خلال الزيارة، ملاحظات العميل، الخطوات التالية وأي تفاصيل مهمة..."), { target: { value: "تمت الزيارة بنجاح" } });
    const form = document.querySelector("form");
    if (!form) throw new Error("نموذج الزيارة غير متاح للاختبار");
    fireEvent.submit(form);

    await waitFor(() => expect(mocks.mutate).toHaveBeenCalledOnce());
    mocks.onSuccess?.({ id: 91 });

    await waitFor(() => expect(screen.getByText("تم إرسال تقرير الزيارة")).toBeTruthy());
    expect(screen.getByText("رقم التقرير #91")).toBeTruthy();
  });
});
