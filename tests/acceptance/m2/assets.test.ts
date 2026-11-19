// M2 수용 테스트(4/5): 아이콘·이미지·반응형·다크·브랜드·색 이름(03장 3.9~3.13, AC-03-28~37·41).
// API 계약·해석은 ASSUMPTIONS ASM-026. 시간 상한(5ms)·hue ±5°·사전 40개·일치율 85%는 BLK-007로 뺀다.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { colorName, contrast } from "../../../packages/taxonomy/src/index.js";
import {
  applyBrandColor,
  deriveTokens,
  exportTokens,
  loadDesignData,
  standardTree,
} from "../../../packages/design-spec/src/index.js";
import { iconSvg } from "../../../packages/assets/src/index.js";
import {
  compilePage,
  rendererCssSources,
  renderBlockSample,
} from "../../../packages/renderer/src/index.js";
import { evaluateGates } from "../../../packages/scoring/src/index.js";
import { openHarness, type Harness } from "../../../apps/worker/src/render/harness.js";
import { thresholdNumber } from "../../../packages/config/src/index.js";
import { ROOT } from "../_support/sh.js";

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
type Obj = { [k: string]: Json };

const data = loadDesignData(ROOT);
const presets = data.presets;
const TYPES = ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8"] as const;
const PURPOSES = ["saas", "local_business", "portfolio"] as const;
const BODY = thresholdNumber("generation.contrastBodyMin");
const LARGE = thresholdNumber("generation.contrastLargeMin");
const TOUCH = thresholdNumber("perf.a11y.touchTargetPx");
const json = (rel: string): Obj => JSON.parse(readFileSync(join(ROOT, rel), "utf8")) as Obj;
const ratio = (a: string, b: string): number => Math.floor(contrast(a, b) * 100) / 100;

let h: Harness;
beforeAll(async () => {
  h = await openHarness();
});
afterAll(async () => {
  await h?.close();
});

const trees = (): {
  t: string;
  purpose: string;
  html: string;
  spec: ReturnType<typeof standardTree>["spec"];
}[] =>
  TYPES.flatMap((t) =>
    PURPOSES.map((purpose) => {
      const { spec, tree } = standardTree(t, purpose, data);
      return { t, purpose, spec, html: compilePage(spec, tree, data).html };
    }),
  );

