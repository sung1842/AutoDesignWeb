// HTML 출력 도우미(04장 CM-05: 모든 텍스트는 이스케이프 후 삽입, 원시 HTML 삽입 API 없음).
const ESC: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** 텍스트·속성 값 공용 이스케이프. */
export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ESC[c] ?? c);
}

/** 이스케이프된 HTML 조각. 문자열을 그대로 넣는 경로를 타입으로 막는다. */
export interface Html {
  readonly __html: string;
}
export const raw = (s: string): Html => ({ __html: s });
export const join = (parts: readonly Html[], sep = ""): Html =>
  raw(parts.map((p) => p.__html).join(sep));

type AttrVal = string | number | boolean | null | undefined;

/** 속성 문자열. 키는 정렬하지 않고 주어진 순서(결정적). on* 키·style 키는 거부(CM-03·05). */
export function attrs(a: Record<string, AttrVal>): string {
  let out = "";
  for (const [k, v] of Object.entries(a)) {
    if (v === null || v === undefined || v === false) continue;
    if (/^on/i.test(k) || k === "style") throw new Error(`금지 속성 ${k}`);
    out += v === true ? ` ${k}` : ` ${k}="${esc(String(v))}"`;
  }
  return out;
}

/** 요소. children은 Html 또는 이스케이프할 문자열. */
export function el(tag: string, a: Record<string, AttrVal>, ...children: (Html | string)[]): Html {
  const body = children.map((c) => (typeof c === "string" ? esc(c) : c.__html)).join("");
  return raw(`<${tag}${attrs(a)}>${body}</${tag}>`);
}

/** 페이지 내 앵커만 허용(04장 4.5.2, CM-05). 아니면 null. */
export function safeAnchor(target: string): string | null {
  return /^#[a-z0-9][a-z0-9-]{0,63}$/.test(target) ? target : null;
}
