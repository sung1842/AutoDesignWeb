// 04장 4.2.2 7·8·10단계: layoutConstraints·copyTone·decor, 4.8 패턴 슬롯, 4.14 apply_to. 해석은 ASSUMPTIONS ASM-035.
import { createHash } from "node:crypto";
import type { L2 } from "@tastefit/taxonomy";
import type { DesignData, JsonObj, Preset } from "./data.js";
import { displayPx } from "./predict.js";
import type { DesignSpec, Purpose, SigCtx, Variant, Vec5 } from "./types.js";

type Constraints = DesignSpec["layout_constraints"];
type Copy = DesignSpec["copy"];

/** 4.8 패턴 카탈로그(config/patterns.json 부재 → 사양 상수). 순서 힌트는 hero·nav·footer 제외. */
export const PATTERNS: Record<Purpose, readonly { id: string; order: string[]; hero: string }[]> = {
  saas: [
    { id: "PS-1", order: ["value", "feature", "proof", "faq", "cta"], hero: "split" },
    { id: "PS-2", order: ["stats", "feature", "proof", "cta"], hero: "type-only" },
    { id: "PS-3", order: ["showcase", "value", "faq", "cta"], hero: "full-bleed-image" },
    { id: "PS-4", order: ["process", "feature", "proof", "cta"], hero: "left-aligned" },
  ],
  local_business: [
    { id: "PL-1", order: ["menu", "highlight", "gallery", "location"], hero: "full-bleed-image" },
    { id: "PL-2", order: ["story", "gallery", "menu", "location"], hero: "split" },
    { id: "PL-3", order: ["gallery", "highlight", "menu", "location"], hero: "full-bleed-image" },
    { id: "PL-4", order: ["highlight", "proof", "menu", "location"], hero: "left-aligned" },
  ],
  portfolio: [
    { id: "PP-1", order: ["gallery", "about", "service", "contact"], hero: "type-only" },
    { id: "PP-2", order: ["about", "gallery", "service", "contact"], hero: "split" },
    { id: "PP-3", order: ["service", "gallery", "proof", "contact"], hero: "left-aligned" },
    { id: "PP-4", order: ["showcase", "gallery", "about", "contact"], hero: "full-bleed-image" },
  ],
};

/** 4.2.1 rhythm 고정값, 4.2.2 변형별 decor.max 표(κ 경계 0.5), 4.8 잡 내 패턴 반복 상한. */
export const LAYOUT_SPEC = {
  rhythm: {
    max_centered_ratio: 0.4,
    inverse_sections: [1, 2],
    max_same_bg_run: 2,
    forbid_strict_alternation: true,
    pad_variation_min: 1,
  },
  decorKappaMin: 0.5,
  patternMaxPerJob: 2,
} as const;

interface PurposeRow {
  id: Purpose;
  requiredSections: string[];
  requiredAny: string[];
  optionalSections: string[];
  forbiddenSections: string[];
  sectionCount: [number, number];
  standardHero: string[];
  imageTags: string[];
  defaultImageTag: string;
}
interface BlockVariant {
  id: string;
  image: unknown;
}
interface BlockRow {
  id: string;
  variants: BlockVariant[];
}

export function purposeRow(purpose: Purpose, data: DesignData): PurposeRow {
  const r = (data.purposes as JsonObj[]).find((p) => p.id === purpose);
  if (!r) throw new Error(`purposes.json에 ${purpose} 없음`);
  return r as unknown as PurposeRow;
}
function blockRows(data: DesignData): BlockRow[] {
  return data.blocks as unknown as BlockRow[];
}

const hv = (x: string): string => (x.startsWith("hero.") ? x : `hero.${x}`);
const uniq = <T>(a: T[]): T[] => [...new Set(a)];

/** 4.2.2 변형별 hero_variants. 용도 허용 = 그 용도 패턴 4개의 hero 힌트(ASM-035 ①). */
export function heroVariants(
  preset: Preset,
  purpose: Purpose,
  variant: Variant,
  data: DesignData,
): string[] {
  const ex = new Set(preset.excludedVariants);
  const type = preset.heroVariants.map(hv).filter((x) => !ex.has(x));
  const fit = purposeRow(purpose, data)
    .standardHero.map(hv)
    .filter((x) => !ex.has(x));
  const allowedByPurpose = new Set(PATTERNS[purpose].map((p) => hv(p.hero)));
  let out: string[];
  if (variant === "v_true") out = type;
  else if (variant === "v_fit") out = fit;
  else out = type.filter((x) => allowedByPurpose.has(x));
  return out.length > 0 ? uniq(out) : type;
}

