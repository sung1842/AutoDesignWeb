// 렌더 측정(04장 4.10.2 하드 게이트 입력, ASM-055). 페이지 안에서 원시 값을 모으고, 판정은 @tastefit/scoring.
// G-02 대비: 텍스트 노드마다 전경색 vs 조상 배경 합성(캔버스로 sRGB 변환). 이미지 위 텍스트는 텍스트를 숨긴 뒤
// bbox 픽셀을 찍어 픽셀별 대비의 하위 5% 값을 쓴다. G-04 가로 넘침, G-05 잘림, G-06 겹침, G-07 리소스.
import type { Page } from "playwright";
import sharp from "sharp";
import {
  loadDesignData,
  specTokenDrift,
  tokenReference,
  type DesignData,
  type TokenReference,
} from "@tastefit/design-spec";

export interface TextSample {
  sel: string;
  text: string;
  fg: [number, number, number, number];
  bg: [number, number, number, number] | null; // null = 이미지 위(픽셀 측정)
  ratio: number;
  large: boolean;
  fontPx: number;
  weight: number;
}
export interface RawMeasure {
  scrollWidth: number;
  innerWidth: number;
  texts: TextSample[];
  clipped: string[];
  overlaps: string[];
  brokenImages: string[];
  fontErrors: string[];
  imageCount: number;
  /** G-03 비텍스트 대비 표본. */
  ui: { sel: string; kind: string; ratio: number }[];
  /** G-12·AIL-17 computed style 표본(ASM-065). */
  styles: StyleSamples;
  /** spec을 넘겼을 때만: 기준 집합과 deriveTokens 불일치 잎. */
  integrity?: { ref: TokenReference; drift: string[] };
}
export interface StyleSamples {
  fonts: { sel: string; role: string | null; px: number }[];
  colors: { sel: string; prop: string; rgba: [number, number, number, number] }[];
  radii: { sel: string; prop: string; px: number }[];
  spaces: { sel: string; prop: string; px: number }[];
}

type RGBA = [number, number, number, number];
const lin = (c: number): number => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
export const luminance = (c: [number, number, number] | RGBA): number =>
  0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
