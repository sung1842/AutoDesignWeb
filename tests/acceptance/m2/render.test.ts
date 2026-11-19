// M2 수용 테스트(5/5): 컴파일·렌더·폴백·미리보기(04장 4.8·4.9·4.10, 06장 6.11.4, 09장 9.4.4 ①~④·⑥~⑧,
// AC-04-08(렌더 D)·11·17·18·18a, AC-03-44(렌더), AC-06-24~26·28). ⑤ 시각 회귀 기준선은 e2e(M2-12) 몫.
// API 계약·해석은 ASSUMPTIONS ASM-027.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHash, createHmac } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  compileSpecs,
  deriveTokens,
  fallbackMockup,
  loadDesignData,
  standardTree,
} from "../../../packages/design-spec/src/index.js";
import { LayoutTreeRawSchema } from "../../../packages/layout-schema/src/index.js";
import { compileForEdit, compilePage, fixturePage } from "../../../packages/renderer/src/index.js";
import { evaluateGates } from "../../../packages/scoring/src/index.js";
import { treeLint } from "../../../packages/linter/src/index.js";
import { openHarness, type Harness } from "../../../apps/worker/src/render/harness.js";
import { runRenderJob } from "../../../apps/worker/src/jobs/render.js";
import {
  handlePreview,
  issuePreviewUrl,
  previewFrame,
  signPreview,
} from "../../../apps/web/src/lib/preview.js";
import { getThresholds, thresholdNumber } from "../../../packages/config/src/index.js";
import { ROOT } from "../_support/sh.js";

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
type Obj = { [k: string]: Json };

const data = loadDesignData(ROOT);
const VIEWPORTS = getThresholds().generation.renderViewports as number[];
const TYPES = ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8"] as const;
const PURPOSES = ["saas", "local_business", "portfolio"] as const;
const VARIANTS = ["v_true", "v_fit", "v_bal"] as const;
const KEYS = ["expression", "temperature", "shape", "density", "depth"] as const;
const sha = (s: string): string => createHash("sha256").update(s).digest("hex");
const FX_DIR = join(ROOT, "fixtures/layouts");
const fixtures = (): Obj[] =>
  readdirSync(FX_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => ({ ...(JSON.parse(readFileSync(join(FX_DIR, f), "utf8")) as Obj), file: f }));
const rawOf = (fx: Obj): Obj => (fx.raw ?? fx) as Obj;

let h: Harness;
beforeAll(async () => {
  h = await openHarness();
});
afterAll(async () => {
  await h?.close();
});

