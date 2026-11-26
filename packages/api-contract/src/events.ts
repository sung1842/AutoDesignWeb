// 00장 8.3 이벤트 레지스트리(MVP). props는 strict(레지스트리 밖 필드 = 400, AC-00-11·12). 요청 본문은 ASM-096.
import { z } from "zod";

const uuid = z.string().uuid();
const TypeId = z.string().regex(/^T[1-8]$/);
const Variant = z.enum(["v_true", "v_fit", "v_bal"]);
const Purpose = z.enum(["saas", "portfolio", "local_business"]);
const Fmt = z.enum(["html_zip", "react_zip", "dtcg_json"]);
const p = <T extends z.ZodRawShape>(shape: T) => z.object(shape).strict();
const S = "server" as const;
const C = "client" as const;

export const EVENT_REGISTRY = {
  landing_view: { source: C, props: p({ path: z.string() }) },
  survey_start: {
    source: S,
    props: p({
      survey_session_id: uuid,
      entry: z.enum(["landing", "share", "retest", "direct"]),
      is_resume: z.boolean(),
    }),
  },
  survey_answer: {
    source: S,
    props: p({
      survey_session_id: uuid,
      stage: z.union([z.literal(1), z.literal(2)]),
      seq: z.number().int(),
      item_id: z.string(),
      shown_option_ids: z.array(z.string()),
      answer: z.enum(["option", "none_of_these", "cant_tell"]),
      chosen_option_id: z.string().optional(),
      latency_ms: z.number().int(),
      sigma_max_after: z.number(),
      chosen_position: z.number().int().nullable(),
      viewport_class: z.string().nullable(),
      viewed_option_ids: z.array(z.string()),
      zoomed_option_ids: z.array(z.string()),
      descriptions_shown: z.boolean(),
      revised: z.boolean(),
      failed_option_ids: z.array(z.string()),
    }),
  },
  survey_exit: {
    source: C,
    props: p({ survey_session_id: uuid, seq: z.number().int(), stage: z.number().int() }),
  },
  survey_back: { source: S, props: p({ survey_session_id: uuid, from_seq: z.number().int() }) },
  survey_complete: {
    source: S,
    props: p({
      survey_session_id: uuid,
      n_questions: z.number().int(),
      duration_s: z.number(),
      early_stop: z.boolean(),
      n_none: z.number().int(),
      n_cant_tell: z.number().int(),
    }),
  },
  result_view: {
    source: C,
    props: p({
      result_id: uuid,
      type_id: TypeId,
      is_boundary: z.boolean(),
      is_shared_view: z.boolean(),
    }),
  },
  result_rating: {
    source: S,
    props: p({ result_id: uuid, score: z.number().int().min(1).max(5) }),
  },
  result_share: {
    source: C,
    props: p({ result_id: uuid, channel: z.enum(["link_copy", "image_save", "web_share"]) }),
  },
  guide_copy: {
    source: C,
    props: p({ result_id: uuid, field: z.enum(["fonts", "palette", "radius", "all"]) }),
  },
  share_page_view: {
    source: S,
    props: p({ target_type: z.enum(["result", "mockup"]), share_id: z.string() }),
  },
  login_prompt_view: {
    source: C,
    props: p({ trigger: z.enum(["generate", "save", "export", "history"]) }),
  },
  login_success: {
    source: S,
    props: p({
      provider: z.enum(["email", "google"]),
      is_new_user: z.boolean(),
      merged_anon: z.boolean(),
    }),
  },
  generate_request: {
    source: S,
    props: p({
      job_id: uuid,
      project_id: uuid,
      purpose: Purpose,
      result_id: uuid,
      quota_remaining_day: z.number().int(),
      quota_remaining_month: z.number().int(),
      queue_position: z.number().int(),
    }),
  },
  generate_rejected: {
    source: S,
    props: p({
      stage: z.enum(["project", "generation"]),
      code: z.enum([
        "RATE_LIMITED",
        "QUOTA_DAY",
        "QUOTA_MONTH",
        "GEN_BUDGET_EXCEEDED",
        "GEN_DISABLED",
        "JOB_IN_PROGRESS",
        "INVITE_REQUIRED",
        "CONSENT_REQUIRED",
        "ACCOUNT_SUSPENDED",
        "PROJECT_LIMIT",
        "BLOCKED_BRAND",
        "BRAND_ATTESTATION_REQUIRED",
      ]),
      reason: z.enum(["high_risk", "phishing_term"]).optional(),
    }),
  },
  generate_complete: {
    source: S,
    props: p({
      job_id: uuid,
      status: z.enum(["succeeded", "partial", "fallback", "failed"]),
      n_shown: z.number().int(),
      n_real: z.number().int(),
      variants_shown: z.array(Variant),
      first_shown_ms: z.number(),
      duration_ms: z.number(),
      cost_usd: z.number(),
      error_code: z.string().optional(),
      regenerated: z.boolean(),
      quota_refunded: z.boolean(),
    }),
  },
  mockup_view: { source: C, props: p({ job_id: uuid, mockup_id: uuid, variant: Variant }) },
  mockup_select: {
    source: S,
    props: p({ job_id: uuid, mockup_id: uuid, variant: Variant, is_fallback: z.boolean() }),
  },
  mockup_edit: {
    source: S,
    props: p({
      mockup_id: uuid,
      kind: z.enum(["step", "candidate", "section_order", "section_hide", "text", "undo", "redo"]),
      target: z.string(),
    }),
  },
  export_complete: {
    source: S,
    props: p({ mockup_id: uuid, format: Fmt, bytes: z.number().int(), duration_ms: z.number() }),
  },
  export_failed: { source: S, props: p({ mockup_id: uuid, format: Fmt, error_code: z.string() }) },
  share_link_enable: {
    source: S,
    props: p({ target_type: z.enum(["result", "mockup"]), target_id: uuid, share_id: z.string() }),
  },
  share_link_disable: {
    source: S,
    props: p({ target_type: z.enum(["result", "mockup"]), target_id: uuid, share_id: z.string() }),
  },
  mockup_adopted: {
    source: S,
    props: p({
      mockup_id: uuid,
      via: z.enum(["export", "share"]),
      format: Fmt.optional(),
      is_fallback: z.boolean(),
      variant: Variant,
    }),
  },
  adoption_followup_answer: {
    source: S,
    props: p({
      mockup_id: uuid,
      answer: z.enum(["deployed", "handed_off", "reference_only", "unused"]),
    }),
  },
  mockup_feedback: {
    source: S,
    props: p({
      mockup_id: uuid,
      rating: z.enum(["up", "down"]),
      reason: z.enum(["ai_feel", "not_my_taste", "broken_layout", "bad_copy", "other"]).optional(),
    }),
  },
  paywall_view: {
    source: C,
    props: p({ placement: z.enum(["quota_day", "quota_month", "pricing"]) }),
  },
  paywall_interest: {
    source: S,
    props: p({ placement: z.enum(["quota_day", "quota_month", "pricing"]) }),
  },
  report_submit: {
    source: S,
    props: p({
      target_type: z.string(),
      reason: z.enum([
        "impersonation",
        "phishing",
        "copyright",
        "trademark",
        "inappropriate",
        "other",
      ]),
    }),
  },
  account_delete: { source: S, props: p({}) },
  ui_error_shown: {
    source: C,
    props: p({ code: z.string(), screen: z.string().regex(/^S(0[1-9]|1[0-5])$/) }),
  },
} as const;
export type EventName = keyof typeof EVENT_REGISTRY;

