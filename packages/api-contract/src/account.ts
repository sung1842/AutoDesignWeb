// 06장 6.4.3 인증·계정 라우트 스키마(M5). MeView 나머지 필드(quota·retest·adoptionFollowup)는 M5-07·08에서 채운다.
import { z } from "zod";

export const CONSENT_DOC_TYPES = [
  "terms",
  "privacy_notice",
  "age_14",
  "privacy_consent",
  "brand_attestation",
  "showcase_optin",
] as const;
export const ConsentReqSchema = z
  .object({
    items: z
      .array(
        z
          .object({
            docType: z.enum(CONSENT_DOC_TYPES),
            docVersion: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
            agreed: z.boolean(),
          })
          .strict(),
      )
      .min(1)
      .max(10),
  })
  .strict();
export type ConsentReq = z.infer<typeof ConsentReqSchema>;

/** 매직링크 요청(S04 서버 액션 입력, ASM-103 ①). */
export const MagicLinkReqSchema = z
  .object({
    email: z.string().trim().max(254).email(),
    next: z.string().max(2048).optional(),
    turnstileToken: z.string(),
  })
  .strict();
export type MagicLinkReq = z.infer<typeof MagicLinkReqSchema>;
