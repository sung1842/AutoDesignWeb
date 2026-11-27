// M5 수용 테스트(13): 이미지 태그 허용 집합·사진 대체(04장 4.2.1·4.9.4, AC-04-44 ①②⑤)와
// 헤드라인 덱 예산·워드마크·role_overrides(04장 4.6.2·4.10.2, AC-04-46 ①②④⑤). 골든 기반 ③(④)은 golden.test.
// 계약: ASSUMPTIONS ASM-120(industryTags·maxCharsJob 시그니처, 픽스처 fixtures/image-tags/briefs.json).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import {
  buildFallback,
  compileSpecs,
  imageTagsAllowed,
  industryTags,
  loadDesignData,
  maxCharsJob,
} from "../../../packages/design-spec/src/index.js";
import { compilePage } from "../../../packages/renderer/src/index.js";
import { treeLint } from "../../../packages/linter/src/index.js";
import { createMockProvider } from "../../../packages/llm/src/index.js";
import { openHarness, type Harness } from "../../../apps/worker/src/render/harness.js";
import { evaluateCandidate } from "../../../apps/worker/src/quality/evaluate.js";
import { openPipe, type Pipe } from "../_support/pipe.js";
import { ROOT } from "../_support/sh.js";

const data = loadDesignData(ROOT);
const TYPES = ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8"] as const;
const PURPOSES = ["saas", "local_business", "portfolio"] as const;
const KEYS = ["expression", "temperature", "shape", "density", "depth"] as const;
/** 4.6.2 덱 예산 하한(3.8.1 계산 결과 "전 조합 ≥ 10", U-11). */
const MAX_CHARS_FLOOR = 10;
/** AC-04-46 ② 브랜드명 길이·뷰포트. */
const NAME_LENGTHS = [1, 14, 30];
const WORDMARK_VPS = [375, 1280];
/** AC-04-46 ④ hero 제목 길이. */
const HERO_LEN = 24;

const json = <T>(p: string): T => JSON.parse(readFileSync(join(ROOT, p), "utf8")) as T;
const DICT = json<{ items: { keyword: string; tags: string[] }[] }>(
  "config/image_tag_keywords.json",
).items;
const FIX = json<{
  items: {
    id: string;
    purpose: (typeof PURPOSES)[number];
    brand: { description: string; keyPoints: string[] };
    kind: "match" | "no_match" | "no_intersection";
    expected: string[];
  }[];
}>("fixtures/image-tags/briefs.json").items;
const purposeTags = (p: string) => data.imageTags.filter((t) => t.startsWith(`${p}.`));
const commonTags = data.imageTags.filter((t) => t.startsWith("common."));

/** 골든 페르소나에서 유형별 대표 취향(계획 L1). */
function taste(typeId: string) {
  const g = readdirSync(join(ROOT, "data/golden"))
    .filter((f) => f.endsWith(".json"))
    .map((f) =>
      json<{ persona: { thetaStar: Record<string, number> }; expected: { typeId: string } }>(
        `data/golden/${f}`,
      ),
    )
    .find((x) => x.expected.typeId === typeId);
  const mu = Object.fromEntries(KEYS.map((k) => [k, g?.persona.thetaStar[k] ?? 0.5]));
  const sigma = Object.fromEntries(KEYS.map((k) => [k, 0.08]));
  return { mu, sigma, kappa: 0.8, insensitive_axes: [], type_id: typeId };
}
const BRAND = {
  name: "온결 베이커리",
  description: "망원동에서 매일 아침 굽는 사워도우 빵집",
  primaryAction: "reserve",
  keyPoints: ["매일 아침 굽는 빵", "천연 발효종"],
};
const specsFor = (t: string, p: string, brand: Record<string, unknown> = BRAND) =>
  compileSpecs(
    {
      taste: taste(t) as never,
      purpose: p as never,
      brand: brand as never,
      jobSeed: `deck-${t}-${p}`,
    },
    data,
  );

