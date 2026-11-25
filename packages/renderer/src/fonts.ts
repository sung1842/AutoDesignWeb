// 03장 3.7.4·3.7.5, 04장 CM-09: 시안별 폰트 계획(@font-face·preload). 순수(4.9.1): 파일을 만들지 않고
// "어떤 패밀리·웨이트를 어떤 글자 집합으로" 쓸지와 파일 경로(글자 집합 해시)만 정한다.
// 실제 woff2 서브셋은 node 쪽(@tastefit/assets/fonts-node, ASM-050)이 같은 계획으로 만든다.

export interface FontEntryLike {
  id: string;
  code: string;
  family: string;
  script: string;
  classification: string;
  subsetFamily: string;
}
export interface PairingLike {
  code: string;
  headingFontId: string;
  bodyFontId: string;
  headingLatinFontId?: string | null;
  labelFontId?: string | null;
}
export interface FontFace {
  family: string; // @font-face font-family = registry.subsetFamily
  fontId: string;
  code: string;
  script: string;
  classification: string;
  weight: number;
  role: "heading" | "body" | "emphasis" | "heading-latin" | "mono";
  preload: boolean;
  /** 페이지 기준 상대 경로(외부 요청 0, CM-09). */
  file: string;
}
export interface FontPlan {
  faces: FontFace[];
  /** 서브셋 글자(코드 포인트 오름차순, 중복 없음). */
  chars: string;
  hash: string;
}

/** 3.7.5 페이지 서브셋 기본 글자: ASCII 95 + 한글 문장부호. */
export const SUBSET_BASE =
  Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)).join("") + "「」·…–“”‘’";
/** 06장 6.8.3: 글꼴은 자산 오리진의 /fonts/ 아래(이미지는 /assets/). */
export const FONT_DIR = "/fonts";

/** FNV-1a 64비트(BigInt, 순수). 파일 이름용 결정적 해시. */
export function fnv64(s: string): string {
  let h = 0xcbf29ce484222325n;
  const P = 0x100000001b3n;
  for (const ch of s) {
    const cp = ch.codePointAt(0) ?? 0;
    for (const b of [cp & 0xff, (cp >> 8) & 0xff, (cp >> 16) & 0xff]) {
      h ^= BigInt(b);
      h = (h * P) & 0xffffffffffffffffn;
    }
  }
  return h.toString(16).padStart(16, "0");
}

/** 제어 문자(U+0000~U+001F)를 빼는 기준: 공백(U+0020)부터. */
const FIRST_PRINTABLE = " ".codePointAt(0) ?? 0;

export function subsetChars(text: string): string {
  const set = new Set<number>();
  for (const ch of SUBSET_BASE + text) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp >= FIRST_PRINTABLE) set.add(cp);
  }
  return [...set]
    .sort((a, b) => a - b)
    .map((c) => String.fromCodePoint(c))
    .join("");
}

export interface PlanInput {
  pairingId: string;
  headingWeight: number;
  emphasisWeight: number;
  pairings: PairingLike[];
  fonts: FontEntryLike[];
  /** 페이지 텍스트 전체(확정 트리 + 고정 문구). */
  text: string;
}

/** 시안당 ≤ 5파일: heading 1 + body 400 + emphasis + heading 라틴(선택) + mono(선택). preload = heading + body 400. */
export function fontPlan(inp: PlanInput): FontPlan {
  const pr = inp.pairings.find((p) => p.code === inp.pairingId);
  const chars = subsetChars(inp.text);
  const hash = fnv64(chars).slice(0, 12);
  if (!pr) return { faces: [], chars, hash };
  const byId = (id: string | null | undefined): FontEntryLike | undefined =>
    id ? inp.fonts.find((f) => f.id === id) : undefined;
  const out: FontFace[] = [];
  const add = (
    f: FontEntryLike | undefined,
    weight: number,
    role: FontFace["role"],
    preload: boolean,
  ): void => {
    if (!f) return;
    if (out.some((x) => x.fontId === f.id && x.weight === weight)) return;
    out.push({
      family: f.subsetFamily,
      fontId: f.id,
      code: f.code,
      script: f.script,
      classification: f.classification,
      weight,
      role,
      preload,
      file: `${FONT_DIR}/${f.code}-${weight}-${hash}.woff2`,
    });
  };
  add(byId(pr.headingFontId), inp.headingWeight, "heading", true);
  add(byId(pr.bodyFontId), 400, "body", true);
  add(byId(pr.bodyFontId), inp.emphasisWeight, "emphasis", false);
  add(byId(pr.headingLatinFontId), inp.headingWeight, "heading-latin", false);
  const mono = byId(pr.labelFontId);
  if (mono?.classification === "mono") add(mono, 400, "mono", false);
  return { faces: out, chars, hash };
}

/** 3.7.4 폴백 면(메트릭 오버라이드, CLS) + 계획의 @font-face. font-display: swap. */
export function fontFaceCss(plan: FontPlan): string {
  const fb = (name: string, locals: string[]): string =>
    `@font-face { font-family: "${name}"; src: ${locals.map((l) => `local("${l}")`).join(", ")}; size-adjust: 100%; ascent-override: 88%; descent-override: 22%; }`;
  const faces = plan.faces.map(
    (f) =>
      `@font-face { font-family: "${f.family}"; src: url("${f.file}") format("woff2"); font-weight: ${f.weight}; font-style: normal; font-display: swap; }`,
  );
  return [
    "/* TasteFit fonts.css (3.7.4·3.7.5) */",
    fb("tf-fb-sans", ["Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR"]),
    fb("tf-fb-serif", ["AppleMyungjo", "Batang", "Noto Serif KR"]),
    ...faces,
  ].join("\n");
}

/** CM-09 preload 링크(≤ 2). */
export function preloadLinks(plan: FontPlan): string {
  return plan.faces
    .filter((f) => f.preload)
    .slice(0, 2)
    .map((f) => `<link rel="preload" href="${f.file}" as="font" type="font/woff2" crossorigin>`)
    .join("");
}
