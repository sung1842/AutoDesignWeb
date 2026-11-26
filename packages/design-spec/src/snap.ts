// 03장 3.3(용도 경로) + 04장 4.3 3단계 조화 스냅. 순수 함수. 해석은 ASSUMPTIONS ASM-029.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { mapL1toL2, type L1, type L2 } from "@tastefit/taxonomy";
import type { DesignData, JsonObj, Preset } from "./data.js";
import { AXIS_KEYS, decorCount, predictL1Vec } from "./predict.js";
import type { Purpose, Vec5 } from "./types.js";

/** 4.3 3단계 탐색 순서(icon.set 제외 17키, R-27). */
export const P_ORDER: readonly string[] = [
  "type.pairing_id",
  "color.palette_id",
  "shape.radius_family",
  "depth.style",
  "depth.shadow_level",
  "space.density",
  "type.scale_ratio",
  "type.display_boost",
  "type.headline_weight",
  "type.body_size",
  "type.body_leading",
  "shape.border",
  "space.container",
  "layout.grid_mode",
  "media.mode",
  "media.treatment",
  "motion.level",
];
/** 4.3 3단계 사양 상수: J의 σ 바닥 0.05, 앵커와 다른 키 하나당 벌점 0.02, 최대 반복 3. */
export const SNAP_SPEC = { sigmaFloor: 0.05, changePenalty: 0.02, maxIter: 3 } as const;
const RESERVED_SHADOW = "3";
/** CF-09: 장식 효과 이 수 이상이면 상충(04장 4.10.3). */
const CF_SPEC = { decorConflictMin: 3 } as const;
const DUOTONE_SIGNATURE = "SIG-10";

interface ForbiddenL2 {
  key: string;
  value: string;
  replace: string;
}

export function presetOfType(typeId: string, data: DesignData): Preset {
  const p = data.presets.find((x) => x.typeId === typeId);
  if (!p) throw new Error(`유형 프리셋 없음: ${typeId}`);
  return p;
}

function purposeForbidden(purpose: Purpose | null, data: DesignData): ForbiddenL2[] {
  if (purpose === null) return [];
  const row = data.purposes.find((x: JsonObj) => x.id === purpose);
  return (row?.forbiddenL2 as ForbiddenL2[] | undefined) ?? [];
}

/** 03장 3.3.1 ②: 유형 허용 매핑 결과를 용도 금지값으로 한 번 더 자른다(media.mode는 3.6.5 대체값). */
export function mapL1toL2ForPurpose(
  t: L1,
  typeId: string,
  purpose: Purpose | null,
  data: DesignData,
): L2 {
  const preset = presetOfType(typeId, data);
  const out = mapL1toL2(t, preset, data);
  for (const f of purposeForbidden(purpose, data))
    if (out[f.key] === f.value) out[f.key] = f.replace;
  return out;
}

export interface SnapContext {
  typeId: string;
  purpose: Purpose | null;
  /** 시그니처 ID(없으면 프리셋 기본 시그니처). */
  signatureId?: string;
}

/** 유형·페어링 기준 키별 허용값(taxonomy.json 값 순서). */
export function allowedValues(key: string, l2: L2, preset: Preset, data: DesignData): string[] {
  const full = data.taxonomy.find((k) => k.id === key)?.values ?? [];
  const allowed = preset.allowed[key] ?? full;
  let vals = full.filter((v) => allowed.includes(v));
  if (key === "type.headline_weight") {
    const pairing = data.pairings.find((p) => p.code === l2["type.pairing_id"]);
    vals = vals.filter((v) => pairing?.headlineWeights.includes(v) ?? false);
  }
  return vals;
}

/** L2 수준에서 판정 가능한 상충(04장 4.10.3 목록 중 CF-03·04·05·08·09·10·11). */
export function l2Conflicts(l2: L2, ctx: SnapContext, data: DesignData): string[] {
  const preset = presetOfType(ctx.typeId, data);
  const sig = ctx.signatureId ?? preset.defaultSignatureId;
  const pal = data.palettes.find((p) => p.id === l2["color.palette_id"]);
  const pairing = data.pairings.find((p) => p.code === l2["type.pairing_id"]) as
    (DesignData["pairings"][number] & { contrastSerif?: boolean; classBody?: string }) | undefined;
  const radius = l2["shape.radius_family"];
  const style = l2["depth.style"];
  const out: string[] = [];
  if (radius === "sharp" && preset.buttonPill) out.push("CF-03");
  if (
    pairing?.contrastSerif === true &&
    pairing.classBody === "sans_geometric" &&
    (radius === "round" || radius === "pill")
  )
    out.push("CF-04");
  if (sig === "SIG-07" && style === "glass") out.push("CF-05");
  if (
    l2["media.treatment"] === "duotone" &&
    (pal as { chroma?: string } | undefined)?.chroma === "vivid"
  )
    out.push("CF-08");
  if (decorCount(l2, sig, data) >= CF_SPEC.decorConflictMin) out.push("CF-09");
  if (preset.theme === "dark" && style === "brutal-offset") out.push("CF-10");
  if (sig === "SIG-06" && l2["motion.level"] === "none") out.push("CF-11");
  return out;
}

