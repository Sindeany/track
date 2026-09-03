import { describe, expect, it, vi } from "vitest";
import { canCaptureMore, captureCameraFrame, COMPRESSED_JPEG_QUALITY, formatCompressedImageSize, getCameraUnavailableMessage, getCompressedImageBytes, MAX_UPLOAD_IMAGE_SIDE, removeCapturedPhoto } from "./CameraCapture";

describe("camera capability guard", () => {
  it("shows a clear fallback when the browser has no camera API", () => {
    expect(getCameraUnavailableMessage(undefined)).toContain("غير مدعومة");
  });

  it("allows the capture flow when getUserMedia is available", () => {
    const supported = { getUserMedia: async () => new MediaStream() } as unknown as Pick<MediaDevices, "getUserMedia">;
    expect(getCameraUnavailableMessage(supported)).toBeNull();
  });

  it("stops capturing once the report reaches its photo limit", () => {
    expect(canCaptureMore(4, 5)).toBe(true);
    expect(canCaptureMore(5, 5)).toBe(false);
  });

  it("turns a camera frame into a compressed report image while keeping the camera workflow available", () => {
    const drawImage = vi.fn();
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({ drawImage } as unknown as CanvasRenderingContext2D),
      toDataURL: vi.fn(() => "data:image/jpeg;base64,captured"),
    };
    const photo = captureCameraFrame({ videoWidth: 2800, videoHeight: 1400 }, () => canvas);

    expect(photo).toBe("data:image/jpeg;base64,captured");
    expect(canvas.width).toBe(MAX_UPLOAD_IMAGE_SIDE);
    expect(canvas.height).toBe(640);
    expect(drawImage).toHaveBeenCalledOnce();
    expect(canvas.toDataURL).toHaveBeenCalledWith("image/jpeg", COMPRESSED_JPEG_QUALITY);
  });

  it("measures the compressed data URL payload and reports its real size", () => {
    const threeKilobytePayload = `data:image/jpeg;base64,${"A".repeat(4096)}`;
    expect(getCompressedImageBytes(threeKilobytePayload)).toBe(3072);
    expect(formatCompressedImageSize(threeKilobytePayload)).toBe("3 ك.ب");
  });

  it("removes only the requested captured image before report submission", () => {
    expect(removeCapturedPhoto(["first", "second", "third"], 1)).toEqual(["first", "third"]);
  });
});
