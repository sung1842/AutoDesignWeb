// 04장 4.5.2 LayoutTreeRaw·4.6.2 덱 상한(ASM-024 ⑥, ASM-025 ⑤). enum 원천은 03장 blocks.json·purposes.json·이미지 manifest(ASM-039).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { z } from "zod";

type Obj = { [k: string]: unknown };
const repoFile = (rel: string): string =>
  fileURLToPath(new URL(`../../../${rel}`, import.meta.url));
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