export const contrastRatio = (a: number, b: number): number =>
  (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

/** 04장 4.10.2 게이트 표의 측정 상수(큰 글자 기준, 겹침 면적, 최소 상자). 사양 값 그대로(ASM-055). */
export const GATE_SPEC = {
  largePx: 24,
  largeBoldPx: 18.66,
  boldWeight: 700,
  overlapAreaPx2: 2,
  minBoxPx: 2,
  clipTolPx: 1,
  imagePercentile: 0.05,
} as const;
type GateSpec = typeof GATE_SPEC;

/** 페이지 안에서 텍스트·박스 원시 값을 모은다(직렬화 가능한 값만). */
async function collectInPage(page: Page): Promise<
  Omit<RawMeasure, "texts"> & {
    texts: TextSample[];
    overImage: { idx: number; rect: [number, number, number, number] }[];
  }
> {
  return page.evaluate(async (G: GateSpec) => {
    // lazy 이미지까지 모두 불러 깨진 이미지를 센다(G-07)
    const imgs = [...document.images];
    for (const im of imgs) im.loading = "eager";
    await Promise.all(
      imgs.map((im) => (im.complete ? Promise.resolve() : im.decode().catch(() => undefined))),
    );
    const cv = document.createElement("canvas");
    cv.width = cv.height = 1;
    const cx = cv.getContext("2d", { willReadFrequently: true });
    const toRGBA = (css: string): [number, number, number, number] => {
      if (!cx) return [0, 0, 0, 1];
      cx.clearRect(0, 0, 1, 1);
      cx.fillStyle = "rgba(0,0,0,0)";
      cx.fillStyle = css;
      cx.fillRect(0, 0, 1, 1);
      const d = cx.getImageData(0, 0, 1, 1).data;
      return [d[0] ?? 0, d[1] ?? 0, d[2] ?? 0, (d[3] ?? 0) / 255];
    };
    const over = (top: number[], bot: number[]): [number, number, number, number] => {
      const a = (top[3] ?? 1) + (bot[3] ?? 1) * (1 - (top[3] ?? 1));
      if (a === 0) return [0, 0, 0, 0];
      const ch = (i: number): number =>
        ((top[i] ?? 0) * (top[3] ?? 1) + (bot[i] ?? 0) * (bot[3] ?? 1) * (1 - (top[3] ?? 1))) / a;
      return [ch(0), ch(1), ch(2), a];
    };
    const lin = (c: number): number => {
      const s = c / 255;
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    const lum = (c: number[]): number =>
      0.2126 * lin(c[0] ?? 0) + 0.7152 * lin(c[1] ?? 0) + 0.0722 * lin(c[2] ?? 0);
    const selOf = (el: Element): string => {
      const sec = el.closest("[data-section-id],[data-block]");
      const id = sec?.getAttribute("data-section-id") ?? sec?.getAttribute("data-block") ?? "page";
      const slot = el.closest("[data-slot-id]")?.getAttribute("data-slot-id");
      return `${id}:${el.tagName.toLowerCase()}${slot ? `[${slot}]` : ""}`;
    };
    const visible = (el: Element): boolean => {
      if (el.closest("[aria-hidden='true'],script,style,noscript,template")) return false;
      const r = el.getBoundingClientRect();
      if (r.width < G.minBoxPx || r.height < G.minBoxPx) return false;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none" || Number(cs.opacity) === 0)
        return false;
      for (let a: Element | null = el; a; a = a.parentElement) {
        const s = getComputedStyle(a);
        if (s.clipPath.includes("inset(100%")) return false;
        if (s.display === "none") return false;
      }
      // details 닫힌 패널 안
      const det = el.closest("details");
      if (det && !det.open && !el.closest("summary")) return false;
      return true;
    };
    const imageUnder = (el: Element): boolean =>
      !!el.closest(".tf-hero__overlay, [data-text-over-image]");
    // --- 텍스트 ---
    const texts: {
      sel: string;
      text: string;
      fg: [number, number, number, number];
      bg: [number, number, number, number] | null;
      ratio: number;
      large: boolean;
      fontPx: number;
      weight: number;
    }[] = [];
    const overImage: { idx: number; rect: [number, number, number, number] }[] = [];
    const seen = new Set<Element>();
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const el = n.parentElement;
      if (!el || seen.has(el) || (n.textContent ?? "").trim() === "") continue;
      if (!visible(el)) continue;
      seen.add(el);
      const cs = getComputedStyle(el);
      const fg = toRGBA(cs.color);
      const fontPx = parseFloat(cs.fontSize);
      const weight = Number(cs.fontWeight) || 400;
      const large = fontPx >= G.largePx || (fontPx >= G.largeBoldPx && weight >= G.boldWeight);
      let bg: [number, number, number, number] = [0, 0, 0, 0];
      for (let a: Element | null = el; a && bg[3] < 0.999; a = a.parentElement) {
        const c = toRGBA(getComputedStyle(a).backgroundColor);
        if (c[3] > 0) bg = over(bg, c);
      }
      if (bg[3] < 0.999) bg = over(bg, [255, 255, 255, 1]);
      const fgc = over(fg, bg);
      const idx = texts.length;
      const r = el.getBoundingClientRect();
      if (imageUnder(el)) {
        overImage.push({ idx, rect: [r.left + scrollX, r.top + scrollY, r.width, r.height] });
        texts.push({
          sel: selOf(el),
          text: (n.textContent ?? "").trim().slice(0, 20),
          fg: fgc,
          bg: null,
          ratio: 0,
          large,
          fontPx,
          weight,
        });
      } else {
        const L1 = lum(fgc);
        const L2 = lum(bg);
        texts.push({
          sel: selOf(el),
          text: (n.textContent ?? "").trim().slice(0, 20),
          fg: fgc,
          bg,
          ratio: (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05),
          large,
          fontPx,
          weight,
        });
      }
    }
    // --- 잘림 G-05 ---
    const clipped: string[] = [];
    for (const el of document.body.querySelectorAll("*")) {
      const cs = getComputedStyle(el);
      if (!/(hidden|clip)/.test(cs.overflowX + cs.overflowY)) continue;
      if (!(el.textContent ?? "").trim() || !visible(el)) continue;
      if (el.closest(".tf-visually-hidden,.tf-skip-link")) continue;
      if (
        el.scrollHeight > el.clientHeight + G.clipTolPx ||
        el.scrollWidth > el.clientWidth + G.clipTolPx
      )
        clipped.push(selOf(el));
    }
    // --- 겹침 G-06: 텍스트 줄 상자끼리, 텍스트 vs 인터랙티브 ---
    type Box = { el: Element; r: DOMRect; kind: "text" | "ui" };
    const boxes: Box[] = [];
    for (const el of seen) {
      if (el.closest("[data-overlay]")) continue;
      const range = document.createRange();
      for (const c of el.childNodes)
        if (c.nodeType === 3 && (c.textContent ?? "").trim()) {
          range.selectNodeContents(c);
          // 글꼴 content area가 아니라 줄 상자(line-height) 높이로 자른 bbox(ASM-055)
          const lh = parseFloat(getComputedStyle(el).lineHeight) || 0;
          for (const r of range.getClientRects())
            if (r.width > 0 && r.height > 0) {
              const h = lh > 0 ? Math.min(r.height, lh) : r.height;
              const top = r.top + (r.height - h) / 2;
              boxes.push({ el, r: new DOMRect(r.left, top, r.width, h), kind: "text" });
            }
        }
    }
    for (const el of document.querySelectorAll("a,button,input,textarea,select,summary"))
      if (visible(el) && !el.closest("[data-overlay]"))
        boxes.push({ el, r: el.getBoundingClientRect(), kind: "ui" });
    const overlaps: string[] = [];
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]!;
        const b = boxes[j]!;
        if (a.kind === "ui" && b.kind === "ui") continue;
        if (a.el === b.el || a.el.contains(b.el) || b.el.contains(a.el)) continue;
        const x = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
        const y = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
        if (x > 0 && y > 0 && x * y > G.overlapAreaPx2)
          overlaps.push(`${selOf(a.el)} × ${selOf(b.el)} ${(x * y).toFixed(1)}px²`);
      }
    // --- 비텍스트 대비 G-03: 입력 테두리·버튼 경계·포커스 링 vs 인접 배경 ---
    const bgOf = (start: Element | null): [number, number, number, number] => {
      let bg: [number, number, number, number] = [0, 0, 0, 0];
      for (let a: Element | null = start; a && bg[3] < 0.999; a = a.parentElement) {
        const c = toRGBA(getComputedStyle(a).backgroundColor);
        if (c[3] > 0) bg = over(bg, c);
      }
      return bg[3] < 0.999 ? over(bg, [255, 255, 255, 1]) : bg;
    };
    const cr = (a: number[], b: number[]): number => {
      const x = lum(a);
      const y = lum(b);
      return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
    };
    const ui: { sel: string; kind: string; ratio: number }[] = [];
    // 입력 경계 = 테두리 또는 채움 중 더 뚜렷한 쪽(WCAG 1.4.11, ASM-057)
    for (const el of document.querySelectorAll("input,textarea,select")) {
      if (!visible(el)) continue;
      const cs = getComputedStyle(el);
      const parentBg = bgOf(el.parentElement);
      const bw = parseFloat(cs.borderTopWidth);
      const edge = bw > 0 ? cr(over(toRGBA(cs.borderTopColor), parentBg), parentBg) : 0;
      const own = toRGBA(cs.backgroundColor);
      const fill = own[3] > 0 ? cr(over(own, parentBg), parentBg) : 0;
      ui.push({ sel: selOf(el), kind: "input-edge", ratio: Math.max(edge, fill) });
    }
    for (const el of document.querySelectorAll(".tf-button")) {
      if (!visible(el)) continue;
      const cs = getComputedStyle(el);
      const parentBg = bgOf(el.parentElement);
      const own = toRGBA(cs.backgroundColor);
      const fill = own[3] > 0 ? cr(over(own, parentBg), parentBg) : 0;
      const bw = parseFloat(cs.borderTopWidth);
      const edge = bw > 0 ? cr(over(toRGBA(cs.borderTopColor), parentBg), parentBg) : 0;
      if (own[3] === 0 && bw === 0) continue;
      ui.push({ sel: selOf(el), kind: "button-edge", ratio: Math.max(fill, edge) });
    }
    for (const el of document.querySelectorAll("a[href],button,input,textarea,select,summary")) {
      if (!visible(el)) continue;
      const focus = getComputedStyle(el).getPropertyValue("--tf-color-focus").trim();
      if (!focus) continue;
      const bg = bgOf(el.parentElement);
      ui.push({ sel: selOf(el), kind: "focus", ratio: cr(over(toRGBA(focus), bg), bg) });
    }
    // --- G-12·AIL-17 style 표본(ASM-065): 색·radius·font-size·spacing ---
    const styles: StyleSamples = { fonts: [], colors: [], radii: [], spaces: [] };
    const SIDES = ["Top", "Right", "Bottom", "Left"] as const;
    const CORNERS = ["TopLeft", "TopRight", "BottomRight", "BottomLeft"] as const;
    const pxOf = (v: string): number | null => (/^-?[\d.]+px$/.test(v) ? parseFloat(v) : null);
    for (const el of document.body.querySelectorAll("*")) {
      const tag = el.tagName.toLowerCase();
      if (el.closest("svg") && tag !== "svg") continue;
      if (!visible(el)) continue;
      const cs = getComputedStyle(el);
      const sel = selOf(el);
      const csd = cs as unknown as Record<string, string>;
      if (seen.has(el)) {
        const role = el.closest("[data-role]")?.getAttribute("data-role") ?? null;
        styles.fonts.push({ sel, role, px: parseFloat(cs.fontSize) });
        styles.colors.push({ sel, prop: "color", rgba: toRGBA(cs.color) });
      }
      const bgc = toRGBA(cs.backgroundColor);
      if (bgc[3] > 0) styles.colors.push({ sel, prop: "background-color", rgba: bgc });
      for (const side of SIDES)
        if (
          parseFloat(csd[`border${side}Width`] ?? "0") > 0 &&
          csd[`border${side}Style`] !== "none"
        )
          styles.colors.push({
            sel,
            prop: `border-${side.toLowerCase()}-color`,
            rgba: toRGBA(csd[`border${side}Color`] ?? ""),
          });
      for (const c of CORNERS) {
        const v = pxOf((csd[`border${c}Radius`] ?? "").split(" ")[0] ?? "");
        if (v !== null && v > 0) styles.radii.push({ sel, prop: `border-${c}-radius`, px: v });
      }
      if (el.closest("[data-layout-auto]")) continue;
      for (const side of SIDES) {
        const v = pxOf(csd[`padding${side}`] ?? "");
        if (v !== null && v !== 0)
          styles.spaces.push({ sel, prop: `padding-${side.toLowerCase()}`, px: v });
      }
      if (/(flex|grid)/.test(cs.display))
        for (const [k, prop] of [
          ["rowGap", "row-gap"],
          ["columnGap", "column-gap"],
        ] as const) {
          const v = pxOf(csd[k] ?? "");
          if (v !== null && v !== 0) styles.spaces.push({ sel, prop, px: v });
        }
      // margin: 세로는 그대로, 가로는 좌우가 같으면 자동 중앙 정렬(margin:auto)로 보고 뺀다(04장 AIL-17)
      for (const side of ["Top", "Bottom"] as const) {
        const v = pxOf(csd[`margin${side}`] ?? "");
        if (v !== null && v !== 0)
          styles.spaces.push({ sel, prop: `margin-${side.toLowerCase()}`, px: v });
      }
      const ml = pxOf(cs.marginLeft);
      const mr = pxOf(cs.marginRight);
      if (ml !== null && mr !== null && Math.abs(ml - mr) > 0.5)
        for (const [prop, v] of [
          ["margin-left", ml],
          ["margin-right", mr],
        ] as const)
          if (v !== 0) styles.spaces.push({ sel, prop, px: v });
    }
    // --- 리소스 G-07 ---
    const brokenImages = imgs
      .filter((im) => im.naturalWidth === 0)
      .map((im) => im.getAttribute("src") ?? "");
    // 3.7.4 폴백 면(tf-fb-*)은 local() 원천이 없는 환경에서 error가 정상이라 뺀다(ASM-055)
    const fontErrors = [...document.fonts]
      .filter((f) => f.status === "error" && !/^"?tf-fb-/.test(f.family))
      .map((f) => `${f.family} ${f.weight}`);
    const se = document.scrollingElement ?? document.documentElement;
    return {
      scrollWidth: se.scrollWidth,
      innerWidth: window.innerWidth,
      texts,
      overImage,
      clipped,
      overlaps: overlaps.slice(0, 50),
      brokenImages,
      fontErrors,
      imageCount: imgs.length,
      ui,
      styles,
    };
  }, GATE_SPEC);
}

