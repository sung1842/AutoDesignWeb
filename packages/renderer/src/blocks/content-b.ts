// proof·pricing·faq·cta·menu variant 템플릿(03장 3.6.1·3.11.3, 04장 4.6.2 덱, CM-01). ASM-046.
// 목록 항목은 카피 {text, sub}뿐이라 필드 대응을 고정한다: proof = 인용/이름, pricing = 플랜/가격,
// faq = 질문/답, menu = 항목명/설명(가격은 4.6.2·D-0312 예시 표기 고정).
import { linkEl, registerTemplate, textEl, type BlockCtx, type PSection } from "../compile.js";
import { el, type Html } from "../html.js";
import { head, imageOf, linkOf, listOf, mediaBox } from "./common.js";

type Tpl = (s: PSection, ctx: BlockCtx) => Html;

/** 4.6.2 menu.groups 비고·03장 D-0312: 가격은 항상 예시 표기, placeholder. */
export const MENU_PRICE_PLACEHOLDER = "[예시] 0,000원";

const role = (ctx: BlockCtx, slot: string, i: number, fb: string): string =>
  ctx.roles(slot)[i] ?? fb;

/** 이름 첫 글자(아바타 이니셜, 장식). */
const initial = (name: string | undefined): string =>
  name ? (Array.from(name.trim())[0] ?? "") : "";

function quoteFig(s: PSection, ctx: BlockCtx, i: number, large: boolean): Html {
  const t = listOf(s.slots.items)[i];
  if (!t) return el("div", {});
  const id = ctx.slotId("items", i);
  const ini = initial(t.sub);
  return el(
    "figure",
    { class: `tf-proof__item${large ? " tf-proof__item--large" : ""}` },
    el(
      "blockquote",
      {
        class: "tf-proof__quote",
        "data-role": role(ctx, "items", 0, "quote"),
        "data-slot-id": id,
        "data-placeholder": t.placeholder ? "true" : null,
      },
      t.text,
    ),
    ...(t.sub !== undefined
      ? [
          el(
            "figcaption",
            { class: "tf-proof__by" },
            ...(!large && ini
              ? [
                  el(
                    "span",
                    {
                      class: "tf-avatar tf-avatar--sm",
                      "data-role": role(ctx, "items", 2, "avatar.initials"),
                      "aria-hidden": "true",
                    },
                    ini,
                  ),
                ]
              : []),
            el(
              "span",
              {
                class: "tf-proof__name",
                "data-role": role(ctx, "items", 1, "proof.name"),
                "data-slot-id": `${id}.sub`,
              },
              t.sub,
            ),
          ),
        ]
      : []),
  );
}

const proofQuoteLarge: Tpl = (s, ctx) =>
  el("div", { class: "tf-proof__wrap" }, head(ctx), quoteFig(s, ctx, 0, true));
const proofCards: Tpl = (s, ctx) =>
  el(
    "div",
    {},
    head(ctx),
    el(
      "div",
      { class: "tf-cols tf-proof__list" },
      ...listOf(s.slots.items).map((_, i) =>
        el("div", { class: "tf-card tf-proof__card" }, quoteFig(s, ctx, i, false)),
      ),
    ),
  );

/** 강조 플랜: 3개일 때 가운데 1개(≤ 1, 3.6.1). 모바일은 강조 플랜 먼저(3.11.3, CSS order). */
const featuredIndex = (n: number): number => (n === 3 ? 1 : -1);
function planEl(s: PSection, ctx: BlockCtx, i: number, featured: boolean): Html {
  const t = listOf(s.slots.plans)[i]!;
  const id = ctx.slotId("plans", i);
  return el(
    "li",
    {
      class: `tf-card tf-pricing__plan${featured ? " tf-pricing__plan--featured" : ""}`,
      "data-featured": featured ? "true" : null,
    },
    textEl("h3", "tf-pricing__name", id, t, role(ctx, "plans", 0, "pricing.plan")),
    ...(t.sub !== undefined
      ? [
          el(
            "p",
            {
              class: "tf-price tf-pricing__price",
              "data-role": role(ctx, "plans", 1, "pricing.price"),
              "data-slot-id": `${id}.sub`,
            },
            t.sub,
          ),
        ]
      : []),
  );
}
const pricingCards: Tpl = (s, ctx) => {
  const n = listOf(s.slots.plans).length;
  return el(
    "div",
    {},
    head(ctx),
    el(
      "ul",
      { class: "tf-cols tf-pricing__list" },
      ...listOf(s.slots.plans).map((_, i) => planEl(s, ctx, i, i === featuredIndex(n))),
    ),
  );
};
const pricingSingle: Tpl = (s, ctx) =>
  el(
    "div",
    { class: "tf-pricing__single" },
    head(ctx),
    el("ul", { class: "tf-pricing__list" }, planEl(s, ctx, 0, false)),
  );

