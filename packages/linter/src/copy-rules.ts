// 04장 4.6.3 카피 규칙 CP-01~CP-12 검사(확정 트리 기준, AC-04-13, ASM-081 ②·ASM-086).
// 표의 "검사" 칸이 AIL 규칙이면 그 규칙(단계 C)을 그대로 쓰고, 나머지는 여기서 판정한다.
import { judgeAbuse, normalizeAbuse } from "@tastefit/compliance";
import { EXAMPLE_PREFIX, isObj, norm, sentences } from "./lib.js";
import { lintAll } from "./rules.js";
import { copyOfTree } from "./tree-copy.js";
import type { CopyItem, Obj } from "./types.js";

export const COPY_RULES: readonly string[] = Array.from(
  { length: 12 },
  (_, i) => `CP-${String(i + 1).padStart(2, "0")}`,
);
/** 표 "검사" 칸의 AIL 규칙 대응. */
const VIA_AIL: Record<string, string[]> = {
  "CP-03": ["AIL-21"],
  "CP-04": ["AIL-21"],
  "CP-05": ["AIL-13"],
  "CP-07": ["AIL-19"],
  "CP-09": ["AIL-22"],
  "CP-12": ["AIL-23"],
};
/** 자리표시 접두(사람이 채울 문구, 08장 8.6). */
const PLACEHOLDER = /^\s*\[(예시|임시)\]/;
/** CP-06 종결 패턴(4.4 tone.ending). */
const ENDINGS: Record<string, RegExp> = {
  hamnida: /(니다|니까|십시오|세요)[.!?…]*$/u,
  haeyo: /요[.!?…]*$/u,
  plain: /(?<!니)다[.!?…]*$/u,
};
/** 종결 어미가 있는 문장(평서·청유·의문)만 CP-06 분모에 넣는다. */
const SENTENCE_END = /(다|요|까|시오)[.!?…]*$/u;
/** CP-06 기준 비율(≥ 90%, 표 원문). */
const CP06 = { minRatio: 0.9 } as const;
/** CP-02 입력 키워드 최소 글자 수. */
const KEYWORD = { minChars: 2 } as const;
/** CP-08: 라틴 단어 4개 이상 연속. */
const LATIN_RUN = /(?:[A-Za-z][A-Za-z'’-]*\s+){3,}[A-Za-z][A-Za-z'’-]*/;
/** CP-10 예시값 밖 연락처·사업자정보 패턴과 허용값(08장 8.7.5). */
const CONTACT: { re: RegExp; ok: string }[] = [
  { re: /\b0\d{1,2}-\d{3,4}-\d{4}\b/g, ok: "02-000-0000" },
  { re: /[\w.+-]+@[\w-]+\.[\w.]+/g, ok: "hello@example.com" },
  { re: /\b\d{3}-\d{2}-\d{5}\b/g, ok: "000-00-00000" },
];

export interface CopyRuleHit {
  rule: string;
  message: string;
}

const strs = (x: unknown): string[] =>
  Array.isArray(x) ? x.filter((v): v is string => typeof v === "string") : [];
function brandInput(brand: Obj | null): { name: string; texts: string[]; keys: string[] } {
  if (!brand) return { name: "", texts: [], keys: [] };
  const name = typeof brand.name === "string" ? norm(brand.name) : "";
  const texts = [
    typeof brand.description === "string" ? brand.description : "",
    ...strs(brand.keyPoints),
    ...strs(brand.key_points),
    typeof brand.audience === "string" ? brand.audience : "",
  ]
    .filter((t) => t && !PLACEHOLDER.test(t))
    .map(norm);
  // 입력 키워드 = 입력 문장의 2자 이상 어절 어근(조사 1~2자 제거 전 원형도 포함)
  const keys = [
    ...new Set(
      texts.flatMap((t) =>
        t
          .split(/[\s,.·]+/)
          .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ""))
          .filter((w) => w.length >= KEYWORD.minChars),
      ),
    ),
  ];
  return { name, texts, keys };
}

