// hero 6 variant 템플릿(03장 3.6.1·3.11.3, 04장 CM-01). 제목은 ctx.heading(컴파일러가 만든 h1)을 배치한다.
// 레이아웃 수치는 blocks.json text_cols(lg 12열 중)를 CSS 클래스로 옮긴 것(hero.css). ASM-044.
import {
  linkEl,
  mediaEl,
  registerTemplate,
  textEl,
  type BlockCtx,
  type PSection,
  type PSlot,
} from "../compile.js";
import { el, type Html } from "../html.js";

type Img = Extract<PSlot, { image: unknown }>["image"];
const copyOf = (v: PSlot | undefined) => (v && "copy" in v ? v.copy : null);
const linkOf = (v: PSlot | undefined) => (v && "link" in v ? v.link : null);
const imageOf = (v: PSlot | undefined): Img | null => (v && "image" in v ? v.image : null);

/** 텍스트 칼럼: eyebrow → 제목 → sub → CTA. */
function heroText(s: PSection, ctx: BlockCtx): Html {
  const eyebrow = copyOf(s.slots.eyebrow);
  const sub = copyOf(s.slots.sub);
  const p1 = linkOf(s.slots.primaryCta);
  const p2 = linkOf(s.slots.secondaryCta);
  const actions: Html[] = [];
  if (p1)
    actions.push(
      linkEl(
        "tf-button tf-button--primary tf-button--lg",
        ctx.slotId("primaryCta"),
        p1,
        "button.label",
        "lg",
      ),
    );
  if (p2)
    actions.push(
      linkEl(
        "tf-button tf-button--secondary tf-button--lg",
        ctx.slotId("secondaryCta"),
        p2,
        "button.label",
        "lg",
      ),
    );
  return el(
    "div",
    { class: "tf-hero__text" },
    ...(eyebrow
      ? [textEl("p", "tf-hero__eyebrow", ctx.slotId("eyebrow"), eyebrow, "eyebrow")]
      : []),
    ctx.heading,
    ...(sub ? [textEl("p", "tf-hero__sub", ctx.slotId("sub"), sub, "lead")] : []),
    ...(actions.length ? [el("div", { class: "tf-hero__actions" }, ...actions)] : []),
  );
}

function heroMedia(ctx: BlockCtx, img: Img | null, cls = "tf-hero__media"): Html[] {
  return img
    ? [el("div", { class: cls }, mediaEl(ctx, ctx.slotId("media"), img, { eager: true }))]
    : [];
}

const grid = (...parts: Html[]): Html => el("div", { class: "tf-hero__grid" }, ...parts);

function split(s: PSection, ctx: BlockCtx): Html {
  return grid(heroText(s, ctx), ...heroMedia(ctx, imageOf(s.slots.media)));
}
function typeOnly(s: PSection, ctx: BlockCtx): Html {
  return grid(heroText(s, ctx));
}
function leftAligned(s: PSection, ctx: BlockCtx): Html {
  return grid(heroText(s, ctx), ...heroMedia(ctx, imageOf(s.slots.media)));
}
function centered(s: PSection, ctx: BlockCtx): Html {
  return grid(heroText(s, ctx), ...heroMedia(ctx, imageOf(s.slots.media)));
}
/** offset: 주 4:5 + 보조 1:1. 스키마에 둘째 이미지 슬롯이 없어 같은 자산을 1:1로 잘라 장식으로 둔다(ASM-044). */
function offset(s: PSection, ctx: BlockCtx): Html {
  const img = imageOf(s.slots.media);
  const extra: Html[] = img
    ? [
        el(
          "div",
          { class: "tf-hero__media tf-hero__media--secondary", "aria-hidden": "true" },
          mediaEl(ctx, `${ctx.slotId("media")}.secondary`, { ...img, ratio: "1:1", alt: "" }),
        ),
      ]
    : [];
  return grid(heroText(s, ctx), ...heroMedia(ctx, img), ...extra);
}
/** full-bleed-image: 이미지와 텍스트를 같은 격자 칸에 겹친다(text_over_image, 스크림은 CSS). */
function fullBleed(s: PSection, ctx: BlockCtx): Html {
  const img = imageOf(s.slots.media);
  return el(
    "div",
    { class: "tf-hero__stage" },
    ...heroMedia(ctx, img, "tf-hero__media tf-hero__media--bleed"),
    el("div", { class: "tf-hero__overlay" }, heroText(s, ctx)),
  );
}

export const HERO_TEMPLATES: Readonly<Record<string, (s: PSection, ctx: BlockCtx) => Html>> = {
  "hero.split": split,
  "hero.type-only": typeOnly,
  "hero.full-bleed-image": fullBleed,
  "hero.left-aligned": leftAligned,
  "hero.offset": offset,
  "hero.centered": centered,
};

export function registerHero(): void {
  for (const [id, t] of Object.entries(HERO_TEMPLATES)) registerTemplate(id, t);
}
