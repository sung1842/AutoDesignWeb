// 06장 6.4.3 공유·신고·권리 요청 라우트 스키마(M5 범위: 결과·시안 공유 생성, 공유 신고, 권리 요청 접수). 08장 8.1.6·8.9.5.
import { z } from "zod";

export const ShareCreateReqSchema = z
  .object({
    targetType: z.enum(["result", "mockup"]),
    targetId: z.string().uuid(),
    versionId: z.string().uuid().optional(),
  })
  .strict();
export const ShareCreateResSchema = z.object({
  shareId: z.string().regex(/^[A-Za-z0-9_-]{22}$/),
  url: z.string(),
  isPublic: z.boolean(),
});

export const REPORT_REASONS = [
  "impersonation",
  "phishing",
  "copyright",
  "trademark",
  "inappropriate",
  "other",
] as const;
export const ShareReportReqSchema = z
  .object({
    reason: z.enum(REPORT_REASONS),
    details: z.string().max(1000).optional(),
    email: z.string().email().max(254).optional(),
    turnstileToken: z.string().min(1),
  })
  .strict();

export const RIGHTS_TYPES = [
  "optout_domain",
  "copyright_claim",
  "trademark_claim",
  "privacy_request",
  "abuse_report",
] as const;
/** 08장 8.1.6 RightsRequest 입력 필드(camelCase, ASM-118 ④). */
export const RightsRequestReqSchema = z
  .object({
    type: z.enum(RIGHTS_TYPES),
    domain: z.string().max(253).nullable().optional(),
    targetUrl: z.string().url().max(2048).nullable().optional(),
    requesterEmail: z.string().email().max(254),
    requesterRole: z.enum(["owner", "agent", "other"]),
    details: z.string().min(1).max(2000),
    turnstileToken: z.string().min(1),
  })
  .strict();
export const RightsRequestResSchema = z.object({ requestId: z.string().uuid(), dueAt: z.string() });