describe("AC-04-44 이미지 태그 허용 집합", () => {
  it("AC-04-44 ① 키워드 사전 픽스처 30건(매칭 20 + 비매칭 10): image_tags_allowed = 기대 집합, ⊆ purposeTags ∪ common.*, 공집합 0, 용도별 매칭 0·교집합 0 사례 포함", () => {
    expect(FIX).toHaveLength(30);
    expect(FIX.filter((f) => f.kind === "match")).toHaveLength(20);
    for (const p of PURPOSES)
      for (const k of ["no_match", "no_intersection"] as const)
        expect(
          FIX.some((f) => f.purpose === p && f.kind === k),
          `${p} ${k}`,
        ).toBe(true);
    for (const f of FIX) {
      const tags = industryTags(f.brand, DICT);
      const got = [...imageTagsAllowed(f.purpose, data, tags)].sort();
      expect(got, f.id).toEqual([...f.expected].sort());
      expect(got.length, f.id).toBeGreaterThan(0);
      const ok = new Set([...purposeTags(f.purpose), ...commonTags]);
      expect(
        got.filter((t) => !ok.has(t)),
        f.id,
      ).toEqual([]);
    }
  });
  it("AC-04-44 ② 허용 밖 이미지 태그를 낸 트리 → LT-10 error", () => {
    const specs = specsFor("T3", "local_business");
    const { spec, tree } = buildFallback(
      {
        typeId: "T3",
        purpose: "local_business",
        variant: "v_true",
        spec: specs.v_true,
        brand: BRAND,
      },
      data,
    );
    // 첫 이미지 태그를 다른 용도 태그로 바꾼다
    let swapped = false;
    const walk = (v: unknown): unknown => {
      if (Array.isArray(v)) return v.map(walk);
      if (v && typeof v === "object") {
        const o: Record<string, unknown> = {};
        for (const [k, x] of Object.entries(v)) {
          if (!swapped && k === "tag" && typeof x === "string") {
            o[k] = "saas.workspace";
            swapped = true;
          } else o[k] = walk(x);
        }
        return o;
      }
      return v;
    };
    const bad = walk(tree);
    expect(swapped, "이미지 태그 슬롯").toBe(true);
    const f = treeLint(spec, bad);
    expect(f.some((x) => x.rule === "LT-10" && x.severity === "error")).toBe(true);
  });
});

describe("AC-04-44 ⑤ 사진 대체 플래그(파이프라인)", () => {
  let P: Pipe;
  beforeAll(async () => {
    P = await openPipe("tastefit_m5deck");
  });
  afterAll(async () => {
    await P?.close();
  });
  it("AC-04-44 ⑤ 업종 매칭 0 브리프 → photoSubstituted=true 카드 ≥ 1, 매칭 브리프 → 전부 false", async () => {
    const none = FIX.find((f) => f.purpose === "local_business" && f.kind === "no_match");
    const hit = FIX.find((f) => f.purpose === "local_business" && f.kind === "match");
    const brand = (d: { description: string; keyPoints: string[] }) => ({
      name: "결무늬",
      description: d.description,
      primaryAction: "contact",
      keyPoints: d.keyPoints,
    });
    const a = await P.job("ok", {
      brand: brand(none?.brand ?? { description: "", keyPoints: [] }),
    });
    const b = await P.job("ok", { brand: brand(hit?.brand ?? { description: "", keyPoints: [] }) });
    const ma = (a.view.mockups ?? []) as { photoSubstituted: boolean }[];
    const mb = (b.view.mockups ?? []) as { photoSubstituted: boolean }[];
    expect(ma.length).toBeGreaterThan(0);
    expect(mb.length).toBeGreaterThan(0);
    expect(ma.some((m) => m.photoSubstituted)).toBe(true);
    expect(mb.every((m) => !m.photoSubstituted)).toBe(true);
  });
});

