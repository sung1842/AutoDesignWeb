// 01장 1.5.5.2 BrandInput(단일 원천) + 1.5.5.3 검증·정규화. 06장 6.4.5 ①~③을 서버·클라이언트가 같은 함수로 쓴다.
// ④ maskPII·⑤ 남용 판정은 서버 전용(@tastefit/compliance).
import { z } from "zod";

export const PURPOSES = ["saas", "portfolio", "local_business"] as const;
export type Purpose = (typeof PURPOSES)[number];
export const PRIMARY_ACTIONS = [
  "signup",
  "demo",
  "download",
  "view_work",
  "resume",
  "reserve",
  "visit",
  "menu",
  "contact",
] as const;
export type PrimaryAction = (typeof PRIMARY_ACTIONS)[number];
/** 1.5.5.2 용도별 허용 primaryAction과 기본 라벨(표 순서). */
export const ACTIONS_BY_PURPOSE: Record<Purpose, Partial<Record<PrimaryAction, string>>> = {
  saas: {
    signup: "무료로 시작하기",
    demo: "데모 신청하기",
    download: "앱 내려받기",
    contact: "문의하기",
  },
  portfolio: { view_work: "작업 보기", contact: "작업 의뢰하기", resume: "이력 보기" },
  local_business: {
    reserve: "예약하기",
    visit: "오시는 길",
    menu: "메뉴 보기",
    contact: "문의하기",
  },
};
/** 1.5.5.2 길이 한도(grapheme, 정규화 후). */
export const BRAND_LIMITS = {
  name: [1, 30],
  description: [10, 80],
  primaryActionLabel: [2, 12],
  audience: [0, 40],
  keyPoint: [2, 40],
  keyPointsMax: 3,
  serializedMax: 2000,
} as const;

export type BrandInput = {
  name: string;
  description: string;
  primaryAction: PrimaryAction;
  primaryActionLabel?: string;
  audience?: string;
  keyPoints?: string[];
  brandColor?: string;
};

/** ① 파싱(미지 필드 거부). 문자열 원문 상한은 정규화 전 방어용(정규화 후 한도는 validateBrand). */
const Raw = z.string().max(1000);
export const BrandInputRawSchema = z
  .object({
    name: Raw,
    description: Raw,
    primaryAction: z.enum(PRIMARY_ACTIONS),
    primaryActionLabel: Raw.optional(),
    audience: Raw.optional(),
    keyPoints: z.array(Raw).max(10).optional(),
    brandColor: z.string().max(20).optional(),
  })
  .strict();
export type BrandInputRaw = z.infer<typeof BrandInputRawSchema>;

export const BriefDraftReqSchema = z
  .object({
    resultId: z.string().uuid(),
    purpose: z.enum(PURPOSES),
    brand: BrandInputRawSchema,
    useSampleContent: z.boolean(),
  })
  .strict();

// ---- ② 정규화 ----
const ENT: Record<string, string> = { lt: "<", gt: ">", amp: "&", quot: '"', apos: "'", nbsp: " " };
/** HTML 엔터티 1회 디코드(한 번의 치환 패스라 이중 인코딩은 한 겹만 벗겨진다). */
function decodeOnce(s: string): string {
  return s.replace(/&(#x[0-9a-f]{1,6}|#\d{1,7}|[a-z]{2,6});/gi, (m, e: string) => {
    if (e[0] === "#") {
      const cp = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : m;
    }
    return ENT[e.toLowerCase()] ?? m;
  });
}
/** ZWJ는 이모지 ZWJ 시퀀스 안(앞뒤가 그림 문자)만 남긴다(07장 TC-B-03 원문 유지, ASM-106). */
const ZWJ_OUTSIDE_EMOJI =
  /(?<!\p{Extended_Pictographic}[\u{FE0F}\u{1F3FB}-\u{1F3FF}]?)‍|‍(?!\p{Extended_Pictographic})/gu;

/** 06장 6.4.5 ②. multiline이면 \n을 남긴다(BrandInput에는 여러 줄 필드가 없다). */
export function normalizeText(s: string, multiline = false): string {
  let t = s.normalize("NFKC");
  t = t.replace(
    multiline ? /[\u0000-\u0009\u000B-\u001F\u007F-\u009F]/g : /[\u0000-\u001F\u007F-\u009F]/g,
    "",
  );
  t = t.replace(/[‪-‮⁦-⁩​‌﻿]/g, "").replace(ZWJ_OUTSIDE_EMOJI, "");
  t = decodeOnce(t);
  t = t.replace(/<[^>]{0,200}>/g, "");
  t = t.split("<<<BRAND_DATA_").join("");
  t = multiline ? t.replace(/[^\S\n]+/g, " ") : t.replace(/\s+/g, " ");
  return t.trim();
}

