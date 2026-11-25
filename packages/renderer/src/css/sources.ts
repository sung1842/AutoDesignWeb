// CSS 층 레지스트리(04장 CM-02). tokens.css·theme.css는 design-spec exportTokens가 만들고,
// 여기는 base·components·blocks·signatures 층만 둔다. 문자열 모듈이라 isomorphic(4.9.1).
import { BASE_CSS } from "./base.js";
import {
  ACCORDION_CSS,
  BUTTON_CSS,
  CARD_CSS,
  CHECKBOX_CSS,
  DATA_CSS,
  FIELD_CSS,
  FOOTER_CSS,
  MEDIA_CSS,
  MISC_CSS,
  NAVBAR_CSS,
  TAG_CSS,
  TEXT_LINK_CSS,
} from "./components.js";
import { CONTENT_A_CSS, LAYOUT_CSS } from "./blocks/content-a.js";
import { CHROME_CSS } from "./blocks/chrome.js";
import { CONTENT_B_CSS } from "./blocks/content-b.js";
import { CONTENT_C_CSS } from "./blocks/content-c.js";
import { HERO_CSS } from "./blocks/hero.js";
import { MEDIA_BLOCK_CSS } from "./blocks/media.js";

export interface CssSource {
  path: string;
  css: string;
}

const SOURCES: readonly CssSource[] = [
  { path: "base.css", css: BASE_CSS },
  { path: "components/button.css", css: BUTTON_CSS },
  { path: "components/text-link.css", css: TEXT_LINK_CSS },
  { path: "components/tag.css", css: TAG_CSS },
  { path: "components/field.css", css: FIELD_CSS },
  { path: "components/checkbox.css", css: CHECKBOX_CSS },
  { path: "components/navbar.css", css: NAVBAR_CSS },
  { path: "components/footer.css", css: FOOTER_CSS },
  { path: "components/card.css", css: CARD_CSS },
  { path: "components/media.css", css: MEDIA_CSS },
  { path: "components/data.css", css: DATA_CSS },
  { path: "components/accordion.css", css: ACCORDION_CSS },
  { path: "components/misc.css", css: MISC_CSS },
  { path: "blocks/layout.css", css: LAYOUT_CSS },
  { path: "blocks/media.css", css: MEDIA_BLOCK_CSS },
  { path: "blocks/hero.css", css: HERO_CSS },
  { path: "blocks/content-a.css", css: CONTENT_A_CSS },
  { path: "blocks/content-b.css", css: CONTENT_B_CSS },
  { path: "blocks/content-c.css", css: CONTENT_C_CSS },
  { path: "blocks/nav-footer.css", css: CHROME_CSS },
];

/** 층 순서(base → components → blocks → signatures)대로 반환한다. */
export function rendererCssSources(): CssSource[] {
  return SOURCES.map((s) => ({ ...s }));
}

/** styles.css 본문(층 순서 연결). tokens.css는 앞에 따로 붙인다.
 *  textRoles(text-roles.css, 스펙마다 생성)는 components 층 뒤·blocks 층 앞에 넣는다(ASM-043). */
export function stylesCss(textRoles?: string): string {
  const parts = SOURCES.map((s) => s.css);
  if (textRoles !== undefined) {
    let at = 0;
    SOURCES.forEach((s, i) => {
      if (s.path === "base.css" || s.path.startsWith("components/")) at = i + 1;
    });
    parts.splice(at, 0, textRoles);
  }
  return parts.join("\n");
}