describe("AC-03-28·29 아이콘", () => {
  it("AC-03-28: 의미 40 × 세트 3 = 120 이름이 인라인 SVG로 변환된다", () => {
    const map = json("data/icons/map.json").items as Obj[];
    expect(map).toHaveLength(40);
    let n = 0;
    for (const set of ["phosphor", "tabler", "iconoir"] as const)
      for (const m of map) {
        const svg = iconSvg(set, m.id as string, { strokeWidth: 1.5 });
        expect(svg.startsWith("<svg"), `${set}/${m.id as string}`).toBe(true);
        expect(svg).toContain(`data-icon-set="${set}"`);
        expect(svg).toContain('aria-hidden="true"');
        expect(svg).not.toMatch(/<script|on[a-z]+=|href=/i);
        n++;
      }
    expect(n).toBe(120);
  });

  it("AC-03-28: 한 시안의 모든 svg[data-icon-set]은 같은 세트·같은 굵기", async () => {
    for (const x of trees()) {
      const sets = await h.withPage(x.html, 1280, (page) =>
        page.evaluate(() => {
          const els = [...document.querySelectorAll("svg[data-icon-set]")];
          return {
            sets: [...new Set(els.map((e) => e.getAttribute("data-icon-set")))],
            strokes: [...new Set(els.map((e) => e.getAttribute("data-icon-stroke")))],
          };
        }),
      );
      expect(sets.sets.length, `${x.t}/${x.purpose}`).toBeLessThanOrEqual(1);
      expect(sets.strokes.length, `${x.t}/${x.purpose}`).toBeLessThanOrEqual(1);
      if (sets.sets.length === 1) expect(sets.sets[0]).toBe(x.spec.l2["icon.set"]);
    }
  });

  it("AC-03-29: 버튼·태그·카드 제목 이모지 0, 섹션당 아이콘 수 상한(3.9.1) 위반 0", async () => {
    // 3.9.1 표: 섹션당 상한(기본 4, value.icon-grid 3, location·contact 5)
    const CAP = { default: 4, "value.icon-grid": 3, location: 5, contact: 5 } as Record<
      string,
      number
    >;
    const bad: string[] = [];
    for (const x of trees()) {
      const r = await h.withPage(x.html, 1280, (page) =>
        page.evaluate(() => {
          const emoji = /\p{Emoji_Presentation}/u;
          const roles = ["button.label", "tag.label", "card.title", "item.title"];
          const emo = roles.flatMap((ro) =>
            [...document.querySelectorAll(`[data-role='${ro}']`)]
              .filter((e) => emoji.test(e.textContent ?? ""))
              .map(() => ro),
          );
          const sections = [...document.querySelectorAll("section[data-block]")].map((s) => ({
            block: s.getAttribute("data-block") ?? "",
            variant: s.getAttribute("data-variant") ?? "",
            icons: s.querySelectorAll("svg[data-icon-set]").length,
          }));
          return { emo, sections };
        }),
      );
      for (const e of r.emo) bad.push(`${x.t}/${x.purpose} 이모지 ${e}`);
      for (const s of r.sections) {
        const cap = CAP[s.variant] ?? CAP[s.block] ?? CAP.default!;
        if (s.icons > cap) bad.push(`${x.t}/${x.purpose} ${s.variant} 아이콘 ${s.icons}`);
      }
    }
    expect(bad).toEqual([]);
  });
});

describe("AC-03-30~32 이미지", () => {
  /** 3.10.2 표 */
  const COUNTS: Record<string, number> = {
    "saas.workspace": 10,
    "saas.hands-device": 8,
    "saas.architecture": 10,
    "saas.material": 10,
    "saas.meeting-back": 10,
    "portfolio.studio": 10,
    "portfolio.tools": 10,
    "portfolio.still-life": 10,
    "portfolio.interior": 10,
    "portfolio.nature": 8,
    "local_business.cafe-interior": 12,
    "local_business.coffee": 12,
    "local_business.bakery": 10,
    "local_business.food": 12,
    "local_business.restaurant-interior": 10,
    "local_business.craft": 10,
    "local_business.flower": 8,
    "local_business.storefront": 10,
    "common.texture-paper": 4,
    "common.texture-concrete": 4,
    "common.texture-fabric": 4,
  };
  it("AC-03-30: manifest 192건 필수 메타·라이선스·얼굴/로고 없음·카테고리 장수", () => {
    const m = json("data/images/manifest.json");
    const list = m.items as Obj[];
    expect(list).toHaveLength(192);
    const req = [
      "id",
      "path",
      "sha256",
      "width",
      "height",
      "tags",
      "focalPoint",
      "dominantColor",
      "altKo",
      "source",
      "author",
      "license",
    ];
    const licenses =
      m.provenance === "temp"
        ? ["CC0-1.0", "LicenseRef-Unsplash", "LicenseRef-TasteFit-Generated"]
        : ["CC0-1.0", "LicenseRef-Unsplash"];
    const count: Record<string, number> = {};
    for (const it of list) {
      for (const k of req) {
        const v = it[k];
        expect(v !== null && v !== undefined && v !== "", `${it.id as string}.${k}`).toBe(true);
      }
      expect(licenses, it.id as string).toContain(it.license);
      expect(it.hasRecognizableFace).toBe(false);
      expect(it.hasLogoOrTrademark).toBe(false);
      const cat = (it.tags as string[]).find((t) => t in COUNTS);
      expect(cat, it.id as string).toBeDefined();
      count[cat!] = (count[cat!] ?? 0) + 1;
    }
    expect(count).toEqual(COUNTS);
  });

  it("AC-03-31 / AC-03-32: img src는 이미지 팩·플레이스홀더만, 외부 요청 0, local_business 빈 이미지 슬롯 0, img width·height, 첫 화면 이미지 ≤ 250KB", async () => {
    const bad: string[] = [];
    for (const x of trees()) {
      const m = await h.measure(x.html, 1280);
      for (const r of evaluateGates(m, ["G-07"]))
        if (!r.pass) bad.push(`${x.t}/${x.purpose} G-07 ${r.violations[0] ?? ""}`);
      const r = await h.withPage(x.html, 1280, (page) =>
        page.evaluate(() => {
          const imgs = [...document.querySelectorAll("img")];
          return {
            srcs: imgs.map((i) => i.getAttribute("src") ?? ""),
            noDim: imgs.filter((i) => !i.hasAttribute("width") || !i.hasAttribute("height")).length,
            emptySlots: [...document.querySelectorAll("[data-media-slot]")].filter(
              (s) => !s.querySelector("img") && !s.querySelector("[data-shape-graphic]"),
            ).length,
            mediaSlots: document.querySelectorAll("[data-media-slot]").length,
          };
        }),
      );
      for (const s of r.srcs)
        if (!/^(\/assets\/images\/|data:image\/)/.test(s))
          bad.push(`${x.t}/${x.purpose} src ${s.slice(0, 60)}`);
      if (r.noDim !== 0) bad.push(`${x.t}/${x.purpose} width/height 없는 img ${r.noDim}`);
      if (r.emptySlots !== 0) bad.push(`${x.t}/${x.purpose} 빈 이미지 슬롯 ${r.emptySlots}`);
      if (x.purpose === "local_business" && r.mediaSlots === 0)
        bad.push(`${x.t}/local_business 사진·shape-graphic 없음`);
      const kb = (await h.firstViewImageBytes(x.html, 1280)) / 1024;
      if (kb > 250) bad.push(`${x.t}/${x.purpose} 첫 화면 이미지 ${kb.toFixed(1)}KB`);
    }
    expect(bad).toEqual([]);
  });
});

