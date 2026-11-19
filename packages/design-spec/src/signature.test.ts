// 3.8.2 자간 표 경계(AC-03-27은 하네스가 필요한 blocks.test에 있어 M2-09 전까지 여기서 확인).
import { describe, expect, it } from "vitest";
import { letterSpacingEmImpl } from "./signature.js";

describe("letterSpacingEm", () => {
  const T: [number, number, number, number][] = [
    [23, 0, 0, 0],
    [24, -0.01, -0.005, 0],
    [31, -0.01, -0.005, 0],
    [32, -0.02, -0.01, -0.01],
    [47, -0.02, -0.01, -0.01],
    [48, -0.03, -0.015, -0.015],
    [71, -0.03, -0.015, -0.015],
    [72, -0.04, -0.02, -0.02],
  ];
  for (const [px, sans, serif, latin] of T)
    it(`${px}px`, () => {
      expect(letterSpacingEmImpl(px, "sans")).toBe(sans);
      expect(letterSpacingEmImpl(px, "serif")).toBe(serif);
      expect(letterSpacingEmImpl(px, "latin-heading")).toBe(latin);
    });
});
