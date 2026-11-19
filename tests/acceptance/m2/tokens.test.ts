// M2 수용 테스트(1/5): 토큰·택소노미·매핑·시그니처(03장 3.1~3.4, AC-03-02~11·44).
// 판정은 packages 공개 API로만 한다. API 계약·해석은 ASSUMPTIONS ASM-023.
import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { contrast, mapL1toL2, type L1, type L2 } from "../../../packages/taxonomy/src/index.js";
import {
  DesignSpecSchema,
  deriveTokens,
  exportTokens,
  loadDesignData,
  predictL1,
  signatureEligible,
  type SigCtx,
} from "../../../packages/design-spec/src/index.js";
import { validateTokenSet } from "../../../packages/data-contracts/src/index.js";
import { cssLiteralViolations, rendererCssSources } from "../../../packages/renderer/src/index.js";
import { thresholdNumber } from "../../../packages/config/src/index.js";
import { ROOT } from "../_support/sh.js";

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
type Obj = { [k: string]: Json };

const data = loadDesignData(ROOT);
/** 대비 하한(07장 thresholds): 본문 4.5, 비텍스트·큰 글자 3. */
const BODY = thresholdNumber("generation.contrastBodyMin");
const LARGE = thresholdNumber("generation.contrastLargeMin");
const AXIS_IDX = [0, 1, 2, 3, 4]; // SC-02 축 5
const harmony = (id: string): Obj =>
  ((data.harmony as Obj[]).find((h) => h.id === id) as Obj).rule as Obj;
const presets = data.presets;
const sha = (x: unknown): string => createHash("sha256").update(JSON.stringify(x)).digest("hex");
/** 3.1.3: 소수 둘째 자리 내림 비교. */
const ratio = (a: string, b: string): number => Math.floor(contrast(a, b) * 100) / 100;

/** 32 TokenSet(프리셋 8 × 팔레트 4). */
const sets = presets.flatMap((p) =>
  p.palettes.map((pal) => {
    const l2: L2 = { ...p.l2, "color.palette_id": pal };
    return { presetId: p.id, paletteId: pal, l2, out: deriveTokens({ presetId: p.id, l2 }, data) };
  }),
);

/** 리프 토큰(= `$type` 보유 객체)을 경로와 함께 모은다. */
function leaves(node: Json, path: string[] = []): { path: string; tok: Obj }[] {
  if (node === null || typeof node !== "object" || Array.isArray(node)) return [];
  if ("$type" in node) return [{ path: path.join("."), tok: node }];
  return Object.entries(node)
    .filter(([k]) => !k.startsWith("$"))
    .flatMap(([k, v]) => leaves(v, [...path, k]));
}
function hexOf(ts: Obj, name: string): string | null {
  const t = (ts.color as Obj)[name] as Obj | undefined;
  if (!t) return null;
  const v = t.$value as Obj;
  return v.hex as string;
}

/** 3.1.3 하드 대비 13쌍: [전경, 배경, 하한]. accent 쌍은 accent가 있을 때만. */
const HARD_PAIRS: [string, string, number][] = [
  ["fg", "bg", BODY],
  ["fg", "surface", BODY],
  ["fg-muted", "bg", BODY],
  ["fg-muted", "surface", BODY],
  ["fg-inverse", "surface-inverse", BODY],
  ["border-strong", "bg", LARGE],
  ["primary", "bg", LARGE],
  ["on-primary", "primary", BODY],
  ["on-primary", "primary-hover", BODY],
  ["on-primary", "primary-active", BODY],
  ["on-accent", "accent", BODY],
  ["focus", "bg", LARGE],
  ["focus", "surface", LARGE],
];

