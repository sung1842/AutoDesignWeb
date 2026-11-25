// 04장 4.4 enforceVariantL2Diff·4.2.1 spec_id 단위 테스트(ASM-036).
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { thresholdNumber } from "@tastefit/config";
import { loadDesignData } from "./data.js";
import { canonicalJson, diffCount, enforceVariantL2Diff, l2DiffVector, specId } from "./enforce.js";
import { heroVariants } from "./layout.js";
import { inFeasible } from "./snap.js";
import type { Purpose, Variant, Vec5 } from "./types.js";

const data = loadDesignData(join(import.meta.dirname, "../../.."));
const MIN = thresholdNumber("generation.variant.l2DiffMin");
const PURPOSES: Purpose[] = ["saas", "local_business", "portfolio"];
const KEYS = ["expression", "temperature", "shape", "density", "depth"] as const;
const vec = (a: readonly number[]): Vec5 =>
  Object.fromEntries(KEYS.map((k, i) => [k, a[i] ?? 0])) as Vec5;
const sigma = vec([0.08, 0.08, 0.08, 0.08, 0.08]);
const same = (): [string, string] => ["hero.x", "SIG-x"];

describe("enforceVariantL2Diff(4.4 L2 층)", () => {
  it("세 변형이 같은 앵커 L2(최악)여도 8유형 × 3용도 모두 쌍마다 7키(hero 포함) l2DiffMin 이상, F 안, TRUE 불변", () => {
    for (const p of data.presets)
      for (const purpose of PURPOSES) {
        const ctx = { typeId: p.typeId, purpose };
        if (!inFeasible(p.l2, ctx, data)) continue; // 앵커 자체가 용도 금지값이면 snap이 먼저 바꾼다
        const t = vec(p.l1);
        const hx = (v: Variant): [string, string] => [
          heroVariants(p, purpose, v, data).join(","),
          "SIG-x",
        ];
        const one = { l2: { ...p.l2 }, t, sigma, ctx };
        const r = enforceVariantL2Diff(
          { v_true: one, v_fit: { ...one }, v_bal: { ...one } },
          hx,
          data,
        );
        expect(r.satisfied, `${p.id} ${purpose}`).toBe(true);
        expect(r.l2.v_true).toEqual(p.l2);
        for (const v of ["v_fit", "v_bal"] as Variant[])
          expect(inFeasible(r.l2[v], ctx, data)).toBe(true);
        const d = (a: Variant, b: Variant): number =>
          diffCount(l2DiffVector(r.l2[a], hx(a)), l2DiffVector(r.l2[b], hx(b)));
        expect(
          Math.min(d("v_true", "v_fit"), d("v_true", "v_bal"), d("v_fit", "v_bal")),
        ).toBeGreaterThanOrEqual(MIN);
        expect(
          enforceVariantL2Diff({ v_true: one, v_fit: { ...one }, v_bal: { ...one } }, hx, data),
        ).toEqual(r);
      }
  });
  it("이미 충분히 다르면 아무것도 바꾸지 않는다(extras가 차이를 채우는 경우 포함)", () => {
    const p = data.presets[0]!;
    const ctx = { typeId: p.typeId, purpose: "saas" as const };
    const one = { l2: { ...p.l2 }, t: vec(p.l1), sigma, ctx };
    const ex = (v: Variant): [string, string] => [`h-${v}`, `s-${v}`];
    const a = enforceVariantL2Diff({ v_true: one, v_fit: one, v_bal: one }, ex, data);
    // extras 2개 차이 + L2 1개면 충족 → FIT·BAL 각 1회 이하 교체
    expect(a.changed.filter((c) => c.variant === "v_fit").length).toBe(MIN - 2);
    expect(a.satisfied).toBe(true);
  });
});

describe("enforceVariantL2Diff 불가능 입력", () => {
  it("L2 대안이 모자라면 예외 없이 satisfied=false(렌더 층·low_separation으로 넘김)", () => {
    const p = data.presets.find((x) => x.id === "PS-T8")!;
    const ctx = { typeId: p.typeId, purpose: "saas" as const };
    const one = { l2: { ...p.l2 }, t: vec(p.l1), sigma, ctx };
    const r = enforceVariantL2Diff(
      { v_true: one, v_fit: { ...one }, v_bal: { ...one } },
      same,
      data,
    );
    expect(r.satisfied).toBe(false);
    expect(r.changed.length).toBeGreaterThan(0);
  });
});

describe("spec_id(4.2.1)", () => {
  it("키 순서와 무관한 16자 hex, 입력이 다르면 다름", () => {
    expect(canonicalJson({ b: 1, a: [2, { d: 1, c: 2 }] })).toBe('{"a":[2,{"c":2,"d":1}],"b":1}');
    const x = specId({ a: 1, b: "v_true" });
    expect(x).toMatch(/^[0-9a-f]{16}$/);
    expect(specId({ b: "v_true", a: 1 })).toBe(x);
    expect(specId({ a: 1, b: "v_fit" })).not.toBe(x);
  });
});
