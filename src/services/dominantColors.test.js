import { describe, expect, it } from "vitest";
import { pickDominantColors } from "./dominantColors";

function pixels(entries) {
  const data = new Uint8ClampedArray(entries.length * 4);
  entries.forEach(([r, g, b, a], index) => {
    data[index * 4] = r;
    data[index * 4 + 1] = g;
    data[index * 4 + 2] = b;
    data[index * 4 + 3] = a;
  });
  return data;
}

describe("pickDominantColors", () => {
  it("returns the two most frequent vivid colors", () => {
    const data = pixels([
      ...Array.from({ length: 20 }, () => [200, 30, 40, 255]),
      ...Array.from({ length: 6 }, () => [30, 60, 200, 255]),
    ]);

    expect(pickDominantColors(data)).toEqual(["#c81e28", "#1e3cc8"]);
  });

  it("ignores transparent, near-white and near-black pixels", () => {
    const data = pixels([
      [255, 255, 255, 255],
      [0, 0, 0, 255],
      [10, 10, 10, 40],
      [128, 128, 128, 255],
    ]);

    expect(pickDominantColors(data)).toBeNull();
  });

  it("derives a second tone when a single color dominates", () => {
    const data = pixels(Array.from({ length: 16 }, () => [200, 30, 40, 255]));
    const colors = pickDominantColors(data);

    expect(colors).toHaveLength(2);
    expect(colors[0]).toMatch(/^#[0-9a-f]{6}$/u);
    expect(colors[1]).toMatch(/^#[0-9a-f]{6}$/u);
    expect(colors[0]).not.toBe(colors[1]);
  });
});