describe("AC-03-02·44 TokenSet 32개 스키마·대비", () => {
  it("32개가 생성되고 data/tokens/schema.json 검증을 통과한다", () => {
    expect(sets.length).toBe(32);
    for (const s of sets) {
      const r = validateTokenSet(s.out.tokenSet);
      expect(r.errors, `${s.paletteId}`).toEqual([]);
      expect(r.ok).toBe(true);
    }
  });

  it("검증기는 위반을 잡는다(그룹 추가·필수 색 누락·hex 형식)", () => {
    const base = JSON.parse(JSON.stringify(sets[0]!.out.tokenSet)) as Obj;
    const extra = { ...base, foo: {} };
    expect(validateTokenSet(extra).ok).toBe(false);
    const noBg = JSON.parse(JSON.stringify(base)) as Obj;
    delete (noBg.color as Obj).bg;
    expect(validateTokenSet(noBg).ok).toBe(false);
    const badHex = JSON.parse(JSON.stringify(base)) as Obj;
    (((badHex.color as Obj).fg as Obj).$value as Obj).hex = "#12345g";
    expect(validateTokenSet(badHex).ok).toBe(false);
  });

  it("하드 대비 13쌍 + 반전 면 3쌍 100% 통과, 쌍별 리포트 저장", () => {
    const report: Obj[] = [];
    const fails: string[] = [];
    for (const s of sets) {
      const ts = s.out.tokenSet as Obj;
      const h = (n: string): string | null => hexOf(ts, n);
      const check = (pair: string, fg: string | null, bg: string | null, min: number): void => {
        if (fg === null || bg === null) return;
        const r = ratio(fg, bg);
        const pass = r >= min;
        report.push({ set: s.paletteId, pair, ratio: r, min, pass });
        if (!pass) fails.push(`${s.paletteId} ${pair} ${r} < ${min}`);
      };
      for (const [f, b, min] of HARD_PAIRS) {
        if ((f === "on-accent" || b === "accent") && h("accent") === null) continue;
        check(`${f}/${b}`, h(f), h(b), min);
      }
      // 3.1.3 반전 면 매핑(T-27): 모드 판정 규칙 자체도 검사한다.
      const prim = h("primary")!;
      const inv = h("surface-inverse")!;
      const onP = h("on-primary")!;
      const fgi = h("fg-inverse")!;
      const expectMode =
        ratio(prim, inv) >= LARGE && ratio(onP, prim) >= BODY ? "primary" : "invert";
      expect(s.out.inverseButtonMode, s.paletteId).toBe(expectMode);
      if (s.out.inverseButtonMode === "invert") {
        check("inverse:button-border", fgi, inv, LARGE);
        check("inverse:button-text", inv, fgi, BODY);
      } else {
        check("inverse:button-border", prim, inv, LARGE);
        check("inverse:button-text", onP, prim, BODY);
      }
      check("inverse:link", fgi, inv, BODY);
      // accentTextSafe = accent 대 bg ≥ 4.5 ∧ 대 surface ≥ 4.5
      const acc = h("accent");
      const safe =
        acc !== null && ratio(acc, h("bg")!) >= BODY && ratio(acc, h("surface")!) >= BODY;
      expect(s.out.accentTextSafe, s.paletteId).toBe(safe);
    }
    mkdirSync(join(ROOT, "reports/m2"), { recursive: true });
    writeFileSync(
      join(ROOT, "reports/m2/contrast-pairs.json"),
      JSON.stringify(report, null, 2) + "\n",
    );
    expect(fails).toEqual([]);
    expect(new Set(report.map((r) => r.set)).size).toBe(32);
  });

  it("팔레트 표 값(3.4.2·3.4.3)은 TokenSet에서 그대로다", () => {
    for (const s of sets) {
      const pal = data.palettes.find((p) => p.id === s.paletteId)!;
      for (const [role, v] of Object.entries(pal.roles)) {
        expect(hexOf(s.out.tokenSet as Obj, role), `${s.paletteId} ${role}`).toBe(v.hex);
      }
    }
  });
});

const SPACE_SET = new Set([0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 128, 160]);
const RADIUS: Record<string, number[]> = {
  sharp: [0, 0, 0],
  soft: [2, 4, 8],
  round: [6, 12, 20],
  pill: [8, 999, 24],
};

describe("AC-03-03 deriveTokens 순수·결정적, spacing·radius 집합", () => {
  it("같은 입력 1,000회 → SHA-256 1종", () => {
    const p = presets[0]!;
    const hashes = new Set<string>();
    Array.from({ length: 1000 }).forEach(() =>
      hashes.add(sha(deriveTokens({ presetId: p.id, l2: { ...p.l2 } }, data))),
    );
    expect(hashes.size).toBe(1);
  });

  it("입력 객체를 바꾸지 않는다", () => {
    const p = presets[1]!;
    const l2 = { ...p.l2 };
    const before = JSON.stringify(l2);
    deriveTokens({ presetId: p.id, l2 }, data);
    expect(JSON.stringify(l2)).toBe(before);
  });

  it("space 값 ⊂ 3.1.6 15개, radius 값 ⊂ family 집합(밀도·family 전 조합)", () => {
    const bad: string[] = [];
    for (const p of presets) {
      for (const density of p.allowed["space.density"] ?? [p.l2["space.density"]!]) {
        for (const fam of p.allowed["shape.radius_family"] ?? [p.l2["shape.radius_family"]!]) {
          const l2: L2 = { ...p.l2, "space.density": density, "shape.radius_family": fam };
          const ts = deriveTokens({ presetId: p.id, l2 }, data).tokenSet as Obj;
          const sp = leaves(ts.space as Json).filter((x) => x.tok.$type === "dimension");
          expect(sp.length, p.id).toBeGreaterThan(0);
          for (const { path, tok } of sp) {
            const v = (tok.$value as Obj).value as number;
            if (!SPACE_SET.has(v)) bad.push(`${p.id}/${density} space.${path}=${v}`);
          }
          const allowed = new Set([0, 999, ...RADIUS[fam]!]);
          const rd = leaves(ts.radius as Json).filter((x) => x.tok.$type === "dimension");
          for (const { path, tok } of rd) {
            const v = (tok.$value as Obj).value as number;
            if (!allowed.has(v)) bad.push(`${p.id}/${fam} radius.${path}=${v}`);
          }
          const r = ts.radius as Obj;
          const val = (k: string): number => ((r[k] as Obj).$value as Obj).value as number;
          expect([val("sm"), val("md"), val("lg"), val("full")], `${p.id}/${fam}`).toEqual([
            ...RADIUS[fam]!,
            999,
          ]);
        }
      }
    }
    expect(bad).toEqual([]);
  });
});