function seedIndex(seed: string, n: number): number {
  return parseInt(createHash("sha256").update(seed).digest("hex").slice(0, 8), 16) % n;
}

/** 4.8 슬롯 배정(결정론): FIT = 표준 + 표준 외 1(job_seed), TRUE = 유형 선호 2, BAL = 표준 + 유형 선호 1. 잡 내 같은 패턴 ≤ 2회. */
export function patternSlots(
  preset: Preset,
  purpose: Purpose,
  jobSeed: string,
): Record<Variant, [string, string]> {
  const ids = PATTERNS[purpose].map((p) => p.id);
  const std = ids[0] as string;
  const pref = preset.preferredPatterns[purpose] ?? [];
  const p0 = pref[0] ?? std;
  const p1 = pref[1] ?? ids.find((x) => x !== p0) ?? std;
  const vTrue: [string, string] = [p0, p1 === p0 ? (ids.find((x) => x !== p0) as string) : p1];
  const balType = vTrue.find((x) => x !== std) as string;
  const vBal: [string, string] = [std, balType];
  const count = (x: string, fit: string[]): number =>
    [...vTrue, ...vBal, ...fit].filter((y) => y === x).length;
  const others = ids.slice(1);
  const start = seedIndex(`${jobSeed}|pattern`, others.length);
  const rot = [...others.slice(start), ...others.slice(0, start)];
  const pick =
    rot.find((x) => count(x, [std]) < LAYOUT_SPEC.patternMaxPerJob) ?? (rot[0] as string);
  // 표준이 TRUE 선호에도 있으면 3회가 된다 → 잡 상한(≤ 2)이 이기고 BAL 슬롯1을 남은 패턴으로 바꾼다(ASM-035 ②).
  if (count(std, [std, pick]) > LAYOUT_SPEC.patternMaxPerJob) {
    const alt = rot.find(
      (x) => x !== vBal[1] && count(x, [std, pick]) < LAYOUT_SPEC.patternMaxPerJob,
    );
    if (alt) vBal[0] = alt;
  }
  return { v_true: vTrue, v_fit: [std, pick], v_bal: vBal };
}

/**
 * 4.9.4 업종 태그(industryTags): BrandInput.description·keyPoints에 사전 keyword가 부분 문자열로 있으면 그 tags의 합집합
 * (결정론, 정렬·중복 제거. 명사 추출 대신 부분 문자열, ASM-120 ①).
 */
export function industryTags(
  brand: { description?: string; keyPoints?: readonly string[] } | null | undefined,
  dict: readonly { keyword: string; tags: readonly string[] }[],
): string[] {
  const text = [brand?.description ?? "", ...(brand?.keyPoints ?? [])].join("\n");
  if (!text.trim()) return [];
  return uniq(
    dict.filter((k) => k.keyword && text.includes(k.keyword)).flatMap((k) => [...k.tags]),
  ).sort();
}

/** 4.2.1 image_tags_allowed(T-34·U-12). industryTags = BrandInput 업종 키워드에서 얻은 구체 태그. */
export function imageTagsAllowed(
  purpose: Purpose,
  data: DesignData,
  industryTags: string[] = [],
): string[] {
  const row = purposeRow(purpose, data);
  const purposeTag = (t: string): boolean => t.startsWith(`${purpose}.`);
  const hit = uniq(industryTags.filter(purposeTag));
  if (hit.length > 0) return hit.sort();
  const textures = data.imageTags.filter((t) => t.startsWith("common.texture-"));
  return uniq([row.defaultImageTag, ...textures.sort()]);
}

