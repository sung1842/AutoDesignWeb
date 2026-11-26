// 04장 4.5.2 LayoutTreeRaw·4.6.2 덱 상한(ASM-024 ⑥, ASM-025 ⑤). enum 원천은 03장 blocks.json·purposes.json·이미지 manifest(ASM-039).
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

type Obj = { [k: string]: unknown };
/** 저장소 루트(pnpm-workspace.yaml)를 cwd부터 위로 찾는다. 번들러(Next Turbopack)는 import.meta.url 상대 경로를
 * 원본 위치로 보존하지 않으므로 cwd 기준이 먼저고, 못 찾으면 모듈 위치 기준(패키지 단독 실행). */
function repoRoot(): string {
  for (let d = resolve(process.cwd()); ; d = dirname(d)) {
    if (existsSync(join(d, "pnpm-workspace.yaml"))) return d;
    if (dirname(d) === d) return resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
  }
}
const repoFile = (rel: string): string => join(repoRoot(), rel);
const items = (rel: string): Obj[] =>
  (JSON.parse(readFileSync(repoFile(rel), "utf8")) as { items: Obj[] }).items;

interface SlotDef {
  id: string;
  kind: "copy" | "list" | "image" | "link";
  required: boolean;
}
interface BlockDef {
  id: string;
  slots: SlotDef[];
  variants: { id: string }[];
}
const BLOCKS = items("data/taxonomy/blocks.json") as unknown as BlockDef[];
const PURPOSES = items("data/taxonomy/purposes.json") as unknown as {
  sectionCount: [number, number];
}[];
const IMAGE_TAGS = [
  ...new Set(
    items("data/images/manifest.json").flatMap((m) =>
      (Array.isArray(m.tags) ? (m.tags as string[]) : []).filter(
        (t) => !t.startsWith("orient.") && !t.startsWith("tone."),
      ),
    ),
  ),
].sort();

/** 4.5.2 정규식(자유 텍스트 경로 없음). */
export const LAYOUT_PATTERNS = {
  deckRef: /^deck:[a-z_.]+#[0-9]$/,
  sectionId: /^[a-z][a-z0-9-]{1,23}$/,
  anchor: /^#[a-z][a-z0-9-]{1,23}$/,
} as const;
const nonEmpty = (a: string[]): [string, ...string[]] => {
  if (a.length === 0) throw new Error("빈 enum");
  return a as [string, ...string[]];
};

const DeckRef = z.string().regex(LAYOUT_PATTERNS.deckRef);
const CopyRef = z.object({ copy: DeckRef }).strict();
const SLOT_VALUE = {
  copy: CopyRef,
  list: z.object({ list: z.array(CopyRef).min(1).max(12) }).strict(),
  image: z
    .object({
      image: z
        .object({
          tag: z.enum(nonEmpty(IMAGE_TAGS)),
          ratio: z.enum(["1:1", "4:5", "3:2", "16:9", "21:9"]),
        })
        .strict(),
    })
    .strict(),
  link: z
    .object({
      link: z.object({ label: DeckRef, target: z.string().regex(LAYOUT_PATTERNS.anchor) }).strict(),
    })
    .strict(),
} as const;

/** nav는 컴파일러가 만들고 footer는 따로 두므로 섹션 블록에서 뺀다. */
const SECTION_BLOCKS = BLOCKS.filter((b) => b.id !== "nav" && b.id !== "footer");
const sectionMax = Math.max(...PURPOSES.map((p) => p.sectionCount[1]));

function sectionSchema(b: BlockDef) {
  const slots: Record<string, z.ZodType> = {};
  for (const s of b.slots) {
    const v = SLOT_VALUE[s.kind];
    slots[s.id] = s.required ? v : v.optional();
  }
  return z
    .object({
      id: z.string().regex(LAYOUT_PATTERNS.sectionId),
      block: z.literal(b.id),
      variant: z.enum(nonEmpty(b.variants.map((v) => v.id))),
      bg: z.enum(["bg", "surface", "inverse", "image"]),
      pad: z.union([z.literal(-1), z.literal(0), z.literal(1)]),
      slots: z.object(slots).strict(),
    })
    .strict();
}

