// 04장 4.4 L2 층 변형 차이 강제(enforceVariantL2Diff)와 4.2.1 spec_id. 순수·결정적. 해석은 ASSUMPTIONS ASM-036.
import { createHash } from "node:crypto";
import { thresholdNumber } from "@tastefit/config";
import type { L2 } from "@tastefit/taxonomy";
import type { DesignData } from "./data.js";
import {
  allowedValues,
  inFeasible,
  presetOfType,
  snapObjective,
  type SnapContext,
} from "./snap.js";
import type { Variant, Vec5 } from "./types.js";

/** 4.4 L2 층 비교 7키 중 L2에서 바꿀 수 있는 키(교체 탐색 순서). hero·signature는 extras로 따라 바뀐다. */
export const L2_DIFF_KEYS: readonly string[] = [
  "type.pairing_id",
  "color.palette_id",
  "shape.radius_family",
  "depth.style",
  "depth.shadow_level",
  "space.density",
];
/** 교체 반복 상한(7키 전부 바꿔도 끝나도록). */
export const ENFORCE_SPEC = { maxSteps: 7 } as const;

export interface VariantL2 {
  l2: L2;
  t: Vec5;
  sigma: Vec5;
  ctx: SnapContext;
}
/** l2가 정해졌을 때 그 변형의 [hero_variants 결합 문자열, signature id]. */
export type Extras = (variant: Variant, l2: L2) => [string, string];

/** 4.4 7키 벡터: pairing, palette, radius, depth(style|level), density, hero, signature. */
export function l2DiffVector(l2: L2, extras: [string, string]): string[] {
  return [
    l2["type.pairing_id"] ?? "",
    l2["color.palette_id"] ?? "",
    l2["shape.radius_family"] ?? "",
    `${l2["depth.style"] ?? ""}|${l2["depth.shadow_level"] ?? ""}`,
    l2["space.density"] ?? "",
    extras[0],
    extras[1],
  ];
}
export const diffCount = (a: string[], b: string[]): number =>
  a.filter((v, i) => v !== b[i]).length;

/** 페어링을 바꾸면 헤드라인 굵기를 새 페어링 허용값으로 맞춘다(기본값 우선). */
function withPairingFix(l2: L2, data: DesignData, typeId: string): L2 {
  const preset = presetOfType(typeId, data);
  const ok = allowedValues("type.headline_weight", l2, preset, data);
  if (ok.includes(l2["type.headline_weight"] ?? "")) return l2;
  const p = data.pairingsFull.find((x) => x.code === l2["type.pairing_id"]);
  const w = p && ok.includes(p.defaultHeadlineWeight) ? p.defaultHeadlineWeight : ok[0];
  return w === undefined ? l2 : { ...l2, "type.headline_weight": w };
}

export interface EnforceResult {
  l2: Record<Variant, L2>;
  changed: { variant: Variant; key: string; from: string; to: string }[];
  satisfied: boolean;
}

/**
 * 4.4: V-FIT → V-BAL 순으로, 미달 쌍의 부족분(Σ max(0, min − diff))을 줄이는 단일 키 교체 중
 * J 증가량이 가장 작은 것을 F 안에서 고른다. V-FIT은 (TRUE, FIT) 쌍만, V-BAL은 두 쌍을 본다.
 */
export function enforceVariantL2Diff(
  input: Record<Variant, VariantL2>,
  extras: Extras,
  data: DesignData,
): EnforceResult {
  const min = thresholdNumber("generation.variant.l2DiffMin");
  const l2: Record<Variant, L2> = {
    v_true: input.v_true.l2,
    v_fit: input.v_fit.l2,
    v_bal: input.v_bal.l2,
  };
  const vec = (v: Variant, x: L2 = l2[v]): string[] => l2DiffVector(x, extras(v, x));
  const changed: EnforceResult["changed"] = [];
  const peers: Record<"v_fit" | "v_bal", Variant[]> = {
    v_fit: ["v_true"],
    v_bal: ["v_true", "v_fit"],
  };
  const deficit = (v: "v_fit" | "v_bal", x: L2): number =>
    peers[v].reduce((s, q) => s + Math.max(0, min - diffCount(vec(v, x), vec(q))), 0);

  for (const v of ["v_fit", "v_bal"] as const) {
    const { t, sigma, ctx } = input[v];
    const preset = presetOfType(ctx.typeId, data);
    for (let step = 0; step < ENFORCE_SPEC.maxSteps && deficit(v, l2[v]) > 0; step += 1) {
      const cur = l2[v];
      const d0 = deficit(v, cur);
      const j0 = snapObjective(cur, t, sigma, ctx, data);
      let best: { l2: L2; key: string; to: string; d: number; dj: number } | null = null;
      for (const key of L2_DIFF_KEYS)
        for (const x of allowedValues(key, cur, preset, data)) {
          if (x === cur[key]) continue;
          let cand: L2 = { ...cur, [key]: x };
          if (key === "type.pairing_id") cand = withPairingFix(cand, data, ctx.typeId);
          if (!inFeasible(cand, ctx, data)) continue;
          const d = deficit(v, cand);
          if (d >= d0) continue;
          const dj = snapObjective(cand, t, sigma, ctx, data) - j0;
          if (!best || d < best.d || (d === best.d && dj < best.dj - 1e-12))
            best = { l2: cand, key, to: x, d, dj };
        }
      if (!best) break;
      changed.push({ variant: v, key: best.key, from: cur[best.key] ?? "", to: best.to });
      l2[v] = best.l2;
    }
  }
  const pairs: [Variant, Variant][] = [
    ["v_true", "v_fit"],
    ["v_true", "v_bal"],
    ["v_fit", "v_bal"],
  ];
  const satisfied = pairs.every(([a, b]) => diffCount(vec(a), vec(b)) >= min);
  return { l2, changed, satisfied };
}

/** 키 정렬 JSON(정규화). */
export function canonicalJson(x: unknown): string {
  if (Array.isArray(x)) return `[${x.map(canonicalJson).join(",")}]`;
  if (x !== null && typeof x === "object") {
    const o = x as Record<string, unknown>;
    return `{${Object.keys(o)
      .filter((k) => o[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonicalJson(o[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(x);
}

/** 4.2.1 spec_id = sha256(입력 정규화 JSON) 앞 16자. */
export function specId(input: unknown): string {
  return createHash("sha256").update(canonicalJson(input)).digest("hex").slice(0, 16);
}