/** 클라이언트 수집 본문(ASM-096 ①). */
export const ClientEventSchema = z
  .object({
    eventId: uuid,
    name: z.string(),
    sessionId: z.string().min(1).max(64),
    device: z.enum(["mobile", "tablet", "desktop"]),
    clientTs: z.string().datetime(),
    referrerHost: z.string().max(255).optional(),
    utm: z
      .object({ source: z.string(), medium: z.string(), campaign: z.string() })
      .partial()
      .strict()
      .optional(),
    props: z.record(z.string(), z.unknown()),
  })
  .strict();
export const EventBatchSchema = z
  .object({ events: z.array(ClientEventSchema).min(1).max(20) })
  .strict();
export type ClientEvent = z.infer<typeof ClientEventSchema>;

/** 이름·source·props 검사. 통과하면 파싱된 props, 아니면 문제 문자열. */
export function checkEvent(
  name: string,
  props: unknown,
  source: "client" | "server",
): { ok: true; props: Record<string, unknown> } | { ok: false; issue: string } {
  const reg = (EVENT_REGISTRY as Record<string, { source: string; props: z.ZodType }>)[name];
  if (!reg) return { ok: false, issue: `미등록 이벤트 ${name}` };
  if (reg.source !== source) return { ok: false, issue: `${name}은 ${reg.source} 이벤트` };
  const r = reg.props.safeParse(props);
  return r.success
    ? { ok: true, props: r.data as Record<string, unknown> }
    : { ok: false, issue: `${name} props: ${r.error.issues[0]?.message ?? ""}` };
}
