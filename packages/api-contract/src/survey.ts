// 06장 6.4.3 진단(익명) 라우트 스키마. 타입 이름·필드는 6.4.3 TS 정의 그대로.
import { z } from "zod";

export const AXIS_KEYS = ["expression", "temperature", "shape", "density", "depth"] as const;
const L1 = z.object({
  expression: z.number(),
  temperature: z.number(),
  shape: z.number(),
  density: z.number(),
  depth: z.number(),
});
const TypeId = z.string().regex(/^T[1-8]$/);
const Purpose = z.enum(["saas", "portfolio", "local_business"]);

export const StartSurveyReqSchema = z
  .object({
    entry: z.enum(["landing", "share", "retest", "direct"]),
    purposeHint: Purpose.optional(),
    restart: z.boolean().optional(),
  })
  .strict();

export const SurveyAnswerUxSchema = z.record(z.string(), z.unknown());
export const SubmitAnswerReqSchema = z
  .object({
    seq: z.number().int().min(1),
    itemKey: z.string().min(1),
    shownItemIds: z.array(z.string()).min(2),
    answer: z.enum(["option", "none_of_these", "cant_tell"]),
    chosenItemId: z.string().optional(),
    latencyMs: z.number().int().min(0).max(3_600_000),
    clientTs: z.string().datetime(),
    ux: SurveyAnswerUxSchema.optional(),
  })
  .strict()
  .refine((b) => (b.answer === "option") === (b.chosenItemId !== undefined), {
    message: "chosenItemId는 answer=option일 때만",
  });
export type SubmitAnswerReq = z.infer<typeof SubmitAnswerReqSchema>;
export const UndoReqSchema = z.object({ fromSeq: z.number().int().min(1) }).strict();
export const RatingReqSchema = z.object({ score: z.number().int().min(1).max(5) }).strict();
export const AnchorOverrideReqSchema = z.object({ typeId: TypeId.nullable() }).strict();

export const QuestionViewSchema = z.object({
  seq: z.number().int(),
  itemKey: z.string(),
  kind: z.enum(["pick4", "ab"]),
  items: z.array(z.string()),
  allowNone: z.boolean(),
  allowCantTell: z.boolean(),
});
export const SurveyViewSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["in_progress", "completed"]),
  stage: z.union([z.literal(1), z.literal(2)]),
  answered: z.number().int(),
  maxQuestions: z.literal(16),
  state: z.record(z.string(), z.unknown()),
  question: QuestionViewSchema.nullable(),
  canUndo: z.boolean(),
  resultId: z.string().uuid().nullable(),
});
export type SurveyView = z.infer<typeof SurveyViewSchema>;

const AssetView = z.object({ url: z.string(), w: z.number(), h: z.number() });
export const SurveyItemViewSchema = z.object({
  id: z.string(),
  stage: z.number().nullable(),
  kind: z.enum(["card", "ab_image", "ab_pair", "anchor_ref"]),
  templateId: z.string(),
  axis: z.string().optional(),
  level: z.number().optional(),
  pairImageIds: z.array(z.string()).optional(),
  xCard: L1.nullable(),
  assets: z.object({ desktop: AssetView, mobile: AssetView.optional() }).nullable(),
  altText: z.string().nullable(),
  dominantColors: z.tuple([z.string(), z.string(), z.string()]).nullable(),
  focusRegion: z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() }).nullable(),
});
export const SurveyItemsViewSchema = z.object({
  taxonomyVersion: z.string(),
  engineVersion: z.string(),
  items: z.array(SurveyItemViewSchema),
});

const TypeBrief = z.object({ id: TypeId, nameKo: z.string(), descriptionKo: z.string() });
export const ResultViewSchema = z.object({
  resultId: z.string().uuid(),
  surveyId: z.string().uuid(),
  type: TypeBrief,
  typeSecond: z.object({ id: TypeId, nameKo: z.string() }).nullable(),
  isBoundary: z.boolean(),
  adjacentTypes: z.tuple([TypeBrief, TypeBrief]),
  confidence: z.enum(["high", "medium", "low"]),
  flags: z.array(z.string()),
  axes: z.array(
    z.object({
      key: z.enum(AXIS_KEYS),
      mu: z.number(),
      sigmaDisplay: z.number(),
      state: z.enum(["open", "confirmed", "insensitive"]),
    }),
  ),
  notice: z.enum(["low_signal", "conflict", "low_consistency", "boundary"]).nullable(),
  seasonAdjusted: z.boolean(),
  anchorOverrideTypeId: TypeId.nullable(),
  rating: z.number().int().nullable(),
  guide: z.object({
    pairingName: z.string(),
    paletteHex: z.array(z.string()),
    radiusFamily: z.string(),
  }),
  similarSites: z.array(
    z.object({ title: z.string(), blurb: z.string(), url: z.string(), domain: z.string() }),
  ),
  taxonomyVersion: z.string(),
  shareId: z.string().nullable(),
});
export type ResultView = z.infer<typeof ResultViewSchema>;
export const RatingResSchema = z.object({ suggestedTypes: z.array(TypeBrief) });
