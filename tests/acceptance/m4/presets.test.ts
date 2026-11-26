// M4 수용 테스트: 프리셋 8종(03장 AC-03-12~14). 표준 트리 조화·대비, 유형 중심 분리, 같은 고정 콘텐츠의 렌더 차이.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  loadDesignData,
  standardTree,
  surveyPage,
} from "../../../packages/design-spec/src/index.js";
import { compilePage } from "../../../packages/renderer/src/index.js";
import { harmonyScore } from "../../../packages/scoring/src/index.js";
import { nearestType } from "../../../packages/diagnosis/src/index.js";
import { openHarness, type Harness } from "../../../apps/worker/src/render/harness.js";
import { ROOT, run } from "../_support/sh.js";

const data = loadDesignData(ROOT);
const read = <T>(rel: string): T => JSON.parse(readFileSync(join(ROOT, rel), "utf8")) as T;
const TYPES = read<{
  items: { id: string; centroid: number[]; anchorPresetId: string; goodPurposes: string[] }[];
}>("data/taxonomy/types.json").items;
const PALETTES = new Map(
  read<{ items: { id: string; contrastFailures: unknown[] }[] }>(
    "data/taxonomy/palettes.json",
  ).items.map((p) => [p.id, p]),
);
/** 03장 AC-03-13 유형 중심 쌍별 최소 거리, AC-03-14 primary 색 차(ΔE_OK)·속성 차이 수. */
const AC = { centerMinDist: 0.25, primaryDeltaEOk: 0.05, minDiffProps: 3, props: 6 } as const;
const dist = (a: number[], b: number[]) =>
  Math.sqrt(a.reduce((s, v, i) => s + (v - (b[i] ?? 0)) ** 2, 0));

describe("AC-03-12 프리셋 8종 스키마·대비·조화", () => {
  it("AC-03-12 data:validate 통과, 팔레트 3.1.3 대비 실패 0, 표준 트리 H = 100·상충 0", async () => {
    const v = await run("pnpm", ["-s", "data:validate"], ROOT);
    expect(v.code, v.out.slice(-1500)).toBe(0);
    expect(data.presets).toHaveLength(8);
    for (const p of data.presets) {
      const pal = PALETTES.get(String((p.l2 as Record<string, string>)["color.palette_id"]));
      expect(pal, p.id).toBeDefined();
      expect(pal!.contrastFailures, p.id).toEqual([]);
      const purpose = TYPES.find((t) => t.id === p.typeId)?.goodPurposes[0] ?? "saas";
      const { spec, tree } = standardTree(p.typeId, purpose, data);
      const h = harmonyScore(spec, tree);
      expect(h.total, `${p.id} H`).toBe(100);
      expect(h.conflicts, `${p.id} 상충`).toEqual([]);
    }
  });
});

describe("AC-03-13 유형 중심 분리·앵커 자기 판정", () => {
  it("AC-03-13 중심 쌍별 거리 최솟값 ≥ 0.25, 앵커 8/8이 최근접 판정에서 자기 유형", () => {
    let min = Number.POSITIVE_INFINITY;
    for (let i = 0; i < TYPES.length; i++)
      for (let j = i + 1; j < TYPES.length; j++)
        min = Math.min(min, dist(TYPES[i]!.centroid, TYPES[j]!.centroid));
    expect(min).toBeGreaterThanOrEqual(AC.centerMinDist);
    for (const p of data.presets) {
      const sig = (p.l1 as number[]).map(() => 1);
      expect(nearestType(p.l1 as number[], sig, TYPES).typeId, p.id).toBe(p.typeId);
    }
  });
});

