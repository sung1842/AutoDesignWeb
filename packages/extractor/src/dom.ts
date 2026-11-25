// 05장 5.5.1·5.5.3 DOM 기반 원시 특징(F01~F13, F16~F18, F22~F24, F26~F30). 페이지 안에서 계산한다.
// 측정 영역 = 상단 [0, min(2400, 문서 높이)], 폭 = 뷰포트(5.4.2). 직렬화 가능한 값만 돌려준다.

/** 5.5.1 측정 상수(사양 값 그대로). */
export const DOM_SPEC = {
  areaMaxY: 2400,
  vpW: 1280,
  vpH: 800,
  opacityMin: 0.1,
  surfaceDeltaE: 0.02,
  surfaceMinArea: 2000,
  surfaceMaxShare: 0.6,
  borderAlphaMin: 0.3,
  buttonPadX: 8,
  headlineRatio: 1.5,
  mediaMin: 64,
  iconMin: 24,
  iconMax: 48,
  secWidthShare: 0.9,
  secMinH: 200,
  shadowAlphaMin: 0.05,
  hardBlurMax: 2,
  hardOffsetMin: 3,
  gridTopTol: 4,
  cellPx: 4,
  topSecs: 3,
} as const;
export type DomSpec = typeof DOM_SPEC;

export interface DomFeatures {
  F01: number | null;
  F02: number;
  F03: number | null;
  F04: number;
  F05: number | null;
  F06: number;
  F07: number;
  F08: number;
  F09: number | null;
  F10: number;
  F11: number;
  F12: number | null;
  F13: number;
  F16: number | null;
  F17: number | null;
  F18: number | null;
  F22: number;
  F23: number | null;
  F24: number;
  F26: {
    heading_family: string | null;
    body_family: string | null;
    heading_class: string;
    body_class: string;
  };
  F27: number | null;
  F28: number | null;
  F29: number;
  F30: number;
  areaH: number;
}

export interface DomArg {
  spec: DomSpec;
  /** 소문자 family → 5.5.2 분류. */
  fontClasses: Record<string, string>;
}

