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
/** 8.9.2 사양 상수(thresholds 아님): (b) 포함 비교 alias 최소 길이, (c) 편집 거리 비교 alias 최소 길이·허용 거리. */
const MATCH = { containMin: 3, editMin: 5, editMax: 1 } as const;
/** 8.9.2 정규화의 접미 분리 비교 대상. */
const SUFFIX = /(은행|bank|카드|card|증권|공식|official)+$/u;

/** 편집 거리가 max 이하인지(Levenshtein, 길이 차 > max면 바로 거짓). */
export function withinEdit(a: string, b: string, max: number): boolean {
  const A = [...a];
  const B = [...b];
  if (Math.abs(A.length - B.length) > max) return false;
  let prev = Array.from({ length: B.length + 1 }, (_, j) => j);
  for (let i = 1; i <= A.length; i++) {
    const cur = [i];
    for (let j = 1; j <= B.length; j++)
      cur[j] = Math.min(
        (prev[j] ?? 0) + 1,
        (cur[j - 1] ?? 0) + 1,
        (prev[j - 1] ?? 0) + (A[i - 1] === B[j - 1] ? 0 : 1),
      );
    prev = cur;
  }
  return (prev[B.length] ?? Infinity) <= max;
}

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

/** 8.9.2 (a) 완전 일치(접미 분리 포함) (b) 길이 ≥ 3 alias 포함 (c) 길이 ≥ 5 alias와 편집 거리 ≤ 1. */
function nameHit(names: readonly string[], n: string): string | undefined {
  const bare = n.replace(SUFFIX, "");
  return (
    names.find((a) => a === n || (bare && a.replace(SUFFIX, "") === bare)) ??
    names.find((a) => a.length >= MATCH.containMin && n.includes(a)) ??
    names.find((a) => [...a].length >= MATCH.editMin && withinEdit(a, n, MATCH.editMax))
  );
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
        nameHit(names, n) ??
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

/** 브리프 필드(06장 6.4.5 ⑤, 08장 8.9.2 입력별 적용 단계 표). 값은 정규화(6.4.5 ②) 후. */
export interface BriefTexts {
  name: string;
  description: string;
  keyPoints?: readonly string[];
  audience?: string;
}
/**
 * 브리프 판정: 고위험 (a)~(c)는 브랜드명, (d) 도메인은 브랜드명·한 줄 소개·강점, 피싱 문구는 한 줄 소개·강점·주요 고객,
 * 금지 업종은 브랜드명·한 줄 소개·강점·주요 고객. 첫 위반 1건(없으면 null). 우선순위 high_risk → phishing_term → prohibited_category.
 */
export function judgeBrief(b: BriefTexts, root: string = findRepoRoot()): AbuseViolation | null {
  const { brands, cats } = data(root);
  const kp = b.keyPoints ?? [];
  const n = normalizeAbuse(b.name);
  for (const br of brands) {
    const names = [br.canonical, ...br.aliases].map(normalizeAbuse).filter(Boolean);
    const hit = n ? nameHit(names, n) : undefined;
    if (hit) return { reason: "high_risk", ref: br.id, term: hit, text: b.name };
    for (const t of [b.name, b.description, ...kp])
      for (const d of br.domains)
        if (d && t.toLowerCase().includes(d.toLowerCase()))
          return { reason: "high_risk", ref: br.id, term: d, text: t };
  }
  for (const t of [b.description, ...kp, b.audience ?? ""]) {
    const x = normalizeAbuse(t);
    if (!x) continue;
    for (const p of PHISHING_TERMS)
      if (x.includes(normalizeAbuse(p)))
        return { reason: "phishing_term", ref: p, term: p, text: t };
  }
  for (const t of [b.name, b.description, ...kp, b.audience ?? ""]) {
    const x = normalizeAbuse(t);
    if (!x) continue;
    for (const c of cats)
      for (const kw of c.keywords) {
        const k = normalizeAbuse(kw);
        if (k && x.includes(k))
          return { reason: "prohibited_category", ref: c.id, term: kw, text: t };
      }
  }
  return null;
}
