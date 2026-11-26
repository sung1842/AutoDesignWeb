// 06장 6.4.3 프로젝트·생성 라우트 스키마(M5).
import { z } from "zod";
import { BrandInputRawSchema, PURPOSES } from "./brand.js";

export const ProjectCreateReqSchema = z
  .object({
    resultId: z.string().uuid(),
    purpose: z.enum(PURPOSES),
    brand: BrandInputRawSchema,
    useSampleContent: z.boolean(),
    brandAttested: z.boolean().optional(),
    briefDraftId: z.string().uuid().optional(),
  })
  .strict();
export const GenerationReqSchema = z.object({ kind: z.enum(["initial", "regenerate"]) }).strict();
/** 6.4.4 Idempotency-Key 형식. */
export const IDEMPOTENCY_KEY = /^[A-Za-z0-9_-]{16,64}$/;

export const JOB_STATUSES = [
  "queued",
  "running",
  "succeeded",
  "partial",
  "fallback",
  "failed",
  "canceled",
] as const;
export const JOB_PHASES = [
  "queued",
  "compiling",
  "generating",
  "rendering",
  "scoring",
  "repairing",
  "fallback",
  "selecting",
  "done",
] as const;
const AxisId = z.enum(["expression", "temperature", "shape", "density", "depth"]);
export const MockupCardSchema = z
  .object({
    mockupId: z.string().uuid(),
    variant: z.enum(["v_true", "v_fit", "v_bal"]),
    isFallback: z.boolean(),
    harmonyScore: z.number(),
    tasteScore: z.number(),
    previewUrl: z.string(),
    screenshotUrl: z.string(),
    labelKey: z.enum(["variant.v_true", "variant.v_fit", "variant.v_bal"]),
    photoSubstituted: z.boolean(),
    brandColorNotice: z
      .enum(["adjusted", "demoted_to_accent", "used_as_tint", "ignored"])
      .nullable(),
    useSampleContent: z.boolean(),
    movedAxes: z.array(
      z
        .object({
          axis: AxisId,
          direction: z.enum(["up", "down"]),
          reason: z.enum(["type", "purpose", "distance"]),
        })
        .strict(),
    ),
    diffFromTrue: z.array(z.string()),
  })
  .strict();
export const GenerationViewSchema = z
  .object({
    jobId: z.string().uuid(),
    status: z.enum(JOB_STATUSES),
    phase: z.enum(JOB_PHASES),
    progressPct: z.number().int().min(0).max(100),
    queuePosition: z.number().int().min(1).nullable(),
    queuedAt: z.string(),
    startedAt: z.string().nullable(),
    finishedAt: z.string().nullable(),
    mockups: z.array(MockupCardSchema).max(3),
    errorCode: z.string().nullable(),
    pollAfterMs: z.number().int().positive().nullable(),
    copySource: z.enum(["llm", "template"]).nullable(),
  })
  .strict();
export type GenerationView = z.infer<typeof GenerationViewSchema>;
