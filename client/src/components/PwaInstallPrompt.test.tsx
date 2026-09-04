// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  triggerInstall: vi.fn(),
  dismiss: vi.fn(),
  canInstall: true,
  isIos: false,
  isDismissed: false,
}));

vi.mock("@/hooks/usePwaInstall", () => ({
  usePwaInstall: () => ({
    canInstall: mocks.canInstall,
    isIos: mocks.isIos,
    isDismissed: mocks.isDismissed,
    triggerInstall: mocks.triggerInstall,
    dismiss: mocks.dismiss,
  }),
}));

import PwaInstallPrompt from "./PwaInstallPrompt";

describe("PwaInstallPrompt Component", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });
  it("renders floating install banner when canInstall is true", () => {
    mocks.canInstall = true;
    mocks.isDismissed = false;
    render(<PwaInstallPrompt />);

    expect(screen.getByText("تثبيت التطبيق على الجوال")).toBeTruthy();
    expect(screen.getByText("تثبيت الآن")).toBeTruthy();

    fireEvent.click(screen.getByText("تثبيت الآن"));
    expect(mocks.triggerInstall).toHaveBeenCalled();
  });

  it("calls dismiss when clicking 'لاحقاً'", () => {
    mocks.canInstall = true;
    mocks.isDismissed = false;
    render(<PwaInstallPrompt />);

    fireEvent.click(screen.getByText("لاحقاً"));
    expect(mocks.dismiss).toHaveBeenCalled();
  });

  it("does not render when canInstall is false or dismissed", () => {
    mocks.canInstall = false;
    const { container } = render(<PwaInstallPrompt />);
    expect(container.firstChild).toBeNull();
  });
});
