// CSS 층 레지스트리(04장 CM-02). tokens.css·theme.css는 design-spec exportTokens가 만들고,
// 여기는 base·components·blocks·signatures 층만 둔다. 문자열 모듈이라 isomorphic(4.9.1).
import { BASE_CSS } from "./base.js";
import { BUTTON_CSS, TEXT_LINK_CSS } from "./components.js";

export interface CssSource {
  path: string;
  css: string;
}

const SOURCES: readonly CssSource[] = [
  { path: "base.css", css: BASE_CSS },
  { path: "components/button.css", css: BUTTON_CSS },
  { path: "components/text-link.css", css: TEXT_LINK_CSS },
];

/** 층 순서(base → components → blocks → signatures)대로 반환한다. */
export function rendererCssSources(): CssSource[] {
  return SOURCES.map((s) => ({ ...s }));
}

/** styles.css 본문(층 순서 연결). tokens.css는 앞에 따로 붙인다. */
export function stylesCss(): string {
  return SOURCES.map((s) => s.css).join("\n");
}
