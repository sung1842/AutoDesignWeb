// 공통 봉투(09장 9.2.1). 모든 JSON 묶음은 이 형식을 따르고 provenance로 출처를 구분한다.
import { z } from "zod";

export const PROVENANCES = ["human", "temp"] as const;
export type Provenance = (typeof PROVENANCES)[number];

/** temp 묶음 생성자 표기: `seed:temp@<gitsha>`. human은 이니셜. */
export const TEMP_PREPARED_BY = /^seed:temp@[0-9a-f]{7,40}$/;
export const TMP_PREFIX = "tmp_";

const iso = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?Z$/, "ISO 8601 UTC");

export const envelopeMeta = z.object({
  bundle: z.string().min(1),
  schemaVersion: z.literal(1),
  taxonomyVersion: z.string().min(1),
  provenance: z.enum(PROVENANCES),
  preparedAt: iso,
  preparedBy: z.string().min(1),
  licenseCheckedAt: iso.optional(),
});
export type EnvelopeMeta = z.infer<typeof envelopeMeta>;

/** items 원소 스키마를 받아 봉투 스키마를 만든다. temp이면 preparedBy 형식을 검사한다. */
export function envelope<T extends z.ZodType>(item: T) {
  return envelopeMeta.extend({ items: z.array(item) }).superRefine((e, ctx) => {
    if (e.provenance === "temp" && !TEMP_PREPARED_BY.test(e.preparedBy))
      ctx.addIssue({
        code: "custom",
        path: ["preparedBy"],
        message: "temp 묶음의 preparedBy는 seed:temp@<gitsha>",
      });
    // 라이선스 확인일(verified_at)은 temp만 비어도 된다(03장 AC-03-22, ASM-072)
    if (e.provenance === "human")
      e.items.forEach((it, i) => {
        if (it && typeof it === "object" && "verified_at" in it && it.verified_at == null)
          ctx.addIssue({
            code: "custom",
            path: ["items", i, "verified_at"],
            message: "human 묶음은 verified_at을 채워야 한다",
          });
      });
  });
}
export type Bundle<T> = EnvelopeMeta & { items: T[] };