describe("AC-03-04 타입 비·웨이트 수", () => {
  it("모든 프리셋 기본 TokenSet: display/body 2.5~8.0, font-weight 고유값 ≤ 3", () => {
    for (const p of presets) {
      const ts = deriveTokens({ presetId: p.id, l2: p.l2 }, data).tokenSet as Obj;
      const ty = ts.type as Obj;
      const size = (k: string): number =>
        (((ty[k] as Obj).$value as Obj).fontSize as Obj).value as number;
      const r = size("display") / size("body");
      // 범위·상한은 03장 3.1.5 원천 정의를 옮긴 harmony.json H7·H5(만점 구간)에서 읽는다.
      const [lo, hi] = harmony("H7").range as number[];
      expect(r, p.id).toBeGreaterThanOrEqual(lo!);
      expect(r, p.id).toBeLessThanOrEqual(hi!);
      const weights = new Set(
        leaves(ty)
          .filter((x) => x.tok.$type === "typography")
          .map((x) => (x.tok.$value as Obj).fontWeight as number),
      );
      const wMax = ((harmony("H5").tiers as Obj[])[0] as Obj).max as number;
      expect(weights.size, `${p.id} ${[...weights].join(",")}`).toBeLessThanOrEqual(wMax);
    }
  });
});

const DTCG_TYPES = new Set([
  "color",
  "dimension",
  "fontFamily",
  "fontWeight",
  "number",
  "duration",
  "cubicBezier",
  "shadow",
  "typography",
  "border",
]);

