// 04장 4.9 결정론적 컴파일러: DesignSpec + 확정 LayoutTree(PageSchema) → 정적 HTML 문자열.
// 순수·isomorphic(4.9.1): node API·DOM·날짜·난수 미사용(CM-14). 텍스트는 전부 이스케이프(CM-05).
// 블록 템플릿(CM-01)은 blocks/에 variant별로 등록하고, 없으면 일반 템플릿(generic)으로 그린다.
import { rootCss } from "@tastefit/design-spec/tokens-css";
import { stylesCss } from "./css/sources.js";
import { textRoleCss, type TextRole } from "./css/text-roles.js";
import { attrs, el, esc, join, raw, safeAnchor, type Html } from "./html.js";

/** 08장 8.x AI 고지(CM-16). */
export const GENERATOR_META = "TasteFit (AI-generated design draft)";
export const GENERATOR_COMMENT = "<!-- Generated with TasteFit (AI). See AI_NOTICE.md -->";
export const SKIP_LINK_KO = "본문으로 건너뛰기";

// --- 확정 트리 구조 타입(@tastefit/layout-schema PageSchema와 같은 모양, 런타임 의존 없음) ---
export interface PText {
  text: string;
  sub?: string;
  placeholder: boolean;
  deck_ref: string;
}
export type PSlot =
  | { copy: PText }
  | { list: { copy: PText }[] }
  | {
      image: {
        tag: string;
        ratio: string;
        asset_id: string;
        alt: string;
        focal: [number, number];
      };
    }
  | { link: { label: PText; target: string } };
export interface PSection {
  id: string;
  block: string;
  variant: string;
  bg: "bg" | "surface" | "inverse" | "image";
  pad: -1 | 0 | 1;
  slots: Record<string, PSlot | undefined>;
  role_overrides?: Record<string, string | undefined>;
}
export interface PTree {
  schemaVersion: "1";
  spec_id: string;
  pattern_id: string;
  nav: { variant: string; items: { label: string; target: string }[] };
  sections: PSection[];
  footer: { variant: string; slots: Record<string, PSlot | undefined> };
}
export interface SpecLike {
  spec_id: string;
  variant: string;
  type_id: string;
  purpose: string;
  theme: "light" | "dark";
  l2: Record<string, unknown>;
  tokens: Record<string, unknown>;
}

/** 블록 템플릿 문맥(CM-01 ctx). */
export interface BlockCtx {
  spec: SpecLike;
  section: PSection;
  headingId: string;
  /** 슬롯 요소 id(CM-04 data-slot-id): `<섹션>.<슬롯>[.<항목>]`. */
  slotId: (slot: string, i?: number) => string;
  /** 슬롯 텍스트 역할(blocks.json slots[].textRoles, 3.1.5a). 없으면 빈 배열. */
  roles: (slot: string) => string[];
}
export type BlockTemplate = (s: PSection, ctx: BlockCtx) => Html;

const TEMPLATES = new Map<string, BlockTemplate>();
/** variant 템플릿 등록(블록 모듈이 부른다). 키 = variant id(`hero.split`). */
export function registerTemplate(variantId: string, t: BlockTemplate): void {
  TEMPLATES.set(variantId, t);
}

// --- 슬롯 렌더 도우미 ---
const isCopy = (s: PSlot | undefined): s is { copy: PText } => !!s && "copy" in s;
const isList = (s: PSlot | undefined): s is { list: { copy: PText }[] } => !!s && "list" in s;
const isLink = (s: PSlot | undefined): s is { link: { label: PText; target: string } } =>
  !!s && "link" in s;
const isImage = (s: PSlot | undefined): s is Extract<PSlot, { image: unknown }> =>
  !!s && "image" in s;

/** 텍스트 요소. 모든 텍스트 노드는 data-role(3.1.5a)을 가진 요소 안에 있어야 한다(AC-03-42). */
export function textEl(tag: string, cls: string, slotId: string, t: PText, role: string): Html {
  return el(
    tag,
    {
      class: cls,
      "data-role": role,
      "data-slot-id": slotId,
      "data-placeholder": t.placeholder ? "true" : null,
    },
    t.text,
  );
}
/** 링크. 버튼(button.label)이면 라벨을 span[data-role][data-size]로 감싼다(3.5.1 C01, AC-03-46 ②). */
export function linkEl(
  cls: string,
  slotId: string,
  l: { label: PText; target: string },
  role = "button.label",
  size: "sm" | "md" | "lg" = "md",
): Html {
  const isButton = role === "button.label";
  return el(
    "a",
    {
      class: cls,
      href: safeAnchor(l.target),
      "data-role": isButton ? null : role,
      "data-slot-id": slotId,
      "data-placeholder": l.label.placeholder ? "true" : null,
    },
    isButton ? el("span", { "data-role": role, "data-size": size }, l.label.text) : l.label.text,
  );
}
/** 미디어 슬롯(C12). 실제 이미지 경로·srcset은 assets(M2-07)에서 붙는다. 지금은 자리표시 틀. */
export function mediaEl(slotId: string, img: Extract<PSlot, { image: unknown }>["image"]): Html {
  const ratio = img.ratio.replace(":", "-");
  return el("div", {
    class: `tf-media tf-media--${ratio} tf-media--placeholder`,
    role: img.alt ? "img" : null,
    "aria-label": img.alt || null,
    "aria-hidden": img.alt ? null : "true",
    "data-slot-id": slotId,
    "data-media-slot": img.tag,
    "data-asset-id": img.asset_id,
  });
}

