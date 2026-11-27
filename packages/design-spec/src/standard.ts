// 03장 standardTree·04장 4.12 buildFallback(ASM-053): 앵커 명세 + 용도 표준 패턴 + 템플릿 카피 → 확정 트리.
// LLM 0회. 덱 참조(deck:key#i) 해석, 이미지 결정(4.9.4 단순화), nav·footer 생성은 컴파일 전 확정 단계다.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { DesignData, JsonObj } from "./data.js";
import { PATTERNS } from "./layout.js";

export type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
export interface PText {
  text: string;
  sub?: string;
  placeholder: boolean;
  deck_ref: string;
}
type PSlot =
  | { copy: PText }
  | { list: { copy: PText }[] }
  | {
      image: { tag: string; ratio: string; asset_id: string; alt: string; focal: [number, number] };
    }
  | { link: { label: PText; target: string } };
export interface PSection {
  id: string;
  block: string;
  variant: string;
  bg: "bg" | "surface" | "inverse" | "image";
  pad: -1 | 0 | 1;
  slots: Record<string, PSlot>;
  role_overrides?: Record<string, string>;
}
export interface PageTree {
  schemaVersion: "1";
  spec_id: string;
  pattern_id: string;
  nav: { variant: string; items: { label: string; target: string }[] };
  sections: PSection[];
  footer: { variant: string; slots: Record<string, PSlot> };
}

// --- 원시 트리(LLM 출력 형식, 04장 4.5.2) ---
export type RawSlot =
  | { copy: string }
  | { list: { copy: string }[] }
  | { image: { tag: string; ratio: string } }
  | { link: { label: string; target: string } };
export interface RawSection {
  id: string;
  block: string;
  variant: string;
  bg: PSection["bg"];
  pad: PSection["pad"];
  slots: Record<string, RawSlot>;
}
export interface RawTree {
  schemaVersion: "1";
  spec_id: string;
  pattern_id: string;
  sections: RawSection[];
  footer: { variant: string };
}

export type Deck = Record<string, Json[]>;
export interface Brand {
  name: string;
  description: string;
  key_points: string[];
}
export const DEFAULT_BRAND: Brand = {
  name: "한결",
  description: "[예시] 브랜드 소개 문장을 여기에 넣어 주세요. 실제 문구로 바꿔 주세요.",
  key_points: [],
};

/** 04장 CP-10·08장 8.7.5 예시값(항상 placeholder). */
export const CONTACT_EXAMPLE: Readonly<Record<string, string>> = {
  phone: "02-000-0000",
  email: "hello@example.com",
  address: "서울시 ○○구 ○○로 00",
  bizNo: "000-00-00000",
  hours: "[예시] 매일 00:00–00:00",
};
/** contact.* 덱 키(컴파일러 고정, LLM 미생성 4.6.2). 제목·안내 문구는 임시(ASM-053). */
const CONTACT_DECK: Readonly<Record<string, string>> = {
  "contact.address": CONTACT_EXAMPLE.address ?? "",
  "contact.hours": CONTACT_EXAMPLE.hours ?? "",
  "contact.phone": CONTACT_EXAMPLE.phone ?? "",
  "contact.email": CONTACT_EXAMPLE.email ?? "",
  "contact.title": "문의하기",
  "contact.body": "[예시] 궁금한 점을 남겨 주시면 답장드릴게요.",
  "contact.form": "[예시] 보내 주신 정보는 답장에만 씁니다.",
};

const sub = (s: string, b: Brand): string =>
  s
    .replace(/\{name\}/g, b.name)
    .replace(/\{description\}/g, b.description)
    .replace(
      /\{key_points\.(\d)\}/g,
      (_, i: string) => b.key_points[Number(i)] ?? "[예시] 핵심 장점",
    );
function subJson(v: Json, b: Brand): Json {
  if (typeof v === "string") return sub(v, b);
  if (Array.isArray(v)) return v.map((x) => subJson(x, b));
  if (v && typeof v === "object")
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, subJson(x, b)]));
  return v;
}

