// worker 렌더 하네스(Playwright chromium, ASM-025 ①·026 ②·027 ④, ASM-055).
// 페이지는 가상 오리진 http://tf.local/ 에 route로 띄운다. /assets/images/* = data/images, /assets/fonts/* = 페이지 서브셋
// (@tastefit/assets/fonts-node가 요청 시 생성·캐시). 그 밖의 요청은 전부 막고 externalRequests로 센다(G-07, 외부 요청 0).
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { materializeFonts, type FaceIn } from "@tastefit/assets/fonts-node";
import type { Browser, Page, Route } from "playwright";
import { collectMeasure, type RawMeasure } from "./measure.js";

export interface PageLike {
  evaluate<R, A = undefined>(fn: (arg: A) => R, arg?: A): Promise<R>;
}
export interface PageMeasure extends RawMeasure {
  vw: number;
  externalRequests: string[];
  failedRequests: string[];
  consoleErrors: string[];
  [k: string]: unknown;
}
export interface Harness {
  measure(html: string, vw: number, opts?: { spec?: unknown }): Promise<PageMeasure>;
  withPage<T>(html: string, vw: number, fn: (page: PageLike) => Promise<T>): Promise<T>;
  platformFontsForHangul(html: string, vw: number): Promise<{ selector: string; family: string }[]>;
  firstViewFontBytes(html: string, vw: number): Promise<number>;
  firstViewImageBytes(html: string, vw: number): Promise<number>;
  headlineLines(
    html: string,
    vw: number,
  ): Promise<{ role: string; lines: number; lastLineChars: number }[]>;
  compileInBrowser(spec: unknown, tree: unknown, data: unknown): Promise<string>;
  extractL1(html: string, vw: number): Promise<number[]>;
  parentProbe(html: string): Promise<{ xss: boolean; contentDocumentNull: boolean }>;
  close(): Promise<void>;
}

export const HARNESS_ORIGIN = "http://tf.local";
const ROOT = resolve(import.meta.dirname, "../../../..");
const FONT_CACHE = join(tmpdir(), "tastefit-harness-fonts");
/** 1280 첫 화면 높이(03장 3.7.5 1280×800, 375×812). */
export const FIRST_VIEW_H: Readonly<Record<number, number>> = { 1280: 800, 375: 812 };
const viewH = (vw: number): number => FIRST_VIEW_H[vw] ?? 900;

interface RegistryFont {
  subsetFamily: string;
  classification: string;
  script: string;
}
let REG: Map<string, RegistryFont> | null = null;
function registry(): Map<string, RegistryFont> {
  if (!REG) {
    const items = (
      JSON.parse(readFileSync(join(ROOT, "data/fonts/registry.json"), "utf8")) as {
        items: RegistryFont[];
      }
    ).items;
    REG = new Map(items.map((f) => [f.subsetFamily, f]));
  }
  return REG;
}

/** html의 @font-face → 서브셋 요청 목록(글자 = 본문 텍스트 전체, 파일 이름은 컴파일러 것 그대로). */
export function facesOf(html: string): { faces: FaceIn[]; chars: string } {
  const faces: FaceIn[] = [];
  const re =
    /@font-face \{ font-family: "([^"]+)"; src: url\("(\/assets\/fonts\/[^"]+)"\) format\("woff2"\); font-weight: (\d+);/g;
  for (const m of html.matchAll(re)) {
    const fam = m[1] ?? "";
    const reg = registry().get(fam);
    faces.push({
      family: fam,
      file: m[2] ?? "",
      weight: Number(m[3]),
      script: reg?.script ?? "hangul",
      classification: reg?.classification ?? "sans_neo_grotesque",
    });
  }
  const body = html.slice(html.indexOf("<body"));
  const text = body
    .replace(/<[^>]*>/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
  const title = /<title>([^<]*)<\/title>/.exec(html)?.[1] ?? "";
  const base =
    Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)).join("") + "「」·…–“”‘’";
  return { faces, chars: [...new Set(base + text + title)].join("") };
}

const TYPES: Readonly<Record<string, string>> = {
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  avif: "image/avif",
  woff2: "font/woff2",
};

interface Session {
  page: Page;
  external: string[];
  failed: string[];
  consoleErrors: string[];
  bytes: { url: string; type: string; size: number }[];
}

