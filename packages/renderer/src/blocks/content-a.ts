// value·feature·showcase·stats·process variant 템플릿(03장 3.6.1·3.11.3, CM-01). ASM-045.
import { registerTemplate, textEl, type BlockCtx, type PSection } from "../compile.js";
import { el, type Html } from "../html.js";
import {
  copyOf,
  head,
  iconEl,
  ICON_GRID_DEFAULTS,
  imageOf,
  itemEl,
  listEl,
  listOf,
  mediaBox,
} from "./common.js";

type Tpl = (s: PSection, ctx: BlockCtx) => Html;

const valueNumbered: Tpl = (s, ctx) =>
  el(
    "div",
    {},
    head(ctx),
    listEl(s, ctx, "items", { index: true, listTag: "ol", listCls: "tf-value__list tf-cols" }),
  );
const valueRuleList: Tpl = (s, ctx) =>
  el("div", {}, head(ctx), listEl(s, ctx, "items", { listCls: "tf-value__list tf-rule-list" }));
const valueIconGrid: Tpl = (s, ctx) =>
  el(
    "div",
    {},
    head(ctx),
    el(
      "ul",
      { class: "tf-value__list tf-cols" },
      ...listOf(s.slots.items).map((t, i) =>
        el(
          "li",
          { class: "tf-value__item" },
          iconEl(
            ctx,
            (ICON_GRID_DEFAULTS[ctx.spec.purpose] ?? ICON_GRID_DEFAULTS.saas ?? [])[i % 4] ??
              "check",
            32,
          ),
          itemEl(s, ctx, "items", i, t, { tag: "div", cls: "tf-value__item-text" }),
        ),
      ),
    ),
  );
const valueBento: Tpl = (s, ctx) =>
  el(
    "div",
    {},
    head(ctx),
    listEl(s, ctx, "items", {
      listCls: "tf-value__list tf-bento",
      cls: "tf-value__item tf-bento__cell",
    }),
  );

/** zigzag: 항목마다 텍스트·미디어 교차. 항목별 이미지 슬롯이 없어 미디어는 첫 항목에만(ASM-045 ②). */
const featureZigzag: Tpl = (s, ctx) => {
  const img = imageOf(s.slots.media);
  return el(
    "div",
    {},
    head(ctx),
    el(
      "ul",
      { class: "tf-feature__rows" },
      ...listOf(s.slots.items).map((t, i) =>
        el(
          "li",
          { class: `tf-feature__row${i % 2 ? " tf-feature__row--reverse" : ""}` },
          itemEl(s, ctx, "items", i, t, { tag: "div", cls: "tf-feature__text" }),
          ...(i === 0 ? mediaBox(ctx, "media", img, "tf-feature__media") : []),
        ),
      ),
    ),
  );
};
const featureStack: Tpl = (s, ctx) =>
  el(
    "div",
    {},
    head(ctx),
    ...mediaBox(ctx, "media", imageOf(s.slots.media), "tf-feature__media tf-feature__media--wide"),
    listEl(s, ctx, "items", { listCls: "tf-feature__list tf-cols" }),
  );
const featureSplitList: Tpl = (s, ctx) =>
  el(
    "div",
    { class: "tf-split" },
    el(
      "div",
      { class: "tf-split__main" },
      head(ctx),
      listEl(s, ctx, "items", { listCls: "tf-feature__list tf-rule-list" }),
    ),
    ...mediaBox(ctx, "media", imageOf(s.slots.media), "tf-split__aside tf-feature__media"),
  );

function showcase(framed: boolean): Tpl {
  return (s, ctx) => {
    const cap = copyOf(s.slots.caption);
    const rs = ctx.roles("caption");
    return el(
      "div",
      {},
      head(ctx),
      el(
        "figure",
        { class: `tf-showcase__figure${framed ? " tf-showcase__figure--framed" : ""}` },
        ...mediaBox(ctx, "media", imageOf(s.slots.media), "tf-showcase__media"),
        ...(cap
          ? [
              textEl(
                "figcaption",
                "tf-showcase__caption",
                ctx.slotId("caption"),
                cap,
                rs[0] ?? "caption",
              ),
            ]
          : []),
      ),
    );
  };
}

const statsList = (s: PSection, ctx: BlockCtx, cls: string): Html =>
  listEl(s, ctx, "items", { titleTag: "p", listCls: `tf-stats__list ${cls}` });
const statsRow: Tpl = (s, ctx) =>
  el("div", {}, head(ctx), statsList(s, ctx, "tf-stats__list--row"));
const statsSplit: Tpl = (s, ctx) =>
  el(
    "div",
    { class: "tf-split" },
    el("div", { class: "tf-split__main" }, head(ctx)),
    el("div", { class: "tf-split__aside" }, statsList(s, ctx, "tf-stats__list--grid")),
  );

const processHorizontal: Tpl = (s, ctx) =>
  el(
    "div",
    {},
    head(ctx),
    listEl(s, ctx, "items", { index: true, listTag: "ol", listCls: "tf-process__list tf-cols" }),
  );
const processVertical: Tpl = (s, ctx) =>
  el(
    "div",
    {},
    head(ctx),
    listEl(s, ctx, "items", {
      index: true,
      listTag: "ol",
      listCls: "tf-process__list tf-process__list--vertical",
    }),
  );

export const CONTENT_A_TEMPLATES: Readonly<Record<string, Tpl>> = {
  "value.numbered": valueNumbered,
  "value.rule-list": valueRuleList,
  "value.icon-grid": valueIconGrid,
  "value.bento": valueBento,
  "feature.zigzag": featureZigzag,
  "feature.stack": featureStack,
  "feature.split-list": featureSplitList,
  "showcase.wide": showcase(false),
  "showcase.framed": showcase(true),
  "stats.row": statsRow,
  "stats.split": statsSplit,
  "process.horizontal": processHorizontal,
  "process.vertical": processVertical,
};

export function registerContentA(): void {
  for (const [id, t] of Object.entries(CONTENT_A_TEMPLATES)) registerTemplate(id, t);
}
