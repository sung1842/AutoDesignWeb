// M3 수용 테스트(2/5): 하드 게이트·조화 항목 순수 함수, 원본 유사도 가드 G-11
// (04장 4.10.2·4.10.3·4.10.6, 08장 8.3, AC-04-19·21, AC-08-11·12·13a). API 계약은 ASSUMPTIONS ASM-078.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import {
  GATE_FNS,
  HARMONY_FNS,
  checkOriginality,
  loadOriginalityConfig,
  type OriginalityInput,
  type ReferenceSig,
} from "../../../packages/scoring/src/index.js";
import { hamming64, phash64 } from "../../../packages/extractor/src/index.js";
import { openHarness, type Harness } from "../../../apps/worker/src/render/harness.js";
import { ROOT } from "../_support/sh.js";

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
type Obj = { [k: string]: Json };

interface SharpChain {
  extract(r: { left: number; top: number; width: number; height: number }): SharpChain;
  modulate(o: { brightness: number }): SharpChain;
  jpeg(o: { quality: number }): SharpChain;
  png(): SharpChain;
  removeAlpha(): SharpChain;
  raw(): SharpChain;
  toBuffer(o: { resolveWithObject: true }): Promise<{
    data: Buffer;
    info: { width: number; height: number; channels: number };
  }>;
  toBuffer(): Promise<Buffer>;
}
// sharp는 worker 의존성(허용 목록). 테스트는 worker 경로로 해석한다.
const sharp = createRequire(join(ROOT, "apps/worker/package.json"))("sharp") as (
  b: Buffer,
) => SharpChain;

const GATE_IDS = Array.from({ length: 13 }, (_, i) => `G-${String(i + 1).padStart(2, "0")}`);
const H_IDS = Array.from({ length: 12 }, (_, i) => `H${i + 1}`);
const FX_DIR = join(ROOT, "packages/scoring/fixtures");

interface Fixture {
  file: string;
  id: string;
  expect: "pass" | "fail";
  input: Json;
}
function fixtures(id: string): Fixture[] {
  const dir = join(FX_DIR, id);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => ({ ...(JSON.parse(readFileSync(join(dir, f), "utf8")) as Fixture), file: f }));
}

describe("AC-04-19 게이트 G-01~G-13·조화 H1~H12 = 독립 순수 함수, 항목당 통과·실패 픽스처 ≥ 2", () => {
  it("함수 목록이 장 항목과 같다", () => {
    expect(Object.keys(GATE_FNS).sort()).toEqual([...GATE_IDS].sort());
    expect(Object.keys(HARMONY_FNS).sort()).toEqual([...H_IDS].sort());
  });

  for (const id of GATE_IDS) {
    it(`${id} 픽스처`, () => {
      const fx = fixtures(id);
      // 통과 ≥ 2·실패 ≥ 2 = pass-1·pass-2·fail-1·fail-2 파일 존재(수치 비교 대신 이름 규약, BLK-014)
      for (const n of ["pass-1.json", "pass-2.json", "fail-1.json", "fail-2.json"])
        expect(existsSync(join(FX_DIR, id, n)), `${id}/${n}`).toBe(true);
      for (const f of fx)
        expect(f.file.startsWith(`${f.expect}-`), `${id}/${f.file} 파일명`).toBe(true);
      for (const f of fx) {
        expect(f.id, f.file).toBe(id);
        const a = GATE_FNS[id](f.input);
        const b = GATE_FNS[id](JSON.parse(JSON.stringify(f.input)) as Json);
        expect(a, `${id}/${f.file} 결정적`).toEqual(b); // 순수: 같은 입력 → 같은 결과
        expect(a.id).toBe(id);
        expect(a.pass, `${id}/${f.file}`).toBe(f.expect === "pass");
        if (!a.pass) expect(a.violations.length, `${id}/${f.file} 위반 기록`).toBeGreaterThan(0);
      }
    });
  }

  for (const id of H_IDS) {
    it(`${id} 픽스처(통과 = 만점, 실패 = 감점)`, () => {
      const fx = fixtures(id);
      // 통과 ≥ 2·실패 ≥ 2 = pass-1·pass-2·fail-1·fail-2 파일 존재(수치 비교 대신 이름 규약, BLK-014)
      for (const n of ["pass-1.json", "pass-2.json", "fail-1.json", "fail-2.json"])
        expect(existsSync(join(FX_DIR, id, n)), `${id}/${n}`).toBe(true);
      for (const f of fx)
        expect(f.file.startsWith(`${f.expect}-`), `${id}/${f.file} 파일명`).toBe(true);
      for (const f of fx) {
        expect(f.id, f.file).toBe(id);
        const a = HARMONY_FNS[id](f.input);
        expect(a, `${id}/${f.file} 결정적`).toEqual(
          HARMONY_FNS[id](JSON.parse(JSON.stringify(f.input)) as Json),
        );
        expect(a.max).toBeGreaterThan(0);
        expect(a.score).toBeGreaterThanOrEqual(0);
        expect(a.score).toBeLessThanOrEqual(a.max);
        if (f.expect === "pass") expect(a.score, `${id}/${f.file}`).toBe(a.max);
        else expect(a.score, `${id}/${f.file}`).toBeLessThan(a.max);
      }
    });
  }

  it("H 항목 만점 합 = 100(4.10.3)", () => {
    const fx = fixtures("H1")[0];
    expect(fx).toBeDefined();
    let sum = 0;
    for (const id of H_IDS) sum += HARMONY_FNS[id](fixtures(id)[0]?.input ?? null).max;
    expect(sum).toBe(100);
  });
});