describe("AC-03-14 같은 고정 콘텐츠 트리의 프리셋 간 렌더 차이", () => {
  let h: Harness;
  beforeAll(async () => {
    h = await openHarness();
  });
  afterAll(async () => {
    await h?.close();
  });
  it("AC-03-14 28쌍 모두 6속성(radius 집합·깊이·제목 서체·본문 서체·primary ΔE_OK·border 두께) 중 ≥ 3개가 다르다", async () => {
    interface Props {
      radius: string;
      depth: string;
      heading: string;
      body: string;
      primary: [number, number, number];
      primaryRaw: string;
      border: string;
    }
    const got: { id: string; p: Props }[] = [];
    for (const preset of data.presets) {
      const { spec, tree } = surveyPage({ presetId: preset.id, templateId: "tpl-hero" }, data);
      const { html } = compilePage(spec, tree, data);
      const p = await h.withPage(html, 1280, (pg) =>
        pg.evaluate(() => {
          const els = [...document.querySelectorAll("body *")];
          const uniq = (xs: string[]) => [...new Set(xs)].sort().join("|");
          const cs = (e: Element) => getComputedStyle(e);
          const lin = (c: number) => {
            const s = c / 255;
            return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
          };
          const btn = document.querySelector(".tf-button--primary");
          const bg = btn ? cs(btn).backgroundColor : "";
          // computed 색은 rgb(…) 또는 oklch(L C H)(토큰이 oklch)로 온다
          const ok = /oklch\(([\d.]+%?)\s+([\d.]+)\s+([\d.]+)/.exec(bg);
          const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/.exec(bg) ?? [];
          const [R, G, B] = [
            lin(Number(m[1] ?? 0)),
            lin(Number(m[2] ?? 0)),
            lin(Number(m[3] ?? 0)),
          ];
          const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
          const mm = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
          const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
          const okL = ok ? (ok[1]!.endsWith("%") ? parseFloat(ok[1]!) / 100 : Number(ok[1])) : 0;
          const okLab: [number, number, number] | null = ok
            ? [
                okL,
                Number(ok[2]) * Math.cos((Number(ok[3]) * Math.PI) / 180),
                Number(ok[2]) * Math.sin((Number(ok[3]) * Math.PI) / 180),
              ]
            : null;
          const heading = document.querySelector("h1, h2");
          return {
            radius: uniq(
              els.flatMap((e) => {
                const r = parseFloat(cs(e).borderTopLeftRadius) || 0;
                const b = e.getBoundingClientRect();
                return r > 0 && r < Math.min(b.width, b.height) / 2 ? [String(r)] : [];
              }),
            ),
            depth: uniq(els.map((e) => cs(e).boxShadow).filter((x) => x !== "none")),
            heading: (heading ? cs(heading).fontFamily : "").split(",")[0]?.trim() ?? "",
            body: cs(document.body).fontFamily.split(",")[0]?.trim() ?? "",
            primary:
              okLab ??
              ([
                0.2104542553 * l + 0.793617785 * mm - 0.0040720468 * s,
                1.9779984951 * l - 2.428592205 * mm + 0.4505937099 * s,
                0.0259040371 * l + 0.7827717662 * mm - 0.808675766 * s,
              ] as [number, number, number]),
            primaryRaw: bg,
            border: uniq(els.map((e) => cs(e).borderTopWidth).filter((x) => x !== "0px")),
          };
        }),
      );
      got.push({ id: preset.id, p });
    }
    const weak: string[] = [];
    for (let i = 0; i < got.length; i++)
      for (let j = i + 1; j < got.length; j++) {
        const a = got[i]!.p;
        const b = got[j]!.p;
        const diff = [
          a.radius !== b.radius,
          a.depth !== b.depth,
          a.heading !== b.heading,
          a.body !== b.body,
          dist(a.primary, b.primary) >= AC.primaryDeltaEOk,
          a.border !== b.border,
        ];
        expect(diff).toHaveLength(AC.props);
        const n = diff.filter(Boolean).length;
        if (n < AC.minDiffProps)
          weak.push(`${got[i]!.id}~${got[j]!.id}: ${n} ${JSON.stringify([a, b])}`);
      }
    expect(weak).toEqual([]);
  });
});