/** page.evaluate 로 넘기는 본문. 외부 변수를 참조하지 않는다. */
export function collectDomFeatures(arg: DomArg): DomFeatures {
  const S = arg.spec;
  const W = window.innerWidth;
  const se = document.scrollingElement ?? document.documentElement;
  const areaH = Math.min(S.areaMaxY, se.scrollHeight);
  const area = W * areaH;
  const vpArea = S.vpW * S.vpH;
  const vps = area / vpArea;
  const median = (xs: number[]): number | null => {
    if (xs.length === 0) return null;
    const s = [...xs].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
  };
  const cv = document.createElement("canvas");
  cv.width = cv.height = 1;
  const cx = cv.getContext("2d", { willReadFrequently: true });
  const rgba = (css: string): [number, number, number, number] => {
    if (!cx || !css) return [0, 0, 0, 0];
    cx.clearRect(0, 0, 1, 1);
    cx.fillStyle = "rgba(0,0,0,0)";
    cx.fillStyle = css;
    cx.fillRect(0, 0, 1, 1);
    const d = cx.getImageData(0, 0, 1, 1).data;
    return [d[0] ?? 0, d[1] ?? 0, d[2] ?? 0, (d[3] ?? 0) / 255];
  };
  const ug = (c: number): number => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const lab = (c: number[]): number[] => {
    const [R, G, B] = [ug(c[0] ?? 0), ug(c[1] ?? 0), ug(c[2] ?? 0)];
    const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
    const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
    const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
    return [
      0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
      1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
      0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
    ];
  };
  const dE = (a: number[], b: number[]): number => {
    const x = lab(a);
    const y = lab(b);
    return Math.hypot(x[0]! - y[0]!, x[1]! - y[1]!, x[2]! - y[2]!);
  };
  const absRect = (r: DOMRect): [number, number, number, number] => [
    r.left + scrollX,
    r.top + scrollY,
    r.width,
    r.height,
  ];
  const inArea = (r: [number, number, number, number]): boolean =>
    r[2] > 0 && r[3] > 0 && r[1] < areaH && r[1] + r[3] > 0 && r[0] < W && r[0] + r[2] > 0;
  // --- V: 가시 요소 ---
  const opa = new Map<Element, number>();
  const cumOpacity = (el: Element): number => {
    const hit = opa.get(el);
    if (hit !== undefined) return hit;
    const own = Number(getComputedStyle(el).opacity);
    const v = (el.parentElement ? cumOpacity(el.parentElement) : 1) * (Number.isNaN(own) ? 1 : own);
    opa.set(el, v);
    return v;
  };
  const shown = (el: Element): boolean => {
    for (let a: Element | null = el; a; a = a.parentElement)
      if (getComputedStyle(a).display === "none") return false;
    return true;
  };
  const V: { el: Element; cs: CSSStyleDeclaration; r: [number, number, number, number] }[] = [];
  for (const el of document.body.querySelectorAll("*")) {
    if (el.closest("script,style,noscript,template")) continue;
    const tag = el.tagName.toLowerCase();
    if (el.closest("svg") && tag !== "svg") continue;
    const r = absRect(el.getBoundingClientRect());
    if (!inArea(r)) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility !== "visible" || !shown(el) || cumOpacity(el) < S.opacityMin) continue;
    V.push({ el, cs, r });
  }
  const effBg = (el: Element | null): [number, number, number, number] => {
    for (let a = el; a; a = a.parentElement) {
      const c = rgba(getComputedStyle(a).backgroundColor);
      if (c[3] > 0) return c;
    }
    return [255, 255, 255, 1];
  };
  const borderW = (cs: CSSStyleDeclaration): number => {
    const ws = [cs.borderTopWidth, cs.borderRightWidth, cs.borderBottomWidth, cs.borderLeftWidth]
      .map((x) => parseFloat(x) || 0)
      .filter(
        (_, i) =>
          [cs.borderTopStyle, cs.borderRightStyle, cs.borderBottomStyle, cs.borderLeftStyle][i] !==
          "none",
      );
    return ws.length ? Math.max(...ws) : 0;
  };
  const visibleBorder = (cs: CSSStyleDeclaration): boolean =>
    borderW(cs) >= 1 && rgba(cs.borderTopColor)[3] >= S.borderAlphaMin;
  const radiusOf = (cs: CSSStyleDeclaration, r: [number, number, number, number]): number => {
    const cap = Math.min(r[2], r[3]) / 2;
    const vals = [
      cs.borderTopLeftRadius,
      cs.borderTopRightRadius,
      cs.borderBottomRightRadius,
      cs.borderBottomLeftRadius,
    ].map((v) => {
      const first = v.split(" ")[0] ?? "0";
      const n = parseFloat(first) || 0;
      const px = first.endsWith("%") ? (n / 100) * Math.min(r[2], r[3]) : n;
      return Math.min(px, cap);
    });
    return vals.reduce((s, x) => s + x, 0) / 4;
  };
  const Sf: typeof V = [];
  const Bt: typeof V = [];
  for (const v of V) {
    const a = v.r[2] * v.r[3];
    const bg = rgba(v.cs.backgroundColor);
    const hasImg = v.cs.backgroundImage !== "none";
    const parentBg = effBg(v.el.parentElement);
    const comp =
      bg[3] > 0 ? bg.map((x, i) => (i < 3 ? x * bg[3] + parentBg[i]! * (1 - bg[3]) : 1)) : parentBg;
    const diff = bg[3] > 0 && dE(comp, parentBg) >= S.surfaceDeltaE;
    if (
      (diff || hasImg || visibleBorder(v.cs)) &&
      a >= S.surfaceMinArea &&
      a <= S.surfaceMaxShare * vpArea
    )
      Sf.push(v);
    const tag = v.el.tagName.toLowerCase();
    const type = (v.el.getAttribute("type") ?? "").toLowerCase();
    if (
      tag === "button" ||
      v.el.getAttribute("role") === "button" ||
      (tag === "input" && (type === "submit" || type === "button")) ||
      (tag === "a" &&
        (bg[3] > 0 || borderW(v.cs) > 0) &&
        (parseFloat(v.cs.paddingLeft) || 0) >= S.buttonPadX)
    )
      Bt.push(v);
  }
  const SB = [...new Set([...Sf, ...Bt])];
  // 그림자 파싱: "rgba(...) xpx ypx blurpx spreadpx[ inset]"(computed 형식)
  const shadows = (s: string): { a: number; x: number; y: number; blur: number }[] => {
    if (!s || s === "none") return [];
    const layers: string[] = [];
    let depth = 0;
    let cur = "";
    for (const ch of s) {
      if (ch === "(") depth++;
      if (ch === ")") depth--;
      if (ch === "," && depth === 0) {
        layers.push(cur);
        cur = "";
      } else cur += ch;
    }
    layers.push(cur);
    return layers.map((l) => {
      const col = /(rgba?\([^)]*\)|oklch\([^)]*\)|#[0-9a-f]+)/i.exec(l)?.[0] ?? "rgb(0,0,0)";
      const nums = l
        .replace(col, "")
        .trim()
        .split(/\s+/)
        .map((x) => parseFloat(x))
        .filter((x) => !Number.isNaN(x));
      return { a: rgba(col)[3], x: nums[0] ?? 0, y: nums[1] ?? 0, blur: nums[2] ?? 0 };
    });
  };
  const shadowed: { blur: number; hard: boolean }[] = [];
  for (const v of SB) {
    const ls = shadows(v.cs.boxShadow).filter(
      (l) => l.a >= S.shadowAlphaMin && (l.blur > 0 || l.x !== 0 || l.y !== 0),
    );
    if (ls.length === 0) continue;
    const blur = Math.max(...ls.map((l) => l.blur));
    const hard = ls.some(
      (l) => l.blur <= S.hardBlurMax && Math.max(Math.abs(l.x), Math.abs(l.y)) >= S.hardOffsetMin,
    );
    shadowed.push({ blur, hard });
  }
  // --- T: 텍스트 런 ---
  type Run = { el: Element; chars: number; px: number; r: [number, number, number, number] };
  const runs: Run[] = [];
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const vset = new Set(V.map((v) => v.el));
  const range = document.createRange();
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    const el = n.parentElement;
    if (!el || !vset.has(el)) continue;
    const chars = (n.textContent ?? "").replace(/\s+/g, "").length;
    if (chars === 0) continue;
    const px = parseFloat(getComputedStyle(el).fontSize) || 0;
    range.selectNodeContents(n);
    const rects = [...range.getClientRects()].map(absRect).filter(inArea);
    if (rects.length === 0) continue;
    const per = chars / rects.length;
    for (const r of rects) runs.push({ el, chars: per, px, r });
  }
  const totalChars = runs.reduce((s, x) => s + x.chars, 0);
  const sizeW = new Map<number, number>();
  for (const t of runs) sizeW.set(t.px, (sizeW.get(t.px) ?? 0) + t.chars);
  let bodyPx = 0;
  let bw = -1;
  for (const [px, w] of [...sizeW].sort((a, b) => a[0] - b[0]))
    if (w > bw) {
      bw = w;
      bodyPx = px;
    }
  const isH = (t: Run): boolean =>
    !!t.el.closest("h1,h2") || (bodyPx > 0 && t.px >= bodyPx * S.headlineRatio);
  const H = runs.filter(isH);
  // 폰트: 계산 family 목록 중 document.fonts에 loaded인 첫 family, 없으면 첫 generic
  const loaded = new Set(
    [...document.fonts]
      .filter((f) => f.status === "loaded")
      .map((f) => f.family.replace(/["']/g, "").toLowerCase()),
  );
  const GENERIC: Record<string, string> = {
    serif: "serif",
    "sans-serif": "sans_neo_grotesque",
    monospace: "mono",
    cursive: "script",
    fantasy: "display",
    "system-ui": "sans_neo_grotesque",
    "ui-monospace": "mono",
    "ui-serif": "serif",
    "ui-sans-serif": "sans_neo_grotesque",
  };
  const famCache = new Map<Element, { family: string | null; cls: string }>();
  const fontOf = (el: Element): { family: string | null; cls: string } => {
    const hit = famCache.get(el);
    if (hit) return hit;
    const list = getComputedStyle(el)
      .fontFamily.split(",")
      .map((x) => x.trim().replace(/["']/g, "").toLowerCase());
    const fam = list.find((f) => loaded.has(f)) ?? null;
    let cls = fam ? (arg.fontClasses[fam] ?? "unknown") : "unknown";
    if (cls === "unknown") {
      const g = list.find((f) => GENERIC[f]);
      if (g) cls = GENERIC[g]!;
    }
    const out = { family: fam ?? list.find((f) => GENERIC[f]) ?? null, cls };
    famCache.set(el, out);
    return out;
  };
  let wSum = 0;
  let wWarm = 0;
  for (const t of runs) {
    const w = t.chars * (isH(t) ? 2 : 1);
    wSum += w;
    if (["serif", "sans_humanist", "script"].includes(fontOf(t.el).cls)) wWarm += w;
  }
  const hChars = H.reduce((s, x) => s + x.chars, 0);
  const hSerif = H.filter((t) => fontOf(t.el).cls === "serif").reduce((s, x) => s + x.chars, 0);
  const firstVp = runs.filter((t) => t.r[1] < S.vpH);
  const maxFirst = firstVp.reduce((m, t) => Math.max(m, t.px), 0);
  const topFam = (rs: Run[]): { family: string | null; cls: string } => {
    const m = new Map<string, { n: number; f: { family: string | null; cls: string } }>();
    for (const t of rs) {
      const f = fontOf(t.el);
      const k = `${f.family}|${f.cls}`;
      const e = m.get(k) ?? { n: 0, f };
      e.n += t.chars;
      m.set(k, e);
    }
    return [...m.values()].sort((a, b) => b.n - a.n)[0]?.f ?? { family: null, cls: "unknown" };
  };
  const hf = topFam(H);
  const bf = topFam(runs.filter((t) => t.px === bodyPx));
  // F27 tracking, F28 line-height
  let trW = 0;
  let trS = 0;
  for (const t of H) {
    const ls = getComputedStyle(t.el).letterSpacing;
    const em = ls === "normal" ? 0 : (parseFloat(ls) || 0) / (t.px || 1);
    trS += em * t.chars;
    trW += t.chars;
  }
  const lhs: number[] = [];
  for (const t of runs.filter((x) => x.px === bodyPx)) {
    const lh = getComputedStyle(t.el).lineHeight;
    lhs.push(lh === "normal" ? 1.2 : (parseFloat(lh) || 0) / (t.px || 1));
  }
  // --- M: 미디어 ---
  const isIcon = (el: Element, r: [number, number, number, number]): boolean =>
    el.tagName.toLowerCase() === "svg" &&
    ((r[2] >= S.iconMin && r[2] <= S.iconMax && r[3] >= S.iconMin && r[3] <= S.iconMax) ||
      !!el.parentElement?.closest("a,button"));
  const M: [number, number, number, number][] = [];
  let decoSvg = 0;
  let decoBgImg = 0;
  let canvasFirst = 0;
  let canvasCount = 0;
  for (const v of V) {
    const tag = v.el.tagName.toLowerCase();
    const bgi = v.cs.backgroundImage;
    const urlBg = /url\(/.test(bgi);
    if (["img", "picture", "video", "canvas"].includes(tag) || urlBg) M.push(v.r);
    if (tag === "svg" && !isIcon(v.el, v.r)) {
      decoSvg++;
      if (v.r[2] >= S.mediaMin && v.r[3] >= S.mediaMin) M.push(v.r);
    }
    if (urlBg && /\.svg|image\/svg/.test(bgi)) decoBgImg++;
    if (tag === "canvas") {
      canvasCount++;
      const y0 = Math.max(0, v.r[1]);
      const y1 = Math.min(S.vpH, v.r[1] + v.r[3]);
      if (y1 > y0) canvasFirst += (y1 - y0) * v.r[2];
    }
  }
  const gradEls = V.filter((v) => /gradient\(/.test(v.cs.backgroundImage)).length;
  const animEls = new Set(
    document
      .getAnimations()
      .filter((a) => a.playState === "running")
      .map((a) => (a.effect as KeyframeEffect | null)?.target ?? null)
      .filter((x) => x !== null),
  ).size;
  // 합집합 면적(격자 래스터화)
  const cell = S.cellPx;
  const gw = Math.ceil(W / cell);
  const gh = Math.ceil(areaH / cell);
  const unionShare = (rs: [number, number, number, number][]): number => {
    const g = new Uint8Array(gw * gh);
    for (const r of rs) {
      const x0 = Math.max(0, Math.floor(r[0] / cell));
      const x1 = Math.min(gw, Math.ceil((r[0] + r[2]) / cell));
      const y0 = Math.max(0, Math.floor(r[1] / cell));
      const y1 = Math.min(gh, Math.ceil((r[1] + r[3]) / cell));
      for (let y = y0; y < y1; y++) g.fill(1, y * gw + x0, y * gw + x1);
    }
    let c = 0;
    for (const x of g) c += x;
    return g.length ? c / g.length : 0;
  };
  const content = [...runs.map((t) => t.r), ...M];
  // --- Sec: 폭 ≥ 0.9W, 높이 ≥ 200. 감싸개(자식 중 Sec 조건 2개 이상)는 내려간다(ASM-066) ---
  const qual = (el: Element): boolean => {
    const r = el.getBoundingClientRect();
    return r.width >= W * S.secWidthShare && r.height >= S.secMinH && shown(el);
  };
  const secs: Element[] = [];
  const walk = (el: Element): void => {
    for (const c of el.children) {
      if (c.closest("script,style,noscript,template")) continue;
      if (!qual(c)) {
        walk(c);
        continue;
      }
      const kids = [...c.children].filter(qual);
      if (kids.length >= 2) walk(c);
      else secs.push(c);
    }
  };
  walk(document.body);
  const secIn = secs
    .map((el) => ({ el, r: absRect(el.getBoundingClientRect()) }))
    .filter((s) => inArea(s.r))
    .sort((a, b) => a.r[1] - b.r[1]);
  const inside = (
    r: [number, number, number, number],
    s: [number, number, number, number],
  ): boolean =>
    r[1] >= s[1] - 0.5 &&
    r[1] + r[3] <= s[1] + s[3] + 0.5 &&
    r[0] >= s[0] - 0.5 &&
    r[0] + r[2] <= s[0] + s[2] + 0.5;
  const pads: number[] = [];
  const asym: number[] = [];
  for (const s of secIn) {
    const cs = content.filter((r) => inside(r, s.r));
    if (cs.length === 0) continue;
    const top = Math.min(...cs.map((r) => r[1])) - s.r[1];
    const bot = s.r[1] + s.r[3] - Math.max(...cs.map((r) => r[1] + r[3]));
    pads.push((top + bot) / 2);
    if (asym.length < S.topSecs) {
      const aSum = cs.reduce((t, r) => t + r[2] * r[3], 0);
      const cxw = cs.reduce((t, r) => t + (r[0] + r[2] / 2) * r[2] * r[3], 0) / (aSum || 1);
      asym.push(Math.abs(cxw - W / 2) / (W / 2));
    }
  }
  // F13 텍스트 블록 수
  const blocks = V.filter((v) =>
    /^(p|li|h[1-6]|blockquote|figcaption)$/.test(v.el.tagName.toLowerCase()),
  ).length;
  // F29 같은 top(±4px) 형제 블록 수 최빈값(2 이상만, 없으면 1)
  const rowCounts = new Map<number, number>();
  const vEls = new Set(V.map((v) => v.el));
  for (const p of new Set(V.map((v) => v.el.parentElement))) {
    if (!p) continue;
    const kids = [...p.children].filter(
      (c) => vEls.has(c) && getComputedStyle(c).display !== "inline",
    );
    if (kids.length < 2) continue;
    const tops = kids.map((c) => c.getBoundingClientRect().top).sort((a, b) => a - b);
    let run = 1;
    for (let i = 1; i <= tops.length; i++) {
      if (i < tops.length && Math.abs(tops[i]! - tops[i - 1]!) <= S.gridTopTol) run++;
      else {
        if (run >= 2) rowCounts.set(run, (rowCounts.get(run) ?? 0) + 1);
        run = 1;
      }
    }
  }
  let F29 = 1;
  let best = 0;
  for (const [k, c] of [...rowCounts].sort((a, b) => a[0] - b[0]))
    if (c > best) {
      best = c;
      F29 = k;
    }
  const ratio = (xs: unknown[], of: unknown[]): number | null =>
    of.length ? xs.length / of.length : null;
  const withBorder = Sf.filter((v) => visibleBorder(v.cs));
  return {
    F01: median(SB.map((v) => radiusOf(v.cs, v.r))),
    F02: Bt.length ? Bt.filter((v) => radiusOf(v.cs, v.r) >= v.r[3] / 2 - 1).length / Bt.length : 0,
    F03: ratio(withBorder, Sf),
    F04: median(withBorder.map((v) => borderW(v.cs))) ?? 0,
    F05: ratio(shadowed, SB),
    F06: median(shadowed.map((s) => s.blur)) ?? 0,
    F07: shadowed.length ? shadowed.filter((s) => s.hard).length / shadowed.length : 0,
    F08: V.filter((v) => /blur\(/.test(v.cs.backdropFilter || "")).length,
    F09: ratio(
      Sf.filter((v) => /gradient\(/.test(v.cs.backgroundImage)),
      Sf,
    ),
    F10: 1 - unionShare(content),
    F11: area > 0 ? totalChars / (area / 100000) : 0,
    F12: median(pads),
    F13: blocks / vps,
    F16: wSum > 0 ? wWarm / wSum : null,
    F17: hChars > 0 ? hSerif / hChars : null,
    F18: bodyPx > 0 && maxFirst > 0 ? maxFirst / bodyPx : null,
    F22: (decoSvg + gradEls + decoBgImg + animEls + canvasCount) / vps,
    F23: asym.length ? asym.reduce((s, x) => s + x, 0) / asym.length : null,
    F24: unionShare(M),
    F26: {
      heading_family: hf.family,
      body_family: bf.family,
      heading_class: hf.cls,
      body_class: bf.cls,
    },
    F27: trW > 0 ? trS / trW : null,
    F28: median(lhs),
    F29,
    F30: canvasFirst / vpArea,
    areaH,
  };
}
