// M2 수용 테스트(3/5): 컴포넌트·블록·서체·조판·텍스트 역할(03장 3.1.5·3.1.5a·3.5~3.8, AC-03-15~27·42·45·46).
// 렌더 측정은 worker 렌더 하네스(Playwright chromium)로 한다. API 계약·해석은 ASSUMPTIONS ASM-025.
// AC-03-15의 axe-core 검사는 BLK-008(의존성 허용 목록에 없음), AC-03-24의 CLS ≤ 0.05는 BLK-007로 뺀다.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  expectedSize,
  letterSpacingEm,
  loadDesignData,
  standardTree,
} from "../../../packages/design-spec/src/index.js";
import {
  compilePage,
  cssLiteralViolations,
  rendererCssSources,
  renderBlockSample,
  renderComponentGallery,
  renderStepProbe,
} from "../../../packages/renderer/src/index.js";
import { copyDeckLimits } from "../../../packages/layout-schema/src/index.js";
import { evaluateGates, harmonyScore } from "../../../packages/scoring/src/index.js";
import { treeLint } from "../../../packages/linter/src/index.js";
import { validateBundle } from "../../../packages/data-contracts/src/index.js";
import { openHarness, type Harness } from "../../../apps/worker/src/render/harness.js";
import { getThresholds, thresholdNumber } from "../../../packages/config/src/index.js";
import { ROOT, run, tmpRepo } from "../_support/sh.js";

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
type Obj = { [k: string]: Json };

const data = loadDesignData(ROOT);
const presets = data.presets;
const VIEWPORTS = getThresholds().generation.renderViewports as number[];
const TYPES = ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8"] as const;
const PURPOSES = ["saas", "local_business", "portfolio"] as const;
const STEPS = ["t-caption", "t-small", "t-body", "t-lead", "t-4", "t-3", "t-2", "t-1", "t-display"];
const items = (rel: string): Obj[] =>
  (JSON.parse(readFileSync(join(ROOT, rel), "utf8")) as { items: Obj[] }).items;
const blocks = items("data/taxonomy/blocks.json");
const components = items("data/taxonomy/components.json");
const textRoles = items("data/taxonomy/text-roles.json");
const ROLE_IDS = new Set(textRoles.map((r) => r.id as string));
const harmonyRule = (id: string): Obj =>
  ((data.harmony as Obj[]).find((h) => h.id === id) as Obj).rule as Obj;
const TOL_PX = harmonyRule("H6").tolerancePx as number; // 0.5px(T-28), 03장 3.1.5 원천을 옮긴 값

let h: Harness;
beforeAll(async () => {
  h = await openHarness();
});
afterAll(async () => {
  await h?.close();
});

const GEOM = ["G-04", "G-05", "G-06"];

