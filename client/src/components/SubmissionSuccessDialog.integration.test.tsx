// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import SubmissionSuccessDialog from "./SubmissionSuccessDialog";

describe("SubmissionSuccessDialog", () => {
  it("confirms successful submission and sends the representative to the saved report", async () => {
    const user = userEvent.setup();
    const onViewReport = vi.fn();
    render(<SubmissionSuccessDialog open reportId={27} onViewReport={onViewReport} />);

    expect(screen.getByText("تم إرسال تقرير الزيارة")).toBeTruthy();
    expect(screen.getByText("رقم التقرير #27")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "عرض التقرير" }));
    expect(onViewReport).toHaveBeenCalledOnce();
  });
});
