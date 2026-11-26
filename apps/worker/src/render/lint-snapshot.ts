// 린터 단계 D·P 스냅숏(04장 4.13.1, ASM-077 ③·ASM-083). 브라우저에서 computed style을 모으고,
// 글래스 요소 뒤 영역 휘도 표준편차(P)는 그 요소를 숨긴 스크린샷으로 잰다.
import type { Page } from "playwright";
import sharp from "sharp";
import { expectedSize, tokenLeaves, TYPE_STEPS } from "@tastefit/design-spec";
import type { Snapshot, TokenSet } from "@tastefit/linter";

type Collected = Omit<Snapshot, "glass" | "tokens"> & {
  glassRects: { x: number; y: number; w: number; h: number; i: number }[];
};

/** 브라우저 안에서 실행(직렬화되므로 바깥 변수를 쓰지 않는다). */
function collect(): Collected {
  const STEP = /^t-(caption|small|body|lead|1|2|3|4|display)$/;
  const CARD = /(^|[\s_-])card($|[\s_-])|__item\b|__cell\b/;
  const px = (v: string): number => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  };
  const sectionsAll = [...document.querySelectorAll("section")];
  const ownText = (el: Element): string =>
    [...el.childNodes]
      .filter((n) => n.nodeType === Node.TEXT_NODE)
      .map((n) => n.textContent ?? "")
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  const elements: Snapshot["elements"] = [];
  const glassRects: Collected["glassRects"] = [];
  const all = [...document.body.querySelectorAll("*")].filter(
    (el) => !["SCRIPT", "STYLE", "TEMPLATE", "NOSCRIPT"].includes(el.tagName),
  );
  for (const el of all) {
    if (el.closest("svg") && el.tagName.toLowerCase() !== "svg") continue;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    if (cs.display === "none" || (r.width === 0 && r.height === 0)) continue;
    const tag = el.tagName.toLowerCase();
    const role = el.getAttribute("data-role");
    const cls = typeof el.className === "string" ? el.className : (el.getAttribute("class") ?? "");
    const text = ownText(el);
    const sec = el.closest("section");
    const isSvg = tag === "svg";
    const heading = /^h[1-6]$/.test(tag) || /(headline|heading)$/.test(role ?? "");
    const button =
      tag === "button" ||
      el.getAttribute("role") === "button" ||
      /\b(btn|button)\b/.test(cls) ||
      /(cta|button)/.test(role ?? "");
    const badge = /(eyebrow|badge)/.test(role ?? "") || /\b(badge|pill|tag|eyebrow)\b/.test(cls);
    const card = el.hasAttribute("data-card") || tag === "article" || CARD.test(cls);
    const cardTitle =
      /title$/.test(role ?? "") ||
      (/^h[2-6]$/.test(tag) && !!el.parentElement?.closest("[data-card], article, .card"));
    const stroke = isSvg ? (cs.stroke !== "none" ? px(cs.strokeWidth) : null) : null;
    const setAttr = el.closest("[data-icon-set]")?.getAttribute("data-icon-set") ?? null;
    const icon = isSvg
      ? {
          set: setAttr ?? (/\blucide\b/.test(cls) ? "lucide" : null),
          size: Math.max(r.width, r.height),
          stroke:
            stroke ??
            (el.getAttribute("stroke-width") !== null
              ? Number(el.getAttribute("stroke-width"))
              : null),
        }
      : null;
    const ml = px(cs.marginLeft);
    const mr = px(cs.marginRight);
    const i = elements.length;
    elements.push({
      tag,
      role,
      section: sec ? sectionsAll.indexOf(sec) : -1,
      text,
      heading,
      button,
      badge,
      cardTitle,
      card,
      wordmark: /wordmark/.test(role ?? "") || /\bwordmark\b/.test(cls),
      decorative: el.getAttribute("aria-hidden") === "true" || (el.textContent ?? "").trim() === "",
      layoutAuto: !!el.closest("[data-layout-auto]"),
      step: cls.split(/\s+/).find((c) => STEP.test(c)) ?? null,
      x: r.left + scrollX,
      y: r.top + scrollY,
      w: r.width,
      h: r.height,
      position: cs.position,
      bgImage: cs.backgroundImage,
      bgClip: `${cs.backgroundClip} ${cs.getPropertyValue("-webkit-background-clip")}`,
      filter: cs.filter,
      backdropFilter: cs.backdropFilter || cs.getPropertyValue("-webkit-backdrop-filter"),
      boxShadow: cs.boxShadow,
      textShadow: cs.textShadow,
      radius: px(cs.borderTopLeftRadius),
      fontFamily: cs.fontFamily,
      fontSize: px(cs.fontSize),
      color: text ? cs.color : "rgba(0, 0, 0, 0)",
      bgColor: cs.backgroundColor,
      borderColor: cs.borderTopColor,
      borderWidth: px(cs.borderTopWidth),
      padding: [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft].map(px),
      gap: [cs.rowGap, cs.columnGap].map((g) => (g === "normal" ? 0 : px(g))),
      margin: [cs.marginTop, cs.marginRight, cs.marginBottom, cs.marginLeft].map(px),
      marginAuto: ml > 0 && Math.abs(ml - mr) < 1,
      icon,
    });
    const bf = cs.backdropFilter || cs.getPropertyValue("-webkit-backdrop-filter");
    if (bf && bf !== "none")
      glassRects.push({ x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height, i });
    el.setAttribute("data-tf-lint", String(i));
  }
  // AIL-05 D: 자식 전부가 아이콘(≤48px svg)+제목+본문인 부모
  const iconCardRows: Snapshot["iconCardRows"] = [];
  const isIconCard = (c: Element): boolean => {
    const svg = c.querySelector("svg");
    if (!svg) return false;
    const sr = svg.getBoundingClientRect();
    const title = c.querySelector("h2,h3,h4,h5,h6,strong,[data-role$='title']");
    const body = c.querySelector("p,[data-role='body']");
    return Math.max(sr.width, sr.height) <= 48 && !!title && !!body;
  };
  for (const p of all) {
    const kids = [...p.children];
    if (!kids[1] || !kids.every(isIconCard)) continue; // 형제 2개 이상
    const ws = kids.map((k) => k.getBoundingClientRect().width);
    const max = Math.max(...ws);
    const sec = p.closest("section");
    iconCardRows.push({
      section: sec ? sectionsAll.indexOf(sec) : -1,
      n: kids.length,
      widthSpread: max > 0 ? (max - Math.min(...ws)) / max : 0,
    });
  }
  // :root custom property 원문
  const rootVars: Record<string, string> = {};
  const rootCs = getComputedStyle(document.documentElement);
  const visit = (rules: CSSRuleList): void => {
    for (const rule of rules) {
      if (rule instanceof CSSStyleRule && /(^|,)\s*(:root|html)\s*(,|$)/.test(rule.selectorText))
        for (const prop of rule.style)
          if (prop.startsWith("--")) rootVars[prop] = rootCs.getPropertyValue(prop).trim();
      if ("cssRules" in rule && rule instanceof CSSGroupingRule) visit(rule.cssRules);
    }
  };
  for (const sh of document.styleSheets)
    try {
      visit(sh.cssRules);
    } catch {
      /* 다른 오리진 시트는 없다(외부 요청 차단) */
    }
  // 헤드라인 줄 수(3.8.1, headlineLines와 같은 방법)
  const headlines: Snapshot["headlines"] = [];
  for (const el of document.querySelectorAll(
    "[data-role='hero.headline'],[data-role='cta.headline']",
  )) {
    const range = document.createRange();
    const tops: number[] = [];
    const perLine = new Map<number, number>();
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const t = n.textContent ?? "";
      for (let k = 0; k < t.length; k++) {
        if (/\s/.test(t[k] ?? "")) continue;
        range.setStart(n, k);
        range.setEnd(n, k + 1);
        const rr = range.getBoundingClientRect();
        if (rr.width === 0) continue;
        let key = tops.find((y) => Math.abs(y - rr.top) < rr.height / 2);
        if (key === undefined) {
          key = rr.top;
          tops.push(key);
        }
        perLine.set(key, (perLine.get(key) ?? 0) + 1);
      }
    }
    tops.sort((a, b) => a - b);
    const last = tops.at(-1);
    headlines.push({
      role: el.getAttribute("data-role") ?? "",
      lines: tops.length,
      lastLineChars: last === undefined ? 0 : (perLine.get(last) ?? 0),
    });
  }
  const txt = (sel: string): string =>
    (document.querySelector(sel)?.textContent ?? "").replace(/\s+/g, " ").trim();
  const regions = {
    nav: txt("nav, header"),
    hero: txt("section"),
    footer: txt("footer"),
    wordmark: txt("[data-role='nav.wordmark'], nav .tf-wordmark, header .tf-wordmark"),
  };
  return {
    vw: innerWidth,
    vh: innerHeight,
    regions,
    rootVars,
    elements,
    iconCardRows,
    headlines,
    glassRects,
  };
}

