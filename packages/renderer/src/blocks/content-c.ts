// highlight·gallery·location·story·about·service·contact variant 템플릿(03장 3.6.1·3.11.3, CM-01). ASM-047.
// 이미지 슬롯은 블록당 1개(PageSchema)라 여러 장을 요구하는 variant는 첫 칸만 실제 이미지, 나머지는
// 빈 자리표시 틀(장식, aria-hidden)로 그린다(BLK-010).
import { mediaEl, registerTemplate, textEl, type BlockCtx, type PSection } from "../compile.js";
import { el, type Html } from "../html.js";
import {
  copyOf,
  head,
  iconEl,
  imageOf,
  listEl,
  listOf,
  mediaBox,
  itemEl,
  type Img,
} from "./common.js";

type Tpl = (s: PSection, ctx: BlockCtx) => Html;
const role = (ctx: BlockCtx, slot: string, i: number, fb: string): string =>
  ctx.roles(slot)[i] ?? fb;

/** 실제 이미지가 없는 칸(BLK-010): 비율만 가진 빈 틀. */
function emptyFrame(ratio: string): Html {
  return el("div", {
    class: `tf-media tf-media--${ratio.replace(":", "-")} tf-media--placeholder`,
    "aria-hidden": "true",
    "data-media-empty": "true",
  });
}
function frameAt(ctx: BlockCtx, img: Img | null, i: number, ratio: string): Html {
  return i === 0 && img ? mediaEl(ctx.slotId("media"), { ...img, ratio }) : emptyFrame(ratio);
}

// --- highlight ---
const highlightTrio: Tpl = (s, ctx) => {
  const img = imageOf(s.slots.media);
  return el(
    "div",
    {},
    head(ctx),
    el(
      "ul",
      { class: "tf-cols tf-highlight__list" },
      ...listOf(s.slots.items).map((t, i) =>
        el(
          "li",
          { class: "tf-highlight__item" },
          frameAt(ctx, img, i, "4:5"),
          itemEl(s, ctx, "items", i, t, { tag: "div", cls: "tf-highlight__text" }),
        ),
      ),
    ),
  );
};
const highlightTextTrio: Tpl = (s, ctx) =>
  el(
    "div",
    {},
    head(ctx),
    listEl(s, ctx, "items", { listCls: "tf-cols tf-highlight__list tf-rule-top" }),
  );
const highlightSplit: Tpl = (s, ctx) =>
  el(
    "div",
    { class: "tf-split" },
    el(
      "div",
      { class: "tf-split__main" },
      head(ctx),
      listEl(s, ctx, "items", { listCls: "tf-rule-list tf-rule-list--single" }),
    ),
    ...mediaBox(ctx, "media", imageOf(s.slots.media), "tf-split__aside"),
  );

// --- gallery: 칸 수 = captions 수(최소 1) ---
function galleryCells(s: PSection, ctx: BlockCtx, ratioOf: (i: number) => string): Html[] {
  const img = imageOf(s.slots.media);
  const caps = listOf(s.slots.captions);
  const n = Math.max(caps.length, 1);
  return Array.from({ length: n }, (_, i) => {
    const c = caps[i];
    return el(
      "figure",
      { class: "tf-gallery__cell" },
      frameAt(ctx, img, i, ratioOf(i)),
      ...(c
        ? [
            textEl(
              "figcaption",
              "tf-gallery__caption",
              ctx.slotId("captions", i),
              c,
              role(ctx, "captions", 0, "caption"),
            ),
          ]
        : []),
    );
  });
}
const galleryGrid: Tpl = (s, ctx) => {
  const r = imageOf(s.slots.media)?.ratio === "4:5" ? "4:5" : "1:1";
  return el(
    "div",
    {},
    head(ctx),
    el(
      "div",
      { class: "tf-gallery__grid tf-gallery__grid--grid" },
      ...galleryCells(s, ctx, () => r),
    ),
  );
};
const MASONRY = ["4:5", "1:1", "3:2", "1:1", "4:5", "3:2", "1:1", "4:5", "1:1"];
const galleryMasonry: Tpl = (s, ctx) =>
  el(
    "div",
    {},
    head(ctx),
    el(
      "div",
      { class: "tf-gallery__grid tf-gallery__grid--masonry" },
      ...galleryCells(s, ctx, (i) => MASONRY[i % MASONRY.length] ?? "1:1"),
    ),
  );
const galleryFeature: Tpl = (s, ctx) =>
  el(
    "div",
    {},
    head(ctx),
    el(
      "div",
      { class: "tf-gallery__grid tf-gallery__grid--feature" },
      ...galleryCells(s, ctx, () => "1:1"),
    ),
  );

// --- location ---
const INFO_ICON: Readonly<Record<string, string>> = {
  address: "map-pin",
  hours: "clock",
  phone: "phone",
};
const INFO_LABEL: Readonly<Record<string, string>> = {
  address: "주소",
  hours: "영업시간",
  phone: "전화",
};
function infoList(s: PSection, ctx: BlockCtx): Html {
  const rows = (["address", "hours", "phone"] as const).flatMap((k) => {
    const t = copyOf(s.slots[k]);
    return t
      ? [
          el(
            "div",
            { class: "tf-location__row" },
            el(
              "dt",
              { "data-role": "stat.label" },
              iconEl(ctx, INFO_ICON[k] ?? "info", 20),
              INFO_LABEL[k] ?? k,
            ),
            el(
              "dd",
              {
                "data-role": role(ctx, k, 0, "info.row"),
                "data-slot-id": ctx.slotId(k),
                "data-placeholder": t.placeholder ? "true" : null,
              },
              t.text,
            ),
          ),
        ]
      : [];
  });
  return el("dl", { class: "tf-location__info" }, ...rows);
}
const locationInfoMap: Tpl = (s, ctx) =>
  el(
    "div",
    { class: "tf-split" },
    el("div", { class: "tf-split__main" }, head(ctx), infoList(s, ctx)),
    // 지도 임베드는 MVP 제외(3.6.1) → 3:2 자리표시
    el(
      "div",
      { class: "tf-split__aside" },
      imageOf(s.slots.mapPlaceholder)
        ? mediaEl(ctx.slotId("mapPlaceholder"), imageOf(s.slots.mapPlaceholder)!)
        : emptyFrame("3:2"),
    ),
  );
