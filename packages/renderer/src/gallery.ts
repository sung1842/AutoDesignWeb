// 컴포넌트 갤러리(AC-03-15·17·46 ②, ASM-061): components.json 18종 × variant × state(true) 케이스.
// 상태는 정적 HTML로 강제한다: 층 CSS의 :hover·:active·:focus-visible을 [data-state=…]로 바꾼 사본을 덧붙이고,
// disabled·error·checked·open·expanded·placeholder는 실제 속성(disabled·aria-invalid·checked·open)으로 만든다.
import { documentHtml, type DataLike, type SpecLike } from "./compile.js";
import { el, raw, type Html } from "./html.js";
import { stylesCss } from "./css/sources.js";

interface ComponentDef {
  id: string;
  name: string;
  variants?: string[];
  states?: Record<string, unknown>;
}

const PSEUDO: readonly [RegExp, string][] = [
  [/:hover/g, '[data-state="hover"]'],
  [/:active/g, '[data-state="active"]'],
  [/:focus-visible/g, '[data-state="focus-visible"]'],
];
/** 상태 강제용 CSS 사본(층 CSS 중 상태 의사 클래스가 든 규칙만, 선택자를 속성으로 치환). */
export function forcedStateCss(): string {
  const css = stylesCss();
  const out: string[] = [];
  // 단순 규칙(중첩 없는 `선택자 { … }`)만 옮긴다. @media 안 상태 규칙은 갤러리 폭에서 다시 쓰지 않는다
  for (const m of css.matchAll(/([^{}@]+)\{([^{}]*)\}/g)) {
    const sel = m[1] ?? "";
    if (!/:hover|:active|:focus-visible/.test(sel)) continue;
    let s2 = sel;
    for (const [re, to] of PSEUDO) s2 = s2.replace(re, to);
    out.push(`${s2.trim()} {${m[2] ?? ""}}`);
  }
  return `/* gallery forced states */\n${out.join("\n")}\n`;
}

export interface GalleryCopy {
  button: string;
  tag: string;
  stat: string;
  text: string;
}
const COPY: Readonly<Record<"max" | "typical", GalleryCopy>> = {
  // AC-03-17 상한: Button 10·Tag 8·Stat 값 10자
  max: {
    button: "가".repeat(10),
    tag: "가".repeat(8),
    stat: "가".repeat(10),
    text: "가".repeat(24),
  },
  typical: { button: "시작하기", tag: "새 소식", stat: "98%", text: "자세히 보기" },
};

