import { describe, expect, it } from "vitest";
import { colorClusters, pixelFeatures } from "./pixels.js";

const img = (parts: [number, [number, number, number]][]): Uint8Array => {
  const out: number[] = [];
  for (const [n, rgb] of parts) for (let i = 0; i < n; i++) out.push(...rgb);
  return Uint8Array.from(out);
};

describe("픽셀 색 군집(5.5.1)", () => {
  it("두 색 75:25 → 군집 2, 면적 비율, 결정적", () => {
    const d = img([
      [300, [250, 248, 240]],
      [100, [20, 60, 160]],
    ]);
    const a = colorClusters(d, 3);
    expect(a.map((c) => c.share)).toEqual([0.75, 0.25]);
    expect(colorClusters(d, 3)).toEqual(a);
    const f = pixelFeatures(a)!;
    expect(f.F21).toBe(2);
    expect(f.F25).toBe(false);
    expect(f.F15).toBeGreaterThan(0); // 크림 배경 b > 0
  });
  it("ΔE_OK < 0.04 인 가까운 색은 병합, 1% 미만 군집은 색 수에서 뺀다", () => {
    const d = img([
      [500, [30, 30, 30]],
      [495, [33, 33, 33]],
      [5, [255, 0, 0]],
    ]);
    const f = pixelFeatures(colorClusters(d, 3))!;
    expect(f.F21).toBe(1);
    expect(f.F25).toBe(true);
    expect(f.F20).toBeCloseTo(0, 6); // 회색 군집의 C ≈ 0
  });
});
