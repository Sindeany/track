// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import PhotoLightbox from "./PhotoLightbox";

describe("PhotoLightbox", () => {
  afterEach(() => {
    cleanup();
    document.body.innerHTML = "";
  });
  const samplePhotos = [
    { id: 1, url: "https://example.com/photo1.jpg", title: "صورة 1" },
    { id: 2, url: "https://example.com/photo2.jpg", title: "صورة 2" },
  ];

  it("does not render when isOpen is false", () => {
    const { container } = render(
      <PhotoLightbox
        photos={samplePhotos}
        isOpen={false}
        onClose={vi.fn()}
      />
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(container.firstChild).toBeNull();
  });

  it("renders when isOpen is true and shows initial photo", () => {
    render(
      <PhotoLightbox
        photos={samplePhotos}
        initialIndex={0}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByRole("dialog")).toBeDefined();
    expect(screen.getByText("صورة 1 من 2")).toBeDefined();
    const img = screen.getByRole("img", { name: "صورة 1" });
    expect(img).toBeDefined();
    expect(img.getAttribute("src")).toBe("https://example.com/photo1.jpg");
  });

  it("navigates forward and backward between photos", () => {
    render(
      <PhotoLightbox
        photos={samplePhotos}
        initialIndex={0}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    // Initial photo
    expect(screen.getByText("صورة 1 من 2")).toBeDefined();

    // Click next photo button (Left chevron in RTL)
    const nextBtn = screen.getByLabelText("الصورة التالية");
    fireEvent.click(nextBtn);

    expect(screen.getByText("صورة 2 من 2")).toBeDefined();
    const img2 = screen.getByRole("img", { name: "صورة 2" });
    expect(img2.getAttribute("src")).toBe("https://example.com/photo2.jpg");

    // Click previous photo button
    const prevBtn = screen.getByLabelText("الصورة السابقة");
    fireEvent.click(prevBtn);

    expect(screen.getByText("صورة 1 من 2")).toBeDefined();
  });

  it("calls onClose when close button is clicked", () => {
    const onClose = vi.fn();
    render(
      <PhotoLightbox
        photos={samplePhotos}
        isOpen={true}
        onClose={onClose}
      />
    );

    const closeBtn = screen.getByLabelText("إغلاق معاينة الصورة");
    fireEvent.click(closeBtn);

    expect(onClose).toHaveBeenCalled();
  });

  it("handles browser/device popstate event (mobile back button) by closing the modal", () => {
    const onClose = vi.fn();
    render(
      <PhotoLightbox
        photos={samplePhotos}
        isOpen={true}
        onClose={onClose}
      />
    );

    // Simulate device hardware/gesture back button dispatching popstate
    window.dispatchEvent(new PopStateEvent("popstate"));

    expect(onClose).toHaveBeenCalled();
  });

  it("supports keyboard navigation: Escape to close", () => {
    const onClose = vi.fn();
    render(
      <PhotoLightbox
        photos={samplePhotos}
        isOpen={true}
        onClose={onClose}
      />
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});