describe("AC-03-15·16·17 컴포넌트", () => {
  it("AC-03-15: 18종 × variant × ● state × 프리셋 8 렌더, 케이스 수 = components.json 계산값, G-02·G-07 0건", async () => {
    expect(components).toHaveLength(18);
    const expectCases = components.reduce((n, c) => {
      const states = Object.values((c.states as Obj) ?? {}).filter((v) => v === true).length;
      const variants = Math.max(1, ((c.variants as Json[] | undefined) ?? []).length);
      return n + states * variants;
    }, 0);
    const bad: string[] = [];
    for (const p of presets) {
      const g = renderComponentGallery(p.id, data, { copy: "typical" });
      expect(g.cases, p.id).toHaveLength(expectCases);
      for (const c of g.cases) expect(g.html).toContain(`data-case="${c}"`);
      for (const vw of [1280, 375]) {
        const m = await h.measure(g.html, vw);
        for (const r of evaluateGates(m, ["G-02", "G-07"]))
          if (!r.pass) bad.push(`${p.id}@${vw} ${r.id} ${r.violations.slice(0, 3).join("; ")}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("AC-03-16: 컴포넌트 CSS(state 포함)는 토큰 변수 참조만(리터럴 0)", () => {
    const comp = rendererCssSources().filter((s) => s.path.includes("components/"));
    expect(comp.length).toBeGreaterThan(1);
    for (const s of comp) {
      expect(cssLiteralViolations(s.css), s.path).toEqual([]);
      expect(s.css, s.path).not.toContain("!important");
    }
  });

  it("AC-03-17: 상한 길이 카피(Button 10·Tag 8·Stat 값 10자)로 375/768/1280 넘침·잘림 0", async () => {
    const bad: string[] = [];
    for (const p of presets) {
      const g = renderComponentGallery(p.id, data, { copy: "max" });
      expect(g.html).toContain("가".repeat(10));
      for (const vw of [375, 768, 1280]) {
        const m = await h.measure(g.html, vw);
        for (const r of evaluateGates(m, ["G-04", "G-05"]))
          if (!r.pass) bad.push(`${p.id}@${vw} ${r.id} ${r.violations.slice(0, 3).join("; ")}`);
      }
    }
    expect(bad).toEqual([]);
  });
});

describe("AC-03-18 블록 50 variant × 용도 × 프리셋 8 × 뷰포트 5", () => {
  const variants = blocks
    .filter((b) => b.id !== "nav")
    .flatMap((b) =>
      (b.variants as Obj[]).map((v) => ({ block: b.id as string, variant: v.id as string })),
    );
  it("variant 수 50(nav 제외, ASM-012)", () => expect(variants).toHaveLength(50));
  for (const p of presets) {
    it(`${p.id}: 상한 길이 카피로 G-04·G-05·G-06 0건`, async () => {
      const bad: string[] = [];
      for (const { block, variant } of variants) {
        for (const purpose of PURPOSES) {
          const pur = (data.purposes as Obj[]).find((x) => x.id === purpose)!;
          if (((pur.forbiddenSections as string[]) ?? []).includes(block)) continue;
          const html = renderBlockSample(
            { presetId: p.id, block, variant, purpose, copy: "max" },
            data,
          );
          if (html === null) continue; // 프리셋 제외 variant(excludedVariants)
          for (const vw of VIEWPORTS) {
            const m = await h.measure(html, vw);
            for (const r of evaluateGates(m, GEOM))
              if (!r.pass) bad.push(`${variant}/${purpose}@${vw} ${r.id} ${r.violations[0] ?? ""}`);
          }
        }
      }
      expect(bad).toEqual([]);
    });
  }
});

describe("AC-03-19·21 슬롯·폴백 체인(정적)", () => {
  it("AC-03-19: 모든 슬롯 maxLength ≥ 덱 상한, 덱에 없는 키 참조 0", () => {
    const limits = copyDeckLimits();
    const bad: string[] = [];
    for (const b of blocks)
      for (const s of (b.slots as Obj[]) ?? []) {
        if (s.kind === "image" || s.kind === "media") continue;
        for (const k of (s.deckKeys as string[]) ?? []) {
          const lim = limits[k];
          if (lim === undefined) {
            bad.push(`${b.id as string}.${s.id as string}: 덱에 없는 키 ${k}`);
            continue;
          }
          const ml = s.maxLength as Json;
          const mlv = typeof ml === "number" ? [ml] : Object.values((ml as Obj) ?? {}).map(Number);
          const limv = typeof lim === "number" ? [lim] : Object.values(lim).map(Number);
          if (Math.min(...mlv) < Math.max(...limv))
            bad.push(`${b.id as string}.${s.id as string} ${k}`);
        }
      }
    expect(bad).toEqual([]);
  });

  it("AC-03-21: fallback_variant 체인 비순환, 이미지 0장 variant 또는 블록 제거로 끝남", () => {
    const all = new Map(
      blocks.flatMap((b) => (b.variants as Obj[]).map((v) => [v.id as string, v] as const)),
    );
    const bad: string[] = [];
    for (const [id] of all) {
      const seen = new Set<string>();
      let cur: string = id;
      for (;;) {
        if (seen.has(cur)) {
          bad.push(`${id}: 순환 ${[...seen].join("→")}`);
          break;
        }
        seen.add(cur);
        const v = all.get(cur);
        if (!v) {
          bad.push(`${id}: 없는 variant ${cur}`);
          break;
        }
        const next = v.fallback_variant as string | null;
        if (next === "remove") break;
        if (next === null) {
          if (v.image !== null) bad.push(`${id}: 끝(${cur})이 이미지 variant인데 블록 제거 아님`);
          break;
        }
        cur = next;
      }
    }
    expect(bad).toEqual([]);
  });
});

describe("AC-03-20 표준 트리 24개", () => {
  it("8유형 × 3용도: G-01·G-02·G-03·LT-01~08·RH-01~02 위반 0, H = 100", async () => {
    let n = 0;
    const bad: string[] = [];
    for (const t of TYPES)
      for (const purpose of PURPOSES) {
        const { spec, tree } = standardTree(t, purpose, data);
        const lint = treeLint(spec, tree).filter((x) => /^(G-01|LT-0[1-8]|RH-0[12])$/.test(x.rule));
        for (const x of lint) bad.push(`${t}/${purpose} ${x.rule} ${x.message}`);
        const { html } = compilePage(spec, tree, data);
        for (const vw of [1280, 375]) {
          const m = await h.measure(html, vw);
          for (const r of evaluateGates(m, ["G-02", "G-03"]))
            if (!r.pass) bad.push(`${t}/${purpose}@${vw} ${r.id} ${r.violations[0] ?? ""}`);
        }
        expect(harmonyScore(spec, tree).total, `${t}/${purpose} H`).toBe(100);
        n++;
      }
    expect(n).toBe(24);
    expect(bad).toEqual([]);
  });
});

describe("AC-03-22·25 서체 레지스트리·페어링(정적)", () => {
  it("AC-03-22: registry 26종 license OFL-1.1·licenseUrl·reservedFontName 채움, verified_at은 temp만 비어도 됨", () => {
    const reg = JSON.parse(readFileSync(join(ROOT, "data/fonts/registry.json"), "utf8")) as Obj;
    const list = reg.items as Obj[];
    expect(list).toHaveLength(26);
    for (const f of list) {
      expect(f.license, f.id as string).toBe("OFL-1.1");
      expect(typeof f.licenseUrl === "string" && f.licenseUrl !== "", f.id as string).toBe(true);
      expect(typeof f.reservedFontName, f.id as string).toBe("boolean");
      if (reg.provenance !== "temp") expect(f.verified_at, f.id as string).not.toBeNull();
    }
    const broken = JSON.parse(JSON.stringify(reg)) as Obj;
    delete ((broken.items as Obj[])[0] as Obj).licenseUrl;
    expect(validateBundle("data/fonts/registry.json", broken).ok).toBe(false);
    const human = JSON.parse(JSON.stringify(reg)) as Obj;
    human.provenance = "human";
    ((human.items as Obj[])[0] as Obj).verified_at = null;
    expect(validateBundle("data/fonts/registry.json", human).ok).toBe(false);
  });

  it("AC-03-22: 빈 필드가 있으면 data:validate(빌드) 실패", async () => {
    const dir = tmpRepo({ linkModules: true });
    const p = join(dir, "data/fonts/registry.json");
    const j = JSON.parse(readFileSync(p, "utf8")) as Obj;
    (((j.items as Obj[])[1] as Obj).license as Json) = "";
    writeFileSync(p, JSON.stringify(j, null, 2));
    const r = await run("pnpm", ["-s", "data:validate"], dir);
    expect(r.code, r.out.slice(-400)).not.toBe(0);
  });

  it("AC-03-25 정적: 모든 페어링의 비 mono 패밀리 ≤ H4 만점 상한", () => {
    const pairs = items("data/fonts/pairings.json");
    const reg = new Map(items("data/fonts/registry.json").map((f) => [f.id as string, f]));
    const max = ((harmonyRule("H4").tiers as Obj[])[0] as Obj).max as number;
    for (const pr of pairs) {
      const fams = new Set(
        ["headingFontId", "headingLatinFontId", "bodyFontId"]
          .map((k) => pr[k] as string | undefined)
          .filter((x): x is string => typeof x === "string")
          .map((id) => reg.get(id))
          .filter((f) => f !== undefined && f.classification !== "mono")
          .map((f) => f!.family as string),
      );
      expect(fams.size, pr.code as string).toBeLessThanOrEqual(max);
    }
  });
});

describe("AC-03-23·24·25·26 서체 렌더(표준 트리·골든 대체: 폴백 시안)", () => {
  it("AC-03-23: 페어링 20 × 허용 프리셋, 한글 텍스트 노드 실제 폰트 = 지정 한글 서체, 시스템 폴백 0", async () => {
    const pairs = items("data/fonts/pairings.json");
    const reg = new Map(items("data/fonts/registry.json").map((f) => [f.id as string, f]));
    const bad: string[] = [];
    let combos = 0;
    for (const pr of pairs)
      for (const p of presets) {
        if (!(p.allowed["type.pairing_id"] ?? []).includes(pr.code as string)) continue;
        const { spec, tree } = standardTree(p.typeId, "saas", data, {
          pairingId: pr.code as string,
        });
        const { html } = compilePage(spec, tree, data);
        const want = new Set(
          ["headingFontId", "bodyFontId"].map(
            (k) => (reg.get(pr[k] as string)?.subsetFamily as string) ?? "",
          ),
        );
        const used = await h.platformFontsForHangul(html, 1280);
        combos++;
        for (const u of used)
          if (!want.has(u.family))
            bad.push(`${pr.code as string}/${p.id} ${u.selector}: ${u.family}`);
      }
    expect(combos).toBeGreaterThan(1);
    expect(bad).toEqual([]);
  });

  it("AC-03-24: 첫 화면 폰트 전송량 최댓값 ≤ firstViewFontKbMax", async () => {
    const maxKb = thresholdNumber("generation.firstViewFontKbMax");
    let worst = 0;
    for (const t of TYPES)
      for (const purpose of PURPOSES) {
        const { spec, tree } = standardTree(t, purpose, data);
        const { html } = compilePage(spec, tree, data);
        const kb = (await h.firstViewFontBytes(html, 1280)) / 1024;
        worst = Math.max(worst, kb);
      }
    expect(worst).toBeLessThanOrEqual(maxKb);
  });

  it("AC-03-25 렌더: heading 요소 computed font-weight 1종", async () => {
    for (const t of TYPES) {
      const { spec, tree } = standardTree(t, "portfolio", data);
      const { html } = compilePage(spec, tree, data);
      const ws = await h.withPage(html, 1280, (page) =>
        page.evaluate(() => [
          ...new Set(
            [...document.querySelectorAll("h1,h2,h3")].map((e) => getComputedStyle(e).fontWeight),
          ),
        ]),
      );
      expect(ws, t).toHaveLength(1);
    }
  });

  it("AC-03-26: 고아 글자 헤드라인 0, 375px 헤드라인 3줄 초과 0, justify 0, ② 비율 기록", async () => {
    const bad: string[] = [];
    let total = 0;
    let lowered = 0;
    for (const t of TYPES)
      for (const purpose of PURPOSES) {
        const { spec, tree } = standardTree(t, purpose, data);
        const { html } = compilePage(spec, tree, data);
        total++;
        if (tree.sections.some((s) => Object.keys(s.role_overrides ?? {}).length > 0)) lowered++;
        for (const vw of [1280, 375]) {
          const hl = await h.headlineLines(html, vw);
          const cap = vw === 375 ? 3 : 2; // 3.8.1 표(데스크톱 ≤ 2줄, 375 ≤ 3줄)
          for (const x of hl) {
            if (x.lines > cap) bad.push(`${t}/${purpose}@${vw} ${x.role} ${x.lines}줄`);
            if ([1, 2].includes(x.lastLineChars))
              bad.push(`${t}/${purpose}@${vw} ${x.role} 고아 글자`);
          }
          const justified = await h.withPage(html, vw, (page) =>
            page.evaluate(
              () =>
                [...document.querySelectorAll("body *")].filter(
                  (e) => getComputedStyle(e).textAlign === "justify",
                ).length,
            ),
          );
          if (justified !== 0) bad.push(`${t}/${purpose}@${vw} justify ${justified}`);
        }
      }
    writeFileSync(
      join(ROOT, "reports/m2/headline-budget.json"),
      JSON.stringify({ total, lowered, ratio: lowered / total }, null, 2) + "\n",
    );
    expect(bad).toEqual([]);
  });
});

describe("AC-03-27 자간 표(3.8.2)", () => {
  // [px, 고딕·display, 명조, 라틴 heading]
  const T: [number, number, number, number][] = [
    [23, 0, 0, 0],
    [24, -0.01, -0.005, 0],
    [31, -0.01, -0.005, 0],
    [32, -0.02, -0.01, -0.01],
    [47, -0.02, -0.01, -0.01],
    [48, -0.03, -0.015, -0.015],
    [71, -0.03, -0.015, -0.015],
    [72, -0.04, -0.02, -0.02],
  ];
  for (const [px, sans, serif, latin] of T)
    it(`${px}px`, () => {
      expect(letterSpacingEm(px, "sans")).toBe(sans);
      expect(letterSpacingEm(px, "serif")).toBe(serif);
      expect(letterSpacingEm(px, "latin-heading")).toBe(latin);
    });
});

describe("AC-03-42·46 텍스트 역할", () => {
  it("AC-03-42: 블록 템플릿에 font-size 리터럴·text-* 크기 클래스 0, text-roles.json 검증 통과", () => {
    const out = (() => {
      try {
        return execFileSync(
          "git",
          [
            "grep",
            "-n",
            "-E",
            "font-size:\\s*[0-9.]+(px|rem|em)|\\btext-(xs|sm|base|lg|[2-9]?xl)\\b",
            "--",
            "packages/renderer/src",
          ],
          { cwd: ROOT, encoding: "utf8" },
        );
      } catch {
        return "";
      }
    })();
    expect(out.trim()).toBe("");
    const tr = JSON.parse(readFileSync(join(ROOT, "data/taxonomy/text-roles.json"), "utf8")) as Obj;
    expect(validateBundle("data/taxonomy/text-roles.json", tr).ok).toBe(true);
  });

  it("AC-03-42: 렌더된 모든 텍스트 노드의 가장 가까운 요소에 data-role이 있고 text-roles 키다", async () => {
    const bad: string[] = [];
    for (const t of TYPES) {
      const { spec, tree } = standardTree(t, "local_business", data);
      const { html } = compilePage(spec, tree, data);
      const roles = await h.withPage(html, 1280, (page) =>
        page.evaluate(() => {
          const out: (string | null)[] = [];
          const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
          for (let n = w.nextNode(); n; n = w.nextNode()) {
            if (!n.textContent || n.textContent.trim() === "") continue;
            const el = n.parentElement?.closest("[data-role]");
            const hidden = n.parentElement?.closest("[aria-hidden='true'],script,style,noscript");
            if (hidden) continue;
            out.push(el ? el.getAttribute("data-role") : null);
          }
          return out;
        }),
      );
      for (const r of roles) if (r === null || !ROLE_IDS.has(r)) bad.push(`${t}: ${String(r)}`);
    }
    expect(bad).toEqual([]);
  });

  it("AC-03-46 ①④: components·blocks 텍스트 슬롯·요소에 역할 키, price 키 0", () => {
    const bad: string[] = [];
    for (const c of components)
      for (const r of (c.textRoles as string[]) ?? [])
        if (!ROLE_IDS.has(r)) bad.push(`${c.id as string}: ${r}`);
    for (const c of components)
      if (
        ((c.textRoles as string[]) ?? []).length === 0 &&
        c.name !== "Divider" &&
        c.name !== "MediaFrame"
      )
        bad.push(`${c.id as string} 역할 없음`);
    for (const b of blocks)
      for (const s of (b.slots as Obj[]) ?? []) {
        if (s.kind === "image" || s.kind === "media") continue;
        const rs = (s.textRoles as string[] | undefined) ?? [];
        if (rs.length === 0) bad.push(`${b.id as string}.${s.id as string} 역할 없음`);
        for (const r of rs)
          if (!ROLE_IDS.has(r)) bad.push(`${b.id as string}.${s.id as string}: ${r}`);
      }
    expect(bad).toEqual([]);
    expect(ROLE_IDS.has("price")).toBe(false);
    expect(ROLE_IDS.has("pricing.price")).toBe(true);
  });

  it("AC-03-46 ②③: button.label md font-size 1종, menu.price ≤ menu.item", async () => {
    for (const p of presets) {
      const g = renderComponentGallery(p.id, data, { copy: "typical" });
      for (const vw of [375, 1280]) {
        const sizes = await h.withPage(g.html, vw, (page) =>
          page.evaluate(() => [
            ...new Set(
              [...document.querySelectorAll("[data-role='button.label'][data-size='md']")].map(
                (e) => getComputedStyle(e).fontSize,
              ),
            ),
          ]),
        );
        expect(sizes, `${p.id}@${vw}`).toHaveLength(1);
      }
      if ((p.excludedVariants as string[] | undefined)?.includes("menu.leader")) continue;
      const html = renderBlockSample(
        {
          presetId: p.id,
          block: "menu",
          variant: "menu.leader",
          purpose: "local_business",
          copy: "typical",
        },
        data,
      );
      if (html === null) continue;
      for (const vw of VIEWPORTS) {
        const [item, price] = await h.withPage(html, vw, (page) =>
          page.evaluate(() =>
            ["menu.item", "menu.price"].map((r) =>
              parseFloat(getComputedStyle(document.querySelector(`[data-role='${r}']`)!).fontSize),
            ),
          ),
        );
        expect(price!, `${p.id}@${vw}`).toBeLessThanOrEqual(item!);
      }
    }
  });
});

describe("AC-03-45 expectedSize·G-12·AIL-17", () => {
  it("① 프리셋 8 × 단계 9 × 뷰포트 5: expectedSize = 브라우저 computed ± tolerancePx", async () => {
    const bad: string[] = [];
    for (const p of presets) {
      const { spec } = standardTree(p.typeId, "saas", data);
      const html = renderStepProbe(spec, data);
      for (const vw of VIEWPORTS) {
        const got = await h.withPage(html, vw, (page) =>
          page.evaluate(() =>
            Object.fromEntries(
              [...document.querySelectorAll("[data-step-probe]")].map((e) => [
                e.getAttribute("data-step-probe"),
                parseFloat(getComputedStyle(e).fontSize),
              ]),
            ),
          ),
        );
        for (const step of STEPS) {
          const exp = expectedSize(spec.tokens, step, vw);
          const g = got[step];
          if (g === undefined || Math.abs(g - exp) > TOL_PX)
            bad.push(`${p.id}@${vw} ${step} ${String(g)} vs ${exp}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it("②④ 표준 트리 24 × 뷰포트 5: G-12·AIL-17 0건, nav.wordmark = t-lead 또는 하향 단계", async () => {
    const bad: string[] = [];
    for (const t of TYPES)
      for (const purpose of PURPOSES) {
        const { spec, tree } = standardTree(t, purpose, data);
        const { html } = compilePage(spec, tree, data);
        for (const vw of VIEWPORTS) {
          const m = await h.measure(html, vw, { spec });
          for (const r of evaluateGates(m, ["G-12", "AIL-17"]))
            if (!r.pass) bad.push(`${t}/${purpose}@${vw} ${r.id} ${r.violations[0] ?? ""}`);
          const wm = await h.withPage(html, vw, (page) =>
            page.evaluate(() =>
              parseFloat(
                getComputedStyle(document.querySelector("[data-role='nav.wordmark']")!).fontSize,
              ),
            ),
          );
          const okSizes = ["t-lead", "t-body", "t-small"].map((s) =>
            expectedSize(spec.tokens, s, vw),
          );
          if (!okSizes.some((s) => Math.abs(s - wm) <= TOL_PX))
            bad.push(`${t}/${purpose}@${vw} nav.wordmark ${wm}`);
        }
      }
    expect(bad).toEqual([]);
  });

  it("③ 스케일 밖 값 픽스처(padding 13px·font-size 15px)는 모든 뷰포트에서 검출", async () => {
    const { spec, tree } = standardTree("T2", "saas", data);
    const { html } = compilePage(spec, tree, data);
    const bad = html.replace(
      "</head>",
      "<style>[data-block='hero'] [data-role='hero.headline']{font-size:15px}[data-block='hero']{padding:13px}</style></head>",
    );
    for (const vw of VIEWPORTS) {
      const m = await h.measure(bad, vw, { spec });
      const res = evaluateGates(m, ["G-12", "AIL-17"]);
      expect(res.find((r) => r.id === "G-12")!.pass, `G-12@${vw}`).toBe(false);
      expect(res.find((r) => r.id === "AIL-17")!.pass, `AIL-17@${vw}`).toBe(false);
    }
  });
});
