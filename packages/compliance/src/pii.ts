// 08장 8.7.5 서버 마스킹 maskPII(M1~M7). 입력은 06장 6.4.5 ② 정규화(NFKC) 후 문자열.
// 적용 순서(ASM-106): 긴·구체적 패턴 먼저 — M3 이메일 → M4 식별번호 → M6 카드(Luhn) → M5 사업자번호 → M7 계좌 → M1 휴대전화 → M2 유선.
export type PiiKind = "phone" | "email" | "rrn" | "bizno" | "card" | "account";
export type PiiCounts = Partial<Record<PiiKind, number>>;

function luhn(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

const RULES: ReadonlyArray<{
  id: string;
  kind: PiiKind;
  re: RegExp;
  to: string;
  accept?: (m: string) => boolean;
}> = [
  {
    id: "M3",
    kind: "email",
    re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
    to: "[이메일]",
  },
  { id: "M4", kind: "rrn", re: /\d{6}[-\s]?[1-8]\d{6}/g, to: "[식별번호]" },
  {
    id: "M6",
    kind: "card",
    re: /\d(?:[-\s]?\d){12,18}/g,
    to: "[카드번호]",
    accept: (m) => luhn(m.replace(/\D/g, "")),
  },
  { id: "M5", kind: "bizno", re: /\d{3}-\d{2}-\d{5}/g, to: "[사업자번호]" },
  { id: "M7", kind: "account", re: /(계좌|입금)\s*[:：]?\s*[\d-]{10,}/g, to: "[계좌정보]" },
  { id: "M1", kind: "phone", re: /01[016789][-.\s]?\d{3,4}[-.\s]?\d{4}/g, to: "[전화번호]" },
  {
    id: "M2",
    kind: "phone",
    re: /(0\d{1,2}|1[568]\d{2})[-.\s]?\d{3,4}[-.\s]?\d{4}/g,
    to: "[전화번호]",
  },
];

/** 문자열 1개 마스킹. counts에 종류별 건수를 더한다. */
export function maskText(s: string, counts: PiiCounts = {}): string {
  let out = s;
  for (const r of RULES)
    out = out.replace(r.re, (m) => {
      if (r.accept && !r.accept(m)) return m;
      counts[r.kind] = (counts[r.kind] ?? 0) + 1;
      return r.to;
    });
  return out;
}

/** 객체·배열 안의 모든 문자열을 마스킹(키는 그대로). 반환 = 마스킹본과 종류별 건수(0은 키 없음). */
export function maskPII<T>(value: T): { value: T; counts: PiiCounts } {
  const counts: PiiCounts = {};
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") return maskText(v, counts);
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object")
      return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
    return v;
  };
  return { value: walk(value) as T, counts };
}