/** spec.tokens → 허용 집합(AIL-17). tokens가 없으면 null. */
export function tokenSet(spec: unknown, vw: number): TokenSet | null {
  const tokens =
    typeof spec === "object" && spec !== null && "tokens" in spec
      ? (spec as { tokens: unknown }).tokens
      : null;
  if (typeof tokens !== "object" || tokens === null) return null;
  const t = tokens as Record<string, unknown>;
  const colors: string[] = [];
  const radii: number[] = [];
  const spacing: number[] = [];
  for (const { path, tok } of tokenLeaves(t)) {
    const v = tok.$value as { hex?: string; value?: number } | undefined;
    if (tok.$type === "color" && v?.hex) colors.push(v.hex);
    if (tok.$type === "dimension" && typeof v?.value === "number") {
      if (path[0] === "radius") radii.push(v.value);
      if (path[0] === "space") spacing.push(v.value);
    }
  }
  const fontSizes: Record<string, number> = {};
  for (const s of TYPE_STEPS)
    try {
      fontSizes[s.step] = expectedSize(t, s.step, vw);
    } catch {
      /* 토큰에 없는 단계는 검사하지 않는다 */
    }
  return { colors, radii, spacing, fontSizes };
}

async function lumStd(
  page: Page,
  i: number,
  rect: { x: number; y: number; w: number; h: number },
): Promise<number> {
  const sel = `[data-tf-lint="${i}"]`;
  await page.evaluate((s) => {
    const el = document.querySelector<HTMLElement>(s);
    if (el) el.style.visibility = "hidden";
  }, sel);
  const clip = {
    x: Math.max(0, rect.x),
    y: Math.max(0, rect.y),
    width: Math.max(1, rect.w),
    height: Math.max(1, rect.h),
  };
  const png = await page.screenshot({ clip, fullPage: true, type: "png" });
  await page.evaluate((s) => {
    const el = document.querySelector<HTMLElement>(s);
    if (el) el.style.visibility = "";
  }, sel);
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const n = info.width * info.height;
  let sum = 0;
  let sq = 0;
  for (let k = 0; k < n; k++) {
    const o = k * info.channels;
    const y = 0.2126 * (data[o] ?? 0) + 0.7152 * (data[o + 1] ?? 0) + 0.0722 * (data[o + 2] ?? 0);
    sum += y;
    sq += y * y;
  }
  const mean = sum / n;
  return Math.sqrt(Math.max(0, sq / n - mean * mean));
}

/** 열린 페이지에서 D·P 스냅숏을 만든다. */
export async function lintSnapshotOf(page: Page, vw: number, spec?: unknown): Promise<Snapshot> {
  const c = await page.evaluate(collect);
  const glass: Snapshot["glass"] = [];
  for (const g of c.glassRects) glass.push({ lumStd: await lumStd(page, g.i, g) });
  const { glassRects: _drop, ...rest } = c;
  void _drop;
  return { ...rest, glass, tokens: tokenSet(spec, vw) };
}