/** 이미지 위 텍스트: 텍스트를 투명하게 한 뒤 bbox 픽셀별 대비의 하위 5%(G-02 4.10.2). */
async function overImageRatios(
  page: Page,
  items: { idx: number; rect: [number, number, number, number] }[],
  texts: TextSample[],
): Promise<void> {
  if (items.length === 0) return;
  // addStyleTag는 javaScriptEnabled=false에서 멈춘다 → evaluate로 style 요소를 넣는다
  await page.evaluate(() => {
    const st = document.createElement("style");
    st.textContent =
      ".tf-hero__overlay *, [data-text-over-image] * { color: transparent !important; }";
    document.head.append(st);
  });
  for (const it of items) {
    const [x, y, w, h] = it.rect;
    if (w < GATE_SPEC.minBoxPx || h < GATE_SPEC.minBoxPx) continue;
    const png = await page.screenshot({ clip: { x, y, width: w, height: h }, fullPage: true });
    const { data, info } = await sharp(png)
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const t = texts[it.idx]!;
    const Lf = luminance(t.fg);
    const ratios: number[] = [];
    for (let p = 0; p < data.length; p += info.channels) {
      ratios.push(contrastRatio(Lf, luminance([data[p] ?? 0, data[p + 1] ?? 0, data[p + 2] ?? 0])));
    }
    ratios.sort((a, b) => a - b);
    t.ratio = ratios[Math.floor(ratios.length * GATE_SPEC.imagePercentile)] ?? 0;
  }
}

let DATA: DesignData | null = null;
const ROOT = new URL("../../../../", import.meta.url).pathname;

export async function collectMeasure(page: Page, spec?: unknown): Promise<RawMeasure> {
  const r = await collectInPage(page);
  await overImageRatios(page, r.overImage, r.texts);
  const { overImage, ...rest } = r;
  void overImage;
  if (spec === undefined) return rest;
  DATA ??= loadDesignData(ROOT);
  const s = spec as { tokens: Record<string, unknown> };
  const vw = page.viewportSize()?.width ?? rest.innerWidth;
  return {
    ...rest,
    integrity: { ref: tokenReference(s.tokens, vw, DATA), drift: specTokenDrift(spec, DATA) },
  };
}
