// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React, { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CameraCapture, { removeCapturedPhoto } from "./CameraCapture";

function CameraTestHarness() {
  const [photos, setPhotos] = useState<string[]>([]);
  return <CameraCapture photos={photos} onCapture={photo => setPhotos(current => [...current, photo])} onRemove={index => setPhotos(current => removeCapturedPhoto(current, index))} />;
}

describe("CameraCapture multi-photo workflow", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [] }) },
    });
    Object.defineProperty(HTMLMediaElement.prototype, "play", { configurable: true, value: vi.fn().mockResolvedValue(undefined) });
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", { configurable: true, value: vi.fn(() => ({ drawImage: vi.fn() })) });
    Object.defineProperty(HTMLCanvasElement.prototype, "toDataURL", { configurable: true, value: vi.fn(() => "data:image/jpeg;base64,captured") });
  });

  afterEach(() => vi.restoreAllMocks());

  it("keeps the camera open to capture several images, previews them, and removes one before submission", async () => {
    const user = userEvent.setup();
    let captureIndex = 0;
    Object.defineProperty(HTMLCanvasElement.prototype, "toDataURL", { configurable: true, value: vi.fn(() => `data:image/jpeg;base64,captured-${++captureIndex}`) });
    render(<CameraTestHarness />);

    await user.click(screen.getByRole("button", { name: /التقاط وإرفاق صورة/ }));
    const video = document.querySelector("video");
    expect(video).not.toBeNull();
    Object.defineProperty(video, "videoWidth", { configurable: true, value: 1200 });
    Object.defineProperty(video, "videoHeight", { configurable: true, value: 800 });

    await user.click(screen.getByRole("button", { name: "التقاط صورة" }));
    await waitFor(() => expect(screen.getByText("هل تريد إرفاق هذه الصورة؟")).toBeTruthy());
    await user.click(screen.getByRole("button", { name: "إعادة التقاط" }));
    expect(screen.getByRole("button", { name: "التقاط صورة" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "التقاط صورة" }));
    await waitFor(() => expect(screen.getByText("هل تريد إرفاق هذه الصورة؟")).toBeTruthy());
    await user.click(screen.getByRole("button", { name: "إرفاق الصورة" }));
    await waitFor(() => expect(screen.getByText("1 / 5 مرفقة")).toBeTruthy());
    await user.click(screen.getByRole("button", { name: "التقاط صورة" }));
    await waitFor(() => expect(screen.getByText("هل تريد إرفاق هذه الصورة؟")).toBeTruthy());
    await user.click(screen.getByRole("button", { name: "إرفاق الصورة" }));

    await waitFor(() => expect(screen.getByText("2 / 5 مرفقة")).toBeTruthy());
    expect(screen.getAllByAltText(/صورة مرفقة/)).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: "حذف الصورة 1" }));
    await waitFor(() => expect(screen.getByText("1 / 5 مرفقة")).toBeTruthy());
    expect(screen.getAllByAltText(/صورة مرفقة/)).toHaveLength(1);
  });
});
