// 04장 4.2.2 layoutConstraints·copyTone·decor, 4.8 패턴 슬롯, 4.14 apply_to 단위 테스트(ASM-035).
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadDesignData } from "./data.js";
import {
  PATTERNS,
  copyTone,
  decorFor,
  heroVariants,
  imageTagsAllowed,
  layoutConstraints,
  patternSlots,
  sigCtx,
  signatureApplyTo,
} from "./layout.js";
import { signatureCandidates } from "./pick-signature.js";
import type { Purpose, Variant, Vec5 } from "./types.js";

const data = loadDesignData(join(import.meta.dirname, "../../.."));
const PURPOSES: Purpose[] = ["saas", "local_business", "portfolio"];
const VARIANTS: Variant[] = ["v_true", "v_fit", "v_bal"];
const v = (e: number, t: number, s: number, d: number, p: number): Vec5 => ({
  expression: e,
  temperature: t,
  shape: s,
  density: d,
  depth: p,
});

describe("hero_variants·패턴 슬롯(4.2.2·4.8)", () => {
  it("TRUE = 유형 허용, FIT = 용도 표준, BAL ⊆ 유형 허용, 전부 비지 않고 hero. 접두", () => {
    for (const p of data.presets)
      for (const purpose of PURPOSES) {
        const t = heroVariants(p, purpose, "v_true", data);
        const f = heroVariants(p, purpose, "v_fit", data);
        const b = heroVariants(p, purpose, "v_bal", data);
        expect(t).toEqual(p.heroVariants.map((x) => `hero.${x}`));
        expect(f.length).toBeGreaterThan(0);
        for (const x of b) expect(t).toContain(x);
        for (const x of [...t, ...f, ...b]) expect(x.startsWith("hero.")).toBe(true);
      }
  });
  it("슬롯: FIT 슬롯1 = 표준·BAL은 상한 안에서 표준, TRUE = 유형 선호, 잡 내 같은 패턴 ≤ 2, 결정론", () => {
    for (const p of data.presets)
      for (const purpose of PURPOSES)
        for (const seed of ["a", "b", "c", "d"]) {
          const s = patternSlots(p, purpose, seed);
          const std = PATTERNS[purpose][0]!.id;
          expect(s.v_fit[0]).toBe(std);
          // 표준이 TRUE 선호에 있으면 잡 상한 때문에 BAL 슬롯1은 표준이 아니다(ASM-035 ②).
          if (s.v_true.includes(std)) expect(s.v_bal[0]).not.toBe(std);
          else expect(s.v_bal[0]).toBe(std);
          expect(s.v_true).toEqual(p.preferredPatterns[purpose]);
          for (const k of VARIANTS) expect(s[k][0]).not.toBe(s[k][1]);
          const all = [...s.v_true, ...s.v_fit, ...s.v_bal];
          for (const id of all) expect(all.filter((x) => x === id).length).toBeLessThanOrEqual(2);
          expect(patternSlots(p, purpose, seed)).toEqual(s);
        }
  });
});

describe("layoutConstraints(4.2.1)", () => {
  it("purposes.json 반영, 금지 블록 없음, 제외 variant 없음, bento는 grid_mode=bento일 때만", () => {
    for (const p of data.presets)
      for (const purpose of PURPOSES)
        for (const variant of VARIANTS) {
          const slots = patternSlots(p, purpose, "x")[variant];
          const c = layoutConstraints(p, purpose, variant, p.l2, slots, data);
          expect(c.required_blocks).toContain("hero");
          for (const b of c.forbidden_blocks) expect(c.allowed_variants[b]).toBeUndefined();
          const vars = Object.values(c.allowed_variants).flat();
          for (const x of p.excludedVariants) expect(vars).not.toContain(x);
          if (p.l2["layout.grid_mode"] !== "bento")
            expect(vars.some((x) => x.endsWith(".bento"))).toBe(false);
          expect(c.allowed_variants.hero).toEqual(c.hero_variants);
          expect(c.image_tags_allowed.length).toBeGreaterThan(0);
          for (const tg of c.image_tags_allowed)
            expect(tg.startsWith(`${purpose}.`) || tg.startsWith("common.")).toBe(true);
        }
  });
  it("image_tags_allowed: 업종 교집합 있으면 그것, 없으면 기본 태그 + common.texture-*", () => {
    expect(
      imageTagsAllowed("local_business", data, ["local_business.bakery", "saas.material"]),
    ).toEqual(["local_business.bakery"]);
    expect(imageTagsAllowed("saas", data)).toEqual([
      "saas.architecture",
      "common.texture-concrete",
      "common.texture-fabric",
      "common.texture-paper",
    ]);
  });
});