interface TemplateItem {
  purpose: string;
  key: string;
  values: Json[];
}
let TEMPLATE_CACHE: { root: string; items: TemplateItem[] } | null = null;
function templates(root: string): TemplateItem[] {
  if (TEMPLATE_CACHE?.root === root) return TEMPLATE_CACHE.items;
  const items = (
    JSON.parse(readFileSync(join(root, "config/copy_templates.json"), "utf8")) as {
      items: TemplateItem[];
    }
  ).items;
  TEMPLATE_CACHE = { root, items };
  return items;
}

/** 4.12 템플릿 카피 덱: config/copy_templates.json(용도별) + 브랜드 치환. */
export function templateDeck(purpose: string, root: string, brand: Brand = DEFAULT_BRAND): Deck {
  const out: Deck = {};
  for (const t of templates(root))
    if (t.purpose === purpose) out[t.key] = subJson(t.values, brand) as Json[];
  return out;
}

const PH = /\[(예시|임시)\]/;
const str = (v: Json | undefined): string => (typeof v === "string" ? v : "");
/** 덱 값 → 텍스트(+보조). 객체 모양별 필드 대응(ASM-046·053). */
function textOf(v: Json | undefined): { text: string; sub?: string; ph?: boolean } {
  if (typeof v === "string") return { text: v };
  if (v && typeof v === "object" && !Array.isArray(v)) {
    const o = v as Record<string, Json>;
    const ph = o.placeholder === true;
    if ("quote" in o) return { text: str(o.quote), sub: str(o.name), ph };
    if ("name" in o && "desc" in o) return { text: str(o.name), sub: str(o.desc), ph };
    if ("title" in o && "body" in o) return { text: str(o.title), sub: str(o.body), ph };
    if ("value" in o && "label" in o) return { text: str(o.value), sub: str(o.label), ph };
    if ("text" in o) return { text: str(o.text), ph };
    if ("title" in o) return { text: str(o.title), ph };
  }
  return { text: "" };
}

/** deck:key#i → PText. contact.*는 예시값(CP-10, placeholder). */
export function resolveRef(ref: string, deck: Deck): PText {
  const m = /^deck:([a-z_.]+)#(\d)$/.exec(ref);
  const key = m?.[1] ?? "";
  const i = Number(m?.[2] ?? 0);
  if (key in CONTACT_DECK) {
    const text = CONTACT_DECK[key] ?? "";
    const isExample = !key.endsWith(".title");
    return { text, placeholder: isExample, deck_ref: ref };
  }
  const vals = deck[key] ?? [];
  const t = textOf(vals[i] ?? vals[0]);
  const text = t.text || "[예시] 문구";
  return {
    text,
    ...(t.sub ? { sub: t.sub } : {}),
    placeholder: t.ph === true || PH.test(text) || PH.test(t.sub ?? ""),
    deck_ref: ref,
  };
}

/** menu.groups#i 하나 → 항목 목록(그룹 안 items를 펼친다, ASM-046 ③). */
function menuItems(ref: string, deck: Deck): PText[] {
  const m = /^deck:menu\.groups#(\d)$/.exec(ref);
  const g = (deck["menu.groups"] ?? [])[Number(m?.[1] ?? 0)] as Record<string, Json> | undefined;
  const items = (g?.items as Json[] | undefined) ?? [];
  return items.map((it) => {
    const t = textOf(it);
    return {
      text: t.text,
      ...(t.sub ? { sub: t.sub } : {}),
      placeholder: true,
      deck_ref: ref,
    };
  });
}

/** 사진 없이 색면 구성(3.10.5)으로 그릴 슬롯의 asset_id. */
export const SHAPE_ASSET = "shape-graphic";

function seedIndex(seed: string, n: number): number {
  return parseInt(createHash("sha256").update(seed).digest("hex").slice(0, 8), 16) % n;
}

export interface ResolveOpts {
  /** 3.8.1 줄 예산 판정용(없으면 건너뜀). */
  budget?: {
    tokens: Record<string, unknown>;
    sizeOf: (tokens: Record<string, unknown>, step: string, vw: number) => number;
  };
  deck: Deck;
  brand: Brand;
  seed: string;
  navVariant?: string;
  mediaMode?: string;
}

