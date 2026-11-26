// 04장 4.13 단계 T(확정 트리 + 블록 메타, 렌더 없음): G-01 스키마·LT-01~11(4.5.3)·RH-01~02(03장 3.6.7).
// 탐지 상수는 data/rule-params.json "T", 리듬 값은 spec.layout_constraints.rhythm(4.2.1). AIL-04·05·12·18(T)은 M3(ASM-073).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PageSchema } from "@tastefit/layout-schema";
import type { LintFinding } from "./stage-s.js";

type Obj = { [k: string]: unknown };
const isObj = (x: unknown): x is Obj => typeof x === "object" && x !== null && !Array.isArray(x);
const repoFile = (rel: string): string =>
  fileURLToPath(new URL(`../../../${rel}`, import.meta.url));
const pkgFile = (rel: string): string => fileURLToPath(new URL(`../${rel}`, import.meta.url));

interface VariantMeta {
  align: string;
  skeleton: string;
  image: unknown;
}
interface TParams {
  skeletonRunMax: number;
  imageRunMax: number;
  ctaMax: number;
  strictAltMinSections: number;
  darkInverse: [number, number];
}
let cache: { variants: Map<string, VariantMeta>; p: TParams } | null = null;
function load(): { variants: Map<string, VariantMeta>; p: TParams } {
  if (cache) return cache;
  const blocks = JSON.parse(readFileSync(repoFile("data/taxonomy/blocks.json"), "utf8")) as {
    items: { variants: ({ id: string } & VariantMeta)[] }[];
  };
  const variants = new Map<string, VariantMeta>();
  for (const b of blocks.items) for (const v of b.variants) variants.set(v.id, v);
  const rp = JSON.parse(readFileSync(pkgFile("data/rule-params.json"), "utf8")) as { items: Obj[] };
  const p = rp.items.find((i) => i.id === "T") as unknown as TParams;
  cache = { variants, p };
  return cache;
}

interface Sec {
  id: string;
  block: string;
  variant: string;
  bg: string;
  pad: number;
  slots: Obj;
}
interface Lc {
  section_count: { min: number; max: number };
  required_blocks: string[];
  forbidden_blocks: string[];
  allowed_variants: Record<string, string[]>;
  hero_variants: string[];
  rhythm: Obj;
  image_tags_allowed: string[];
}

/** 섹션의 덱 참조(CTA 라벨 = link.label 제외)와 이미지 태그를 모은다. */
function walkSlots(slots: Obj): { refs: string[]; tags: string[]; hasImage: boolean } {
  const refs: string[] = [];
  const tags: string[] = [];
  let hasImage = false;
  const text = (t: unknown): void => {
    if (isObj(t) && typeof t.deck_ref === "string") refs.push(t.deck_ref);
  };
  for (const v of Object.values(slots)) {
    if (!isObj(v)) continue;
    if ("copy" in v) text(v.copy);
    // 목록 슬롯 안의 같은 참조는 1회(menu.groups 그룹 1개를 항목 여러 개로 펼친 것, ASM-053 ④)
    if (Array.isArray(v.list)) {
      const before = refs.length;
      for (const it of v.list) if (isObj(it)) text(it.copy);
      const uniq = [...new Set(refs.splice(before))];
      refs.push(...uniq);
    }
    if (isObj(v.image)) {
      hasImage = true;
      if (typeof v.image.tag === "string") tags.push(v.image.tag);
    }
  }
  return { refs, tags, hasImage };
}

/** 같은 값이 연속되는 최대 길이. */
function maxRun<T>(xs: T[]): { len: number; at: number } {
  let best = { len: 0, at: -1 };
  let len = 0;
  for (let i = 0; i < xs.length; i++) {
    len = i > 0 && xs[i] === xs[i - 1] ? len + 1 : 1;
    if (len > best.len) best = { len, at: i - len + 1 };
  }
  return best;
}