/** 일반 템플릿: 슬롯 종류별로 순서대로 그린다(블록별 템플릿이 없을 때). */
export function genericBlock(s: PSection, ctx: BlockCtx): Html {
  const parts: Html[] = [];
  for (const [k, v] of Object.entries(s.slots)) {
    const rs = ctx.roles(k);
    if (isCopy(v))
      parts.push(textEl("p", `tf-${s.block}__${k}`, ctx.slotId(k), v.copy, rs[0] ?? "body"));
    else if (isLink(v))
      parts.push(
        linkEl(
          `tf-button tf-button--${k === "secondaryCta" ? "secondary" : "primary"}`,
          ctx.slotId(k),
          v.link,
          rs[0] ?? "button.label",
        ),
      );
    else if (isList(v))
      parts.push(
        el(
          "ul",
          { class: `tf-${s.block}__${k}` },
          ...v.list.map((it, i) =>
            el(
              "li",
              { class: `tf-${s.block}__item` },
              textEl(
                "h3",
                `tf-${s.block}__item-title`,
                ctx.slotId(k, i),
                it.copy,
                rs[0] ?? "item.title",
              ),
              ...(it.copy.sub !== undefined
                ? [
                    el(
                      "p",
                      {
                        class: `tf-${s.block}__item-body`,
                        "data-role": rs[1] ?? "body",
                        "data-slot-id": `${ctx.slotId(k, i)}.sub`,
                      },
                      it.copy.sub,
                    ),
                  ]
                : []),
            ),
          ),
        ),
      );
    else if (isImage(v)) parts.push(mediaEl(ctx.slotId(k), v.image));
  }
  return join(parts);
}

function sectionHtml(spec: SpecLike, s: PSection, data: DataLike): Html {
  const heading = headingFor(data, s.block);
  const headingId = `${s.id}-h`;
  const ctx: BlockCtx = {
    spec,
    section: s,
    headingId,
    slotId: (slot, i) => (i === undefined ? `${s.id}.${slot}` : `${s.id}.${slot}.${i}`),
    roles: (slot) => slotRoles(data, s.block, slot),
  };
  const tpl = TEMPLATES.get(s.variant) ?? genericBlock;
  const isHero = s.block === "hero";
  const head: Html[] = [];
  if (isHero) {
    const hl = s.slots.headline;
    if (isCopy(hl))
      head.push(
        el(
          "h1",
          {
            id: headingId,
            class: "tf-hero__headline",
            "data-role": "hero.headline",
            "data-slot-id": ctx.slotId("headline"),
            "data-placeholder": hl.copy.placeholder ? "true" : null,
          },
          hl.copy.text,
        ),
      );
  } else {
    const hl = s.slots.headline ?? s.slots.title;
    const text = isCopy(hl) ? hl.copy.text : (heading ?? s.block);
    head.push(
      el(
        "h2",
        {
          id: headingId,
          class:
            heading || isCopy(hl) ? "tf-section__title" : "tf-section__title tf-visually-hidden",
          "data-role": s.block === "cta" && isCopy(hl) ? "cta.headline" : "section.title",
          "data-slot-id": isCopy(hl) ? ctx.slotId(s.slots.headline ? "headline" : "title") : null,
        },
        text,
      ),
    );
  }
  const rest: PSection = {
    ...s,
    slots: Object.fromEntries(
      Object.entries(s.slots).filter(([k]) =>
        isHero ? k !== "headline" : !(k === "headline" || (k === "title" && !s.slots.headline)),
      ),
    ),
  };
  return el(
    "section",
    {
      id: s.id,
      class: `tf-section tf-${s.block} tf-${s.variant.replace(".", "--")}`,
      "data-block": s.block,
      "data-variant": s.variant,
      "data-section-id": s.id,
      "data-bg": s.bg,
      "data-pad": s.pad,
      "aria-labelledby": headingId,
    },
    el("div", { class: "tf-container" }, ...head, tpl(rest, ctx)),
  );
}

