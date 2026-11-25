// 04장 4.13 단계 S(DesignSpec만 보고 판정, 렌더 없음). 탐지 상수는 data/rule-params.json(ASM-038).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export interface LintFinding {
  rule: string;
  severity: "error" | "warn";
  message: string;
}
type Obj = { [k: string]: unknown };
const isObj = (x: unknown): x is Obj => typeof x === "object" && x !== null && !Array.isArray(x);
const repoFile = (rel: string): string =>
  fileURLToPath(new URL(`../../../${rel}`, import.meta.url));
const pkgFile = (rel: string): string => fileURLToPath(new URL(`../${rel}`, import.meta.url));

interface Params {
  "AIL-01": { hueA: [number, number]; hueB: [number, number]; chromaMin: number };
  "AIL-03": { singleFamilyBanned: string[]; headingFirstBanned: string[] };
  "AIL-06": {
    radiusPx: [number, number];
    blurMinPx: number;
    alphaMax: number;
    warnTypes: string[];
  };
}
let cache: { params: Params; families: Map<string, string> } | null = null;
function load(): { params: Params; families: Map<string, string> } {
  if (cache) return cache;
  const rp = JSON.parse(readFileSync(pkgFile("data/rule-params.json"), "utf8")) as { items: Obj[] };
  const params = Object.fromEntries(rp.items.map((i) => [i.id as string, i])) as unknown as Params;
  const reg = JSON.parse(readFileSync(repoFile("data/fonts/registry.json"), "utf8")) as {
    items: { subsetFamily: string; family: string; classification: string }[];
  };
  const families = new Map<string, string>();
  for (const f of reg.items)
    families.set(f.subsetFamily, f.classification === "mono" ? "" : f.family);
  cache = { params, families };
  return cache;
}

const inRange = (x: number, [lo, hi]: [number, number]): boolean => x >= lo && x <= hi;
const px = (d: unknown): number => (isObj(d) && typeof d.value === "number" ? d.value : NaN);

/** 토큰 트리에서 $type이 t인 잎을 모두 모은다. */
function leaves(node: unknown, t: string, out: Obj[] = []): Obj[] {
  if (!isObj(node)) return out;
  if (node.$type === t) out.push(node);
  for (const [k, v] of Object.entries(node)) if (!k.startsWith("$")) leaves(v, t, out);
  return out;
}

function ail01(tokens: Obj, p: Params["AIL-01"]): LintFinding[] {
  const out: LintFinding[] = [];
  for (const g of leaves(tokens, "gradient")) {
    const stops = Array.isArray(g.$value) ? (g.$value as Obj[]) : [];
    const lch = stops
      .map((s) => (isObj(s.color) ? (s.color.components as number[] | undefined) : undefined))
      .filter((c): c is number[] => Array.isArray(c));
    const has = (r: [number, number]): boolean =>
      lch.some((c) => (c[1] ?? 0) >= p.chromaMin && inRange(c[2] ?? -1, r));
    if (has(p.hueA) && has(p.hueB))
      out.push({ rule: "AIL-01", severity: "error", message: "보라~파랑 그라디언트 토큰" });
  }
  return out;
}

function ail03(tokens: Obj, p: Params["AIL-03"], families: Map<string, string>): LintFinding[] {
  const font = isObj(tokens.font) ? tokens.font : {};
  const first = (k: string): string | null => {
    const t = font[k];
    const v = isObj(t) && Array.isArray(t.$value) ? (t.$value[0] as string) : null;
    return v === null ? null : (families.get(v) ?? v);
  };
  const heading = first("heading");
  const used = new Set([heading, first("body")].filter((x): x is string => !!x));
  const out: LintFinding[] = [];
  if (used.size === 1 && p.singleFamilyBanned.includes([...used][0] as string))
    out.push({ rule: "AIL-03", severity: "error", message: `기본 서체 1종: ${[...used][0]}` });
  else if (heading && p.headingFirstBanned.includes(heading))
    out.push({ rule: "AIL-03", severity: "error", message: `헤딩 기본 서체: ${heading}` });
  return out;
}