/** 확정 트리의 카피 규칙 위반. brand가 없으면 브랜드 입력 대조 규칙(CP-01·02)은 건너뛴다. */
export function copyRules(
  tree: unknown,
  opts: { brand?: unknown; spec?: unknown } = {},
): CopyRuleHit[] {
  const brand = isObj(opts.brand) ? opts.brand : null;
  const spec = isObj(opts.spec) ? opts.spec : null;
  const copy: CopyItem[] = copyOfTree(tree);
  const bi = brandInput(brand);
  const own = new Set(bi.texts);
  const out: CopyRuleHit[] = [];
  const add = (rule: string, message: string): void => void out.push({ rule, message });

  // AIL 경유 규칙(단계 C). 사용자 입력 원문 슬롯은 source user로 표시한다.
  const marked = copy.map((c) => (own.has(norm(c.text)) ? { ...c, source: "user" as const } : c));
  const lint = lintAll(
    { copy: marked, brand: brand ?? undefined, spec: spec ?? undefined },
    { stages: ["C"] },
  );
  for (const [cp, ails] of Object.entries(VIA_AIL))
    for (const f of lint.filter((x) => ails.includes(x.rule) && x.severity === "error"))
      add(cp, `${f.rule} ${f.message}`);
  if (lint.some((x) => x.rule === "AIL-19")) add("CP-07", "권유형 종결 페이지당 > 2");

  // CP-01 워드마크 = 브랜드명 원문(NFC)
  if (bi.name) {
    const wm = copy.filter((c) => /(^|\.)wordmark$/.test(c.role));
    for (const w of wm)
      if (norm(w.text) !== bi.name) add("CP-01", `${w.role} "${w.text}" ≠ 브랜드명 "${bi.name}"`);
    if (wm.length === 0 && !copy.some((c) => norm(c.text).includes(bi.name)))
      add("CP-01", "브랜드명이 카피에 없음");
  }
  // CP-02 hero 제목·부제에 브랜드명 또는 입력 키워드
  if (bi.name) {
    const hero = copy.filter((c) => /^hero\.(headline|sub)$/.test(c.role));
    const has = (t: string): boolean =>
      norm(t).includes(bi.name) || bi.keys.some((k) => norm(t).includes(k));
    if (hero.length > 0 && !hero.some((c) => has(c.text)))
      add("CP-02", "hero 제목·부제에 브랜드명·입력 키워드 없음");
  }
  // CP-06 종결어미 일치 비율(자리표시·사용자 원문 제외)
  const ending =
    spec && isObj(spec.copy) && typeof spec.copy.ending === "string" ? spec.copy.ending : null;
  const want = ending ? ENDINGS[ending] : undefined;
  if (want) {
    const ss = copy
      .filter(
        (c) => !PLACEHOLDER.test(c.text) && !EXAMPLE_PREFIX.test(c.text) && !own.has(norm(c.text)),
      )
      .flatMap((c) => sentences(c.text))
      .filter((s) => SENTENCE_END.test(s));
    const okN = ss.filter((s) => want.test(s)).length;
    if (ss.length > 0 && okN / ss.length < CP06.minRatio)
      add("CP-06", `종결어미(${ending}) 일치 ${okN}/${ss.length}`);
  }
  // CP-08 영문 문장 금지(브랜드명 제외)
  for (const c of copy) {
    const t = bi.name ? norm(c.text).split(bi.name).join(" ") : c.text;
    const m = LATIN_RUN.exec(t);
    if (m) add("CP-08", `${c.role} 영문 문장 "${m[0]}"`);
  }
  // CP-10 연락처·사업자정보 = 예시값
  for (const c of copy)
    for (const { re, ok } of CONTACT)
      for (const m of c.text.matchAll(re))
        if (m[0] !== ok) add("CP-10", `${c.role} 예시값 밖 "${m[0]}"`);
  // CP-11 타사 상표(고위험 브랜드 사전, 브랜드 입력에 있는 경우 제외)
  const inputText = [bi.name, ...bi.texts].join(" ");
  for (const v of judgeAbuse(copy.map((c) => c.text)))
    if (v.reason === "high_risk" && !normalizeAbuse(inputText).includes(normalizeAbuse(v.term)))
      add("CP-11", `타사 상표 "${v.term}"`);
  return out;
}