function navHtml(tree: PTree, brand: string): Html {
  const links = tree.nav.items.map((it) =>
    el(
      "a",
      { class: "tf-navbar__link", "data-role": "nav.link", href: safeAnchor(it.target) },
      it.label,
    ),
  );
  const drawerLinks = tree.nav.items.map((it) =>
    el(
      "a",
      { class: "tf-drawer__link", "data-role": "nav.link", href: safeAnchor(it.target) },
      it.label,
    ),
  );
  const v = tree.nav.variant.split(".")[1] ?? "split";
  return el(
    "header",
    { class: `tf-navbar tf-navbar--${v}`, "data-block": "nav", "data-variant": tree.nav.variant },
    el(
      "nav",
      { class: "tf-container tf-navbar__inner", "aria-label": "주요 메뉴" },
      el("a", { class: "tf-wordmark", "data-role": "nav.wordmark", href: "#main" }, brand),
      el("div", { class: "tf-navbar__links" }, ...links),
      el(
        "details",
        { class: "tf-drawer" },
        el(
          "summary",
          { "aria-label": "메뉴 열기" },
          el("span", { "data-role": "button.label", "data-size": "md" }, "메뉴"),
        ),
        el("div", { class: "tf-drawer__panel" }, ...drawerLinks),
      ),
    ),
  );
}

function footerHtml(tree: PTree): Html {
  const f = tree.footer;
  const v = f.variant.split(".")[1] ?? "minimal";
  const parts: Html[] = [];
  const s = f.slots;
  if (isCopy(s.wordmark))
    parts.push(
      textEl(
        "p",
        `tf-wordmark tf-wordmark--${v === "big-type" ? "big-type" : "footer"}`,
        "footer.wordmark",
        s.wordmark.copy,
        "footer.wordmark",
      ),
    );
  if (isCopy(s.tagline))
    parts.push(textEl("p", "tf-footer__tagline", "footer.tagline", s.tagline.copy, "body"));
  if (isList(s.links))
    parts.push(
      el(
        "ul",
        { class: "tf-footer__links" },
        ...s.links.list.map((it, i) =>
          el(
            "li",
            {},
            textEl("span", "tf-footer__link", `footer.links.${i}`, it.copy, "footer.link"),
          ),
        ),
      ),
    );
  if (isCopy(s.businessInfo))
    parts.push(
      textEl("p", "tf-footer__biz", "footer.businessInfo", s.businessInfo.copy, "footer.legal"),
    );
  return el(
    "footer",
    { class: `tf-footer tf-footer--${v}`, "data-block": "footer", "data-variant": f.variant },
    el("div", { class: "tf-container tf-footer__inner" }, ...parts),
  );
}

/** 블록 기본 제목(blocks.json default_heading_ko). data에서 읽는다. */
type DataLike =
  | {
      blocks?: {
        id: string;
        default_heading_ko?: string | null;
        slots?: { id: string; textRoles?: string[] }[];
      }[];
      textRoles?: TextRole[];
    }
  | undefined;
function headingFor(data: DataLike, block: string): string | null {
  return data?.blocks?.find((b) => b.id === block)?.default_heading_ko ?? null;
}
function slotRoles(data: DataLike, block: string, slot: string): string[] {
  return (
    data?.blocks?.find((b) => b.id === block)?.slots?.find((x) => x.id === slot)?.textRoles ?? []
  );
}
/** 토큰 세트에서 타입 단계의 데스크톱 px(3.1.5a nav.link 규칙용). */
function stepPx(tokens: Record<string, unknown>, key: string): number | undefined {
  const t = (tokens.type as Record<string, unknown> | undefined)?.[key] as
    { $value?: { fontSize?: { value?: number } } } | undefined;
  return t?.$value?.fontSize?.value;
}

/** CM-01~16 문서 조립. 같은 입력 → 같은 바이트(CM-14). */
export function compilePageImpl(spec: SpecLike, tree: PTree, data?: DataLike): { html: string } {
  const wm = tree.footer.slots.wordmark;
  const brand = isCopy(wm) ? wm.copy.text : "";
  const roleCss = data?.textRoles
    ? textRoleCss(data.textRoles, { smallPx: stepPx(spec.tokens, "small") })
    : undefined;
  const css = rootCss(spec.tokens, `TasteFit tokens-1 · ${spec.spec_id}`) + stylesCss(roleCss);
  const head = raw(
    `${GENERATOR_COMMENT}<meta charset="utf-8">` +
      `<meta name="viewport" content="width=device-width, initial-scale=1">` +
      `<meta name="generator" content="${esc(GENERATOR_META)}">` +
      `<title>${esc(brand)}</title><style>${css}</style>`,
  );
  const sections = tree.sections.map((s) => sectionHtml(spec, s, data));
  const depth = typeof spec.l2["depth.style"] === "string" ? spec.l2["depth.style"] : null;
  const body = join([
    el("a", { class: "tf-skip-link", "data-role": "nav.link", href: "#main" }, SKIP_LINK_KO),
    navHtml(tree, brand),
    el("main", { id: "main" }, ...sections),
    footerHtml(tree),
  ]);
  const html = `<!doctype html><html${attrs({
    lang: "ko",
    "data-theme": spec.theme,
    "data-depth": depth,
    "data-type": spec.type_id,
    "data-spec-id": spec.spec_id,
  })}><head>${head.__html}</head><body>${body.__html}</body></html>`;
  return { html };
}