const footer = BLOCKS.find((b) => b.id === "footer");
const PATTERN_IDS = ["PS", "PL", "PP"].flatMap((p) => [1, 2, 3, 4].map((n) => `${p}-${n}`));

export const LayoutTreeRawSchema = z
  .object({
    schemaVersion: z.literal("1"),
    spec_id: z.string().regex(/^[0-9a-f]{16}$/),
    pattern_id: z.enum(nonEmpty(PATTERN_IDS)),
    sections: z
      .array(z.discriminatedUnion("block", SECTION_BLOCKS.map(sectionSchema) as never))
      .min(1)
      .max(sectionMax),
    footer: z
      .object({ variant: z.enum(nonEmpty((footer?.variants ?? []).map((v) => v.id))) })
      .strict(),
  })
  .strict()
  .superRefine((t, ctx) => {
    const ids = (t.sections as { id: string }[]).map((s) => s.id);
    if (new Set(ids).size !== ids.length) ctx.addIssue({ code: "custom", message: "섹션 id 중복" });
  });
export type LayoutTreeRaw = z.infer<typeof LayoutTreeRawSchema>;

/** zod → JSON Schema(draft 2020-12). strict 객체는 additionalProperties: false. */
export function layoutTreeRawJsonSchema(): Record<string, unknown> {
  return z.toJSONSchema(LayoutTreeRawSchema, { unrepresentable: "any" }) as Record<string, unknown>;
}

/** 03장 3.1.5 타입 단계(role_overrides 값). */
export const TYPE_STEP_IDS = [
  "t-caption",
  "t-small",
  "t-body",
  "t-lead",
  "t-4",
  "t-3",
  "t-2",
  "t-1",
  "t-display",
] as const;
/** 확정 텍스트 상한(가장 긴 덱 상한 240 + 여유). 텍스트는 렌더러가 이스케이프한다. */
const TEXT_MAX = 400;
const Text = z
  .object({
    text: z.string().max(TEXT_MAX),
    /** 목록 항목의 둘째 필드(본문·답·설명·라벨·이름). */
    sub: z.string().max(TEXT_MAX).optional(),
    placeholder: z.boolean(),
    deck_ref: DeckRef,
  })
  .strict();
const CopyText = z.object({ copy: Text }).strict();
const PAGE_SLOT_VALUE = {
  copy: CopyText,
  list: z.object({ list: z.array(CopyText).min(1).max(12) }).strict(),
  image: z
    .object({
      image: z
        .object({
          tag: z.enum(nonEmpty(IMAGE_TAGS)),
          ratio: z.enum(["1:1", "4:5", "3:2", "16:9", "21:9"]),
          // manifest id(temp "tmp_img:<태그>-<번호>") 또는 색면 표시 "shape-graphic"(ASM-053)
          asset_id: z.string().regex(/^[a-z0-9_.:-]{1,64}$/),
          alt: z.string().max(120),
          focal: z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]),
        })
        .strict(),
    })
    .strict(),
  link: z
    .object({
      link: z.object({ label: Text, target: z.string().regex(LAYOUT_PATTERNS.anchor) }).strict(),
    })
    .strict(),
} as const;

function pageSlots(b: BlockDef) {
  const slots: Record<string, z.ZodType> = {};
  for (const s of b.slots) {
    const v = PAGE_SLOT_VALUE[s.kind];
    slots[s.id] = s.required ? v : v.optional();
  }
  return z.object(slots).strict();
}
function pageSectionSchema(b: BlockDef) {
  const step = z.enum(TYPE_STEP_IDS);
  const overrides: Record<string, z.ZodType> = {};
  for (const s of b.slots) if (s.kind !== "image") overrides[s.id] = step.optional();
  return z
    .object({
      id: z.string().regex(LAYOUT_PATTERNS.sectionId),
      block: z.literal(b.id),
      variant: z.enum(nonEmpty(b.variants.map((v) => v.id))),
      bg: z.enum(["bg", "surface", "inverse", "image"]),
      pad: z.union([z.literal(-1), z.literal(0), z.literal(1)]),
      slots: pageSlots(b),
      /** 줄 예산 하향 결과(04장 4.10.2 넘침 처리 ②, T-30). */
      role_overrides: z.object(overrides).strict().optional(),
    })
    .strict();
}
const nav = BLOCKS.find((b) => b.id === "nav");
/** 4.5.2 nav 항목 상한(컴파일러 생성, nav_label 있는 섹션에서 최대 5개). */
export const NAV_ITEMS_MAX = 5;

