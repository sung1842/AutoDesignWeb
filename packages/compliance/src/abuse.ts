// 08장 8.9.2 남용 판정(고위험 브랜드·피싱 문구·금지 업종). 판정 함수는 이 파일 하나(S-24): 브리프·편집 저장·G-13이 함께 쓴다.
// 원천: config/high_risk_brands.json(B21), config/prohibited_categories.json(B22). 피싱 문구는 8.9.2 목록.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { findRepoRoot } from "@tastefit/config";

export type AbuseReason = "high_risk" | "phishing_term" | "prohibited_category";
export interface AbuseViolation {
  reason: AbuseReason;
  /** 걸린 항목(브랜드 id·문구·범주 id). */
  ref: string;
  term: string;
  text: string;
}
interface Brand {
  id: string;
  canonical: string;
  aliases: string[];
  domains: string[];
}
interface Category {
  id: string;
  keywords: string[];
}
/** 8.9.2 피싱 문구 필터 목록. */
export const PHISHING_TERMS: readonly string[] = [
  "비밀번호",
  "보안카드",
  "OTP",
  "공인인증서",
  "본인인증",
  "계좌이체",
  "환급금",
  "미납",
  "정지 해제",
  "개인정보 입력",
  "로그인 확인",
];
/** 8.9.2 판정 (b) 포함 비교에 쓰는 alias 최소 길이. */
const ALIAS_CONTAIN_MIN = 3;

/** 8.9.2 정규화: NFKC → 소문자 → 공백·문장부호·(주)·주식회사·㈜ 제거. */
export function normalizeAbuse(s: string): string {
  return s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\(주\)|주식회사|㈜/g, "")
    .replace(/[\s\p{P}\p{S}]+/gu, "");
}

let DATA: { brands: Brand[]; cats: Category[] } | null = null;
function data(root: string): { brands: Brand[]; cats: Category[] } {
  if (DATA) return DATA;
  const read = <T>(f: string): T[] =>
    (JSON.parse(readFileSync(join(root, "config", f), "utf8")) as { items: T[] }).items;
  DATA = {
    brands: read<Brand>("high_risk_brands.json"),
    cats: read<Category>("prohibited_categories.json"),
  };
  return DATA;
}

/**
 * 텍스트 목록을 판정한다(G-13: 최종 트리의 모든 텍스트, 08장 8.9.2 입력별 적용 단계 표).
 * 고위험 브랜드는 canonical·길이 ≥ 3 alias 포함 또는 도메인 포함, 피싱 문구·금지 업종 키워드는 정규화 포함.
 */
export function judgeAbuse(
  texts: readonly string[],
  root: string = findRepoRoot(),
): AbuseViolation[] {
  const { brands, cats } = data(root);
  const out: AbuseViolation[] = [];
  for (const text of texts) {
    const n = normalizeAbuse(text);
    if (!n) continue;
    for (const b of brands) {
      const names = [b.canonical, ...b.aliases].map(normalizeAbuse).filter(Boolean);
      const hit =
        names.find((a) => a === n) ??
        names.find((a) => a.length >= ALIAS_CONTAIN_MIN && n.includes(a)) ??
        b.domains.map((d) => d.toLowerCase()).find((d) => text.toLowerCase().includes(d));
      if (hit) out.push({ reason: "high_risk", ref: b.id, term: hit, text });
    }
    for (const t of PHISHING_TERMS) {
      const k = normalizeAbuse(t);
      if (n.includes(k)) out.push({ reason: "phishing_term", ref: t, term: t, text });
    }
    for (const c of cats)
      for (const kw of c.keywords) {
        const k = normalizeAbuse(kw);
        if (k && n.includes(k)) {
          out.push({ reason: "prohibited_category", ref: c.id, term: kw, text });
          break;
        }
      }
  }
  return out;
}
