import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
const cropMocks = vi.hoisted(() => ({ exportCrop: vi.fn() }));
vi.mock("../services/imageCrop", async (importOriginal) => ({ ...await importOriginal<typeof import("../services/imageCrop")>(), exportCrop: cropMocks.exportCrop }));
import ProfileImageCropper from "./ProfileImageCropper";

const originalShowModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal");
const originalClose = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "close");
beforeAll(() => {
  // jsdom does not implement the browser's native modal dialog methods.
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function () { this.setAttribute("open", ""); } });
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: function () { this.removeAttribute("open"); } });
});
afterAll(() => {
  if (originalShowModal) Object.defineProperty(HTMLDialogElement.prototype, "showModal", originalShowModal);
  else Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
  if (originalClose) Object.defineProperty(HTMLDialogElement.prototype, "close", originalClose);
  else Reflect.deleteProperty(HTMLDialogElement.prototype, "close");
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  vi.spyOn(HTMLDialogElement.prototype, "showModal").mockImplementation(function (this: HTMLDialogElement) { this.setAttribute("open", ""); });
  vi.spyOn(HTMLDialogElement.prototype, "close").mockImplementation(function (this: HTMLDialogElement) { this.removeAttribute("open"); });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function loadImage() {
  const image = screen.getByRole("img", { name: "Image to crop" });
  Object.defineProperties(image, { naturalWidth: { value: 1200 }, naturalHeight: { value: 800 } });
  fireEvent.load(image);
}
describe("profile crop dialog", () => {
  it("zooms with the wheel, synchronizes the slider and prevents page scrolling", () => {
    render(<ProfileImageCropper source="data:image/png;base64,test" kind="avatar" onApply={vi.fn()} onClose={vi.fn()} />);
    loadImage();
    const frame = screen.getByRole("group", { name: "Image position" });
    expect(fireEvent.wheel(frame, { deltaY: -100, cancelable: true })).toBe(false);
    expect(Number((screen.getByRole("slider", { name: "Zoom" }) as HTMLInputElement).value)).toBeGreaterThan(1);
    fireEvent.wheel(frame, { deltaY: -10000 });
    expect(screen.getByRole("slider", { name: "Zoom" })).toHaveValue("4");
    fireEvent.wheel(frame, { deltaY: 10000 });
    expect(screen.getByRole("slider", { name: "Zoom" })).toHaveValue("1");
  });
  it("does not apply changes when canceled", async () => {
    const user = userEvent.setup();
    const onApply = vi.fn(); const onClose = vi.fn();
    render(<ProfileImageCropper source="data:image/png;base64,test" kind="avatar" onApply={onApply} onClose={onClose} />);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(onApply).not.toHaveBeenCalled();
    expect(cropMocks.exportCrop).not.toHaveBeenCalled();
  });
  it("applies zoom and position only after confirmation and retains the dialog on failure", async () => {
    const user = userEvent.setup();
    const file = new File(["crop"], "crop.webp", { type: "image/webp" });
    cropMocks.exportCrop.mockResolvedValue(file);
    const onApply = vi.fn().mockRejectedValueOnce(new Error("Upload failed")).mockResolvedValueOnce(undefined);
    const onClose = vi.fn();
    render(<ProfileImageCropper source="data:image/png;base64,test" kind="cover" onApply={onApply} onClose={onClose} />);
    loadImage();
    fireEvent.change(screen.getByRole("slider", { name: "Zoom" }), { target: { value: "2" } });
    fireEvent.keyDown(screen.getByRole("group", { name: "Image position" }), { key: "ArrowLeft" });
    await user.click(screen.getByRole("button", { name: "Apply" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Upload failed");
    expect(onClose).not.toHaveBeenCalled();
    expect(cropMocks.exportCrop).toHaveBeenCalledWith(expect.anything(), 2.5, { zoom: 2, x: 51, y: 50, rotation: 0 });
    await user.click(screen.getByRole("button", { name: "Apply" }));
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(onApply).toHaveBeenCalledWith(file);
  });
  it("resets image adjustments and passes the selected rotation to export", async () => {
    const user = userEvent.setup();
    cropMocks.exportCrop.mockResolvedValue(new File(["crop"], "crop.webp", { type: "image/webp" }));
    render(<ProfileImageCropper source="data:image/png;base64,test" kind="avatar" onApply={vi.fn()} onClose={vi.fn()} />);
    loadImage();
    await user.click(screen.getByRole("button", { name: "Rotate image" }));
    fireEvent.change(screen.getByRole("slider", { name: "Zoom" }), { target: { value: "2" } });
    await user.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.getByRole("slider", { name: "Zoom" })).toHaveValue("1");
    expect(screen.getByRole("button", { name: "Reset" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Rotate image" }));
    await user.click(screen.getByRole("button", { name: "Apply" }));
    await waitFor(() => expect(cropMocks.exportCrop).toHaveBeenCalledWith(expect.anything(), 1, { zoom: 1, x: 50, y: 50, rotation: 90 }));
  });
});
