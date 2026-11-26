// worker 렌더 하네스(Playwright chromium, ASM-025 ①·026 ②·027 ④, ASM-055).
// 페이지는 가상 오리진 http://tf.local/ 에 route로 띄운다. /assets/images/* = data/images, /fonts/* = 페이지 서브셋(06장 6.8.3)
// (@tastefit/assets/fonts-node가 요청 시 생성·캐시). 그 밖의 요청은 전부 막고 externalRequests로 센다(G-07, 외부 요청 0).
import { createRequire } from "node:module";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { materializeFonts, type FaceIn } from "@tastefit/assets/fonts-node";
import type { Browser, Page, Route } from "playwright";
import {
  AXES,
  extractFeatures,
  toL1,
  type ExtractPage,
  type Features,
  type Normalizer,
} from "@tastefit/extractor";
import sharp from "sharp";
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
  /** 전체 페이지 PNG + 막은 요청(06장 6.8.3 render_blocked_requests). ASM-058 계약 확장. */
  screenshot(html: string, vw: number): Promise<{ png: Buffer; blocked: string[] }>;
  platformFontsForHangul(html: string, vw: number): Promise<{ selector: string; family: string }[]>;
  firstViewFontBytes(html: string, vw: number): Promise<number>;
  firstViewImageBytes(html: string, vw: number): Promise<number>;
  headlineLines(
    html: string,
    vw: number,
  ): Promise<{ role: string; lines: number; lastLineChars: number }[]>;
  compileInBrowser(spec: unknown, tree: unknown, data: unknown): Promise<string>;
  extractL1(html: string, vw: number): Promise<number[]>;
  /** 05장 5.5.3 원시 특징(M2-09d1, ASM-066). 5.4.2: 1280×800·애니메이션 정착 후 측정. */
  features(html: string, vw: number): Promise<Features>;
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
    /@font-face \{ font-family: "([^"]+)"; src: url\("(\/fonts\/[^"]+)"\) format\("woff2"\); font-weight: (\d+);/g;
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
    .replace(/&#61;/g, "=")
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
    javaScriptEnabled: false, // 06장 6.8.2: 시안 HTML에는 스크립트가 없다(측정 evaluate는 동작)
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
    else if (url.pathname.startsWith("/fonts/")) {
      file = join(FONT_CACHE, url.pathname);
      // 같은 파일 이름 = 같은 글자 집합(subset_fonts.py). 이미 있으면 python 프로세스를 다시 띄우지 않는다.
      // 없으면 이 페이지의 빠진 서체를 한 번에 만든다(python 기동 1회/페이지, ASM-075).
      if (plan.faces.some((f) => f.file === url.pathname) && !existsSync(file)) {
        const missing = plan.faces.filter((f) => !existsSync(join(FONT_CACHE, f.file)));
        materializeFonts({ faces: missing, chars: plan.chars }, FONT_CACHE);
      }
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

/** 현재 정규화기 = data/normalizers의 가장 늦은 버전(design-spec normalizerVersion과 같은 규칙). */
let NZ: Normalizer | null = null;
function normalizer(): Normalizer {
  if (!NZ) {
    const dir = join(ROOT, "data/normalizers");
    const last = readdirSync(dir)
      .filter((f) => f.endsWith(".json"))
      .sort()
      .at(-1);
    if (!last) throw new Error("정규화기 없음(data/normalizers)");
    NZ = JSON.parse(readFileSync(join(dir, last), "utf8")) as Normalizer;
  }
  return NZ;
}

/** 5.5.2: tf- family는 03장 레지스트리 classification으로 분류한다. */
function fontClasses(): Record<string, string> {
  return Object.fromEntries(
    [...registry().values()].map((f) => [f.subsetFamily.toLowerCase(), f.classification]),
  );
}

export async function openHarness(): Promise<Harness> {
  const browser = await chromium().launch();
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
    async screenshot(html, vw) {
      const s = await openPage(browser, html, vw);
      try {
        const png = await s.page.screenshot({ fullPage: true, type: "png" });
        return { png, blocked: [...s.external] };
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
        // 한글 글자만 판정한다(3.7: 라틴 글자·괄호·숫자는 headingLatin 서체가 맡을 수 있음).
        // 한글 연속 구간을 클래스 없는 span으로 감싸 그 span의 플랫폼 폰트를 읽는다(상속 서체 그대로).
        const marked = await s.page.evaluate(() => {
          const out: string[] = [];
          const HANGUL = /[\u1100-\u11ff\u3130-\u318f\uac00-\ud7a3]+/g;
          const targets: Text[] = [];
          const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
          for (let n = w.nextNode(); n; n = w.nextNode()) {
            const el = n.parentElement;
            if (!el || !/[가-힣]/.test(n.textContent ?? "")) continue;
            if (el.closest("[aria-hidden='true'],script,style")) continue;
            const r = el.getBoundingClientRect();
            if (r.width === 0 || r.height === 0) continue;
            targets.push(n as Text);
          }
          for (const n of targets) {
            const el = n.parentElement;
            if (!el) continue;
            const sel = `${el.tagName.toLowerCase()}${el.className ? "." + String(el.className).split(" ")[0] : ""}`;
            const text = n.textContent ?? "";
            const frag = document.createDocumentFragment();
            let last = 0;
            for (const m of text.matchAll(HANGUL)) {
              const at = m.index ?? 0;
              if (at > last) frag.append(text.slice(last, at));
              const span = document.createElement("span");
              span.setAttribute("data-hfont", String(out.length));
              span.textContent = m[0];
              frag.append(span);
              out.push(sel);
              last = at + m[0].length;
            }
            if (last < text.length) frag.append(text.slice(last));
            n.replaceWith(frag);
          }
          return out;
        });
        // span 삽입 뒤 DOM을 다시 읽는다
        const docNow = await cdp.send("DOM.getDocument", { depth: -1 });
        const res: { selector: string; family: string }[] = [];
        for (let i = 0; i < marked.length; i++) {
          const q = await cdp.send("DOM.querySelector", {
            nodeId: docNow.root.nodeId,
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
    async headlineLines(html, vw) {
      const s = await openPage(browser, html, vw);
      try {
        return await s.page.evaluate(() => {
          // 3.8.1: 헤드라인 역할 요소의 줄 수·마지막 줄 글자 수(공백 제외)
          const out: { role: string; lines: number; lastLineChars: number }[] = [];
          for (const el of document.querySelectorAll(
            "[data-role='hero.headline'],[data-role='cta.headline']",
          )) {
            const range = document.createRange();
            const tops: number[] = [];
            const perLine = new Map<number, number>();
            const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
            for (let n = w.nextNode(); n; n = w.nextNode()) {
              const t = n.textContent ?? "";
              for (let i = 0; i < t.length; i++) {
                if (/\s/.test(t[i] ?? "")) continue;
                range.setStart(n, i);
                range.setEnd(n, i + 1);
                const r = range.getBoundingClientRect();
                if (r.width === 0) continue;
                let key = tops.find((y) => Math.abs(y - r.top) < r.height / 2);
                if (key === undefined) {
                  key = r.top;
                  tops.push(key);
                }
                perLine.set(key, (perLine.get(key) ?? 0) + 1);
              }
            }
            tops.sort((a, b) => a - b);
            const last = tops.at(-1);
            out.push({
              role: el.getAttribute("data-role") ?? "",
              lines: tops.length,
              lastLineChars: last === undefined ? 0 : (perLine.get(last) ?? 0),
            });
          }
          return out;
        });
      } finally {
        await closeS(s);
      }
    },
    async compileInBrowser(spec, tree, data) {
      // AC-04-18a: renderer dist ESM을 import map으로 띄워 브라우저에서 compilePageImpl을 실행한다(ASM-027 ①)
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      const MODS: Record<string, string> = {
        "/m/renderer/": join(ROOT, "packages/renderer/dist/"),
        "/m/design-spec/": join(ROOT, "packages/design-spec/dist/"),
        "/m/assets/": join(ROOT, "packages/assets/dist/"),
      };
      const shell =
        '<!doctype html><html><head><script type="importmap">' +
        JSON.stringify({
          imports: {
            "@tastefit/design-spec/tokens-css": "/m/design-spec/tokens-css.js",
            "@tastefit/assets": "/m/assets/index.js",
          },
        }) +
        "</script></head><body></body></html>";
      await page.route("**/*", async (route: Route) => {
        const url = new URL(route.request().url());
        if (url.origin !== HARNESS_ORIGIN) return route.abort("blockedbyclient");
        if (url.pathname === "/") return route.fulfill({ body: shell, contentType: "text/html" });
        const pre = Object.keys(MODS).find((k) => url.pathname.startsWith(k));
        const file = pre ? join(MODS[pre] ?? "", url.pathname.slice(pre.length)) : "";
        if (!file || !existsSync(file)) return route.fulfill({ status: 404, body: "" });
        return route.fulfill({ body: readFileSync(file), contentType: "text/javascript" });
      });
      try {
        await page.goto(`${HARNESS_ORIGIN}/`);
        // import()가 테스트 변환기에 바뀌지 않도록 문자열로 평가한다
        await page.evaluate(
          (args) => {
            (globalThis as unknown as { __tfArgs: unknown }).__tfArgs = args;
          },
          [spec, tree, data],
        );
        return (await page.evaluate(
          `(async () => { await import("/m/renderer/blocks/index.js"); const c = await import("/m/renderer/compile.js"); const [s, t, d] = globalThis.__tfArgs; return c.compilePageImpl(s, t, d).html; })()`,
        )) as string;
      } finally {
        await ctx.close();
      }
    },
    async extractL1(html, vw) {
      const l1 = toL1(await h.features(html, vw), normalizer());
      const bad = AXES.filter((k) => l1[k] === null);
      if (bad.length) throw new Error(`extractL1: 측정 불가 축 ${bad.join(",")}(5.5.3 null)`);
      return AXES.map((k) => l1[k] as number);
    },
    async features(html, vw) {
      const s = await openPage(browser, html, vw);
      try {
        await s.page.evaluate(() => {
          for (const a of document.getAnimations())
            try {
              a.finish();
            } catch {
              a.pause();
            }
        });
        return await extractFeatures(s.page as unknown as ExtractPage, {
          fontClasses: fontClasses(),
          decode: async (png, width) => {
            const { data, info } = await sharp(png)
              .resize({ width, kernel: "nearest" })
              .removeAlpha()
              .raw()
              .toBuffer({ resolveWithObject: true });
            return { data, channels: info.channels };
          },
        });
      } finally {
        await closeS(s);
      }
    },
    async parentProbe(html) {
      // 6.11.4: 부모(JS 켬)가 sandbox="" iframe에 srcdoc으로 넣는다 → 시안 쪽 코드가 부모에 닿는지, 부모가 문서에 닿는지
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await page.route("**/*", (route: Route) => {
        const u = new URL(route.request().url());
        if (u.origin === HARNESS_ORIGIN && u.pathname === "/")
          return route.fulfill({
            body: "<!doctype html><html><body></body></html>",
            contentType: "text/html",
          });
        return route.abort("blockedbyclient");
      });
      try {
        await page.goto(`${HARNESS_ORIGIN}/`);
        return await page.evaluate(async (doc) => {
          const f = document.createElement("iframe");
          f.setAttribute("sandbox", "");
          f.srcdoc = doc;
          const loaded = new Promise((r) => f.addEventListener("load", r));
          document.body.append(f);
          await loaded;
          await new Promise((r) => setTimeout(r, 300));
          return {
            xss: (window as unknown as { __xss?: unknown }).__xss !== undefined,
            contentDocumentNull: f.contentDocument === null,
          };
        }, html);
      } finally {
        await ctx.close();
      }
    },
    async close() {
      await browser.close();
    },
  };
  return h;
}