/** harmony.json.conflicts 중 presets:lint-matrix 등록분(CF-13~: 프리셋 1값 조합, 03장 3.4.1 S-33). */
export interface RegisteredConflict {
  id: string;
  preset: string;
  key: string;
  value: string;
}
const REG_CACHE = new Map<string, RegisteredConflict[]>();
export function registeredConflicts(data: DesignData): RegisteredConflict[] {
  const hit = REG_CACHE.get(data.root);
  if (hit) return hit;
  const p = join(data.root, "data/taxonomy/harmony.json");
  const list = existsSync(p)
    ? ((JSON.parse(readFileSync(p, "utf8")) as { conflicts?: Partial<RegisteredConflict>[] })
        .conflicts ?? [])
    : [];
  const out = list.filter(
    (c): c is RegisteredConflict =>
      typeof c.id === "string" &&
      typeof c.preset === "string" &&
      typeof c.key === "string" &&
      typeof c.value === "string",
  );
  REG_CACHE.set(data.root, out);
  return out;
}

/** 4.3 3단계 실행 가능 집합 F 소속 여부. */
export function inFeasible(l2: L2, ctx: SnapContext, data: DesignData): boolean {
  const preset = presetOfType(ctx.typeId, data);
  if (registeredConflicts(data).some((c) => c.preset === preset.id && l2[c.key] === c.value))
    return false;
  for (const key of Object.keys(preset.l2)) {
    const v = l2[key];
    if (v === undefined) return false;
    if (key === "icon.set") {
      if (v !== preset.l2[key]) return false;
      continue;
    }
    if (!allowedValues(key, l2, preset, data).includes(v)) return false;
  }
  if (!preset.palettes.includes(l2["color.palette_id"] ?? "")) return false;
  if (l2["depth.shadow_level"] === RESERVED_SHADOW) return false;
  for (const f of purposeForbidden(ctx.purpose, data)) if (l2[f.key] === f.value) return false;
  const sig = ctx.signatureId ?? preset.defaultSignatureId;
  if (l2["media.treatment"] === "duotone" && sig !== DUOTONE_SIGNATURE) return false;
  return l2Conflicts(l2, ctx, data).length === 0;
}

/** 04장 4.15 편집 선택지: 프리셋 허용 값별 disabled(F 밖 = 등록 상충·L2 상충·용도 금지 등, AC-03-43). */
export function editChoices(
  spec: { type_id: string; purpose: string | null; l2: L2 },
  data: DesignData,
): { key: string; value: string; disabled: boolean; current: boolean }[] {
  const preset = presetOfType(spec.type_id, data);
  const ctx: SnapContext = {
    typeId: spec.type_id,
    purpose: (spec.purpose ?? null) as Purpose | null,
  };
  const out: { key: string; value: string; disabled: boolean; current: boolean }[] = [];
  for (const key of Object.keys(preset.allowed))
    for (const value of allowedValues(key, spec.l2, preset, data)) {
      const current = spec.l2[key] === value;
      out.push({
        key,
        value,
        current,
        disabled: !current && !inFeasible({ ...spec.l2, [key]: value }, ctx, data),
      });
    }
  return out;
}

/** 4.3 3단계 목적 함수 J. */
export function snapObjective(
  l2: L2,
  t: Vec5,
  sigma: Vec5,
  ctx: SnapContext,
  data: DesignData,
): number {
  const preset = presetOfType(ctx.typeId, data);
  const raw = AXIS_KEYS.map((k) => 1 / (sigma[k] ** 2 + SNAP_SPEC.sigmaFloor ** 2));
  const sum = raw.reduce((a, b) => a + b, 0);
  const pred = predictL1Vec(l2, data, ctx.signatureId ? { signatureId: ctx.signatureId } : {});
  let j = 0;
  AXIS_KEYS.forEach((k, i) => (j += ((raw[i] ?? 0) / sum) * (pred[k] - t[k]) ** 2));
  let changed = 0;
  for (const key of Object.keys(preset.l2)) if (l2[key] !== preset.l2[key]) changed += 1;
  return j + SNAP_SPEC.changePenalty * changed;
}

/** 4.3 3단계 snapToFeasible. 동률이면 taxonomy.json 값 순서상 앞의 값. */
export function snapToFeasible(
  l2_0: L2,
  t: Vec5,
  sigma: Vec5,
  ctx: SnapContext,
  data: DesignData,
): L2 {
  const preset = presetOfType(ctx.typeId, data);
  let l2: L2 = inFeasible(l2_0, ctx, data) ? { ...l2_0 } : { ...preset.l2 };
  if (!inFeasible(l2, ctx, data)) {
    // 앵커 프리셋 자체가 용도 금지값을 가진 경우(예: local_business × type-led): 대체값 적용
    for (const f of purposeForbidden(ctx.purpose, data))
      if (l2[f.key] === f.value) l2[f.key] = f.replace;
  }
  for (let iter = 0; iter < SNAP_SPEC.maxIter; iter += 1) {
    let moved = false;
    for (const p of P_ORDER) {
      const cur = l2[p];
      let best = cur;
      let bestJ = Number.POSITIVE_INFINITY;
      for (const x of allowedValues(p, l2, preset, data)) {
        const cand = { ...l2, [p]: x };
        if (!inFeasible(cand, ctx, data)) continue;
        const j = snapObjective(cand, t, sigma, ctx, data);
        if (j < bestJ - 1e-12) {
          best = x;
          bestJ = j;
        }
      }
      if (best !== undefined && best !== cur) {
        l2 = { ...l2, [p]: best };
        moved = true;
      }
    }
    if (!moved) break;
  }
  return l2;
}