/** 08장 8.3.3 설정 블록(FINAL 원문) → 값. */
function specOriginality(): Obj {
  const md = readFileSync(join(ROOT, "docs/spec/FINAL/08_legal.md"), "utf8");
  const i = md.indexOf("// config/originality.json");
  const body = md.slice(md.lastIndexOf("{", md.indexOf("\n", i) + 2), md.indexOf("```", i));
  const json = body
    .split("\n")
    .map((l) => l.replace(/\s\/\/.*$/, ""))
    .join("\n");
  return JSON.parse(json) as Obj;
}

describe("08장 8.3.3 config/originality.json", () => {
  it("파일 값 = 장 블록 값(임계값 원천 1곳)", () => {
    const spec = specOriginality();
    const cfg = loadOriginalityConfig(ROOT) as unknown as Obj;
    for (const k of [
      "g1_min_domains",
      "g2_max_matches",
      "g2_delta_e_threshold",
      "g3_phash_max_distance",
      "g3_viewport",
      "g5_max_consecutive_words",
      "g4_enabled",
      "g6_enabled",
    ])
      expect(cfg[k], k).toEqual(spec[k]);
    expect(typeof cfg.version).toBe("string");
  });
});

/** 합성 레퍼런스 10개: 속성이 서로 다르게. */
const FONTS = (
  JSON.parse(readFileSync(join(ROOT, "data/fonts/registry.json"), "utf8")) as {
    items: { id: string }[];
  }
).items.map((f) => f.id);
const RADIUS = ["sharp", "soft", "round", "pill"];
const DEPTH = ["flat", "layered", "glass", "brutal"];
const PATTERNS = ["PL-1", "PL-2", "PL-3", "PL-4"];
function refSig(i: number): ReferenceSig {
  return {
    reference_id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
    palette_oklab: {
      primary: [0.35 + 0.04 * i, 0.12 - 0.02 * (i % 5), -0.1 + 0.03 * (i % 7)],
      accent: [0.7 - 0.03 * i, -0.08 + 0.02 * (i % 4), 0.1 - 0.02 * (i % 6)],
    },
    font_substitute_ids: { display: FONTS[i % FONTS.length], body: FONTS[(i + 5) % FONTS.length] },
    radius_family_id: RADIUS[i % 4],
    depth_id: DEPTH[(i + 1) % 4],
    layout_pattern_id: PATTERNS[(i + 2) % 4],
    phash_1280: null,
    texts: [],
  };
}
const REFS = Array.from({ length: 10 }, (_, i) => refSig(i));
/** 어떤 합성 레퍼런스와도 일치 0인 시그니처(ID는 집합 밖 값, 색은 멀리). */
const far = (i: number): OriginalityInput["sig"] => ({
  palette_oklab: { primary: [0.95, 0.0, 0.0], accent: [0.1, 0.0, 0.0] },
  font_substitute_ids: { display: `x-display-${i}`, body: `x-body-${i}` },
  radius_family_id: `x-radius-${i}`,
  depth_id: `x-depth-${i}`,
  layout_pattern_id: `x-pattern-${i}`,
});