/** 4.5.2 원시 트리 → 확정 트리(PageSchema). 이미지: 같은 태그·미사용 후보 중 seed 선택(4.9.4, 톤 규칙은 M5). */
/** 3.1.5a 헤드라인 역할의 기본 단계(조건부 variant 포함). */
function headlineStep(variant: string): string | null {
  if (variant === "hero.type-only" || variant === "hero.full-bleed-image") return "t-display";
  if (variant.startsWith("hero.")) return "t-1";
  if (variant === "cta.big-type") return "t-display";
  if (variant.startsWith("cta.")) return "t-2";
  return null;
}
function applyHeadlineBudget(
  sec: PSection,
  raw: RawSection,
  data: DesignData,
  o: ResolveOpts,
  taken: Set<string>,
): void {
  const b = o.budget;
  const step = headlineStep(sec.variant);
  const slot = raw.slots.headline;
  if (!b || !step || !slot || !("copy" in slot)) return;
  const m = /^deck:([a-z_.]+)#(\d)$/.exec(slot.copy);
  if (!m) return;
  const key = m[1] ?? "";
  const options = (o.deck[key] ?? []).map((_, i) => resolveRef(`deck:${key}#${i}`, o.deck).text);
  if (options.length === 0) return;
  const blk = data.blocks.find((x) => x.id === sec.block) as unknown as
    { variants: { id: string; text_cols?: { lg: number; base: number } }[] } | undefined;
  const cols = blk?.variants.find((v) => v.id === sec.variant)?.text_cols ?? { lg: 12, base: 4 };
  const lay = (b.tokens.layout as Record<string, { $value?: { value?: number } }> | undefined)
    ?.container;
  const containerPx = lay?.$value?.value ?? HEADLINE_SPEC.contentMax;
  // LT-09: 다른 슬롯이 이미 쓰는 옵션(cta.headline = hero.headline#1 등)으로는 바꾸지 않는다(4.10 "LT-09 유지")
  const exclude = new Set(
    options
      .map((_, i) => i)
      .filter((i) => i !== Number(m[2] ?? 0) && taken.has(`deck:${key}#${i}`)),
  );
  const r = fitHeadline(
    options,
    Number(m[2] ?? 0),
    step,
    b.tokens,
    cols,
    containerPx,
    b.sizeOf,
    exclude,
  );
  taken.delete(slot.copy);
  taken.add(`deck:${key}#${r.index}`);
  sec.slots.headline = { copy: resolveRef(`deck:${key}#${r.index}`, o.deck) };
  if (r.step) sec.role_overrides = { ...(sec.role_overrides ?? {}), headline: r.step };
}

export function resolveTree(raw: RawTree, data: DesignData, o: ResolveOpts): PageTree {
  const used = new Set<string>();
  const taken = new Set<string>();
  for (const s of raw.sections)
    for (const v of Object.values(s.slots)) if ("copy" in v) taken.add(v.copy);
  const blocks = new Map(data.blocks.map((b) => [b.id as string, b]));
  const pickImage = (sec: string, slot: string, tag: string, ratio: string): PSlot => {
    const cands = data.images
      .filter((m) => m.tags.includes(tag) && !used.has(m.id))
      .sort((a, b) => (a.id < b.id ? -1 : 1));
    if (cands.length === 0 || o.mediaMode === "shape-graphic")
      return { image: { tag, ratio, asset_id: SHAPE_ASSET, alt: "", focal: [0.5, 0.5] } };
    const m = cands[seedIndex(`${o.seed}|${sec}|${slot}`, cands.length)]!;
    used.add(m.id);
    return { image: { tag, ratio, asset_id: m.id, alt: m.altKo, focal: m.focalPoint } };
  };
  const sections: PSection[] = raw.sections.map((s) => {
    const slots: Record<string, PSlot> = {};
    for (const [k, v] of Object.entries(s.slots)) {
      if ("copy" in v) slots[k] = { copy: resolveRef(v.copy, o.deck) };
      else if ("link" in v)
        slots[k] = { link: { label: resolveRef(v.link.label, o.deck), target: v.link.target } };
      else if ("image" in v) slots[k] = pickImage(s.id, k, v.image.tag, v.image.ratio);
      else if ("list" in v) {
        const items =
          s.block === "menu"
            ? v.list.flatMap((x) => menuItems(x.copy, o.deck))
            : v.list.map((x) => resolveRef(x.copy, o.deck));
        slots[k] = { list: items.map((copy) => ({ copy })) };
      }
    }
    const sec: PSection = {
      id: s.id,
      block: s.block,
      variant: s.variant,
      bg: s.bg,
      pad: s.pad,
      slots,
    };
    if (o.budget) applyHeadlineBudget(sec, s, data, o, taken);
    return sec;
  });
  const navItems = raw.sections
    .map((s) => ({ label: String(blocks.get(s.block)?.nav_label ?? ""), target: `#${s.id}` }))
    .filter((x) => x.label !== "")
    .slice(0, 5);
  const T = (text: string, ref: string, placeholder = false): PText => ({
    text,
    placeholder,
    deck_ref: ref,
  });
  const tagline = resolveRef("deck:footer.tagline#0", o.deck);
  return {
    schemaVersion: "1",
    spec_id: raw.spec_id,
    pattern_id: raw.pattern_id,
    nav: { variant: o.navVariant ?? "nav.split", items: navItems },
    sections,
    footer: {
      variant: raw.footer.variant,
      slots: {
        wordmark: { copy: T(o.brand.name, "deck:meta.title#0") },
        tagline: { copy: tagline },
        businessInfo: {
          copy: T(
            `상호 ${o.brand.name} · 사업자등록번호 ${CONTACT_EXAMPLE.bizNo ?? ""} · ${CONTACT_EXAMPLE.address ?? ""}`,
            "deck:contact.biz#0",
            true,
          ),
        },
      },
    },
  };
}

