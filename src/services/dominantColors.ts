function toHex({ r, g, b }) {
  const channel = (value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0");
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

function shift({ r, g, b }, factor) {
  const channel = (value) =>
    factor < 1 ? value * factor : value + (255 - value) * (factor - 1);
  return { r: channel(r), g: channel(g), b: channel(b) };
}

function distance(a, b) {
  return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);
}

export function pickDominantColors(data, { alphaThreshold = 125 } = {}) {
  const buckets = new Map();

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < alphaThreshold) continue;

    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const lightness = (max + min) / 510;
    const saturation = max === min ? 0 : (max - min) / (255 - Math.abs(max + min - 255));

    if (lightness > 0.93 || lightness < 0.07) continue;
    if (saturation < 0.14) continue;

    const key = `${r >> 4}-${g >> 4}-${b >> 4}`;
    const bucket = buckets.get(key) ?? { r: 0, g: 0, b: 0, n: 0 };
    bucket.r += r;
    bucket.g += g;
    bucket.b += b;
    bucket.n += 1;
    buckets.set(key, bucket);
  }

  const ranked = [...buckets.values()]
    .map((bucket) => ({
      r: bucket.r / bucket.n,
      g: bucket.g / bucket.n,
      b: bucket.b / bucket.n,
      n: bucket.n,
    }))
    .sort((a, b) => b.n - a.n);

  if (ranked.length === 0) return null;

  const first = ranked[0];
  const second = ranked
    .slice(1)
    .find((candidate) => distance(first, candidate) > 110);

  return [
    toHex(first),
    toHex(second ?? shift(ranked[1] ?? first, second ? 1 : 0.55)),
  ];
}

export function extractDominantColors(url, { size = 48 } = {}) {
  return new Promise((resolve) => {
    if (!url || typeof document === "undefined") {
      resolve(null);
      return;
    }

    const image = new Image();
    if (/^https?:/iu.test(url)) image.crossOrigin = "anonymous";

    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) {
          resolve(null);
          return;
        }

        context.drawImage(image, 0, 0, size, size);
        const { data } = context.getImageData(0, 0, size, size);
        resolve(pickDominantColors(data));
      } catch {
        resolve(null);
      }
    };

    image.onerror = () => resolve(null);
    image.src = url;
  });
}