describe("AC-08-11 · AC-04-21 ① 복제 픽스처 10종 → G2 100% 차단", () => {
  it("레퍼런스 토큰·패턴 그대로 = 실패, OriginalityReport 필드 기록", () => {
    const cfg = loadOriginalityConfig(ROOT);
    for (let i = 0; i < 10; i++) {
      const r = REFS[i];
      const rep = checkOriginality(
        {
          sig: {
            palette_oklab: r.palette_oklab,
            font_substitute_ids: r.font_substitute_ids,
            radius_family_id: r.radius_family_id,
            depth_id: r.depth_id,
            layout_pattern_id: r.layout_pattern_id,
          },
          phash: null,
          texts: [],
        },
        REFS,
        cfg,
      );
      expect(rep.passed, `clone ${i}`).toBe(false);
      expect(rep.violated).toContain("G2");
      expect(rep.nearest_reference_id).toBe(r.reference_id);
      expect(rep.g2_matches).toBe(7); // 7속성 전부 복제
      expect(rep.g2_matched_attrs.length).toBe(rep.g2_matches);
      expect(rep.config_version).toBe(cfg.version);
      for (const k of ["min_phash_distance", "min_phash_reference_id", "g5_max_run"])
        expect(Object.keys(rep), k).toContain(k);
    }
  });

  it("경계: 일치 3개(g2_max_matches)는 통과, 4개는 실패", () => {
    const cfg = loadOriginalityConfig(ROOT);
    const r = REFS[0];
    const base = far(0);
    const three = {
      ...base,
      radius_family_id: r.radius_family_id,
      depth_id: r.depth_id,
      layout_pattern_id: r.layout_pattern_id,
    };
    const only = [r];
    const ok = checkOriginality({ sig: three, phash: null, texts: [] }, only, cfg);
    expect(ok.g2_matches).toBe(3);
    expect(ok.violated).not.toContain("G2");
    const four = {
      ...three,
      font_substitute_ids: { ...base.font_substitute_ids, body: r.font_substitute_ids.body },
    };
    const bad = checkOriginality({ sig: four, phash: null, texts: [] }, only, cfg);
    expect(bad.g2_matches).toBe(4);
    expect(bad.violated).toContain("G2");
  });

  it("ΔE2000 < 3이면 같은 색으로 센다(주조색 미세 이동도 일치)", () => {
    const cfg = loadOriginalityConfig(ROOT);
    const r = REFS[2];
    const p = r.palette_oklab.primary;
    const sig = {
      ...far(2),
      palette_oklab: {
        primary: [p[0] + 0.004, p[1], p[2]] as [number, number, number],
        accent: [0.1, 0, 0] as [number, number, number],
      },
    };
    const rep = checkOriginality({ sig, phash: null, texts: [] }, [r], cfg);
    expect(rep.g2_matched_attrs).toContain("primary");
  });
});

let h: Harness;
beforeAll(async () => {
  h = await openHarness();
});
afterAll(async () => {
  await h?.close();
});