/** grapheme 수(Intl.Segmenter, 1.5.5.3 규칙 2). */
export function graphemes(s: string): number {
  return Array.from(new Intl.Segmenter("ko", { granularity: "grapheme" }).segment(s)).length;
}

export type BrandIssueCode =
  | "required"
  | "too_short"
  | "too_long"
  | "too_many"
  | "duplicate"
  | "url"
  | "color"
  | "action_purpose"
  | "serialized_too_long";
export interface BrandIssue {
  path: string;
  code: BrandIssueCode;
}
const URL_RE = /https?:\/\/|www\./i;
const COLOR_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

/**
 * ②정규화 + ③길이 재검사·1.5.5.3 규칙. path는 요청 본문 기준(`brand.name` 등, ASM-105 ②).
 * 선택 필드가 정규화 후 빈 값이면 없는 것으로 본다.
 */
export function validateBrand(
  purpose: Purpose,
  raw: BrandInputRaw,
): { ok: true; brand: BrandInput } | { ok: false; issues: BrandIssue[] } {
  const issues: BrandIssue[] = [];
  const P = "brand.";
  const text = (
    key: string,
    v: string,
    [min, max]: readonly [number, number],
    required: boolean,
  ) => {
    const t = normalizeText(v);
    const n = graphemes(t);
    if (!t) {
      if (required) issues.push({ path: P + key, code: "required" });
      return undefined;
    }
    if (URL_RE.test(t)) issues.push({ path: P + key, code: "url" });
    else if (n < min) issues.push({ path: P + key, code: "too_short" });
    else if (n > max) issues.push({ path: P + key, code: "too_long" });
    return t;
  };
  const name = text("name", raw.name, BRAND_LIMITS.name, true);
  const description = text("description", raw.description, BRAND_LIMITS.description, true);
  if (!(raw.primaryAction in ACTIONS_BY_PURPOSE[purpose]))
    issues.push({ path: P + "primaryAction", code: "action_purpose" });
  const label =
    raw.primaryActionLabel === undefined
      ? undefined
      : text("primaryActionLabel", raw.primaryActionLabel, BRAND_LIMITS.primaryActionLabel, false);
  const audience =
    raw.audience === undefined
      ? undefined
      : text("audience", raw.audience, BRAND_LIMITS.audience, false);
  let keyPoints: string[] | undefined;
  if (raw.keyPoints !== undefined) {
    const kp = raw.keyPoints
      .map((k, i) => text(`keyPoints.${i}`, k, BRAND_LIMITS.keyPoint, true))
      .filter((k): k is string => k !== undefined);
    if (raw.keyPoints.length > BRAND_LIMITS.keyPointsMax)
      issues.push({ path: P + "keyPoints", code: "too_many" });
    if (new Set(kp).size !== kp.length) issues.push({ path: P + "keyPoints", code: "duplicate" });
    keyPoints = kp.length ? kp : undefined;
  }
  let brandColor: string | undefined;
  if (raw.brandColor !== undefined && raw.brandColor !== "") {
    const c = raw.brandColor.trim();
    if (!COLOR_RE.test(c)) issues.push({ path: P + "brandColor", code: "color" });
    else {
      const h = c.slice(1).toUpperCase();
      brandColor = `#${h.length === 3 ? [...h].map((x) => x + x).join("") : h}`;
    }
  }
  if (issues.length || name === undefined || description === undefined)
    return { ok: false, issues };
  const brand: BrandInput = {
    name,
    description,
    primaryAction: raw.primaryAction,
    ...(label !== undefined ? { primaryActionLabel: label } : {}),
    ...(audience !== undefined ? { audience } : {}),
    ...(keyPoints !== undefined ? { keyPoints } : {}),
    ...(brandColor !== undefined ? { brandColor } : {}),
  };
  if (JSON.stringify(brand).length > BRAND_LIMITS.serializedMax)
    return { ok: false, issues: [{ path: "brand", code: "serialized_too_long" }] };
  return { ok: true, brand };
}