describe("AC-04-46 헤드라인 덱 예산·워드마크·role_overrides", () => {
  let h: Harness;
  beforeAll(async () => {
    h = await openHarness();
  });
  afterAll(async () => {
    await h?.close();
  });
  it("AC-04-46 ① maxChars_job: 잡당 결정론 1개 정수 ≥ 10(유형 8 × 용도 3), 덱 hero.headline 3옵션 중 ≥ 1개가 그 이하", async () => {
    const mock = createMockProvider({
      scenario: "ok",
      latencyMs: 0,
      sleep: (_ms: number, s: AbortSignal) =>
        s.aborted ? Promise.reject(new Error("aborted")) : Promise.resolve(),
    });
    for (const t of TYPES)
      for (const p of PURPOSES) {
        const specs = specsFor(t, p);
        const a = maxCharsJob(specs, data);
        expect(maxCharsJob(specsFor(t, p), data), `${t}/${p} 결정론`).toBe(a);
        expect(Number.isInteger(a), `${t}/${p}`).toBe(true);
        expect(a, `${t}/${p}`).toBeGreaterThanOrEqual(MAX_CHARS_FLOOR);
        const r = await mock.complete({
          role: "gen_copy",
          callKind: "initial",
          candidateIndex: null,
          attempt: 1,
          signal: new AbortController().signal,
          input: { brand: BRAND, purpose: p, maxCharsJob: a },
        } as never);
        expect(r.kind).toBe("ok");
        const deck = JSON.parse(r.kind === "ok" ? r.text : "{}") as {
          "hero.headline"?: { text: string }[];
        };
        const lens = (deck["hero.headline"] ?? []).map((x) => [...x.text].length);
        expect(lens).toHaveLength(3);
        expect(
          lens.some((n) => n <= a),
          `${t}/${p} ${JSON.stringify(lens)} > ${a}`,
        ).toBe(true);
      }
  });
  it("AC-04-46 ② 브랜드명 1·14·30자 × 프리셋 8 × {375, 1280}: nav·footer 워드마크 G-04·G-06 위반 0", async () => {
    const bad: string[] = [];
    for (const len of NAME_LENGTHS)
      for (const t of TYPES) {
        const name = "한결빵집커피공방".repeat(4).slice(0, len);
        const brand = { ...BRAND, name };
        const specs = specsFor(t, "local_business", brand);
        const { spec, tree } = buildFallback(
          { typeId: t, purpose: "local_business", variant: "v_true", spec: specs.v_true, brand },
          data,
        );
        const { html } = compilePage(spec, tree, data);
        const { report } = await evaluateCandidate(h, { spec, tree, html }, data, {
          fallback: true,
        });
        for (const g of report.hard)
          if ((g.id === "G-04" || g.id === "G-06") && g.status !== "pass")
            if (g.viewport === undefined || WORDMARK_VPS.includes(g.viewport))
              bad.push(
                `${len}자 ${t} ${g.id}@${String(g.viewport)} ${JSON.stringify(g.measured).slice(0, 120)}`,
              );
      }
    expect(bad).toEqual([]);
  });
  it("AC-04-46 ④ hero 제목 24자로 바꾼 트리: 클라이언트(브라우저) 컴파일과 서버 재컴파일의 role_overrides(data-step) 동일", async () => {
    const specs = specsFor("T5", "saas");
    const { spec, tree } = buildFallback(
      { typeId: "T5", purpose: "saas", variant: "v_true", spec: specs.v_true, brand: BRAND },
      data,
    );
    const t = JSON.parse(JSON.stringify(tree)) as {
      sections: { slots?: Record<string, { copy?: { text: string } }> }[];
    };
    const head = t.sections[0]?.slots?.headline?.copy;
    expect(head, "hero headline 슬롯").toBeTruthy();
    if (head) head.text = "가".repeat(HERO_LEN);
    const server = compilePage(spec, t, data).html;
    const client = await h.compileInBrowser(spec, t, data);
    const steps = (html: string) => [...html.matchAll(/data-step="([^"]*)"/g)].map((m) => m[1]);
    expect(steps(client)).toEqual(steps(server));
  });
  it("AC-04-46 ⑤ spec.render_adjustments 필드가 스키마·코드에 0건", () => {
    const hits: string[] = [];
    const walk = (d: string): void => {
      for (const n of readdirSync(d)) {
        if (["node_modules", "dist", ".next", ".turbo"].includes(n)) continue;
        const p = join(d, n);
        if (statSync(p).isDirectory()) walk(p);
        else if (
          /\.(ts|tsx|json)$/.test(p) &&
          readFileSync(p, "utf8").includes("render_adjustments")
        )
          hits.push(relative(ROOT, p));
      }
    };
    for (const d of ["packages", "apps", "data", "config"]) walk(join(ROOT, d));
    expect(hits.filter((f) => !f.startsWith("config/lock/"))).toEqual([]);
  });
});