/** 04장 4.5.2 확정 트리 LayoutTree(= 06장 PageSchema, ASM-040). */
export const PageSchema = z
  .object({
    schemaVersion: z.literal("1"),
    spec_id: z.string().regex(/^[0-9a-f]{16}$/),
    pattern_id: z.enum(nonEmpty(PATTERN_IDS)),
    nav: z
      .object({
        variant: z.enum(nonEmpty((nav?.variants ?? []).map((v) => v.id))),
        items: z
          .array(
            z
              .object({
                label: z.string().max(20),
                target: z.string().regex(LAYOUT_PATTERNS.anchor),
              })
              .strict(),
          )
          .max(NAV_ITEMS_MAX),
      })
      .strict(),
    sections: z
      .array(z.discriminatedUnion("block", SECTION_BLOCKS.map(pageSectionSchema) as never))
      .min(1)
      .max(sectionMax),
    footer: z
      .object({
        variant: z.enum(nonEmpty((footer?.variants ?? []).map((v) => v.id))),
        slots: footer ? pageSlots(footer) : z.object({}).strict(),
      })
      .strict(),
  })
  .strict()
  .superRefine((t, ctx) => {
    const ids = (t.sections as { id: string }[]).map((s) => s.id);
    if (new Set(ids).size !== ids.length) ctx.addIssue({ code: "custom", message: "섹션 id 중복" });
  });
export type PageTree = z.infer<typeof PageSchema>;

export function pageSchemaJsonSchema(): Record<string, unknown> {
  return z.toJSONSchema(PageSchema, { unrepresentable: "any" }) as Record<string, unknown>;
}

/** 09장 9.4.4 ⑥ 정적 검사: 금지 키가 생길 수 있는 경로(속성 이름 일치 또는 열린 객체). */
export const BANNED_KEY = /^(style|className|css|html|script|on[A-Za-z].*)$/;
export function bannedKeyPaths(js: unknown, path = "$"): string[] {
  if (js === null || typeof js !== "object") return [];
  if (Array.isArray(js)) return js.flatMap((x, i) => bannedKeyPaths(x, `${path}[${i}]`));
  const o = js as Obj;
  const out: string[] = [];
  const isObject = o.type === "object" || "properties" in o;
  if (isObject && o.additionalProperties !== false) out.push(`${path}(열린 객체)`);
  for (const k of Object.keys((o.properties as Obj | undefined) ?? {}))
    if (BANNED_KEY.test(k)) out.push(`${path}.properties.${k}`);
  for (const [k, v] of Object.entries(o)) out.push(...bannedKeyPaths(v, `${path}.${k}`));
  return out;
}

/** 4.6.2 덱 키별 길이 상한(한글 글자 수, 상한만). 목록은 필드별. contact.*는 컴파일러가 채우므로 0. */
export const COPY_DECK_LIMITS: Record<string, number | Record<string, number>> = {
  "hero.headline": 24,
  "hero.sub": 80,
  "hero.eyebrow": 14,
  "cta.primary": 10,
  "cta.secondary": 10,
  "about.title": 20,
  "about.body": 240,
  "footer.tagline": 30,
  "meta.title": 60,
  "meta.description": 160,
  "value.items": { 제목: 18, 본문: 90 },
  "feature.items": { 제목: 20, 본문: 120 },
  "faq.items": { 질문: 40, 답: 160 },
  "highlight.items": { 제목: 16, 본문: 60 },
  "story.body": 240,
  "menu.groups": { 항목명: 20, 설명: 40 },
  "work.items": { 제목: 20, 캡션: 40 },
  "work.items[0]": { 제목: 20, 캡션: 40 },
  "service.items": { 제목: 16, 본문: 90 },
  "proof.items": { 인용: 120 },
  "stats.items": { 값: 10, 라벨: 16 },
  "contact.*": 0,
};
export function copyDeckLimits(): Record<string, number | Record<string, number>> {
  return structuredClone(COPY_DECK_LIMITS);
}