describe("apply_to(4.14 규칙 4)", () => {
  it("모든 프리셋·용도·변형에서 선택 가능한 시그니처의 apply_to가 비지 않고 intensity 1 ≤ 2", () => {
    for (const p of data.presets)
      for (const purpose of PURPOSES)
        for (const variant of VARIANTS) {
          const c = layoutConstraints(p, purpose, variant, p.l2, ["a", "b"], data);
          const ctx = sigCtx(p.theme, p.l2, c, data);
          for (const id of signatureCandidates(p, ctx)) {
            const a2 = signatureApplyTo(id, 2, c, data);
            const a1 = signatureApplyTo(id, 1, c, data);
            expect(a2.length, `${p.id} ${purpose} ${id}`).toBeGreaterThan(0);
            expect(a1.length).toBe(Math.ceil(a2.length / 2));
            expect(a2.slice(0, a1.length)).toEqual(a1);
          }
        }
  });
  it("최대 적용 수: SIG-03 ≤ 2, SIG-06·07·11 = 1", () => {
    const p = data.presets[0]!;
    const c = layoutConstraints(p, "saas", "v_true", p.l2, ["a", "b"], data);
    expect(signatureApplyTo("SIG-03", 2, c, data).length).toBeLessThanOrEqual(2);
    expect(signatureApplyTo("SIG-07", 2, c, data)).toEqual(["page"]);
    expect(signatureApplyTo("SIG-11", 2, c, data)).toEqual(["hero"]);
    expect(signatureApplyTo("SIG-06", 2, c, data)).toEqual(["cta"]);
  });
});

describe("copyTone(4.6.1)", () => {
  it("첫 일치 규칙과 용도 기본", () => {
    expect(copyTone(v(0.6, 0.6, 0.5, 0.5, 0.5), "saas", "v_true").tone_id).toBe("T-PLAYFUL");
    expect(copyTone(v(0.5, 0.5, 0.5, 0.35, 0.5), "saas", "v_true").tone_id).toBe("T-EDITORIAL");
    expect(copyTone(v(0.55, 0.55, 0.5, 0.5, 0.5), "saas", "v_true").tone_id).toBe("T-WARM");
    expect(copyTone(v(0.44, 0.44, 0.5, 0.5, 0.5), "portfolio", "v_true").tone_id).toBe("T-PRECISE");
    expect(copyTone(v(0.5, 0.5, 0.5, 0.5, 0.5), "local_business", "v_true").tone_id).toBe("T-WARM");
    expect(copyTone(v(0.5, 0.5, 0.5, 0.5, 0.5), "portfolio", "v_true").tone_id).toBe("T-EDITORIAL");
  });
  it("종결·느낌표·헤드라인 선호", () => {
    const pl = copyTone(v(0.7, 0.7, 0.5, 0.5, 0.5), "saas", "v_true");
    expect([pl.ending, pl.exclaim_max_per_page]).toEqual(["haeyo", 1]);
    const pr = copyTone(v(0.2, 0.2, 0.5, 0.5, 0.5), "saas", "v_fit");
    expect([pr.ending, pr.exclaim_max_per_page]).toEqual(["hamnida", 0]);
    expect(pr.headline_option_preference[0]).toBe("factual");
    expect(
      copyTone(v(0.2, 0.2, 0.5, 0.5, 0.5), "saas", "v_bal").headline_option_preference[0],
    ).toBe("benefit");
    expect(copyTone(v(0.5, 0.5, 0.5, 0.2, 0.5), "saas", "v_true").ending).toBe("plain");
  });
});

describe("decor(4.2.2 10단계)", () => {
  it("max: FIT 1, TRUE·BAL 2(κ < 0.5이면 1). effects = 시그니처 DecorId ∪ glass·brutal-offset", () => {
    const l2 = { ...data.presets[0]!.l2, "depth.style": "glass" };
    expect(decorFor("SIG-03", l2, 0.8, "v_true", data)).toEqual({
      effects: ["oversized-type", "glass"],
      max: 2,
    });
    expect(decorFor("SIG-01", l2, 0.8, "v_fit", data)).toEqual({ effects: ["glass"], max: 1 });
    expect(decorFor("SIG-09", { ...l2, "depth.style": "flat" }, 0.3, "v_bal", data)).toEqual({
      effects: [],
      max: 1,
    });
  });
});
