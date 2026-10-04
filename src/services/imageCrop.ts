export const MAX_CROP_INPUT_BYTES = 10 * 1024 * 1024;

export interface CropSettings { zoom: number; x: number; y: number; rotation?: number }
export function getRotatedDimensions(width: number, height: number, rotation = 0) {
  return rotation % 180 ? { width: height, height: width } : { width, height };
}
export function getCropRectangle(width: number, height: number, aspect: number, settings: CropSettings) {
  const zoom = Math.max(1, Math.min(4, settings.zoom));
  const cropWidth = Math.min(width, height * aspect) / zoom;
  const cropHeight = cropWidth / aspect;
  return {
    x: (width - cropWidth) * Math.max(0, Math.min(100, settings.x)) / 100,
    y: (height - cropHeight) * Math.max(0, Math.min(100, settings.y)) / 100,
    width: cropWidth,
    height: cropHeight,
  };
}

export function readCropImage(file: File): Promise<string> {
  if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) return Promise.reject(new Error("Choose a PNG, JPG, WebP or GIF image."));
  if (file.size > MAX_CROP_INPUT_BYTES) return Promise.reject(new Error("Choose an image, 10 MB or smaller."));
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Unable to read this image."));
    reader.readAsDataURL(file);
  });
}

export async function exportCrop(image: HTMLImageElement, aspect: number, settings: CropSettings): Promise<File> {
  const rotation = settings.rotation ?? 0;
  const dimensions = getRotatedDimensions(image.naturalWidth, image.naturalHeight, rotation);
  const crop = getCropRectangle(dimensions.width, dimensions.height, aspect, settings);
  let source: HTMLImageElement | HTMLCanvasElement = image;
  if (rotation) {
    const rotated = document.createElement("canvas");
    rotated.width = dimensions.width;
    rotated.height = dimensions.height;
    const rotatedContext = rotated.getContext("2d");
    if (!rotatedContext) throw new Error("Image cropping is unavailable in this browser.");
    rotatedContext.translate(dimensions.width / 2, dimensions.height / 2);
    rotatedContext.rotate(rotation * Math.PI / 180);
    rotatedContext.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);
    source = rotated;
  }
  const canvas = document.createElement("canvas");
  canvas.width = aspect === 1 ? 512 : 1500;
  canvas.height = Math.round(canvas.width / aspect);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Image cropping is unavailable in this browser.");
  context.drawImage(source, crop.x, crop.y, crop.width, crop.height, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((result) => result ? resolve(result) : reject(new Error("Unable to crop this image.")), "image/webp", 0.9));
  if (blob.size > 2 * 1024 * 1024) throw new Error("This cropped image is too large. Try a smaller image.");
  return new File([blob], "profile-crop.webp", { type: "image/webp" });
}