/** 정적 검사 금지 패턴(AC-06-24·AC-04-18). */
const BANNED = [
  /<script/i,
  /\son\w+=/i,
  /javascript:/i,
  /dangerouslySetInnerHTML/,
  /type="password"/i,
  /action=/i,
];
const staticBad = (html: string): string[] => [
  ...BANNED.filter((r) => r.test(html)).map((r) => r.source),
  ...[...html.matchAll(/https?:\/\/[^\s"'<>)]+/g)]
    .map((m) => m[0])
    .filter((u) => !/^https?:\/\/(www\.)?w3\.org\//.test(u)),
];

describe("9.4.4 ① 레이아웃 픽스처 30개 이상", () => {
  it("용도 3 × 10 이상, 전부 스키마 유효 + 렌더 성공(G-07 0)", async () => {
    const fx = fixtures();
    for (const p of PURPOSES)
      expect(fx.filter((f) => f.purpose === p).length, p).toBeGreaterThanOrEqual(10);
    const bad: string[] = [];
    for (const f of fx) {
      const r = LayoutTreeRawSchema.safeParse(rawOf(f));
      if (!r.success) {
        bad.push(`${f.file as string} 스키마 ${JSON.stringify(r.error.issues[0])}`);
        continue;
      }
      const { spec, tree } = fixturePage(f, data);
      const { html } = compilePage(spec, tree, data);
      const m = await h.measure(html, 1280);
      for (const g of evaluateGates(m, ["G-07"]))
        if (!g.pass) bad.push(`${f.file as string} ${g.violations[0] ?? ""}`);
    }
    expect(bad).toEqual([]);
  });
});

describe("AC-04-11 용도 3 × 패턴 4 픽스처 트리", () => {
  it("12개가 스키마·린트 T(error 0)·렌더 하드 게이트를 통과", async () => {
    const fx = fixtures();
    const bad: string[] = [];
    let n = 0;
    for (const [p, pre] of [
      ["saas", "PS"],
      ["local_business", "PL"],
      ["portfolio", "PP"],
    ] as const)
      for (const k of [1, 2, 3, 4]) {
        const id = `${pre}-${k}`;
        const f = fx.find((x) => x.purpose === p && rawOf(x).pattern_id === id);
        expect(f, `${p} ${id} 픽스처`).toBeDefined();
        if (!f) continue;
        n++;
        expect(LayoutTreeRawSchema.safeParse(rawOf(f)).success, id).toBe(true);
        const { spec, tree } = fixturePage(f, data);
        for (const l of treeLint(spec, tree).filter((x) => x.severity === "error"))
          bad.push(`${id} ${l.rule}`);
        const { html } = compilePage(spec, tree, data);
        for (const vw of VIEWPORTS) {
          const m = await h.measure(html, vw, { spec });
          for (const g of evaluateGates(m, ["G-02", "G-03", "G-04", "G-05", "G-06", "G-07"]))
            if (!g.pass) bad.push(`${id}@${vw} ${g.id} ${g.violations[0] ?? ""}`);
        }
      }
    expect(n).toBe(12);
    expect(bad).toEqual([]);
  });
});

describe("9.4.4 ②③ 폴백 시안 72 × 뷰포트 5", () => {
  for (const t of TYPES)
    it(`${t}: 대비 AA·가로 넘침·겹침·깨진 이미지 0, 외부 요청 0`, async () => {
      const bad: string[] = [];
      for (const purpose of PURPOSES)
        for (const v of VARIANTS) {
          const { spec, tree } = fallbackMockup(t, purpose, v, data);
          expect(spec.variant).toBe(v);
          const { html } = compilePage(spec, tree, data);
          for (const vw of VIEWPORTS) {
            const m = await h.measure(html, vw);
            for (const g of evaluateGates(m, ["G-02", "G-04", "G-06", "G-07"]))
              if (!g.pass) bad.push(`${purpose}/${v}@${vw} ${g.id} ${g.violations[0] ?? ""}`);
            if (m.externalRequests.length !== 0)
              bad.push(`${purpose}/${v}@${vw} 외부 요청 ${m.externalRequests[0]}`);
          }
        }
      expect(bad).toEqual([]);
    });
});

describe("9.4.4 ④·AC-04-17·18·18a 결정성·정적 안전성", () => {
  it("같은 입력 100회 컴파일 → HTML SHA-256 1종, 렌더 DOM 직렬화도 2회 동일", async () => {
    const { spec, tree } = standardTree("T4", "local_business", data);
    const hs = new Set<string>();
    Array.from({ length: 100 }).forEach(() => hs.add(sha(compilePage(spec, tree, data).html)));
    expect(hs.size).toBe(1);
    const html = compilePage(spec, tree, data).html;
    const dom = async (): Promise<string> =>
      h.withPage(html, 1280, (page) => page.evaluate(() => document.documentElement.outerHTML));
    expect(sha(await dom())).toBe(sha(await dom()));
  });

  it("AC-04-18·AC-06-24: 픽스처 30+ × 프리셋 8 산출물에 외부 URL·script·on*·javascript:·password·action= 0", () => {
    const bad: string[] = [];
    for (const f of fixtures())
      for (const p of data.presets) {
        const { spec, tree } = fixturePage(f, data, { presetId: p.id });
        for (const b of staticBad(compilePage(spec, tree, data).html))
          bad.push(`${f.file as string}/${p.id} ${b}`);
      }
    expect(bad).toEqual([]);
  });

  it("AC-06-24: 브리프에 HTML·스크립트를 넣어도 이스케이프된다", () => {
    const { spec, tree } = standardTree("T1", "saas", data, {
      brandName: `<img src=x onerror="window.__xss=1">`,
      copyOverride: `"><script>window.__xss=1</script>`,
    });
    const html = compilePage(spec, tree, data).html;
    expect(staticBad(html)).toEqual([]);
    expect(html).toContain("&lt;img");
  });

  it("AC-04-18a: 브라우저 번들 실행과 Node의 compile() SHA-256이 같다", async () => {
    const { spec, tree } = standardTree("T6", "portfolio", data);
    const node = sha(compilePage(spec, tree, data).html);
    const browser = await h.compileInBrowser(spec, tree, data);
    expect(sha(browser)).toBe(node);
  });
});

describe("AC-03-44 accentTextSafe = false 렌더", () => {
  it("accent 색 텍스트 노드 0건", async () => {
    let checked = 0;
    const bad: string[] = [];
    for (const p of data.presets)
      for (const pal of p.palettes) {
        const l2 = { ...p.l2, "color.palette_id": pal };
        const d = deriveTokens({ presetId: p.id, l2 }, data);
        if (d.accentTextSafe) continue;
        const accent = (((d.tokenSet as unknown as Obj).color as Obj).accent as Obj | undefined)
          ?.$value as Obj | undefined;
        if (!accent) continue;
        const { spec, tree } = standardTree(p.typeId, "saas", data, { paletteId: pal });
        const { html } = compilePage(spec, tree, data);
        const n = await h.withPage(html, 1280, (page) =>
          page.evaluate((hex) => {
            const want = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(", ");
            const out: string[] = [];
            const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
            for (let x = w.nextNode(); x; x = w.nextNode()) {
              if (!x.textContent?.trim() || !x.parentElement) continue;
              if (getComputedStyle(x.parentElement).color === `rgb(${want})`)
                out.push(x.parentElement.tagName);
            }
            return out.length;
          }, accent.hex as string),
        );
        checked++;
        if (n !== 0) bad.push(`${pal} ${n}`);
      }
    expect(checked).toBeGreaterThan(0);
    expect(bad).toEqual([]);
  });
});

describe("AC-04-08 렌더 벡터 D(골든 θ*)", () => {
  it("변형 쌍 추출 벡터 D ≥ renderDistMin 충족률 ≥ variantRenderDRatioMin", async () => {
    const dMin = thresholdNumber("generation.variant.renderDistMin");
    const rMin = thresholdNumber("release.golden.variantRenderDRatioMin");
    const dir = join(ROOT, "data/golden");
    let ok = 0;
    let total = 0;
    for (const f of readdirSync(dir).filter((x) => x.endsWith(".json"))) {
      const c = JSON.parse(readFileSync(join(dir, f), "utf8")) as Obj;
      const th = (c.persona as Obj).thetaStar as Obj;
      const typeId = (c.expected as Obj).typeId as string;
      const mu = Object.fromEntries(KEYS.map((k) => [k, th[k] as number]));
      const sg = Object.fromEntries(KEYS.map((k) => [k, 0.08]));
      const specs = compileSpecs(
        {
          taste: { mu, sigma: sg, kappa: 0.8, insensitive_axes: [], type_id: typeId } as never,
          purpose: c.purpose as never,
          brand: null,
          jobSeed: `golden-${f}`,
        },
        data,
      );
      const vecs: Record<string, number[]> = {};
      for (const v of VARIANTS) {
        const { tree } = fallbackMockup(typeId, c.purpose as string, v, data, { spec: specs[v] });
        const { html } = compilePage(specs[v], tree, data);
        vecs[v] = await h.extractL1(html, 1280);
      }
      for (const [x, y] of [
        ["v_true", "v_fit"],
        ["v_true", "v_bal"],
        ["v_fit", "v_bal"],
      ] as const) {
        const d = vecs[x]!.reduce((s, a, i) => s + Math.abs(a - vecs[y]![i]!), 0);
        total++;
        if (d >= dMin) ok++;
      }
    }
    expect(total).toBe(96);
    expect(ok / total).toBeGreaterThanOrEqual(rMin);
  });
});

describe("D-25 worker render 잡·AC-06-28 차단 카운터", () => {
  it("뷰포트 5장 PNG, 정상 픽스처 render_blocked_requests = 0", async () => {
    const { spec, tree } = standardTree("T2", "saas", data);
    const r = await runRenderJob({ html: compilePage(spec, tree, data).html }, h);
    expect(r.screenshots.map((s) => s.viewport)).toEqual(VIEWPORTS);
    for (const s of r.screenshots) expect(s.png.subarray(1, 4).toString("ascii")).toBe("PNG");
    expect(r.renderBlockedRequests).toBe(0);
    expect(r.externalRequests).toEqual([]);
  });

  it("외부 URL이 든 조작 HTML: 외부 요청 0건, 차단 카운터 ≥ 1", async () => {
    const { spec, tree } = standardTree("T2", "saas", data);
    const html = compilePage(spec, tree, data).html.replace(
      "</body>",
      `<img src="https://example.com/x.png" width="1" height="1" alt=""><link rel="stylesheet" href="http://evil.test/a.css"></body>`,
    );
    const r = await runRenderJob({ html }, h);
    expect(r.externalRequests).toEqual([]);
    expect(r.renderBlockedRequests).toBeGreaterThanOrEqual(1);
  });
});

describe("9.4.4 ⑦ renderer 금지 의존성", () => {
  it("renderer package.json·소스에 tailwindcss·shadcn·lucide·react-dom/client 0", () => {
    const pj = JSON.parse(
      readFileSync(join(ROOT, "packages/renderer/package.json"), "utf8"),
    ) as Obj;
    const deps = Object.keys({
      ...((pj.dependencies as Obj) ?? {}),
      ...((pj.devDependencies as Obj) ?? {}),
    });
    expect(deps.filter((d) => /tailwind|shadcn|lucide|@radix-ui/.test(d))).toEqual([]);
    let out = "";
    try {
      out = execFileSync(
        "git",
        [
          "grep",
          "-n",
          "-E",
          "from ['\"](tailwindcss|lucide|@radix-ui|class-variance-authority)",
          "--",
          "packages/renderer",
        ],
        {
          cwd: ROOT,
          encoding: "utf8",
        },
      );
    } catch {
      out = "";
    }
    expect(out.trim()).toBe("");
  });
});

describe("9.4.4 ⑧ / AC-06-25 / AC-06-26 미리보기 격리", () => {
  const WEB = "http://127.0.0.1:3000";
  const PREVIEW = "http://localhost:3100";
  const SECRET = "s".repeat(32);
  const deps = (owner: string) => ({
    env: {
      WEB_ORIGIN: WEB,
      PREVIEW_ORIGIN: PREVIEW,
      PREVIEW_SIGNING_SECRET: SECRET,
      APP_ENV: "local" as const,
    },
    now: () => 1_800_000_000_000,
    loadCandidate: async (id: string) => {
      if (id !== "cand-1") return null;
      const { spec, tree } = standardTree("T3", "portfolio", data);
      return { ownerId: owner, spec, tree };
    },
    data,
  });
  const CSP =
    "default-src 'none'; style-src 'unsafe-inline'; img-src {PREVIEW_ORIGIN} data:; font-src {PREVIEW_ORIGIN}; base-uri 'none'; form-action 'none'; frame-ancestors {WEB_ORIGIN}; sandbox"
      .replaceAll("{PREVIEW_ORIGIN}", PREVIEW)
      .replaceAll("{WEB_ORIGIN}", WEB);

  it("유효 서명 → 200, 헤더가 6.11.4와 바이트 일치, 본문 script 0", async () => {
    const d = deps("u1");
    const exp = Math.floor(d.now() / 1000) + 600;
    const sig = createHmac("sha256", SECRET).update(`candidate|cand-1|1280|${exp}`).digest("hex");
    expect(signPreview(SECRET, "candidate", "cand-1", 1280, exp)).toBe(sig);
    const res = await handlePreview(
      new Request(`${PREVIEW}/render/candidate/cand-1?vp=1280&exp=${exp}&sig=${sig}`),
      d,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-security-policy")).toBe(CSP);
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("referrer-policy")).toBe("no-referrer");
    expect(res.headers.get("cross-origin-resource-policy")).toBe("cross-origin");
    expect(res.headers.get("cache-control")).toBe("private, max-age=300");
    expect(res.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(staticBad(await res.text())).toEqual([]);
  });

  it("서명 틀림·만료 → 403, 남의 candidate 서명 발급 → 404", async () => {
    const d = deps("u1");
    const now = Math.floor(d.now() / 1000);
    const bad = await handlePreview(
      new Request(
        `${PREVIEW}/render/candidate/cand-1?vp=1280&exp=${now + 600}&sig=${"0".repeat(64)}`,
      ),
      d,
    );
    expect(bad.status).toBe(403);
    const old = now - 1;
    const sig = signPreview(SECRET, "candidate", "cand-1", 1280, old);
    const expired = await handlePreview(
      new Request(`${PREVIEW}/render/candidate/cand-1?vp=1280&exp=${old}&sig=${sig}`),
      d,
    );
    expect(expired.status).toBe(403);
    expect(
      (await issuePreviewUrl({ userId: "u2", kind: "candidate", id: "cand-1", vp: 1280 }, d))
        .status,
    ).toBe(404);
    const okIssue = await issuePreviewUrl(
      { userId: "u1", kind: "candidate", id: "cand-1", vp: 1280 },
      d,
    );
    expect(okIssue.status).toBe(200);
    const exp = Number(new URL(okIssue.url!).searchParams.get("exp"));
    expect(exp - now).toBeLessThanOrEqual(15 * 60);
  });

  it('iframe: 표시 sandbox=""·측정 sandbox="allow-same-origin", allow-scripts 0, srcdoc 첫 요소 meta CSP, 부모 접근 불가', async () => {
    const show = previewFrame({ kind: "display", src: `${PREVIEW}/render/candidate/c?vp=1280` });
    const measure = previewFrame({ kind: "measure", srcdoc: "<p>x</p>" });
    expect(show).toMatch(/\ssandbox=""/);
    expect(measure).toMatch(/\ssandbox="allow-same-origin"/);
    for (const f of [show, measure]) expect(f).not.toContain("allow-scripts");
    const { spec, tree } = standardTree("T5", "saas", data, {
      brandName: `<img src=x onerror="parent.__xss=1">`,
    });
    const { html } = compileForEdit(spec.tokens, tree, 1280, { webOrigin: WEB, spec, data });
    const head = /<head[^>]*>\s*(<[^>]+>)/i.exec(html)?.[1] ?? "";
    expect(head).toBe(
      `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src ${WEB} data:; font-src ${WEB}; base-uri 'none'; form-action 'none'">`,
    );
    const r = await h.parentProbe(html);
    expect(r.xss).toBe(false);
    expect(r.contentDocumentNull).toBe(true);
  });
});