describe("AC-03-33·34 반응형", () => {
  it("AC-03-33: 블록 variant × 프리셋 8 @375·768 터치 타깃 < touchTargetPx 0건", async () => {
    const blocks = json("data/taxonomy/blocks.json").items as Obj[];
    const bad: string[] = [];
    for (const p of presets)
      for (const b of blocks) {
        if (b.id === "nav") continue;
        for (const v of b.variants as Obj[]) {
          const html = renderBlockSample(
            {
              presetId: p.id,
              block: b.id as string,
              variant: v.id as string,
              purpose: "portfolio",
              copy: "typical",
            },
            data,
          );
          if (html === null) continue;
          for (const vw of [375, 768]) {
            const small = await h.withPage(html, vw, (page) =>
              page.evaluate(
                (min) =>
                  [...document.querySelectorAll("a[href],button,input,select,textarea,summary")]
                    .map((e) => e.getBoundingClientRect())
                    .filter((r) => r.width > 0 && (r.width < min || r.height < min)).length,
                TOUCH,
              ),
            );
            if (small !== 0) bad.push(`${p.id} ${v.id as string}@${vw} ${small}`);
          }
        }
      }
    expect(bad).toEqual([]);
  });

  it("AC-03-34: theme.css·컴파일러 CSS 브레이크포인트 = 3.11.1(48·64·80·96rem)", () => {
    const BP = ["48rem", "64rem", "80rem", "96rem"];
    const p = presets[0]!;
    const theme = exportTokens(deriveTokens({ presetId: p.id, l2: p.l2 }, data), {
      presetId: p.id,
      l2: p.l2,
      taxonomyVersion: data.taxonomyVersion,
    })["tokens/theme.css"];
    for (const [name, v] of [
      ["md", BP[0]],
      ["lg", BP[1]],
      ["xl", BP[2]],
      ["2xl", BP[3]],
    ] as const)
      expect(theme).toContain(`--breakpoint-${name}: ${v};`);
    const used = rendererCssSources().flatMap((s) =>
      [...s.css.matchAll(/@media[^{]*\(min-width:\s*([0-9.]+(?:rem|px|em))\)/g)].map((m) => m[1]!),
    );
    expect(used.length).toBeGreaterThan(1);
    expect(used.filter((u) => !BP.includes(u))).toEqual([]);
  });
});

describe("AC-03-35 다크(T7)", () => {
  // 3.12 다크 규칙 표: [하한, 상한]
  const DARK = {
    bgL: [0.12, 0.22],
    bgC: [0, 0.02],
    fgL: [0.9, 0.96],
    surfDL: [0.03, 0.06],
    primL: [0.7, 0.88],
    primC: [0, 0.18],
  };
  const t7 = presets.find((p) => p.typeId === "T7")!;
  it("4개 팔레트가 다크 규칙·하드 대비를 만족, color 그룹에 테마 분기 없음", () => {
    expect(t7.theme).toBe("dark");
    expect(t7.palettes).toHaveLength(4);
    const inR = (x: number, r: number[]): boolean => x >= r[0]! - 1e-9 && x <= r[1]! + 1e-9;
    for (const pal of t7.palettes) {
      const d = deriveTokens({ presetId: t7.id, l2: { ...t7.l2, "color.palette_id": pal } }, data);
      const c = (d.tokenSet as unknown as Obj).color as Obj;
      expect(
        Object.keys(c).some((k) => k === "light" || k === "dark"),
        pal,
      ).toBe(false);
      const ok = (n: string): number[] => ((c[n] as Obj).$value as Obj).components as number[];
      const hx = (n: string): string => ((c[n] as Obj).$value as Obj).hex as string;
      const [bl, bc] = ok("bg");
      expect(inR(bl!, DARK.bgL) && inR(bc!, DARK.bgC), `${pal} bg ${bl},${bc}`).toBe(true);
      expect(inR(ok("fg")[0]!, DARK.fgL), `${pal} fg`).toBe(true);
      expect(inR(ok("surface")[0]! - bl!, DARK.surfDL), `${pal} surface`).toBe(true);
      const [pl, pc] = ok("primary");
      expect(inR(pl!, DARK.primL) && inR(pc!, DARK.primC), `${pal} primary ${pl},${pc}`).toBe(true);
      for (const [f, b, min] of [
        ["fg", "bg", BODY],
        ["fg", "surface", BODY],
        ["fg-muted", "bg", BODY],
        ["fg-muted", "surface", BODY],
        ["fg-inverse", "surface-inverse", BODY],
        ["border-strong", "bg", LARGE],
        ["primary", "bg", LARGE],
        ["on-primary", "primary", BODY],
        ["focus", "bg", LARGE],
      ] as [string, string, number][])
        expect(ratio(hx(f), hx(b)), `${pal} ${f}/${b}`).toBeGreaterThanOrEqual(min);
      expect(["subtle-shadow", "layered-shadow", "brutal-offset"]).not.toContain(
        t7.l2["depth.style"],
      );
    }
  });
});

describe("AC-03-36·37 브랜드 컬러", () => {
  const HEX24 = [
    "#000000",
    "#FFFFFF",
    "#FF0000",
    "#00FF00",
    "#0000FF",
    "#FFFF00",
    "#00FFFF",
    "#FF00FF",
    "#808080",
    "#F5F5DC",
    "#0A0A0A",
    "#F0F0F0",
    "#123456",
    "#FEDCBA",
    "#FF7F00",
    "#8A2BE2",
    "#2E8B57",
    "#DC143C",
    "#4B0082",
    "#7FFF00",
    "#39FF14",
    "#FDFD96",
    "#AAF0D1",
    "#FFF5CC",
  ];
  it("AC-03-36: 24 × 8유형 = 192건, 모두 4종 결과 중 하나로 종료·예외 0, 결과 TokenSet 하드 대비 통과", () => {
    expect(HEX24).toHaveLength(24);
    const bad: string[] = [];
    let n = 0;
    for (const p of presets)
      for (const hex of HEX24) {
        const r = applyBrandColor(
          { presetId: p.id, paletteId: p.l2["color.palette_id"]!, hex },
          data,
        );
        expect([null, "adjusted", "demoted_to_accent", "used_as_tint", "ignored"]).toContain(
          r.notice,
        );
        const d = deriveTokens({ presetId: p.id, l2: p.l2, brand: { hex } }, data);
        const c = (d.tokenSet as unknown as Obj).color as Obj;
        const hx = (k: string): string | null =>
          c[k] ? (((c[k] as Obj).$value as Obj).hex as string) : null;
        const pairs: [string, string, number][] = [
          ["fg", "bg", BODY],
          ["fg", "surface", BODY],
          ["fg-muted", "bg", BODY],
          ["fg-inverse", "surface-inverse", BODY],
          ["border-strong", "bg", LARGE],
          ["primary", "bg", LARGE],
          ["on-primary", "primary", BODY],
          ["on-primary", "primary-hover", BODY],
          ["on-primary", "primary-active", BODY],
          ["focus", "bg", LARGE],
          ["focus", "surface", LARGE],
        ];
        if (r.role === "accent") pairs.push(["accent", "bg", LARGE]);
        for (const [f, b, min] of pairs) {
          const fh = hx(f);
          const bh = hx(b);
          if (fh === null || bh === null) continue;
          if (ratio(fh, bh) < min) bad.push(`${p.id} ${hex} ${f}/${b} ${ratio(fh, bh)}`);
        }
        n++;
      }
    expect(n).toBe(192);
    expect(bad).toEqual([]);
  });

  it("AC-03-37: 무채 브랜드 색 → primary 불변, 사유 코드 기록", () => {
    for (const p of presets)
      for (const hex of ["#000000", "#FFFFFF", "#808080", "#0A0A0A", "#F0F0F0"]) {
        const r = applyBrandColor(
          { presetId: p.id, paletteId: p.l2["color.palette_id"]!, hex },
          data,
        );
        expect(["brand_neutral_ignored", "brand_neutral_inverse"], `${p.id} ${hex}`).toContain(
          r.reason,
        );
        const base = deriveTokens({ presetId: p.id, l2: p.l2 }, data).tokenSet as unknown as Obj;
        const withB = deriveTokens({ presetId: p.id, l2: p.l2, brand: { hex } }, data)
          .tokenSet as unknown as Obj;
        expect(((withB.color as Obj).primary as Obj).$value).toEqual(
          ((base.color as Obj).primary as Obj).$value,
        );
      }
  });
});

describe("AC-03-41 colorName", () => {
  it("사전이 0~360°를 빈틈없이 덮고, 같은 입력에 같은 출력", () => {
    const dict = data.colorNames as { name: string; h: number[] }[];
    expect(dict.length).toBeGreaterThan(1);
    const covered = (deg: number): boolean =>
      dict.some((e) => {
        const [a, b] = [e.h[0]!, e.h[1]!];
        return a <= b ? deg >= a && deg < b : deg >= a || deg < b;
      });
    const gaps = Array.from({ length: 3600 }, (_v, i) => i / 10).filter((d) => !covered(d));
    expect(gaps.slice(0, 5)).toEqual([]);
    for (const hex of ["#1E2A78", "#C2987A", "#F9F6F1", "#000000", "#39FF14"]) {
      const a = colorName(hex);
      expect(typeof a).toBe("string");
      expect(a.length).toBeGreaterThan(1);
      expect(colorName(hex)).toBe(a);
    }
    expect(colorName("#000000")).toBe("검정");
    expect(colorName("#FFFFFF")).toBe("흰색");
  });
});