/** 레퍼런스 "첫 화면"으로 쓸 결정적 페이지(외부 자원 없음). */
const REF_HTML = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>
body{margin:0;background:#f4efe6;font:16px/1.5 sans-serif;color:#1d1a16}
.hero{display:grid;grid-template-columns:7fr 5fr;gap:48px;padding:96px 80px;min-height:560px}
.hero h1{font-size:64px;line-height:1.1;margin:0 0 24px}
.pic{background:linear-gradient(135deg,#2f4a3a,#c9a46a);border-radius:4px}
.bar{height:120px;background:#1d1a16}
</style></head><body><div class="hero"><div><h1>한결로스터리<br>매일 아침 볶는 원두</h1>
<p>성수동 작은 로스터리에서 핸드드립용 원두를 정기배송합니다.</p></div><div class="pic"></div></div>
<div class="bar"></div></body></html>`;

async function firstViewRaw(
  png: Buffer,
): Promise<{ data: Buffer; w: number; h: number; c: number }> {
  const { data, info } = await sharp(png)
    .extract({ left: 0, top: 0, width: 1280, height: 800 })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height, c: info.channels };
}
async function hashOf(png: Buffer): Promise<string> {
  const r = await firstViewRaw(png);
  return phash64(new Uint8Array(r.data), r.w, r.h, r.c);
}

describe("AC-08-12 · AC-04-21 ② pHash 거리 0·밝기 ±10%·JPEG 재압축 → G3 100% 차단", () => {
  it("변형 4종 모두 G3 위반", async () => {
    const cfg = loadOriginalityConfig(ROOT);
    const { png } = await h.screenshot(REF_HTML, 1280);
    const ref = await hashOf(png);
    expect(ref).toMatch(/^[0-9a-f]{16}$/);
    const first = await sharp(png)
      .extract({ left: 0, top: 0, width: 1280, height: 800 })
      .png()
      .toBuffer();
    const variants: Record<string, Buffer> = {
      same: first,
      bright: await sharp(first).modulate({ brightness: 1.1 }).png().toBuffer(),
      dark: await sharp(first).modulate({ brightness: 0.9 }).png().toBuffer(),
      jpeg: await sharp(first).jpeg({ quality: 60 }).toBuffer(),
    };
    const refs: ReferenceSig[] = [{ ...REFS[0], phash_1280: ref }];
    for (const [name, buf] of Object.entries(variants)) {
      const ph = await (async () => {
        const { data, info } = await sharp(buf)
          .removeAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true });
        return phash64(new Uint8Array(data), info.width, info.height, info.channels);
      })();
      if (name === "same") expect(hamming64(ph, ref)).toBe(0);
      const rep = checkOriginality({ sig: far(0), phash: ph, texts: [] }, refs, cfg);
      expect(rep.violated, name).toContain("G3");
      expect(rep.passed, name).toBe(false);
      expect(rep.min_phash_reference_id).toBe(REFS[0].reference_id);
      expect(rep.min_phash_distance).toBeLessThanOrEqual(cfg.g3_phash_max_distance);
    }
  }, 120_000);

  it("다른 페이지는 G3 통과(거리 > 상한)", async () => {
    const cfg = loadOriginalityConfig(ROOT);
    const a = await hashOf((await h.screenshot(REF_HTML, 1280)).png);
    const other = REF_HTML.replace("grid-template-columns:7fr 5fr", "grid-template-columns:3fr 9fr")
      .replace("#f4efe6", "#10131a")
      .replace("color:#1d1a16", "color:#f4efe6")
      .replace('class="bar"', 'class="bar" style="height:520px;background:#e8d9b8"');
    const b = await hashOf((await h.screenshot(other, 1280)).png);
    const rep = checkOriginality(
      { sig: far(1), phash: b, texts: [] },
      [{ ...REFS[1], phash_1280: a }],
      cfg,
    );
    expect(rep.min_phash_distance).toBeGreaterThan(cfg.g3_phash_max_distance);
    expect(rep.violated).not.toContain("G3");
  }, 120_000);
});

describe("AC-08-13a G5 연속 어절 일치", () => {
  const blurb = "성수동 골목 끝에서 매일 아침 직접 볶은 원두를 핸드드립으로 내려 드립니다";
  it("8어절 그대로 = 차단, 7어절 = 통과", () => {
    const cfg = loadOriginalityConfig(ROOT);
    const words = blurb.split(" ");
    const refs: ReferenceSig[] = [{ ...REFS[4], texts: [blurb] }];
    const eight = `우리는 ${words.slice(1, 9).join(" ")} 그래서 좋습니다`;
    const seven = `우리는 ${words.slice(1, 8).join(" ")} 그래서 좋습니다`;
    const r8 = checkOriginality({ sig: far(4), phash: null, texts: [eight] }, refs, cfg);
    expect(r8.g5_max_run).toBe(8);
    expect(r8.violated).toContain("G5");
    const r7 = checkOriginality({ sig: far(4), phash: null, texts: [seven] }, refs, cfg);
    expect(r7.g5_max_run).toBe(7);
    expect(r7.violated).not.toContain("G5");
    expect(r7.passed).toBe(true);
  });
});

describe("G-11 게이트 = checkOriginality 결과(AC-04-21)", () => {
  it("OriginalityReport.passed=false → G-11 fail(code GATE_FAILED:G-11)", () => {
    const cfg = loadOriginalityConfig(ROOT);
    const r = REFS[3];
    const rep = checkOriginality(
      {
        sig: {
          palette_oklab: r.palette_oklab,
          font_substitute_ids: r.font_substitute_ids,
          radius_family_id: r.radius_family_id,
          depth_id: r.depth_id,
          layout_pattern_id: r.layout_pattern_id,
        },
        phash: null,
        texts: [],
      },
      REFS,
      cfg,
    );
    const g = GATE_FNS["G-11"]({ originality: rep as unknown as Json });
    expect(g.pass).toBe(false);
    const ok = checkOriginality({ sig: far(3), phash: null, texts: [] }, REFS, cfg);
    expect(ok.passed).toBe(true);
    expect(GATE_FNS["G-11"]({ originality: ok as unknown as Json }).pass).toBe(true);
  });
});