function ail06(spec: Obj, tokens: Obj, p: Params["AIL-06"]): LintFinding[] {
  const l2 = (spec.l2 ?? {}) as Record<string, string>;
  const style = l2["depth.style"];
  if (style !== "subtle-shadow" && style !== "layered-shadow") return [];
  const radius =
    isObj(tokens.radius) && isObj(tokens.radius.md) ? px(tokens.radius.md.$value) : NaN;
  const shadow = isObj(tokens.shadow) ? tokens.shadow[`level-${l2["depth.shadow_level"]}`] : null;
  const layers = isObj(shadow) && Array.isArray(shadow.$value) ? (shadow.$value as Obj[]) : [];
  if (!inRange(radius, p.radiusPx) || layers.length === 0) return [];
  const blur = Math.max(...layers.map((s) => px(s.blur)));
  const alphaOk = layers.every((s) => isObj(s.color) && (s.color.alpha as number) <= p.alphaMax);
  if (blur < p.blurMinPx || !alphaOk) return [];
  const warn = p.warnTypes.includes(spec.type_id as string);
  return [
    {
      rule: "AIL-06",
      severity: warn ? "warn" : "error",
      message: `카드 radius ${radius}px + 흐린 그림자 blur ${blur}px`,
    },
  ];
}

/** 명세서 내부 정합(04장 4.2.1·4.2.2·4.14·H11): 렌더 전에 잡을 수 있는 모순. */
function specRules(spec: Obj): LintFinding[] {
  const out: LintFinding[] = [];
  const l2 = (spec.l2 ?? {}) as Record<string, string>;
  const decor = isObj(spec.decor) ? spec.decor : {};
  const effects = Array.isArray(decor.effects) ? decor.effects : [];
  const sig = isObj(spec.signature) ? spec.signature : {};
  const forb = isObj(spec.forbidden) ? spec.forbidden : {};
  if (typeof decor.max === "number" && effects.length > decor.max)
    out.push({
      rule: "SPEC-DECOR",
      severity: "error",
      message: `장식 ${effects.length} > max ${decor.max}`,
    });
  if (Array.isArray(forb.conflict_ids) && forb.conflict_ids.length > 0)
    out.push({
      rule: "SPEC-CF",
      severity: "error",
      message: `상충 ${forb.conflict_ids.join(",")}`,
    });
  if (l2["depth.shadow_level"] === "3")
    out.push({ rule: "SPEC-RESERVED", severity: "error", message: "shadow_level 3은 예약값" });
  if (l2["media.treatment"] === "duotone" && sig.id !== "SIG-10")
    out.push({ rule: "SPEC-DUOTONE", severity: "error", message: "duotone은 SIG-10일 때만" });
  if (l2["depth.style"] !== "glass" && effects.includes("glass"))
    out.push({ rule: "AIL-09", severity: "error", message: "glass 장식 ∧ depth.style ≠ glass" });
  if (typeof sig.id !== "string" || sig.id === "SIG-05")
    out.push({
      rule: "SPEC-SIG",
      severity: "error",
      message: "시그니처는 정확히 1개(SIG-05 제외)",
    });
  return out;
}

export function staticLintImpl(spec: unknown): LintFinding[] {
  if (!isObj(spec))
    return [{ rule: "SPEC-SHAPE", severity: "error", message: "명세서가 객체가 아님" }];
  const { params, families } = load();
  const tokens = isObj(spec.tokens) ? spec.tokens : {};
  return [
    ...specRules(spec),
    ...ail01(tokens, params["AIL-01"]),
    ...ail03(tokens, params["AIL-03"], families),
    ...ail06(spec, tokens, params["AIL-06"]),
  ];
}
