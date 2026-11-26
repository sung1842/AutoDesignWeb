// 04장 4.6.2 CopyDeck(LLM gen_copy 출력) zod. 용도별 키 집합 고정(추가·삭제 금지 = strict), 개수·길이(공백 포함 글자 수) 하한·상한.
// contact.*는 컴파일러가 채우므로 키가 없다. 문구 품질(금지어·AIL)은 린터 몫(ASM-107 ⑧).
import { z } from "zod";

export type DeckPurpose = "saas" | "portfolio" | "local_business";
const len = (min: number, max: number) =>
  z.string().refine((s) => {
    const n = Array.from(s).length;
    return n >= min && n <= max;
  }, `길이 ${min}~${max}`);
const many = <T extends z.ZodType>(item: T, min: number, max: number) =>
  z.array(item).min(min).max(max);
const exact = <T extends z.ZodType>(item: T, n: number) => many(item, n, n);
/** [임시]·[예시] 자리표시 접두. */
const EXAMPLE = /^\[예시\]/;

const headline = exact(
  z.object({ kind: z.enum(["factual", "benefit", "emotive"]), text: len(8, 24) }).strict(),
  3,
).refine((a) => new Set(a.map((h) => h.kind)).size === 3, "hero.headline kind 3종");
const titleBody = (t: [number, number], b: [number, number]) =>
  z.object({ title: len(...t), body: len(...b) }).strict();

const COMMON = {
  "hero.headline": headline,
  "hero.sub": exact(len(30, 80), 2),
  "hero.eyebrow": exact(len(2, 14), 2),
  "cta.primary": exact(len(2, 10), 3),
  "cta.secondary": exact(len(2, 10), 2),
  "about.title": exact(len(6, 20), 1),
  "about.body": exact(len(80, 240), 2),
  "footer.tagline": exact(len(1, 30), 1),
  "meta.title": exact(len(1, 60), 1),
  "meta.description": exact(len(1, 160), 1),
  "proof.items": many(
    z
      .object({
        quote: len(1, 120).refine((s) => EXAMPLE.test(s), "[예시] 접두"),
        name: z.string().regex(/^.○○$/),
        placeholder: z.literal(true),
      })
      .strict(),
    2,
    3,
  ).optional(),
  "stats.items": many(z.object({ value: len(1, 10), label: len(1, 16) }).strict(), 0, 4).optional(),
};
const BY_PURPOSE = {
  saas: {
    "value.items": many(titleBody([6, 18], [30, 90]), 3, 4),
    "feature.items": many(titleBody([6, 20], [40, 120]), 3, 5),
    "faq.items": many(z.object({ q: len(1, 40), a: len(40, 160) }).strict(), 4, 6),
  },
  local_business: {
    "highlight.items": exact(titleBody([4, 16], [20, 60]), 3),
    "story.body": exact(len(80, 240), 2),
    "menu.groups": many(
      z
        .object({
          title: len(1, 20),
          items: many(
            z
              .object({
                name: len(1, 20),
                desc: len(1, 40),
                price: z.literal("[예시] 0,000원"),
                placeholder: z.literal(true),
              })
              .strict(),
            3,
            4,
          ),
        })
        .strict(),
      1,
      2,
    ),
  },
  portfolio: {
    "work.items": many(z.object({ title: len(1, 20), caption: len(1, 40) }).strict(), 4, 6),
    "service.items": exact(titleBody([4, 16], [30, 90]), 3),
  },
} as const;

/** 용도별 CopyDeck 스키마(4.6.2 키 표). */
export function CopyDeckSchema(purpose: DeckPurpose) {
  return z.object({ ...COMMON, ...BY_PURPOSE[purpose] }).strict();
}
export type CopyDeck = z.infer<ReturnType<typeof CopyDeckSchema>>;
