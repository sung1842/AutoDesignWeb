import { describe, expect, it } from "vitest";
import { harmonyScore, loadHarmony } from "./index.js";

const col = (l: number, c: number, h: number): unknown => ({
  $type: "color",
  $value: { colorSpace: "oklch", components: [l, c, h], alpha: 1 },
});
const typ = (px: number, w: number): unknown => ({
  $value: { fontSize: { value: px, unit: "px" }, fontWeight: w },
});

function baseSpec(): Record<string, unknown> {
  return {
    theme: "light",
    l2: { "depth.style": "flat", "motion.level": "none" },
    signature: { id: "SIG-01" },
    decor: { effects: [], max: 2 },
    forbidden: { conflict_ids: [] },
    tokens: {
      color: {
        bg: col(0.975, 0.008, 85),
        surface: col(0.945, 0.01, 85),
        "surface-inverse": col(0.24, 0.012, 60),
        primary: col(0.5, 0.12, 250),
        accent: col(0.6, 0.12, 280),
        success: col(0.6, 0.15, 145),
      },
      font: {
        heading: { $value: ["tf-a", "serif"] },
        body: { $value: ["tf-b", "sans-serif"] },
        weight: { heading: { $value: 600 }, body: { $value: 400 }, emphasis: { $value: 700 } },
      },
      type: { body: typ(18, 400), display: typ(81, 600) },
      shadow: { color: col(0.145, 0.01, 85), "level-1": { $value: [] } },
    },
  };
}
const tree = {
  sections: [
    { block: "hero", variant: "hero.split", slots: { eyebrow: { copy: { text: "소개" } } } },
  ],
};
const pts = (r: ReturnType<typeof harmonyScore>, id: string): number =>
  r.items.find((i) => i.id === id)?.points ?? -1;

describe("harmonyScore(03장 3.14.3, ASM-074)", () => {
  it("harmony.json 배점 합 100, 기본 명세 H = 100", () => {
    const sum = loadHarmony()
      .items.filter((i) => i.kind === "score")
      .reduce((s, i) => s + (i.points as number), 0);
    expect(sum).toBe(100);
    const r = harmonyScore(baseSpec(), tree);
    expect(r.total).toBe(100);
    expect(r.conflicts).toEqual([]);
  });

  it("H1: 브랜드 색 4개 → 4점, H2: hue 차 90° → 0점, H3: accent C 과다 → 2.5", () => {
    const s = baseSpec();
    const c = (s.tokens as { color: Record<string, unknown> }).color;
    c.accent = col(0.6, 0.2, 340);
    c.surface = col(0.9, 0.06, 30);
    c["surface-inverse"] = col(0.3, 0.08, 150);
    const r = harmonyScore(s, tree);
    expect(pts(r, "H1")).toBe(4);
    expect(pts(r, "H2")).toBe(0);
    expect(pts(r, "H3")).toBe(2.5);
  });

  it("무채 primary는 H2·H3 관계 검사 면제", () => {
    const s = baseSpec();
    const c = (s.tokens as { color: Record<string, unknown> }).color;
    c.primary = col(0.2, 0.01, 60);
    c.accent = col(0.6, 0.2, 30);
    const r = harmonyScore(s, tree);
    expect(pts(r, "H2")).toBe(10);
    expect(pts(r, "H3")).toBe(5);
  });

  it("H4·H5·H7: 렌더 측정 입력이 토큰보다 우선", () => {
    const r = harmonyScore(baseSpec(), tree, {
      render: {
        fontFamilies: ["a", "b", "c", "mono-x"],
        fontWeights: [300, 400, 500, 700],
        displayPx: 40,
        bodyPx: 18,
      },
    });
    expect(pts(r, "H4")).toBe(0);
    expect(pts(r, "H5")).toBe(2);
    expect(pts(r, "H7")).toBe(0);
  });

  it("H6·H8·H9 비율 구간, H11 초과 1개당 −3, H12 LT-05~08만 2점씩", () => {
    const r = harmonyScore(baseSpec(), tree, {
      render: {
        typeScaleRatio: 0.92,
        spacingRatio: 0.5,
        radiusRatio: 0.96,
        decorEffects: ["a", "b", "c"],
      },
      violations: [{ rule: "LT-05" }, { rule: "LT-07" }, { rule: "LT-01" }, { rule: "RH-01" }],
    });
    expect(pts(r, "H6")).toBe(5);
    expect(pts(r, "H8")).toBe(0);
    expect(pts(r, "H9")).toBe(4);
    expect(pts(r, "H11")).toBe(3);
    expect(pts(r, "H12")).toBe(4);
  });

  it("상충 픽스처(CF-01·05·06·09·10·11·12 + forbidden.conflict_ids)는 H ≤ 79", () => {
    const cases: [string, (s: Record<string, unknown>) => unknown][] = [
      ["CF-01", (s) => ((s.l2 as Record<string, string>)["depth.style"] = "glass")],
      [
        "CF-05",
        (s) => {
          (s.l2 as Record<string, string>)["depth.style"] = "glass";
          s.signature = { id: "SIG-07" };
        },
      ],
      [
        "CF-06",
        (s) => {
          s.theme = "dark";
          const sh = (s.tokens as { shadow: Record<string, unknown> }).shadow;
          sh.color = col(0.02, 0, 0);
          sh["level-1"] = { $value: [{ blur: 4 }] };
        },
      ],
      ["CF-09", (s) => (s.decor = { effects: ["a", "b", "c"], max: 2 })],
      [
        "CF-10",
        (s) => {
          s.theme = "dark";
          (s.l2 as Record<string, string>)["depth.style"] = "brutal-offset";
        },
      ],
      ["CF-11", (s) => (s.signature = { id: "SIG-06" })],
      ["CF-03", (s) => (s.forbidden = { conflict_ids: ["CF-03"] })],
    ];
    for (const [id, mut] of cases) {
      const s = baseSpec();
      mut(s);
      const r = harmonyScore(s, tree);
      expect(r.conflicts, id).toContain(id);
      expect(r.total, id).toBeLessThanOrEqual(79);
    }
    const t12 = {
      sections: [
        {
          block: "hero",
          variant: "hero.centered",
          slots: { eyebrow: { copy: { text: "✨ 신규 출시" } } },
        },
      ],
    };
    const r = harmonyScore(baseSpec(), t12);
    expect(r.conflicts).toContain("CF-12");
    expect(r.total).toBeLessThanOrEqual(79);
  });
});
