import { describe, expect, it } from "vitest";
import { quantileRank, toL1, type Normalizer } from "./l1.js";

const lin = (a: number, b: number): number[] =>
  Array.from({ length: 101 }, (_, i) => a + ((b - a) * i) / 100);
const NZ: Normalizer = {
  version: "t",
  features: {
    F01: { transform: "identity", q: lin(0, 10) },
    F02: { transform: "identity", q: lin(0, 1) },
    F11: { transform: "log1p", q: lin(0, Math.log1p(99)) },
  },
  mapping: {
    expression: { weights: { F01: 1 }, sign: {}, b0: 0, b1: 1 },
    temperature: { weights: { F01: 0.5, F02: 0.5 }, sign: { F02: -1 }, b0: 0, b1: 1 },
    shape: { weights: { F01: 0.4, F99: 0.6 }, sign: {}, b0: 0, b1: 1 },
    density: { weights: { F11: 1 }, sign: {}, b0: 0.1, b1: 2 },
    depth: { weights: { F01: 0.6, F02: 0.4 }, sign: {}, b0: 0, b1: 1 },
  },
  reliable: { expression: false, temperature: false, shape: false, density: false, depth: false },
};

describe("원시 → L1(5.5.4)", () => {
  it("분위 보간·범위 밖 0/1·같은 값 구간은 중간 순위", () => {
    expect(quantileRank(lin(0, 10), 2.5)).toBeCloseTo(0.25, 12);
    expect(quantileRank(lin(0, 10), -1)).toBe(0);
    expect(quantileRank(lin(0, 10), 11)).toBe(1);
    const tied = [...Array(51).fill(0), ...lin(0.02, 1).slice(51)];
    expect(quantileRank(tied, 0)).toBeCloseTo(0.25, 12);
  });
  it("부호 반전·null 재정규화·50% null이면 축 null·b0/b1 후 clip", () => {
    const l1 = toL1({ F01: 5, F02: 0.2, F11: 99, F99: null }, NZ);
    expect(l1.expression).toBeCloseTo(0.5, 12);
    expect(l1.temperature).toBeCloseTo(0.5 * 0.5 + 0.5 * 0.8, 12);
    expect(l1.shape).toBeNull(); // F99 null = 가중치 60%
    expect(l1.density).toBe(1); // 0.1 + 2 × 1 → clip
    const part = toL1({ F01: 5, F02: null }, NZ);
    expect(part.depth).toBeCloseTo(0.5, 12); // F02(40%) 빠지고 F01만으로 재정규화
  });
});