/** 4.2.2 7단계: 03장 purposes.json ∩ 유형 허용(excludedVariants) ∩ 변형 규칙. */
export function layoutConstraints(
  preset: Preset,
  purpose: Purpose,
  variant: Variant,
  l2: L2,
  slots: [string, string],
  data: DesignData,
  industryTags: string[] = [],
): Constraints {
  const row = purposeRow(purpose, data);
  const ex = new Set(preset.excludedVariants);
  const hero = heroVariants(preset, purpose, variant, data);
  const optional = uniq([...row.requiredAny, ...row.optionalSections]).filter(
    (b) => !row.requiredSections.includes(b),
  );
  const present = new Set(["nav", "hero", "footer", ...row.requiredSections, ...optional]);
  const allowed: Record<string, string[]> = {};
  for (const b of blockRows(data)) {
    if (!present.has(b.id)) continue;
    allowed[b.id] =
      b.id === "hero"
        ? hero
        : b.variants
            .map((v) => v.id)
            .filter((id) => !ex.has(id))
            .filter((id) => !id.endsWith(".bento") || l2["layout.grid_mode"] === "bento");
  }
  return {
    section_count: { min: row.sectionCount[0], max: row.sectionCount[1] },
    required_blocks: [...row.requiredSections],
    optional_blocks: optional,
    forbidden_blocks: [...row.forbiddenSections],
    allowed_variants: allowed,
    hero_variants: hero,
    pattern_slots: slots,
    rhythm: { ...LAYOUT_SPEC.rhythm, inverse_sections: [...LAYOUT_SPEC.rhythm.inverse_sections] },
    image_tags_allowed: imageTagsAllowed(purpose, data, industryTags),
  };
}

const NUMBER_BLOCKS = new Set(["stats", "process"]);
/** 03장 3.2.4 요구 조건 입력. 섹션 수는 용도 하한(보수적, ASM-035 ③). */
export function sigCtx(theme: "light" | "dark", l2: L2, c: Constraints, data: DesignData): SigCtx {
  const pal = data.palettes.find((p) => p.id === l2["color.palette_id"]);
  const chroma = (pal as { chroma?: string } | undefined)?.chroma;
  const pairing = data.pairingsFull.find((p) => p.code === l2["type.pairing_id"]);
  const label = data.fonts.find((f) => f.id === pairing?.labelFontId);
  const vars = Object.values(c.allowed_variants).flat();
  const imageBlocks = new Set(
    blockRows(data)
      .filter((b) =>
        b.variants.some((v) => v.image != null && (c.allowed_variants[b.id] ?? []).includes(v.id)),
      )
      .map((b) => b.id),
  );
  return {
    theme,
    shapeBorder: l2["shape.border"] ?? "",
    gridMode: l2["layout.grid_mode"] ?? "",
    motionLevel: l2["motion.level"] ?? "",
    depthStyle: l2["depth.style"] ?? "",
    mediaTreatment: l2["media.treatment"] ?? "",
    chroma: chroma === "vivid" ? "vivid" : chroma === "muted" ? "muted" : "moderate",
    sectionCount: c.section_count.min,
    hasNumberSlot:
      Object.keys(c.allowed_variants).some((b) => NUMBER_BLOCKS.has(b)) ||
      vars.includes("value.numbered"),
    // SIG-12 적용 블록(03장 3.2.4: hero.split·story·about) 중 이미지 variant가 허용된 것이 있어야 한다.
    hasImageSlot:
      l2["media.mode"] !== "type-led" &&
      (c.hero_variants.includes("hero.split") ||
        imageBlocks.has("story") ||
        imageBlocks.has("about")),
    pairingHasMono: label?.classification === "mono",
    displayPx: displayPx(l2),
  };
}

/** 03장 3.2.4 적용 블록(순서 = 우선), 04장 4.14 최대 적용 수(null = 전체). "page" = 페이지 배경. */
export const SIG_APPLY: Record<
  string,
  { blocks: string[] | "sections" | "image"; max: number | null }
> = {
  "SIG-01": { blocks: ["value", "feature", "faq", "menu", "footer"], max: null },
  "SIG-02": { blocks: "sections", max: null },
  "SIG-03": { blocks: ["stats", "process", "value"], max: 2 },
  "SIG-04": { blocks: ["hero", "showcase"], max: 2 },
  "SIG-06": { blocks: ["cta", "hero"], max: 1 },
  "SIG-07": { blocks: ["page"], max: 1 },
  "SIG-08": { blocks: "sections", max: null },
  "SIG-09": { blocks: ["nav"], max: null },
  "SIG-10": { blocks: "image", max: null },
  "SIG-11": { blocks: ["hero", "footer"], max: 1 },
  "SIG-12": { blocks: ["hero", "story", "about"], max: 2 },
};