function caseHtml(c: ComponentDef, v: string, st: string, copy: GalleryCopy): Html {
  const ds = ["hover", "active", "focus-visible"].includes(st) ? st : null;
  const dis = st === "disabled";
  const err = st === "error";
  switch (c.name) {
    case "Button":
      return el(
        "button",
        { class: `tf-button tf-button--${v}`, type: "button", "data-state": ds, disabled: dis },
        el("span", { "data-role": "button.label", "data-size": "md" }, copy.button),
      );
    case "TextLink":
      return el(
        "a",
        {
          class: `tf-text-link${v === "standalone" ? " tf-text-link--standalone" : ""}`,
          href: "#main",
          "data-role": "body",
          "data-state": ds,
        },
        copy.text,
      );
    case "Tag":
      return el("span", { class: `tf-tag tf-tag--${v}`, "data-role": "tag.label" }, copy.tag);
    case "Input":
    case "Textarea":
    case "Select": {
      const id = `f-${c.id}-${v.replace(/\W/g, "")}-${st}`;
      const ctl =
        c.name === "Input"
          ? el("input", {
              class: "tf-input",
              id,
              type: "text",
              value: "입력값",
              disabled: dis,
              "aria-invalid": err ? "true" : null,
              "data-state": ds,
              "data-role": "form.input",
            })
          : c.name === "Textarea"
            ? el(
                "textarea",
                {
                  class: "tf-textarea",
                  id,
                  rows: 2,
                  disabled: dis,
                  "aria-invalid": err ? "true" : null,
                  "data-state": ds,
                  "data-role": "form.input",
                },
                "입력값",
              )
            : el(
                "div",
                { class: "tf-select-wrap" },
                el(
                  "select",
                  {
                    class: "tf-select",
                    id,
                    disabled: dis,
                    "aria-invalid": err ? "true" : null,
                    "data-state": ds,
                    "data-role": "form.input",
                  },
                  el("option", {}, "선택"),
                ),
              );
      return el(
        "div",
        { class: `tf-field${err ? " tf-field--error" : ""}` },
        el("label", { class: "tf-field__label", for: id, "data-role": "form.label" }, "이름"),
        ctl,
        el(
          "p",
          { class: "tf-field__help", "data-role": err ? "form.error" : "form.help" },
          err ? "다시 확인해 주세요" : "도움말",
        ),
      );
    }
    case "Checkbox":
      return el(
        "label",
        { class: "tf-checkbox" },
        el("input", {
          class: "tf-checkbox__box",
          type: "checkbox",
          checked: st === "checked/selected",
          disabled: dis,
          "aria-invalid": err ? "true" : null,
          "data-state": ds,
        }),
        el("span", { "data-role": "form.label" }, "동의합니다"),
      );
    case "NavBar":
      return el(
        "header",
        { class: `tf-navbar tf-navbar--${v}` },
        el(
          "nav",
          { class: "tf-navbar__inner", "aria-label": "주요 메뉴" },
          el("a", { class: "tf-wordmark", "data-role": "nav.wordmark", href: "#main" }, "한결"),
          el(
            "div",
            { class: "tf-navbar__links" },
            el(
              "a",
              {
                class: "tf-navbar__link",
                "data-role": "nav.link",
                href: "#main",
                "data-state": ds,
                "aria-current": st === "checked/selected" ? "true" : null,
              },
              "메뉴",
            ),
          ),
        ),
      );
    case "Drawer":
      return el(
        "details",
        { class: "tf-drawer tf-drawer--gallery", open: st === "open" },
        el(
          "summary",
          { "aria-label": "메뉴 열기", "data-state": ds },
          el("span", { "data-role": "button.label", "data-size": "md" }, "메뉴"),
        ),
        el(
          "div",
          { class: "tf-drawer__panel" },
          el("a", { class: "tf-drawer__link", "data-role": "nav.link", href: "#main" }, "소개"),
        ),
      );
    case "Footer":
      return el(
        "footer",
        { class: `tf-footer tf-footer--${v}` },
        el(
          "div",
          { class: "tf-footer__inner" },
          el(
            "p",
            {
              class: `tf-wordmark tf-wordmark--${v === "big-type" ? "big-type" : "footer"}`,
              "data-role": "footer.wordmark",
            },
            "한결",
          ),
          el(
            "p",
            { class: "tf-footer__biz", "data-role": "footer.legal" },
            "상호 한결 · 000-00-00000",
          ),
        ),
      );
    case "Card":
      return el(
        "article",
        {
          class: `tf-card${v === "plain" ? "" : ` tf-card--${v}`}`,
          "data-state": ds,
          tabindex: ds === "focus-visible" ? 0 : null,
        },
        ...(v === "plain"
          ? []
          : [
              el(
                "div",
                { class: "tf-media tf-media--3-2 tf-shape tf-shape--g1", "aria-hidden": "true" },
                el("span", { class: "tf-shape__r tf-shape__r--1" }),
              ),
            ]),
        el(
          "div",
          { class: "tf-card__body" },
          el("h3", { "data-role": "card.title" }, "카드 제목"),
          el("p", { "data-role": "body" }, copy.text),
        ),
      );
    case "MediaFrame":
      return el(
        "figure",
        {},
        el("div", {
          class: `tf-media tf-media--${v.replace(":", "-")}${st === "placeholder" ? " tf-media--placeholder" : " tf-shape tf-shape--g2"}`,
          role: "img",
          "aria-label": "장면 이미지 자리",
        }),
        el("figcaption", { "data-role": "caption" }, `장면 · ${v}`),
      );
    case "Avatar":
      return el(
        "span",
        { class: "tf-avatar", "data-role": "avatar.initials", "aria-hidden": null },
        "김",
      );
    case "PriceTag":
      return el(
        "p",
        { class: "tf-price", "data-role": "pricing.price" },
        "월 9,900원",
        ...(v === "per-period" ? [el("span", { class: "tf-price__period" }, " / 월")] : []),
      );
    case "Stat":
      return el(
        "div",
        { class: "tf-stat" },
        el("p", { class: "tf-stat__value", "data-role": "stat.value" }, copy.stat),
        el("p", { class: "tf-stat__label", "data-role": "stat.label" }, "재방문율"),
        ...(v === "value+label+note"
          ? [el("p", { class: "tf-stat__note", "data-role": "caption" }, "2026년 기준")]
          : []),
      );
    case "Accordion":
      return el(
        "div",
        { class: `tf-accordion tf-accordion--${v}` },
        el(
          "details",
          { class: "tf-accordion__item", open: st === "expanded" },
          el(
            "summary",
            { "data-state": ds },
            el("span", { "data-role": "accordion.question" }, "자주 묻는 질문"),
          ),
          el(
            "div",
            { class: "tf-accordion__body" },
            el("p", { "data-role": "body" }, "답변 내용입니다."),
          ),
        ),
      );
    case "Divider":
      return v === "ornament"
        ? el(
            "div",
            { class: "tf-divider--ornament", role: "separator", "data-role": "caption" },
            "· · ·",
          )
        : el("hr", { class: `tf-divider--${v}` });
    case "Wordmark":
      return el("p", { class: "tf-wordmark", "data-role": "nav.wordmark" }, "한결");
    default:
      return raw("");
  }
}

/** 갤러리 페이지와 케이스 id 목록(`<컴포넌트>.<variant>.<state>`). */
export function renderComponentGalleryImpl(
  spec: SpecLike,
  data: DataLike,
  components: ComponentDef[],
  copyKind: "max" | "typical",
): { html: string; cases: string[] } {
  const copy = COPY[copyKind];
  const cases: string[] = [];
  const parts: Html[] = [];
  for (const c of components) {
    const states = Object.entries(c.states ?? {})
      .filter(([, v]) => v === true)
      .map(([k]) => k);
    const variants = (c.variants ?? []).length ? (c.variants ?? []) : ["default"];
    for (const v of variants)
      for (const st of states) {
        const id = `${c.id}.${v}.${st}`;
        cases.push(id);
        parts.push(
          el("div", { class: "tf-gallery-case", "data-case": id }, caseHtml(c, v, st, copy)),
        );
      }
  }
  const body = el(
    "main",
    { id: "main" },
    el("div", { class: "tf-container tf-gallery-grid" }, ...parts),
  );
  const extra =
    forcedStateCss() +
    ".tf-gallery-grid { display: grid; gap: var(--tf-space-6); padding-block: var(--tf-space-8); }\n" +
    ".tf-gallery-case { min-width: 0; }\n" +
    ".tf-drawer--gallery .tf-drawer__panel { position: static; width: auto; box-shadow: none; }\n" +
    ".tf-drawer--gallery[open]::before { content: none; }\n";
  return { html: documentHtml(spec, body, "한결", data, undefined, extra).html, cases };
}