function faqList(s: PSection, ctx: BlockCtx): Html {
  return el(
    "div",
    { class: "tf-accordion tf-accordion--bordered tf-faq__list" },
    ...listOf(s.slots.items).map((t, i) => {
      const id = ctx.slotId("items", i);
      return el(
        "details",
        { class: "tf-accordion__item" },
        el(
          "summary",
          {},
          el(
            "span",
            {
              "data-role": role(ctx, "items", 0, "accordion.question"),
              "data-slot-id": id,
              "data-placeholder": t.placeholder ? "true" : null,
            },
            t.text,
          ),
        ),
        ...(t.sub !== undefined
          ? [
              el(
                "div",
                { class: "tf-accordion__body" },
                el(
                  "p",
                  { "data-role": role(ctx, "items", 1, "body"), "data-slot-id": `${id}.sub` },
                  t.sub,
                ),
              ),
            ]
          : []),
      );
    }),
  );
}
const faqAccordion: Tpl = (s, ctx) =>
  el("div", { class: "tf-faq__narrow" }, head(ctx), faqList(s, ctx));
const faqTwoCol: Tpl = (s, ctx) =>
  el(
    "div",
    { class: "tf-split" },
    el("div", { class: "tf-split__main tf-faq__aside" }, head(ctx)),
    el("div", { class: "tf-split__aside" }, faqList(s, ctx)),
  );

function ctaActions(s: PSection, ctx: BlockCtx): Html[] {
  const l = linkOf(s.slots.primaryCta);
  return l
    ? [
        el(
          "div",
          { class: "tf-cta__actions" },
          linkEl(
            "tf-button tf-button--primary tf-button--lg",
            ctx.slotId("primaryCta"),
            l,
            role(ctx, "primaryCta", 0, "button.label"),
            "lg",
          ),
        ),
      ]
    : [];
}
const ctaBand: Tpl = (s, ctx) =>
  el("div", { class: "tf-cta__inner" }, ctx.heading, ...ctaActions(s, ctx));
const ctaBigType: Tpl = (s, ctx) =>
  el("div", { class: "tf-cta__inner" }, ctx.heading, ...ctaActions(s, ctx));
/** cta.image: blocks.json cta 슬롯에 media가 없어, 있으면 겹쳐 그리고 없으면 band와 같은 틀(fallback band, ASM-046). */
const ctaImage: Tpl = (s, ctx) => {
  const img = imageOf(s.slots.media);
  if (!img) return ctaBand(s, ctx);
  return el(
    "div",
    { class: "tf-hero__stage tf-cta__stage" },
    ...mediaBox(ctx, "media", img, "tf-hero__media tf-hero__media--bleed"),
    el("div", { class: "tf-hero__overlay tf-cta__inner" }, ctx.heading, ...ctaActions(s, ctx)),
  );
};

function menuItem(s: PSection, ctx: BlockCtx, i: number, leader: boolean): Html {
  const t = listOf(s.slots.groups)[i]!;
  const id = ctx.slotId("groups", i);
  const name = textEl("p", "tf-menu__name", id, t, role(ctx, "groups", 1, "menu.item"));
  const price = el(
    "p",
    {
      class: "tf-price tf-menu__price",
      "data-role": role(ctx, "groups", 3, "menu.price"),
      "data-placeholder": "true",
    },
    MENU_PRICE_PLACEHOLDER,
  );
  const desc =
    t.sub !== undefined
      ? [
          el(
            "p",
            {
              class: "tf-menu__desc",
              "data-role": role(ctx, "groups", 2, "menu.desc"),
              "data-slot-id": `${id}.sub`,
            },
            t.sub,
          ),
        ]
      : [];
  return el(
    "li",
    { class: `tf-menu__item${leader ? " tf-menu__item--leader" : ""}` },
    el(
      "div",
      { class: "tf-menu__line" },
      name,
      ...(leader ? [el("span", { class: "tf-menu__dots", "aria-hidden": "true" })] : []),
      price,
    ),
    ...desc,
  );
}
function menuList(s: PSection, ctx: BlockCtx, cls: string, leader: boolean): Html {
  return el(
    "ul",
    { class: `tf-menu__list ${cls}` },
    ...listOf(s.slots.groups).map((_, i) => menuItem(s, ctx, i, leader)),
  );
}
const menuLeader: Tpl = (s, ctx) =>
  el("div", { class: "tf-menu__narrow" }, head(ctx), menuList(s, ctx, "", true));
const menuCards: Tpl = (s, ctx) =>
  el("div", {}, head(ctx), menuList(s, ctx, "tf-menu__list--cards", false));
const menuColumns: Tpl = (s, ctx) =>
  el("div", {}, head(ctx), menuList(s, ctx, "tf-menu__list--columns", true));

export const CONTENT_B_TEMPLATES: Readonly<Record<string, Tpl>> = {
  "proof.quote-large": proofQuoteLarge,
  "proof.cards": proofCards,
  "pricing.cards": pricingCards,
  "pricing.single": pricingSingle,
  "faq.accordion": faqAccordion,
  "faq.two-col": faqTwoCol,
  "cta.band": ctaBand,
  "cta.big-type": ctaBigType,
  "cta.image": ctaImage,
  "menu.leader": menuLeader,
  "menu.cards": menuCards,
  "menu.columns": menuColumns,
};

export function registerContentB(): void {
  for (const [id, t] of Object.entries(CONTENT_B_TEMPLATES)) registerTemplate(id, t);
}
