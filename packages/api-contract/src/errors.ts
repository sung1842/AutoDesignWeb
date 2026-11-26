// 06장 6.4.2 오류 코드 카탈로그(진단·이벤트 경로에서 쓰는 것 + 공통). ErrorBody는 6.4.1.
import { z } from "zod";

export const ERROR_STATUS = {
  VALIDATION_FAILED: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN_ORIGIN: 403,
  CONSENT_REQUIRED: 403,
  TURNSTILE_FAILED: 403,
  NOT_FOUND: 404,
  SEQ_CONFLICT: 409,
  UNDO_NOT_ALLOWED: 409,
  SURVEY_NOT_COMPLETED: 409,
  RATE_LIMITED: 429,
  INTERNAL: 500,
  SURVEY_ITEMS_INSUFFICIENT: 503,
} as const;
export type ErrorCode = keyof typeof ERROR_STATUS;

export const ErrorBodySchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    requestId: z.string(),
    retryAfterS: z.number().optional(),
    details: z.record(z.string(), z.unknown()).optional(),
  }),
});
export type ErrorBody = z.infer<typeof ErrorBodySchema>;