export type { JsonObj };

// --- 표준 패턴 원시 트리(4.8 패턴 카탈로그) ---
export const STANDARD_PATTERN: Readonly<Record<string, string>> = {
  saas: "PS-1",
  local_business: "PL-1",
  portfolio: "PP-1",
};

/** contact.* 슬롯 → 덱 키(CP-10). */
const CONTACT_SLOT_KEY: Readonly<Record<string, string>> = {
  address: "contact.address",
  hours: "contact.hours",
  phone: "contact.phone",
  title: "contact.title",
  body: "contact.body",
  contactInfo: "contact.email",
  form: "contact.form",
};
/** 목록 슬롯 항목 수(3.6.3 목록 범위 안, variant별). */
function listCount(variant: string, available: number): number {
  const fixed: Record<string, number> = {
    "value.icon-grid": 3,
    "value.bento": 4,
    "feature.zigzag": 3,
    "proof.quote-large": 1,
    "proof.cards": 2,
    "highlight.trio": 3,
    "highlight.text-trio": 3,
    "highlight.split": 3,
    "service.list": 3,
    "service.cards": 3,
    "faq.accordion": 4,
    "faq.two-col": 4,
    "menu.leader": 1,
    "menu.cards": 1,
    "menu.columns": 1,
    "gallery.grid": 6,
    "gallery.masonry": 6,
    "gallery.feature": 5,
    "stats.row": 3,
    "stats.split": 3,
  };
  return Math.max(1, Math.min(fixed[variant] ?? 3, available));
}

interface VariantMeta {
  id: string;
  skeleton?: string;
  image: { ratios: string[] } | null;
  allowed_bg: string[];
}
interface BlockMeta {
  id: string;
  slots: { id: string; kind: string; deckKeys?: string[] }[];
  variants: VariantMeta[];
}

export interface SpecForTree {
  spec_id: string;
  purpose: string;
  l2: Record<string, unknown>;
  layout_constraints: {
    allowed_variants: Record<string, string[]>;
    hero_variants: string[];
    image_tags_allowed: string[];
    /** LT-03 하한 채우기용(없으면 채우지 않음, ASM-073). */
    section_count?: { min: number; max: number };
    optional_blocks?: string[];
    forbidden_blocks?: string[];
  };
}

/**
 * 패턴 힌트(hero + 4)가 LT-03 하한보다 짧으면 용도 선택 블록(명세 순서) 중 아직 없고 허용된 것을
 * 마지막 섹션 앞에 넣어 하한까지 채운다(4.8 "섹션 순서 힌트" + 4.5.3 LT-03, ASM-073).
 */
