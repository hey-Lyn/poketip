import { afterEach, describe, expect, it, vi } from "vitest";
import { exportCrop, getCropRectangle, MAX_CROP_INPUT_BYTES, readCropImage } from "./imageCrop";

afterEach(() => { vi.restoreAllMocks(); });
describe("profile image cropping", () => {
  it("centers a square crop and constrains a zoomed banner to image bounds", () => {
    expect(getCropRectangle(1200, 800, 1, { zoom: 1, x: 50, y: 50 })).toEqual({ x: 200, y: 0, width: 800, height: 800 });
    expect(getCropRectangle(1200, 800, 2.5, { zoom: 2, x: 100, y: 0 })).toEqual({ x: 600, y: 0, width: 600, height: 240 });
    expect(getCropRectangle(800, 1200, 1, { zoom: 1, x: -5, y: 120 })).toEqual({ x: 0, y: 400, width: 800, height: 800 });
  });
  it("rejects unsupported and oversized source images before decoding", async () => {
    await expect(readCropImage(new File(["svg"], "image.svg", { type: "image/svg+xml" }))).rejects.toThrow(/PNG/u);
    await expect(readCropImage({ type: "image/png", size: MAX_CROP_INPUT_BYTES + 1 } as File)).rejects.toThrow(/10 MB/u);
  });
  it("exports the selected source rectangle at the banner output size", async () => {
    const drawImage = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage } as any);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (callback) {
      expect(this.width).toBe(1500);
      expect(this.height).toBe(600);
      callback(new Blob(["cropped"], { type: "image/webp" }));
    });
    const image = { naturalWidth: 1200, naturalHeight: 800 } as HTMLImageElement;
    const file = await exportCrop(image, 2.5, { zoom: 2, x: 100, y: 0 });
    expect(drawImage).toHaveBeenCalledWith(image, 600, 0, 600, 240, 0, 0, 1500, 600);
    expect(file.type).toBe("image/webp");
  });
  it("rotates the source before exporting the banner selection", async () => {
    const context = { drawImage: vi.fn(), translate: vi.fn(), rotate: vi.fn() };
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context as any);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback) => callback(new Blob(["crop"], { type: "image/webp" })));
    const image = { naturalWidth: 1200, naturalHeight: 800 } as HTMLImageElement;
    await exportCrop(image, 2.5, { zoom: 1, x: 50, y: 50, rotation: 90 });
    expect(context.translate).toHaveBeenCalledWith(400, 600);
    expect(context.rotate).toHaveBeenCalledWith(Math.PI / 2);
    expect(context.drawImage).toHaveBeenNthCalledWith(1, image, -600, -400);
    const orientedSource = context.drawImage.mock.calls[1][0] as HTMLCanvasElement;
    expect([orientedSource.width, orientedSource.height]).toEqual([800, 1200]);
    expect(context.drawImage).toHaveBeenNthCalledWith(2, orientedSource, 0, 440, 800, 320, 0, 0, 1500, 600);
  });
});
