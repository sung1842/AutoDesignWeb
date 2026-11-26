// 06장 6.9.2 models.yaml 로드·검증 + 08장 8.8 승인 공급자 검사(ASM-107 ④⑤).
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parse } from "yaml";
import { z } from "zod";
import { findRepoRoot } from "@tastefit/config";
import { LLM_ROLES, LlmError } from "./gateway.js";

const Compliance = z
  .object({
    L1: z.boolean(),
    L2: z.boolean(),
    L3: z.boolean(),
    L4: z.boolean(),
    L5: z.boolean(),
    checked_at: z.string().nullable(),
  })
  .strict();
const Entry = z
  .object({
    processor_id: z.string().min(1),
    family: z.string().min(1),
    model: z.string().min(1),
    params: z
      .object({ temperature: z.number(), maxOutputTokens: z.number().int().positive() })
      .strict(),
    timeout_ms: z.number().int().positive(),
    compliance: Compliance,
  })
  .strict();
export type ModelEntry = z.infer<typeof Entry>;
const Role = z
  .object({
    primary: Entry,
    fallbacks: z.array(Entry),
    prompt: z.object({ id: z.enum(LLM_ROLES), version: z.number().int().positive() }).strict(),
    max_input_tokens: z.number().int().positive(),
    max_images: z.number().int().positive().optional(),
  })
  .strict();
const Price = z
  .object({
    input_per_mtok: z.number().min(0),
    output_per_mtok: z.number().min(0),
    cached_input_per_mtok: z.number().min(0),
    cache_write_per_mtok: z.number().min(0),
    per_image: z.number().min(0),
    source_url: z.string(),
    checked_at: z.string().nullable(),
  })
  .strict();
export const ModelsSchema = z
  .object({
    revision: z.number().int().positive(),
    processors_file: z.string(),
    roles: z
      .object({ gen_layout: Role, gen_copy: Role, judge_vision: Role, ref_tagger: Role })
      .strict(),
    pricing: z.record(z.string(), Price),
    retry: z.object({
      network_or_5xx: z.object({ max: z.number().int(), backoff_ms: z.number().int() }).strict(),
      rate_limited: z
        .object({ max: z.number().int(), respect_retry_after_max_ms: z.number().int() })
        .strict(),
      switch_to_fallback_after_consecutive_failures: z.number().int().positive(),
    }),
    circuit_breaker: z
      .object({
        window_s: z.number(),
        min_calls: z.number().int(),
        failure_ratio: z.number(),
        open_s: z.number(),
      })
      .strict(),
  })
  .strict()
  .superRefine((m, ctx) => {
    // 04장 4.10.5: judge 계열 ≠ 생성 계열
    const j = m.roles.judge_vision.primary.family;
    if (j === m.roles.gen_layout.primary.family || j === m.roles.gen_copy.primary.family)
      ctx.addIssue({ code: "custom", message: "judge_vision family가 생성 역할 family와 같다" });
  });
export type Models = z.infer<typeof ModelsSchema> & { path: string };

export const defaultModelsPath = (): string => join(findRepoRoot(), "packages/llm/models.yaml");

/** models.yaml 로드. 검증 실패는 LlmError(E_MODELS_INVALID). */
export function loadModels(path: string = defaultModelsPath()): Models {
  const r = ModelsSchema.safeParse(parse(readFileSync(path, "utf8")));
  if (!r.success)
    throw new LlmError(
      "E_MODELS_INVALID",
      r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
    );
  return { ...r.data, path };
}

export class UnapprovedProcessorError extends Error {
  constructor(
    readonly processorId: string,
    reason: string,
  ) {
    super(`UnapprovedProcessorError: ${processorId} ${reason}`);
    this.name = "UnapprovedProcessorError";
  }
}
interface Processor {
  id: string;
  approved?: boolean;
  effective_from?: string;
  trains_on_api_data?: boolean;
}
export function loadProcessors(m: Models): Map<string, Processor> {
  const p = resolve(dirname(m.path), m.processors_file);
  const list = existsSync(p) ? ((parse(readFileSync(p, "utf8")) as Processor[] | null) ?? []) : [];
  return new Map(list.map((x) => [x.id, x]));
}
const entries = (m: Models): ModelEntry[] =>
  Object.values(m.roles).flatMap((r) => [r.primary, ...r.fallbacks]);

/** 6.9.2 첫 행·08장 8.8.2: approved ∧ effective_from ≤ 오늘 ∧ trains_on_api_data=false. 위반 사유(없으면 null). */
export function processorProblem(p: Processor | undefined, today: string): string | null {
  if (!p) return "processors.yaml에 없음";
  if (p.approved !== true) return "approved: false";
  if (!p.effective_from || p.effective_from > today) return "effective_from 미도래·없음";
  if (p.trains_on_api_data !== false) return "trains_on_api_data ≠ false";
  return null;
}

/** live·record 기동 검사(8.8.2). 첫 위반에서 UnapprovedProcessorError. 외부 요청을 하지 않는다. */
export function assertLiveReady(m: Models, o: { today?: string } = {}): void {
  const today = o.today ?? new Date().toISOString().slice(0, 10);
  const procs = loadProcessors(m);
  for (const e of entries(m)) {
    const why = processorProblem(procs.get(e.processor_id), today);
    if (why) throw new UnapprovedProcessorError(e.processor_id, why);
  }
}

/** 08장 AC-08-39 CI 검사: 운영 항목(폴백 포함)의 L1~L5·승인·단가 출처 미충족 목록. */
export function checkModelsCompliance(m: Models, o: { today?: string } = {}): string[] {
  const today = o.today ?? new Date().toISOString().slice(0, 10);
  const procs = loadProcessors(m);
  const out: string[] = [];
  for (const [role, r] of Object.entries(m.roles))
    for (const e of [r.primary, ...r.fallbacks]) {
      const at = `${role}:${e.processor_id}/${e.model}`;
      for (const k of ["L1", "L2", "L3", "L4", "L5"] as const)
        if (!e.compliance[k]) out.push(`${at} ${k} 미충족`);
      const why = processorProblem(procs.get(e.processor_id), today);
      if (why) out.push(`${at} ${why}`);
      const price = m.pricing[`${e.processor_id}/${e.model}`];
      if (!price) out.push(`${at} pricing 없음`);
      else if (!price.source_url || !price.checked_at) out.push(`${at} pricing 원문 미확인`);
    }
  return [...new Set(out)];
}