const locationInfoOnly: Tpl = (s, ctx) =>
  el("div", { class: "tf-measure" }, head(ctx), infoList(s, ctx));

// --- story·about ---
function bodyEl(s: PSection, ctx: BlockCtx, slot = "body"): Html[] {
  const t = copyOf(s.slots[slot]);
  return t
    ? [textEl("p", `tf-${s.block}__body`, ctx.slotId(slot), t, role(ctx, slot, 0, "body"))]
    : [];
}
const proseSplit: Tpl = (s, ctx) =>
  el(
    "div",
    { class: "tf-split" },
    el("div", { class: "tf-split__main tf-prose" }, head(ctx), ...bodyEl(s, ctx)),
    ...mediaBox(ctx, "media", imageOf(s.slots.media), "tf-split__aside"),
  );
const proseText: Tpl = (s, ctx) =>
  el("div", { class: "tf-measure tf-prose" }, head(ctx), ...bodyEl(s, ctx));

// --- service ---
const serviceList: Tpl = (s, ctx) =>
  el(
    "div",
    {},
    head(ctx),
    listEl(s, ctx, "items", { listCls: "tf-rule-list tf-rule-list--single tf-service__list" }),
  );
const serviceCards: Tpl = (s, ctx) =>
  el(
    "div",
    {},
    head(ctx),
    listEl(s, ctx, "items", {
      listCls: "tf-cols tf-service__list",
      cls: "tf-card tf-service__item",
    }),
  );

// --- contact ---
/** 정적 폼(3.6.1: action 미지정, 내보내기 README 안내). 필드 라벨은 고정 문구(ASM-047). */
const FIELDS = [
  { id: "name", label: "이름", type: "text", auto: "name" },
  { id: "email", label: "이메일", type: "email", auto: "email" },
] as const;
function contactForm(s: PSection, ctx: BlockCtx): Html {
  const help = copyOf(s.slots.form);
  const fid = (k: string): string => `${s.id}-${k}`;
  return el(
    "form",
    { class: "tf-contact__form", "aria-labelledby": ctx.headingId, novalidate: true },
    ...FIELDS.map((f) =>
      el(
        "div",
        { class: "tf-field" },
        el(
          "label",
          { class: "tf-field__label", for: fid(f.id), "data-role": "form.label" },
          f.label,
        ),
        el("input", {
          class: "tf-input",
          id: fid(f.id),
          name: f.id,
          type: f.type,
          autocomplete: f.auto,
          "data-role": "form.input",
        }),
      ),
    ),
    el(
      "div",
      { class: "tf-field" },
      el(
        "label",
        { class: "tf-field__label", for: fid("message"), "data-role": "form.label" },
        "문의 내용",
      ),
      el("textarea", {
        class: "tf-textarea",
        id: fid("message"),
        name: "message",
        rows: 4,
        "data-role": "form.input",
      }),
    ),
    ...(help ? [textEl("p", "tf-field__help", ctx.slotId("form"), help, "form.help")] : []),
    el(
      "button",
      { class: "tf-button tf-button--primary", type: "submit" },
      el("span", { "data-role": "button.label", "data-size": "md" }, "보내기"),
    ),
  );
}
function contactText(s: PSection, ctx: BlockCtx): Html[] {
  const info = copyOf(s.slots.contactInfo);
  return [
    ...bodyEl(s, ctx),
    ...(info
      ? [
          textEl(
            "p",
            "tf-contact__info",
            ctx.slotId("contactInfo"),
            info,
            role(ctx, "contactInfo", 0, "info.row"),
          ),
        ]
      : []),
  ];
}
const contactSplitForm: Tpl = (s, ctx) =>
  el(
    "div",
    { class: "tf-split" },
    el("div", { class: "tf-split__main tf-prose" }, head(ctx), ...contactText(s, ctx)),
    el("div", { class: "tf-split__aside" }, contactForm(s, ctx)),
  );
/** contact.simple: 연락처 + CTA(3.6.1). 링크 슬롯이 없어 연락처를 강조 행으로 둔다(ASM-047). */
const contactSimple: Tpl = (s, ctx) =>
  el("div", { class: "tf-measure tf-prose tf-contact__simple" }, head(ctx), ...contactText(s, ctx));

export const CONTENT_C_TEMPLATES: Readonly<Record<string, Tpl>> = {
  "highlight.trio": highlightTrio,
  "highlight.text-trio": highlightTextTrio,
  "highlight.split": highlightSplit,
  "gallery.grid": galleryGrid,
  "gallery.masonry": galleryMasonry,
  "gallery.feature": galleryFeature,
  "location.info-map": locationInfoMap,
  "location.info-only": locationInfoOnly,
  "story.split": proseSplit,
  "story.text": proseText,
  "about.split": proseSplit,
  "about.text": proseText,
  "service.list": serviceList,
  "service.cards": serviceCards,
  "contact.split-form": contactSplitForm,
  "contact.simple": contactSimple,
};

export function registerContentC(): void {
  for (const [id, t] of Object.entries(CONTENT_C_TEMPLATES)) registerTemplate(id, t);
}