export function treeLintImpl(spec: unknown, tree: unknown): LintFinding[] {
  const out: LintFinding[] = [];
  const add = (rule: string, severity: "error" | "warn", message: string): void => {
    out.push({ rule, severity, message });
  };
  const parsed = PageSchema.safeParse(tree);
  if (!parsed.success) {
    const i = parsed.error.issues[0];
    add("G-01", "error", `스키마 위반: ${i ? `${i.path.join(".")} ${i.message}` : ""}`);
    return out;
  }
  const lc = (
    isObj(spec) && isObj(spec.layout_constraints) ? spec.layout_constraints : null
  ) as Lc | null;
  if (!lc) {
    add("G-01", "error", "spec.layout_constraints 없음");
    return out;
  }
  const theme = isObj(spec) && spec.theme === "dark" ? "dark" : "light";
  const { variants, p } = load();
  const secs = parsed.data.sections as unknown as Sec[];
  const blocks = secs.map((s) => s.block);

  // LT-01 required_blocks
  for (const b of lc.required_blocks)
    if (!blocks.includes(b)) add("LT-01", "error", `필수 블록 ${b} 없음`);
  // LT-02 forbidden_blocks·allowed_variants
  for (const s of secs) {
    if (lc.forbidden_blocks.includes(s.block))
      add("LT-02", "error", `${s.id}: 금지 블록 ${s.block}`);
    else if (!(lc.allowed_variants[s.block] ?? []).includes(s.variant))
      add("LT-02", "error", `${s.id}: 허용 밖 variant ${s.variant}`);
  }
  // LT-03 섹션 수(nav·footer 제외)
  const n = secs.length;
  if (n < lc.section_count.min || n > lc.section_count.max)
    add("LT-03", "error", `섹션 ${n}개 ∉ [${lc.section_count.min}, ${lc.section_count.max}]`);
  // LT-04 첫 섹션 hero, variant ∈ hero_variants
  const first = secs[0];
  if (!first || first.block !== "hero") add("LT-04", "error", "첫 섹션이 hero가 아님");
  else if (!lc.hero_variants.includes(first.variant))
    add("LT-04", "error", `hero variant ${first.variant} ∉ spec.hero_variants`);
  // LT-05 인접 같은 variant(AIL-07 a, error)
  for (let i = 1; i < n; i++)
    if (secs[i]?.variant === secs[i - 1]?.variant)
      add(
        "LT-05",
        "error",
        `${secs[i - 1]?.id}·${secs[i]?.id}: 인접 같은 variant ${secs[i]?.variant}`,
      );
  // LT-06 bg 리듬(AIL-07 c·d, warn)
  const bgs = secs.map((s) => s.bg);
  const sameMax = typeof lc.rhythm.max_same_bg_run === "number" ? lc.rhythm.max_same_bg_run : 2;
  const run = maxRun(bgs);
  if (run.len > sameMax)
    add("LT-06", "warn", `bg ${bgs[run.at]} ${run.len}연속(섹션 ${run.at + 1}~)`);
  const strict =
    n >= p.strictAltMinSections &&
    bgs.every((b) => b === "bg" || b === "surface") &&
    bgs.every((b, i) => i === 0 || b !== bgs[i - 1]);
  if (strict && lc.rhythm.forbid_strict_alternation !== false)
    add("LT-06", "warn", `${n}섹션 bg/surface 엄격 교대`);
  const inv = bgs.filter((b) => b === "inverse").length;
  const invRange: [number, number] =
    theme === "dark"
      ? p.darkInverse
      : Array.isArray(lc.rhythm.inverse_sections)
        ? (lc.rhythm.inverse_sections as [number, number])
        : [1, 2];
  if (inv < invRange[0] || inv > invRange[1])
    add("LT-06", "warn", `inverse ${inv}개 ∉ [${invRange[0]}, ${invRange[1]}](${theme})`);
  // LT-07 pad ≠ 0 섹션 ≥ pad_variation_min
  const padMin = typeof lc.rhythm.pad_variation_min === "number" ? lc.rhythm.pad_variation_min : 1;
  if (secs.filter((s) => s.pad !== 0).length < padMin) add("LT-07", "warn", "pad ≠ 0 섹션 없음");
  // LT-08 중앙 정렬 비율
  const cMax =
    typeof lc.rhythm.max_centered_ratio === "number" ? lc.rhythm.max_centered_ratio : 0.4;
  const centered = secs.filter((s) => variants.get(s.variant)?.align === "center").length;
  if (n > 0 && centered / n > cMax + 1e-9)
    add("LT-08", "warn", `중앙 정렬 ${centered}/${n} > ${cMax}`);
  // LT-09 덱 참조 중복·LT-10 이미지 태그
  const seen = new Map<string, string>();
  const imgFlags: boolean[] = [];
  for (const s of secs) {
    const w = walkSlots(s.slots);
    for (const r of w.refs) {
      const prev = seen.get(r);
      if (prev !== undefined) add("LT-09", "error", `${s.id}: 덱 참조 ${r} 중복(${prev})`);
      else seen.set(r, s.id);
    }
    for (const t of w.tags)
      if (!lc.image_tags_allowed.includes(t))
        add("LT-10", "error", `${s.id}: 이미지 태그 ${t} 허용 밖`);
    imgFlags.push(w.hasImage || s.bg === "image");
  }
  // LT-11 CTA 블록 수
  const ctas = blocks.filter((b) => b === "cta").length;
  if (ctas > p.ctaMax) add("LT-11", "warn", `CTA 블록 ${ctas}개 > ${p.ctaMax}`);
  // RH-01 같은 skeleton 연속
  const sk = maxRun(secs.map((s) => variants.get(s.variant)?.skeleton ?? s.variant));
  if (sk.len > p.skeletonRunMax) add("RH-01", "warn", `skeleton ${sk.len}연속(섹션 ${sk.at + 1}~)`);
  // RH-02 이미지 유무 연속
  const im = maxRun(imgFlags);
  if (im.len > p.imageRunMax)
    add(
      "RH-02",
      "warn",
      `${imgFlags[im.at] ? "이미지" : "무이미지"} 섹션 ${im.len}연속(섹션 ${im.at + 1}~)`,
    );
  return out;
}