export function fillSectionMin(order: string[], lc: SpecForTree["layout_constraints"]): string[] {
  const min = lc.section_count?.min ?? 0;
  const out = [...order];
  for (const b of lc.optional_blocks ?? []) {
    if (out.length >= min) break;
    if (out.includes(b) || (lc.forbidden_blocks ?? []).includes(b) || !(b in lc.allowed_variants))
      continue;
    out.splice(Math.max(1, out.length - 1), 0, b);
  }
  return out;
}

/** 패턴 + 명세 → 원시 트리(결정론). media.mode = type-led면 이미지 없는 variant를 먼저 고른다. */
export function patternRaw(
  spec: SpecForTree,
  patternId: string,
  deck: Deck,
  data: DesignData,
  pick: Record<string, string> = {},
  opts: { order?: string[]; lastInverse?: boolean } = {},
): RawTree {
  const pat = Object.values(PATTERNS)
    .flat()
    .find((p) => p.id === patternId);
  if (!pat) throw new Error(`패턴 없음 ${patternId}`);
  const blocks = new Map(data.blocks.map((b) => [b.id as string, b as unknown as BlockMeta]));
  const lc = spec.layout_constraints;
  const typeLed = spec.l2["media.mode"] === "type-led";
  const tag =
    lc.image_tags_allowed.find((t) => t.startsWith(`${spec.purpose}.`)) ??
    lc.image_tags_allowed[0] ??
    "common.texture-paper";
  /** 블록별 variant 후보(선호 순). pick·hero는 1개로 고정. */
  const candidates = (block: string): VariantMeta[] => {
    const meta = blocks.get(block);
    if (!meta) throw new Error(`블록 없음 ${block}`);
    const allowed = lc.allowed_variants[block] ?? meta.variants.map((v) => v.id);
    if (pick[block]) {
      const v = meta.variants.find((x) => x.id === pick[block]);
      if (v) return [v];
    }
    if (block === "hero") {
      const hint = `hero.${pat.hero}`;
      const id = lc.hero_variants.includes(hint) ? hint : (lc.hero_variants[0] ?? hint);
      return [meta.variants.find((v) => v.id === id) ?? meta.variants[0]!];
    }
    const vs = allowed
      .map((id) => meta.variants.find((v) => v.id === id))
      .filter((v): v is VariantMeta => !!v);
    const ranked = typeLed ? [...vs.filter((v) => !v.image), ...vs.filter((v) => v.image)] : vs;
    return ranked.length > 0 ? ranked : [meta.variants[0]!];
  };
  /**
   * 선호 순 깊이 우선 탐색으로 RH-01(같은 skeleton 3연속)·LT-05(인접 같은 variant)를 피하는 첫 조합.
   * 없으면 각 블록 첫 후보(ASM-073). 후보 ≤ 3 × 섹션 ≤ 8이라 비용은 작다.
   */
  const assignVariants = (blocksInOrder: string[]): VariantMeta[] => {
    const cands = blocksInOrder.map(candidates);
    const ok = (seq: VariantMeta[], v: VariantMeta): boolean => {
      const [a, b] = [seq.at(-2), seq.at(-1)];
      if (b && b.id === v.id) return false;
      return !(a && b && v.skeleton && a.skeleton === v.skeleton && b.skeleton === v.skeleton);
    };
    const dfs = (seq: VariantMeta[]): VariantMeta[] | null => {
      if (seq.length === cands.length) return seq;
      for (const v of cands[seq.length] ?? []) {
        if (!ok(seq, v)) continue;
        const r = dfs([...seq, v]);
        if (r) return r;
      }
      return null;
    };
    return dfs([]) ?? cands.map((c) => c[0]!);
  };
  const order = opts.order ?? fillSectionMin(["hero", ...pat.order], lc);
  const chosen = assignVariants(order);
  /** LT-09: 같은 덱 키를 두 블록이 쓰면(feature·process = feature.items) 뒤 블록은 이어지는 index부터. */
  const listUsed = new Map<string, number>();
  const ids = order.map((b) => b);
  const ctaTarget = ids.includes("cta")
    ? "#cta"
    : ids.includes("contact")
      ? "#contact"
      : `#${ids[1] ?? "hero"}`;
  const BG_CYCLE: PSection["bg"][] = ["surface", "bg", "bg", "surface"];
  const sections: RawSection[] = order.map((block, i) => {
    const meta = blocks.get(block)!;
    const v = chosen[i]!;
    const slots: Record<string, RawSlot> = {};
    for (const sd of meta.slots) {
      const key0 = (sd.deckKeys ?? [])[0]?.replace(/\[\d\]$/, "") ?? "";
      if (sd.kind === "image") {
        if (!v.image) continue;
        const ratio = v.image.ratios[0] ?? "1:1";
        slots[sd.id] = { image: { tag, ratio } };
      } else if (sd.kind === "copy") {
        const key = block === "location" || block === "contact" ? CONTACT_SLOT_KEY[sd.id] : key0;
        if (!key) continue;
        // LT-09: 같은 키를 앞 슬롯이 썼으면 다음 index(showcase work.items#0 → gallery #1~)
        const used = listUsed.get(key) ?? 0;
        const idx = block === "cta" && key === "hero.headline" ? Math.max(1, used) : used;
        listUsed.set(key, idx + 1);
        slots[sd.id] = { copy: `deck:${key}#${idx}` };
      } else if (sd.kind === "link") {
        if (sd.id === "secondaryCta") continue;
        slots[sd.id] = { link: { label: `deck:${key0 || "cta.primary"}#0`, target: ctaTarget } };
      } else if (sd.kind === "list") {
        const avail = (deck[key0] ?? []).length;
        if (avail === 0) continue;
        const used = listUsed.get(key0) ?? 0;
        const off = avail - used > 0 ? used : 0;
        const n = listCount(v.id, avail - off);
        listUsed.set(key0, off + n);
        slots[sd.id] = {
          list: Array.from({ length: n }, (_, k) => ({ copy: `deck:${key0}#${off + k}` })),
        };
      }
    }
    let bg: PSection["bg"] =
      block === "hero"
        ? v.id === "hero.full-bleed-image"
          ? "image"
          : "bg"
        : i === 0
          ? "bg"
          : (BG_CYCLE[(i - 1) % 4] ?? "bg");
    if (i === order.length - 1 && block !== "hero" && opts.lastInverse !== false) bg = "inverse";
    if (!v.allowed_bg.includes(bg)) bg = (v.allowed_bg[0] as PSection["bg"] | undefined) ?? "bg";
    return { id: block, block, variant: v.id, bg, pad: block === "hero" ? 1 : 0, slots };
  });
  const footer = pick.footer ?? lc.allowed_variants.footer?.[0] ?? "footer.minimal";
  return {
    schemaVersion: "1",
    spec_id: spec.spec_id,
    pattern_id: patternId,
    sections,
    footer: { variant: footer },
  };
}

