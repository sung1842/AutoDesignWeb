// 06장 6.4.3 라우트 레지스트리(AC-06-08): 51개 전부. 구현된 라우트는 요청·응답 스키마를 갖고, 아직 없는 라우트는 담당 마일스톤만 둔다.
import { z } from "zod";
import { EventBatchSchema } from "./events.js";
import {
  RightsRequestReqSchema,
  RightsRequestResSchema,
  ShareCreateReqSchema,
  ShareCreateResSchema,
  ShareReportReqSchema,
} from "./share.js";
import {
  AnchorOverrideReqSchema,
  RatingReqSchema,
  RatingResSchema,
  ResultViewSchema,
  StartSurveyReqSchema,
  SubmitAnswerReqSchema,
  SurveyItemsViewSchema,
  SurveyViewSchema,
  UndoReqSchema,
} from "./survey.js";

export const HealthResSchema = z.object({
  status: z.enum(["ok", "degraded"]),
  db: z.string(),
  queue: z.string(),
});
const NoContent = z.null();

export interface RouteContract {
  milestone: `M${number}`;
  /** 요청 본문 스키마(본문 없는 메서드는 없음). */
  req?: z.ZodType;
  /** 정상 응답 스키마(204는 null). 없으면 미구현. */
  res?: z.ZodType;
}
/** 키 = "METHOD /path"(쿼리 제외, 경로 파라미터는 :name). */
export const ROUTES: Record<string, RouteContract> = {
  "GET /api/survey-items": { milestone: "M4", res: SurveyItemsViewSchema },
  "POST /api/surveys": { milestone: "M4", req: StartSurveyReqSchema, res: SurveyViewSchema },
  "GET /api/surveys": { milestone: "M5" },
  "GET /api/surveys/current": { milestone: "M4", res: SurveyViewSchema },
  "POST /api/surveys/:id/responses": {
    milestone: "M4",
    req: SubmitAnswerReqSchema,
    res: SurveyViewSchema,
  },
  "POST /api/surveys/:id/undo": { milestone: "M4", req: UndoReqSchema, res: SurveyViewSchema },
  "GET /api/surveys/:id/result": { milestone: "M4", res: ResultViewSchema },
  "POST /api/surveys/:id/rating": { milestone: "M4", req: RatingReqSchema, res: RatingResSchema },
  "PATCH /api/surveys/:id/anchor-override": {
    milestone: "M4",
    req: AnchorOverrideReqSchema,
    res: ResultViewSchema,
  },
  "DELETE /api/surveys/:id": { milestone: "M4", res: NoContent },
  "GET /auth/callback": { milestone: "M5" },
  "GET /api/me": { milestone: "M5" },
  "POST /api/consents": { milestone: "M5" },
  "POST /api/invites/redeem": { milestone: "M5" },
  "GET /api/me/export": { milestone: "M7" },
  "DELETE /api/me": { milestone: "M7" },
  "POST /api/brief-drafts": { milestone: "M5" },
  "GET /api/brief-drafts/:id": { milestone: "M5" },
  "POST /api/projects": { milestone: "M5" },
  "GET /api/projects": { milestone: "M5" },
  "GET /api/projects/:id": { milestone: "M5" },
  "DELETE /api/projects/:id": { milestone: "M5" },
  "POST /api/projects/:id/generations": { milestone: "M5" },
  "GET /api/generations/:jobId": { milestone: "M5" },
  "POST /api/generations/:jobId/cancel": { milestone: "M5" },
  "POST /api/mockups/:id/select": { milestone: "M5" },
  "GET /api/mockups/:id": { milestone: "M5" },
  "POST /api/mockups/:id/versions": { milestone: "M6" },
  "POST /api/mockups/:id/restore": { milestone: "M6" },
  "POST /api/mockups/:id/feedback": { milestone: "M6" },
  "POST /api/mockups/:id/adoption-followup": { milestone: "M6" },
  "POST /api/mockup-versions/:id/exports": { milestone: "M6" },
  "GET /api/exports/:id": { milestone: "M6" },
  "POST /api/share": { milestone: "M6", req: ShareCreateReqSchema, res: ShareCreateResSchema },
  "PATCH /api/share/:shareId": { milestone: "M6" },
  "DELETE /api/share/:shareId": { milestone: "M6" },
  "GET /api/share/:shareId": { milestone: "M6" },
  "POST /api/share/:shareId/report": { milestone: "M7", req: ShareReportReqSchema, res: NoContent },
  "POST /api/support": { milestone: "M7" },
  "POST /api/rights-requests": {
    milestone: "M7",
    req: RightsRequestReqSchema,
    res: RightsRequestResSchema,
  },
  "GET /api/rights-requests/:id/verify": { milestone: "M7" },
  "POST /api/events": { milestone: "M4", req: EventBatchSchema, res: NoContent },
  "GET /api/admin/metrics": { milestone: "M7" },
  "GET /api/admin/jobs": { milestone: "M7" },
  "GET /api/admin/reports": { milestone: "M7" },
  "GET /api/admin/support": { milestone: "M7" },
  "GET /api/admin/users": { milestone: "M7" },
  "GET /api/admin/survey-items": { milestone: "M7" },
  "POST /api/admin/eval-sets": { milestone: "M7" },
  "GET /api/admin/audit-logs": { milestone: "M7" },
  "GET /api/health": { milestone: "M0", res: HealthResSchema },
};
/** 6.4.3 "local 전용" 표시 라우트(api-parity·AC-06-08 수집 제외). */
export const LOCAL_ONLY_ROUTES = ["/api/_storage/[...path]"] as const;