async function openPage(browser: Browser, html: string, vw: number): Promise<Session> {
  const ctx = await browser.newContext({
    viewport: { width: vw, height: viewH(vw) },
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  const s: Session = { page, external: [], failed: [], consoleErrors: [], bytes: [] };
  const plan = facesOf(html);
  page.on("console", (m) => {
    if (m.type() === "error") s.consoleErrors.push(m.text());
  });
  await page.route("**/*", async (route: Route) => {
    const url = new URL(route.request().url());
    if (url.origin !== HARNESS_ORIGIN) {
      s.external.push(url.href);
      return route.abort("blockedbyclient");
    }
    if (url.pathname === "/")
      return route.fulfill({ body: html, contentType: "text/html; charset=utf-8" });
    let file: string | null = null;
    if (url.pathname.startsWith("/assets/images/"))
      file = join(
        ROOT,
        "data/images",
        decodeURIComponent(url.pathname.slice("/assets/images/".length)),
      );
    else if (url.pathname.startsWith("/assets/fonts/")) {
      const face = plan.faces.filter((f) => f.file === url.pathname);
      if (face.length) materializeFonts({ faces: face, chars: plan.chars }, FONT_CACHE);
      file = join(FONT_CACHE, url.pathname);
    }
    if (!file || !existsSync(file)) {
      s.failed.push(url.pathname);
      return route.fulfill({ status: 404, body: "" });
    }
    const body = readFileSync(file);
    const ext = file.split(".").pop() ?? "";
    const type = TYPES[ext] ?? "application/octet-stream";
    s.bytes.push({ url: url.pathname, type, size: body.length });
    return route.fulfill({ body, contentType: type });
  });
  await page.goto(`${HARNESS_ORIGIN}/`, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  return s;
}

const closeS = async (s: Session): Promise<void> => {
  await s.page.context().close();
};

let CHROMIUM: { launch: () => Promise<Browser> } | null = null;
function chromium(): { launch: () => Promise<Browser> } {
  if (!CHROMIUM) {
    const req = createRequire(import.meta.url);
    CHROMIUM = (req("playwright") as { chromium: { launch: () => Promise<Browser> } }).chromium;
  }
  return CHROMIUM;
}

export async function openHarness(): Promise<Harness> {
  const browser = await chromium().launch();
  const pending = (n: string) => (): never => {
    throw new Error(`Harness.${n}: M2-09 이후 단위에서 구현 예정`);
  };
  const h: Harness = {
    async measure(html, vw, opts) {
      const s = await openPage(browser, html, vw);
      try {
        const raw = await collectMeasure(s.page, opts?.spec);
        return {
          ...raw,
          vw,
          externalRequests: s.external,
          failedRequests: s.failed,
          consoleErrors: s.consoleErrors,
        };
      } finally {
        await closeS(s);
      }
    },
    async withPage(html, vw, fn) {
      const s = await openPage(browser, html, vw);
      try {
        return await fn(s.page as unknown as PageLike);
      } finally {
        await closeS(s);
      }
    },
    async platformFontsForHangul(html, vw) {
      const s = await openPage(browser, html, vw);
      try {
        const cdp = await s.page.context().newCDPSession(s.page);
        await cdp.send("DOM.enable");
        await cdp.send("CSS.enable");
        const doc = await cdp.send("DOM.getDocument", { depth: -1 });
        const marked = await s.page.evaluate(() => {
          const out: string[] = [];
          let k = 0;
          const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
          for (let n = w.nextNode(); n; n = w.nextNode()) {
            const el = n.parentElement;
            if (!el || !/[가-힣]/.test(n.textContent ?? "")) continue;
            if (el.closest("[aria-hidden='true'],script,style")) continue;
            const r = el.getBoundingClientRect();
            if (r.width === 0 || r.height === 0) continue;
            if (!el.hasAttribute("data-hfont")) {
              el.setAttribute("data-hfont", String(k++));
              out.push(
                `${el.tagName.toLowerCase()}${el.className ? "." + String(el.className).split(" ")[0] : ""}`,
              );
            }
          }
          return out;
        });
        const res: { selector: string; family: string }[] = [];
        for (let i = 0; i < marked.length; i++) {
          const q = await cdp.send("DOM.querySelector", {
            nodeId: doc.root.nodeId,
            selector: `[data-hfont="${i}"]`,
          });
          if (!q.nodeId) continue;
          const f = await cdp.send("CSS.getPlatformFontsForNode", { nodeId: q.nodeId });
          for (const pf of f.fonts) res.push({ selector: marked[i] ?? "", family: pf.familyName });
        }
        return res;
      } finally {
        await closeS(s);
      }
    },
    async firstViewFontBytes(html, vw) {
      const s = await openPage(browser, html, vw);
      try {
        return s.bytes.filter((b) => b.type === "font/woff2").reduce((a, b) => a + b.size, 0);
      } finally {
        await closeS(s);
      }
    },
    async firstViewImageBytes(html, vw) {
      const s = await openPage(browser, html, vw);
      try {
        // 첫 화면 = 스크롤 없이 로드된 이미지(lazy는 화면 밖이면 요청되지 않는다)
        return s.bytes.filter((b) => b.type.startsWith("image/")).reduce((a, b) => a + b.size, 0);
      } finally {
        await closeS(s);
      }
    },
    headlineLines: pending("headlineLines"),
    compileInBrowser: pending("compileInBrowser"),
    extractL1: pending("extractL1"),
    parentProbe: pending("parentProbe"),
    async close() {
      await browser.close();
    },
  };
  return h;
}