// --- 3.8.1 헤드라인 줄 예산(S-39·T-30·U-11): 덱 옵션 교체 → 단계 1단 하향(role_overrides) → warn. ASM-064 ---
/** 3.8.1 계수: 한글 평균 글자 폭 0.95, keep-all 손실 0.85, 콘텐츠 폭 상한 1200, 375 텍스트 폭 343, 거터 보정 24. */
export const HEADLINE_SPEC = {
  glyphW: 0.95,
  keepAll: 0.85,
  contentMax: 1200,
  mobileText: 343,
  gutter: 24,
  orphanMax: 2,
  desktopVw: 1280,
} as const;
const LOWER: Readonly<Record<string, string>> = { "t-display": "t-1", "t-1": "t-2" };
/** 3.8.1 줄 예산 데스크톱 2줄·375 3줄. */
export const HEADLINE_LINES: Readonly<Record<number, number>> = { 1280: 2, 375: 3 };

export function textWidthPx(
  vw: number,
  cols: { lg: number; base: number },
  containerPx: number,
): number {
  return vw >= HEADLINE_SPEC.desktopVw
    ? Math.floor(
        (Math.min(containerPx, HEADLINE_SPEC.contentMax) * cols.lg) / 12 - HEADLINE_SPEC.gutter,
      )
    : Math.floor((HEADLINE_SPEC.mobileText * cols.base) / 4);
}

/** 3.8.1 headlineBudget: maxChars와 한 줄 글자 수(perLine). */
export function headlineBudget(
  sizePx: number,
  vw: number,
  cols: { lg: number; base: number },
  containerPx: number,
): { maxChars: number; perLine: number } {
  const perLine = Math.max(
    1,
    Math.floor(textWidthPx(vw, cols, containerPx) / (sizePx * HEADLINE_SPEC.glyphW)),
  );
  return {
    maxChars: Math.floor(perLine * (HEADLINE_LINES[vw] ?? 2) * HEADLINE_SPEC.keepAll),
    perLine,
  };
}

