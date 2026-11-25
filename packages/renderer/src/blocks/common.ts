// 블록 템플릿 공용 도우미(CM-01). 슬롯 꺼내기·목록 항목·섹션 머리. 순수(4.9.1).
import {
  mediaEl,
  textEl,
  type BlockCtx,
  type PSection,
  type PSlot,
  type PText,
} from "../compile.js";
import { el, type Html } from "../html.js";

export type Img = Extract<PSlot, { image: unknown }>["image"];
export const copyOf = (v: PSlot | undefined): PText | null => (v && "copy" in v ? v.copy : null);
export const linkOf = (v: PSlot | undefined) => (v && "link" in v ? v.link : null);
export const imageOf = (v: PSlot | undefined): Img | null => (v && "image" in v ? v.image : null);
export const listOf = (v: PSlot | undefined): PText[] =>
  v && "list" in v ? v.list.map((x) => x.copy) : [];

/** 01/02/03(list.index, 3.1.5a). */
export const indexLabel = (i: number): string => String(i + 1).padStart(2, "0");

export interface ItemOpts {
  /** 제목 태그(기본 h3). */
  titleTag?: string;
  /** 번호(list.index) 붙이기. */
  index?: boolean;
  /** 항목 요소 태그(기본 li). */
  tag?: string;
  cls?: string;
}

/** 목록 항목 1개: [번호] 제목(text) + 본문(sub). 역할은 슬롯 textRoles 순서(ASM-043 ④). */
export function itemEl(
  s: PSection,
  ctx: BlockCtx,
  slot: string,
  i: number,
  t: PText,
  o: ItemOpts = {},
): Html {
  const rs = ctx.roles(slot);
  const id = ctx.slotId(slot, i);
  const parts: Html[] = [];
  if (o.index)
    parts.push(
      el(
        "span",
        { class: `tf-${s.block}__index`, "data-role": "list.index", "aria-hidden": "true" },
        indexLabel(i),
      ),
    );
  parts.push(textEl(o.titleTag ?? "h3", `tf-${s.block}__item-title`, id, t, rs[0] ?? "item.title"));
  if (t.sub !== undefined)
    parts.push(
      el(
        "p",
        {
          class: `tf-${s.block}__item-body`,
          "data-role": rs[1] ?? "body",
          "data-slot-id": `${id}.sub`,
        },
        t.sub,
      ),
    );
  return el(o.tag ?? "li", { class: o.cls ?? `tf-${s.block}__item` }, ...parts);
}

/** 목록 슬롯 → ul(또는 ol) + 항목. */
export function listEl(
  s: PSection,
  ctx: BlockCtx,
  slot: string,
  o: ItemOpts & { listTag?: "ul" | "ol"; listCls?: string } = {},
): Html {
  const items = listOf(s.slots[slot]);
  return el(
    o.listTag ?? "ul",
    { class: o.listCls ?? `tf-${s.block}__list` },
    ...items.map((t, i) => itemEl(s, ctx, slot, i, t, o)),
  );
}

export function mediaBox(ctx: BlockCtx, slot: string, img: Img | null, cls: string): Html[] {
  return img ? [el("div", { class: cls }, mediaEl(ctx.slotId(slot), img))] : [];
}

/** 섹션 머리(제목). 블록 템플릿 공통 래퍼. */
export const head = (ctx: BlockCtx, cls = "tf-section__head"): Html =>
  el("div", { class: cls }, ctx.heading);
