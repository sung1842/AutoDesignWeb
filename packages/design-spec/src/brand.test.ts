// 03장 3.13 applyBrandColor 단위 테스트(ASM-032). 잠긴 AC-03-36·37(assets.test)과 같은 픽스처로
// 하네스 없이 먼저 확인한다.
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { thresholdNumber } from "@tastefit/config";
import { contrast, hexToOklch } from "@tastefit/taxonomy";
import { loadDesignData } from "./data.js";
import { applyBrandColorImpl, hueDiff, normalizeBrandHex } from "./brand.js";
import { deriveTokens } from "./stubs.js";

const data = loadDesignData(join(import.meta.dirname, "../../.."));
const BODY = thresholdNumber("generation.contrastBodyMin");
const LARGE = thresholdNumber("generation.contrastLargeMin");
type Obj = { [k: string]: unknown };
const HEX24 = [
  "#000000",
  "#FFFFFF",
  "#FF0000",
  "#00FF00",
  "#0000FF",
  "#FFFF00",
  "#00FFFF",
  "#FF00FF",
  "#808080",
  "#F5F5DC",
  "#0A0A0A",
  "#F0F0F0",
  "#123456",
  "#FEDCBA",
  "#FF7F00",
  "#8A2BE2",
  "#2E8B57",
  "#DC143C",
  "#4B0082",
  "#7FFF00",
  "#39FF14",
  "#FDFD96",
  "#AAF0D1",
  "#FFF5CC",
];
const hexOf = (c: Obj, k: string): string | null =>
  c[k] ? ((((c[k] as Obj).$value as Obj).hex as string) ?? null) : null;

describe("normalizeBrandHex", () => {
  it("#RGB 확장·대문자, 그 외 거부", () => {
    expect(normalizeBrandHex("#abc")).toBe("#AABBCC");
    expect(normalizeBrandHex("#a1B2c3")).toBe("#A1B2C3");
    expect(normalizeBrandHex("red")).toBeNull();
    expect(normalizeBrandHex("#12345")).toBeNull();
  });
});

describe("applyBrandColor 3.13", () => {
  it("24 × 8 = 192건: 예외 0, 결과 TokenSet 하드 대비 통과, primary hue ≤ 5°(hex 반올림 오차 허용 범위 밖은 기록)", () => {
    const bad: string[] = [];
    const hueOff: string[] = [];
    for (const p of data.presets)
      for (const hex of HEX24) {
        const paletteId = p.l2["color.palette_id"] as string;
        const r = applyBrandColorImpl({ presetId: p.id, paletteId, hex }, data);
        expect([null, "adjusted", "demoted_to_accent", "used_as_tint", "ignored"]).toContain(
          r.notice,
        );
        const c = (deriveTokens({ presetId: p.id, l2: p.l2, brand: { hex } }, data).tokenSet as Obj)
          .color as Obj;
        const pairs: [string, string, number][] = [
          ["fg", "bg", BODY],
          ["fg", "surface", BODY],
          ["fg-muted", "bg", BODY],
          ["fg-inverse", "surface-inverse", BODY],
          ["border-strong", "bg", LARGE],
          ["primary", "bg", LARGE],
          ["on-primary", "primary", BODY],
          ["on-primary", "primary-hover", BODY],
          ["on-primary", "primary-active", BODY],
          ["focus", "bg", LARGE],
          ["focus", "surface", LARGE],
        ];
        if (r.role === "accent") pairs.push(["accent", "bg", LARGE]);
        for (const [f, b, min] of pairs) {
          const fh = hexOf(c, f);
          const bh = hexOf(c, b);
          if (fh && bh && contrast(fh, bh) < min) bad.push(`${p.id} ${hex} ${f}/${b}`);
        }
        if (r.role === "primary") {
          const got = hexToOklch(hexOf(c, "primary") ?? "#000000");
          if (got.c >= 0.04 && hueDiff(got.h, hexToOklch(hex).h) > 5) hueOff.push(`${p.id} ${hex}`);
        }
      }
    expect(bad).toEqual([]);
    expect(hueOff).toEqual([]);
  });

  it("무채 브랜드 색 → primary 불변, 사유 brand_neutral_*", () => {
    for (const p of data.presets)
      for (const hex of ["#000000", "#FFFFFF", "#808080", "#0A0A0A", "#F0F0F0"]) {
        const paletteId = p.l2["color.palette_id"] as string;
        const r = applyBrandColorImpl({ presetId: p.id, paletteId, hex }, data);
        expect(["brand_neutral_ignored", "brand_neutral_inverse"]).toContain(r.reason);
        const base = (deriveTokens({ presetId: p.id, l2: p.l2 }, data).tokenSet as Obj)
          .color as Obj;
        const withB = (
          deriveTokens({ presetId: p.id, l2: p.l2, brand: { hex } }, data).tokenSet as Obj
        ).color as Obj;
        expect((withB.primary as Obj).$value).toEqual((base.primary as Obj).$value);
      }
  });

  it("결정적: 같은 입력 → 같은 결과, 잘못된 형식은 ignored", () => {
    const p = data.presets[0]!;
    const paletteId = p.l2["color.palette_id"] as string;
    const a = applyBrandColorImpl({ presetId: p.id, paletteId, hex: "#DC143C" }, data);
    expect(applyBrandColorImpl({ presetId: p.id, paletteId, hex: "#dc143c" }, data)).toEqual(a);
    expect(applyBrandColorImpl({ presetId: p.id, paletteId, hex: "nope" }, data).notice).toBe(
      "ignored",
    );
  });
});