/** 토큰 계산 판정: 예산 안이고 마지막 줄(글자 수 근사)이 1~2자가 아니다(1줄 2자 이하도 고아로 본다). */
export function headlineFits(
  text: string,
  step: string,
  tokens: Record<string, unknown>,
  cols: { lg: number; base: number },
  containerPx: number,
  sizeOf: (tokens: Record<string, unknown>, step: string, vw: number) => number,
): boolean {
  const n = [...text.replace(/\s+/g, "")].length;
  for (const vw of [1280, 375]) {
    const { maxChars, perLine } = headlineBudget(sizeOf(tokens, step, vw), vw, cols, containerPx);
    if (n > maxChars) return false;
    const last = n - Math.floor((n - 1) / perLine) * perLine;
    if (last <= HEADLINE_SPEC.orphanMax) return false;
  }
  return true;
}

/**
 * 헤드라인 슬롯 확정: ① 같은 덱 키의 다른 옵션 중 처음 맞는 것 → ② 단계 1단 하향 후 다시 → ③ 원래 옵션 유지(warn).
 * 반환: 쓸 옵션 index와 하향 단계(없으면 null).
 */
export function fitHeadline(
  options: string[],
  startIdx: number,
  baseStep: string,
  tokens: Record<string, unknown>,
  cols: { lg: number; base: number },
  containerPx: number,
  sizeOf: (tokens: Record<string, unknown>, step: string, vw: number) => number,
  exclude: ReadonlySet<number> = new Set(),
): { index: number; step: string | null; warn: boolean } {
  const order = [
    startIdx,
    ...options.map((_, i) => i).filter((i) => i !== startIdx && !exclude.has(i)),
  ];
  for (const step of [baseStep, LOWER[baseStep]].filter((s): s is string => !!s)) {
    for (const i of order)
      if (headlineFits(options[i] ?? "", step, tokens, cols, containerPx, sizeOf))
        return { index: i, step: step === baseStep ? null : step, warn: false };
  }
  return { index: startIdx, step: null, warn: true };
}

/**
 * 4.6.2 maxChars_job(S-39·T-30·U-11): 변형 3 × 각 변형 layout_constraints.hero_variants × {1280, 375}의
 * headlineBudget.maxChars 최솟값(정수). t-display hero는 넘침 처리 ②를 적용한 t-1 크기로 계산한다.
 * S1(명세 3개) 확정 뒤 S2(덱 호출) 전에 계산하므로 잡마다 결정론적으로 1개 값이다.
 */
export function maxCharsJobImpl(
  specs: Readonly<
    Record<
      string,
      { tokens: Record<string, unknown>; layout_constraints: { hero_variants: string[] } }
    >
  >,
  data: DesignData,
  sizeOf: (tokens: Record<string, unknown>, step: string, vw: number) => number,
): number {
  const hero = data.blocks.find((x) => x.id === "hero") as unknown as
    { variants: { id: string; text_cols?: { lg: number; base: number } }[] } | undefined;
  let min = Number.POSITIVE_INFINITY;
  for (const v of Object.keys(specs).sort()) {
    const spec = specs[v];
    if (!spec) continue;
    const lay = (spec.tokens.layout as Record<string, { $value?: { value?: number } }> | undefined)
      ?.container;
    const containerPx = lay?.$value?.value ?? HEADLINE_SPEC.contentMax;
    for (const hv of spec.layout_constraints.hero_variants) {
      const base = headlineStep(hv);
      if (!base) continue;
      const step = base === "t-display" ? (LOWER[base] ?? base) : base;
      const cols = hero?.variants.find((x) => x.id === hv)?.text_cols ?? { lg: 12, base: 4 };
      for (const vw of Object.keys(HEADLINE_LINES).map(Number))
        min = Math.min(
          min,
          headlineBudget(sizeOf(spec.tokens, step, vw), vw, cols, containerPx).maxChars,
        );
    }
  }
  return Number.isFinite(min) ? Math.floor(min) : 0;
}