/** 4.14 규칙 4: intensity 2 = 최대 적용 수, 1 = 절반(올림). 후보 블록은 이 명세에서 쓸 수 있는 블록만. */
export function signatureApplyTo(
  id: string,
  intensity: 1 | 2,
  c: Constraints,
  data: DesignData,
): string[] {
  const rule = SIG_APPLY[id];
  if (!rule) return [];
  const order = ["hero", ...c.required_blocks.filter((b) => b !== "hero"), ...c.optional_blocks];
  const has = (b: string): boolean => b === "page" || b in c.allowed_variants;
  let cand: string[];
  if (rule.blocks === "sections") cand = order;
  else if (rule.blocks === "image") {
    const img = new Set(
      blockRows(data)
        .filter((b) =>
          b.variants.some(
            (v) => v.image != null && (c.allowed_variants[b.id] ?? []).includes(v.id),
          ),
        )
        .map((b) => b.id),
    );
    cand = order.filter((b) => img.has(b));
  } else {
    cand = rule.blocks.filter(has);
    if (id === "SIG-09") cand = [...cand, ...order];
    if (id === "SIG-12" && !c.hero_variants.includes("hero.split"))
      cand = cand.filter((b) => b !== "hero");
  }
  cand = uniq(cand);
  const max = Math.min(rule.max ?? cand.length, cand.length);
  const n = intensity === 2 ? max : Math.ceil(max / 2);
  return cand.slice(0, n);
}

/** 4.6.1 copyTone(첫 일치 규칙). A1 = expression, A2 = temperature, A4 = density(R-01). */
export const TONE_SPEC = {
  playful: { a1Min: 0.6, a2Min: 0.6 },
  editorial: { a4Max: 0.35, a1Max: 0.5 },
  warm: { a2Min: 0.55 },
  precise: { a2Below: 0.45, a1Below: 0.45 },
} as const;
const TONES = {
  "T-PLAYFUL": { ending: "haeyo", exclaim: 1, base: ["emotive", "benefit", "factual"] },
  "T-EDITORIAL": { ending: "plain", exclaim: 0, base: ["emotive", "factual", "benefit"] },
  "T-WARM": { ending: "haeyo", exclaim: 0, base: ["benefit", "emotive", "factual"] },
  "T-PRECISE": { ending: "hamnida", exclaim: 0, base: ["factual", "benefit", "emotive"] },
} as const;
type ToneId = keyof typeof TONES;
const PURPOSE_TONE: Record<Purpose, ToneId> = {
  saas: "T-PRECISE",
  local_business: "T-WARM",
  portfolio: "T-EDITORIAL",
};

export function copyTone(t: Vec5, purpose: Purpose, variant: Variant): Copy {
  const s = TONE_SPEC;
  let tone: ToneId;
  if (t.expression >= s.playful.a1Min && t.temperature >= s.playful.a2Min) tone = "T-PLAYFUL";
  else if (t.density <= s.editorial.a4Max && t.expression <= s.editorial.a1Max)
    tone = "T-EDITORIAL";
  else if (t.temperature >= s.warm.a2Min) tone = "T-WARM";
  else if (t.temperature < s.precise.a2Below && t.expression < s.precise.a1Below)
    tone = "T-PRECISE";
  else tone = PURPOSE_TONE[purpose];
  const row = TONES[tone];
  const base: string[] = [...row.base];
  const first = variant === "v_fit" ? "factual" : variant === "v_bal" ? "benefit" : null;
  const pref = first ? [first, ...base.filter((x) => x !== first)] : base;
  return {
    tone_id: tone,
    ending: row.ending,
    headline_option_preference: pref,
    exclaim_max_per_page: row.exclaim as 0 | 1,
  };
}

/** 4.2.2 10단계: effects = 시그니처 DecorId ∪ l2 파생(glass·brutal-offset), max = 변형·κ 표. */
export function decorFor(
  sigId: string,
  l2: L2,
  kappa: number,
  variant: Variant,
  data: DesignData,
): DesignSpec["decor"] {
  const sig = (data.signatures as JsonObj[]).find((x) => x.id === sigId);
  const fromSig = typeof sig?.decorId === "string" ? [sig.decorId] : [];
  const style = l2["depth.style"];
  const fromL2 = style === "glass" || style === "brutal-offset" ? [style] : [];
  const max: 1 | 2 = variant === "v_fit" || kappa < LAYOUT_SPEC.decorKappaMin ? 1 : 2;
  return { effects: uniq([...fromSig, ...fromL2]), max };
}