describe("AC-03-05 내보내기 tokens.json(DTCG)·CSS 리터럴", () => {
  it("tokens.json: $schemaVersion·$type 집합·$value·별칭·확장 메타", () => {
    for (const p of presets) {
      const d = deriveTokens({ presetId: p.id, l2: p.l2 }, data);
      const files = exportTokens(d, {
        presetId: p.id,
        l2: p.l2,
        taxonomyVersion: data.taxonomyVersion,
      });
      expect(Object.keys(files).sort()).toEqual([
        "tokens/theme.css",
        "tokens/tokens.css",
        "tokens/tokens.json",
      ]);
      const j = JSON.parse(files["tokens/tokens.json"]) as Obj;
      expect(j.$schemaVersion).toBe("tokens-1");
      const ext = (j.$extensions as Obj)["app.tastefit"] as Obj;
      expect(ext.presetId).toBe(p.id);
      expect(ext.taxonomyVersion).toBe(data.taxonomyVersion);
      expect(ext.l2).toEqual(p.l2);
      const ls = leaves(j);
      expect(ls.length).toBeGreaterThan(1);
      let aliases = 0;
      for (const { path, tok } of ls) {
        expect(DTCG_TYPES.has(tok.$type as string), `${p.id} ${path} $type`).toBe(true);
        expect(tok.$value, `${p.id} ${path} $value`).toBeDefined();
        if (typeof tok.$value === "string" && /^\{[a-z0-9.-]+\}$/.test(tok.$value)) aliases++;
      }
      expect(aliases, `${p.id} 별칭 유지`).toBeGreaterThan(0);
      // tokens.css: :root 단일 블록, --tf- 접두사
      const css = files["tokens/tokens.css"];
      expect(css.match(/:root\s*\{/g)?.length).toBe(1);
      expect(css).toContain("--tf-color-fg-muted");
      // theme.css: Tailwind v4 @theme, 기본 팔레트 초기화
      const theme = files["tokens/theme.css"];
      expect(theme).toMatch(/@theme\s*\{/);
      expect(theme).toContain("--color-*: initial");
      expect(theme).toContain("var(--tf-color-bg)");
    }
  });

  it("tokens.css·theme.css 밖 CSS(base·blocks·signatures)에 색·px 리터럴 0건", () => {
    const srcs = rendererCssSources();
    expect(srcs.length).toBeGreaterThan(0);
    expect(srcs.some((s) => /(^|\/)base\.css$/.test(s.path))).toBe(true);
    const bad = srcs.flatMap((s) => cssLiteralViolations(s.css).map((v) => `${s.path}: ${v}`));
    expect(bad).toEqual([]);
  });

  it("리터럴 검사 도구는 위반을 잡고 허용 목록(0·100%·auto·1fr·inherit·currentColor)은 통과시킨다", () => {
    expect(cssLiteralViolations(".a{color:#fff}").length).toBeGreaterThan(0);
    expect(cssLiteralViolations(".a{margin:12px}").length).toBeGreaterThan(0);
    expect(cssLiteralViolations(".a{background:rgb(0 0 0)}").length).toBeGreaterThan(0);
    expect(
      cssLiteralViolations(
        ".a{margin:0;width:100%;height:auto;grid-template-columns:1fr;color:inherit;fill:currentColor;padding:var(--tf-space-4)}",
      ),
    ).toEqual([]);
  });
});

describe("AC-03-06 taxonomy.json ↔ DesignSpec.l2 키", () => {
  it("키 집합과 값 enum이 같다", () => {
    const l2Shape = (DesignSpecSchema.shape.l2 as unknown as { shape: Record<string, unknown> })
      .shape;
    expect(Object.keys(l2Shape).sort()).toEqual(data.taxonomy.map((k) => k.id).sort());
    expect(data.taxonomy.length).toBe(18);
    for (const k of data.taxonomy) {
      const e = l2Shape[k.id] as { options?: string[] };
      expect(e.options ? [...e.options].sort() : null, k.id).toEqual([...k.values].sort());
    }
  });
});

/** 03장 3.4.7(R-04) 유형 중심 벡터. */
const ANCHOR: Record<string, number[]> = {
  T1: [0.26, 0.81, 0.12, 0.0, 0.0],
  T2: [0.3, 0.23, 0.12, 0.62, 0.0],
  T3: [0.16, 0.31, 0.72, 0.12, 0.34],
  T4: [0.4, 0.96, 0.72, 0.5, 0.34],
  T5: [1.0, 0.57, 0.0, 1.0, 0.56],
  T6: [0.79, 0.7, 1.0, 0.62, 0.66],
  T7: [0.54, 0.23, 0.32, 0.62, 0.7],
  T8: [0.7, 0.65, 0.25, 0.25, 0.0],
};
const R01 = ["expression", "temperature", "shape", "density", "depth"] as const;

describe("AC-03-07 predictL1", () => {
  for (const t of Object.keys(ANCHOR)) {
    it(`${t}: predictL1(기본 L2) = 3.4.7 (소수 둘째 자리)`, () => {
      const p = presets.find((x) => x.typeId === t)!;
      const l2 = { ...p.l2 };
      const out = predictL1(l2, data);
      expect(Object.keys(out).sort()).toEqual([...R01].sort());
      expect(R01.map((k) => Math.round(out[k] * 100) / 100)).toEqual(ANCHOR[t]);
      expect(predictL1(l2, data)).toEqual(out);
      expect(l2).toEqual(p.l2);
    });
  }
});

const BASE_CTX: SigCtx = {
  theme: "light",
  shapeBorder: "hairline",
  gridMode: "symmetric",
  motionLevel: "subtle",
  depthStyle: "flat",
  mediaTreatment: "duotone",
  chroma: "muted",
  sectionCount: 6,
  hasNumberSlot: true,
  hasImageSlot: true,
  pairingHasMono: true,
  displayPx: 80,
};
/** 03장 3.2.4 요구 조건·충돌별 음성 픽스처. SIG-05는 예약(항상 불가), SIG-09는 조건·충돌 없음(ASM-023). */
const NEG: Record<string, Partial<SigCtx>[]> = {
  "SIG-01": [{ shapeBorder: "bold" }],
  "SIG-02": [{ sectionCount: 3 }],
  "SIG-03": [{ hasNumberSlot: false }],
  "SIG-04": [{ gridMode: "bento" }, { depthStyle: "glass" }],
  "SIG-06": [{ motionLevel: "none" }],
  "SIG-07": [{ theme: "dark" }, { depthStyle: "glass" }],
  "SIG-08": [{ pairingHasMono: false }],
  "SIG-10": [{ chroma: "vivid" }, { mediaTreatment: "grayscale" }],
  "SIG-11": [{ displayPx: 71 }],
  "SIG-12": [{ hasImageSlot: false }],
};

describe("AC-03-08 시그니처 12종 양성·음성", () => {
  const ids = Array.from({ length: 12 }, (_, i) => `SIG-${String(i + 1).padStart(2, "0")}`);
  for (const id of ids) {
    it(`${id}`, () => {
      if (id === "SIG-05") {
        expect(signatureEligible(id, BASE_CTX)).toBe(false);
        return;
      }
      expect(signatureEligible(id, BASE_CTX), `${id} 양성`).toBe(true);
      for (const n of NEG[id] ?? []) {
        expect(
          signatureEligible(id, { ...BASE_CTX, ...n }),
          `${id} 음성 ${JSON.stringify(n)}`,
        ).toBe(false);
      }
      if (id === "SIG-09") {
        for (const n of Object.values(NEG).flat())
          expect(signatureEligible(id, { ...BASE_CTX, ...n })).toBe(true);
      }
    });
  }
});

describe("AC-03-09~11 mapL1toL2", () => {
  const map = data; // MapData 호환(taxonomy·mapping·pairings·palettes)
  const clip = (x: number): number => Math.min(1, Math.max(0, x));

  it("AC-03-09: t = a_T → 앵커 프리셋 L2 18키 일치(8/8)", () => {
    for (const p of presets) {
      const out = mapL1toL2(p.l1, p, map);
      expect(Object.keys(out).length).toBe(18);
      expect(out, p.id).toEqual(p.l2);
    }
  });

  it("AC-03-10: 160 입력이 유형 허용 집합 안, 반복 결과 동일", () => {
    let n = 0;
    for (const p of presets)
      for (const a of AXIS_IDX)
        for (const d of [-0.3, -0.1, 0.1, 0.3]) {
          const t = [...p.l1] as number[];
          t[a] = clip(t[a]! + d);
          const out = mapL1toL2(t as unknown as L1, p, map);
          for (const [k, v] of Object.entries(out)) {
            const allowed = p.allowed[k];
            if (allowed) expect(allowed, `${p.id} ${k}`).toContain(v);
          }
          expect(mapL1toL2(t as unknown as L1, p, map)).toEqual(out);
          n++;
        }
    expect(n).toBe(160);
  });

  it("AC-03-11: 단조성(8유형 × 5축 × 11점), headline_weight는 같은 페어링 구간에서만(ASM-015)", () => {
    const tax = new Map(data.taxonomy.map((k) => [k.id, k.values]));
    const rows = data.mapping.filter((r) => r.kind === "ordinal" && r.axis);
    const bad: string[] = [];
    for (const p of presets)
      for (const a of AXIS_IDX) {
        let prev: L2 | null = null;
        for (let g = 0; g <= 10; g++) {
          const t = [...p.l1] as number[];
          t[a] = g / 10;
          const out = mapL1toL2(t as unknown as L1, p, map);
          if (prev) {
            for (const r of rows) {
              if (r.axis !== `A${a + 1}`) continue;
              if (
                r.id === "type.headline_weight" &&
                prev["type.pairing_id"] !== out["type.pairing_id"]
              )
                continue;
              const vals = tax.get(r.id)!;
              const di = vals.indexOf(out[r.id]!) - vals.indexOf(prev[r.id]!);
              if (di < 0) bad.push(`${p.id} A${a + 1} g${g} ${r.id}`);
            }
          }
          prev = out;
        }
      }
    expect(bad).toEqual([]);
  });
});

describe("AC-03-38 harmony.json 배점", () => {
  it("AC-03-38: H1~H12 배점 합 100, 04장 4.10.3 표 배점과 차이 0", () => {
    const hs = (data.harmony as Obj[]).filter((x) => /^H([1-9]|1[0-2])$/.test(x.id as string));
    expect(hs).toHaveLength(12);
    expect(hs.reduce((n, x) => n + (x.points as number), 0)).toBe(100);
    const doc = readFileSync(join(ROOT, "docs/spec/FINAL/04_generation.md"), "utf8");
    const table = new Map<string, number>();
    for (const m of doc.matchAll(/^\| (H\d+) \|[^|]*\|[^|]*\| (\d+) \|/gm))
      table.set(m[1]!, Number(m[2]));
    expect(table.size).toBe(12);
    for (const x of hs) expect(table.get(x.id as string), x.id as string).toBe(x.points);
  });
});
