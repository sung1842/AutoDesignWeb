// M2 수용 테스트(2/5): 디자인 명세서·보정·변형·레이아웃 트리 스키마(04장 4.2~4.5·4.14, AC-04-03~10·30).
// API 계약·해석은 ASSUMPTIONS ASM-024. AC-04-03 hue 오차(±5°)는 BLK-007로 단위 테스트에서 검사한다.
import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { contrast } from "../../../packages/taxonomy/src/index.js";
import {
  DesignSpecSchema,
  calibrate,
  compileSpecs,
  deriveTokens,
  loadDesignData,
  type DesignSpec,
  type TasteResult,
  type Vec5,
} from "../../../packages/design-spec/src/index.js";
import {
  LayoutTreeRawSchema,
  layoutTreeRawJsonSchema,
} from "../../../packages/layout-schema/src/index.js";
import { staticLint } from "../../../packages/linter/src/index.js";
import { thresholdNumber } from "../../../packages/config/src/index.js";
import { ROOT } from "../_support/sh.js";

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
type Obj = { [k: string]: Json };

const data = loadDesignData(ROOT);
const BODY = thresholdNumber("generation.contrastBodyMin");
const LARGE = thresholdNumber("generation.contrastLargeMin");
const L2_DIFF_MIN = thresholdNumber("generation.variant.l2DiffMin");
const KEYS = ["expression", "temperature", "shape", "density", "depth"] as const;
type Key = (typeof KEYS)[number];
const TYPES = ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8"] as const;
const PURPOSES = ["saas", "local_business", "portfolio"] as const;
type Purpose = (typeof PURPOSES)[number];
const VARIANTS = ["v_true", "v_fit", "v_bal"] as const;

/** 03장 3.4.7 앵커(R-04). */
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
/** 04장 4.3 용도 표: 범위 [lo, hi] 5축, 중심 c_p, α_p. */
const PURPOSE: Record<Purpose, { lo: number[]; hi: number[]; c: number[]; alpha: number }> = {
  saas: {
    lo: [0.1, 0.0, 0.0, 0.2, 0.0],
    hi: [0.8, 0.8, 1.0, 0.8, 0.7],
    c: [0.4, 0.4, 0.5, 0.55, 0.35],
    alpha: 0.4,
  },
  local_business: {
    lo: [0.1, 0.2, 0.0, 0.1, 0.0],
    hi: [0.9, 1.0, 1.0, 0.7, 0.6],
    c: [0.5, 0.7, 0.55, 0.4, 0.25],
    alpha: 0.3,
  },
  portfolio: {
    lo: [0.0, 0.0, 0.0, 0.0, 0.0],
    hi: [1.0, 1.0, 1.0, 0.85, 1.0],
    c: [0.55, 0.5, 0.45, 0.3, 0.3],
    alpha: 0.1,
  },
};

const vec = (a: readonly number[]): Vec5 =>
  Object.fromEntries(KEYS.map((k, i) => [k, a[i]!])) as unknown as Vec5;
const arr = (v: Vec5): number[] => KEYS.map((k) => (v as unknown as Record<Key, number>)[k]);
const r3 = (x: number): number => Math.round(x * 1000) / 1000;
const clip = (x: number, lo = 0, hi = 1): number => Math.min(hi, Math.max(lo, x));

/** 결정적 PRNG(mulberry32). */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 04장 4.3 1·2단계 기준 구현(테스트 기대값 계산용). */
function refCalibrate(
  mu: number[],
  sigma: number[],
  kappa: number,
  insensitive: Key[],
  typeId: string,
  purpose: Purpose,
  alpha: number,
): { v1: number[]; v2: number[] } {
  const a = ANCHOR[typeId]!;
  const p = PURPOSE[purpose];
  // 4.3 4단계 κ 구간 표 [하한, s_κ, 유형 범위 확장 e](기대값 계산식의 상수이며 판정 기준이 아니다, ASM-024)
  const band = KAPPA_BANDS.find((b) => kappa >= b.from)!;
  const sk = band.s;
  const e = band.e;
  const v1 = KEYS.map((k, i) => {
    const u = clip((sigma[i]! - 0.08) / 0.17);
    const g = sk * (1 - 0.5 * u);
    const m = insensitive.includes(k) ? p.c[i]! : mu[i]!;
    const lo = clip(a[i]! - 0.2) - e;
    const hi = clip(a[i]! + 0.2) + e;
    return clip(a[i]! + g * (m - a[i]!), lo, hi);
  });
  const v2 = v1.map((x, i) => clip((1 - alpha) * x + alpha * p.c[i]!, p.lo[i], p.hi[i]));
  return { v1, v2 };
}

function taste(
  mu: number[],
  sigma: number[],
  kappa: number,
  typeId: string,
  ins: Key[] = [],
): TasteResult {
  return { mu: vec(mu), sigma: vec(sigma), kappa, insensitive_axes: ins, type_id: typeId };
}

const KAPPA_BANDS = [
  { from: 0.75, s: 1.0, e: 0.05 },
  { from: 0.5, s: 0.8, e: 0 },
  { from: -Infinity, s: 0.6, e: 0 },
];
const SIGMA_SURE = [0.08, 0.08, 0.08, 0.08, 0.08];

/** 3.1.3 하드 대비 13쌍(tokens.test와 같은 목록). */
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
function contrastFails(spec: DesignSpec): string[] {
  const color = (spec.tokens as unknown as Obj).color as Obj;
  const hex = (n: string): string | null => {
    const t = color[n] as Obj | undefined;
    return t ? ((t.$value as Obj).hex as string) : null;
  };
  const out: string[] = [];
  for (const [f, b, min] of HARD_PAIRS) {
    const fh = hex(f);
    const bh = hex(b);
    if (fh === null || bh === null) continue;
    // 브랜드 색이 accent로 강등되면 on-accent 쓰임이 금지되므로(03장 3.13.2 S-37) on-accent 쌍은 검사하지 않는다
    if (f === "on-accent" && spec.brand_color?.role === "accent") continue;
    const r = Math.floor(contrast(fh, bh) * 100) / 100;
    if (r < min) out.push(`${f}/${b} ${r}`);
  }
  return out;
}
const presetOf = (typeId: string): string => data.presets.find((p) => p.typeId === typeId)!.id;

describe("AC-04-03 브랜드 hex 20개", () => {
  const HEX = [
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
  ];
  it("20건 모두 대비 게이트 통과, brand_color·notice 기록", () => {
    expect(HEX).toHaveLength(20);
    const fails: string[] = [];
    HEX.forEach((hex, i) => {
      const typeId = TYPES[i % TYPES.length]!;
      const purpose = PURPOSES[i % PURPOSES.length]!;
      const specs = compileSpecs(
        {
          taste: taste(ANCHOR[typeId]!, SIGMA_SURE, 0.8, typeId),
          purpose,
          brand: { brand_color: hex },
          jobSeed: `ac-04-03-${i}`,
        },
        data,
      );
      for (const v of VARIANTS) {
        const s = specs[v];
        expect(DesignSpecSchema.safeParse(s).success, `${hex} ${v}`).toBe(true);
        expect(
          ["adjusted", "demoted_to_accent", "used_as_tint", "ignored", null],
          `${hex} notice`,
        ).toContain(s.brand_color_notice);
        if (s.brand_color_notice !== "ignored" && s.brand_color_notice !== "used_as_tint") {
          expect(s.brand_color, `${hex} brand_color`).not.toBeNull();
          expect(s.brand_color!.hex_in).toBe(hex);
        }
        for (const f of contrastFails(s)) fails.push(`${hex} ${v} ${f}`);
      }
    });
    expect(fails).toEqual([]);
  });
});

describe("AC-04-04 72조합 compileSpec", () => {
  it("8유형 × 3용도 × 3변형: 스키마·정적 린트 S·deriveTokens(l2) == tokens", () => {
    let n = 0;
    for (const typeId of TYPES)
      for (const purpose of PURPOSES) {
        const specs = compileSpecs(
          {
            taste: taste(ANCHOR[typeId]!, SIGMA_SURE, 0.8, typeId),
            purpose,
            brand: null,
            jobSeed: "ac-04-04",
          },
          data,
        );
        for (const v of VARIANTS) {
          const s = specs[v];
          const parsed = DesignSpecSchema.safeParse(s);
          expect(
            parsed.success,
            `${typeId}/${purpose}/${v} ${JSON.stringify(parsed.error?.issues?.[0] ?? "")}`,
          ).toBe(true);
          expect(s.variant).toBe(v);
          expect(s.type_id).toBe(typeId);
          expect(s.purpose).toBe(purpose);
          const errs = staticLint(s).filter((x) => x.severity === "error");
          expect(errs, `${typeId}/${purpose}/${v}`).toEqual([]);
          const re = deriveTokens({ presetId: presetOf(typeId), l2: s.l2, brand: null }, data);
          expect(re.tokenSet, `${typeId}/${purpose}/${v} tokens`).toEqual(s.tokens);
          n++;
        }
      }
    expect(n).toBe(72);
  });

  it("결정적: 같은 입력 2회 → 같은 명세서(spec_id 포함)", () => {
    const inp = {
      taste: taste(ANCHOR.T3!, SIGMA_SURE, 0.6, "T3"),
      purpose: "saas" as const,
      brand: null,
      jobSeed: "x",
    };
    expect(JSON.stringify(compileSpecs(inp, data))).toBe(JSON.stringify(compileSpecs(inp, data)));
  });
});

describe("AC-04-05 calibrate() 30건", () => {
  const cases: {
    name: string;
    mu: number[];
    sigma: number[];
    kappa: number;
    ins: Key[];
    typeId: string;
    purpose: Purpose;
  }[] = [];
  const r = rng(405);
  const rv = (lo: number, hi: number): number[] => KEYS.map(() => r3(lo + (hi - lo) * r()));
  for (const kappa of [0.9, 0.6, 0.3])
    for (const ins of [[], ["temperature", "density"]] as Key[][])
      for (const purpose of PURPOSES) {
        const typeId = TYPES[Math.floor(r() * TYPES.length)]!;
        cases.push({
          name: `κ${kappa}/${ins.length}/${purpose}`,
          mu: rv(0, 1),
          sigma: rv(0.05, 0.3),
          kappa,
          ins,
          typeId,
          purpose,
        });
      }
  // 경계값 12건: κ 구간 경계, σ 경계(0.08·0.25), μ 끝값, 유형 범위·용도 범위 클리핑
  const B: [number[], number[], number, Key[], string, Purpose][] = [
    [[0.5, 0.5, 0.5, 0.5, 0.5], SIGMA_SURE, 0.75, [], "T1", "saas"],
    [[0.5, 0.5, 0.5, 0.5, 0.5], SIGMA_SURE, 0.7499, [], "T1", "saas"],
    [[0.5, 0.5, 0.5, 0.5, 0.5], SIGMA_SURE, 0.5, [], "T2", "portfolio"],
    [[0.5, 0.5, 0.5, 0.5, 0.5], SIGMA_SURE, 0.4999, [], "T2", "portfolio"],
    [[0.9, 0.1, 0.9, 0.1, 0.9], [0.25, 0.25, 0.25, 0.25, 0.25], 0.8, [], "T3", "local_business"],
    [[0.9, 0.1, 0.9, 0.1, 0.9], [0.3, 0.3, 0.3, 0.3, 0.3], 0.8, [], "T3", "local_business"],
    [[0, 0, 0, 0, 0], SIGMA_SURE, 0.9, [], "T5", "saas"],
    [[1, 1, 1, 1, 1], SIGMA_SURE, 0.9, [], "T1", "saas"],
    [[1, 1, 1, 1, 1], SIGMA_SURE, 0.9, [], "T6", "portfolio"],
    [
      [0, 0, 0, 0, 0],
      SIGMA_SURE,
      0.2,
      ["expression", "temperature", "shape", "density", "depth"],
      "T4",
      "local_business",
    ],
    [[0.2, 0.9, 0.2, 0.9, 0.2], [0.08, 0.165, 0.25, 0.1, 0.2], 0.6, ["shape"], "T7", "saas"],
    [[0.7, 0.65, 0.25, 0.25, 0], SIGMA_SURE, 1, [], "T8", "portfolio"],
  ];
  B.forEach(([mu, sigma, kappa, ins, typeId, purpose], i) =>
    cases.push({ name: `경계${i + 1}`, mu, sigma, kappa, ins, typeId, purpose }),
  );

  it("30건", () => expect(cases).toHaveLength(30));
  for (const c of cases) {
    it(`${c.name} ${c.typeId}/${c.purpose}: v1·v2가 기대 벡터와 소수 3자리 일치(α = α_p, 0)`, () => {
      for (const alpha of [PURPOSE[c.purpose].alpha, 0]) {
        const inp = {
          taste: taste(c.mu, c.sigma, c.kappa, c.typeId, c.ins),
          purpose: c.purpose,
          alpha,
        };
        const frozen = JSON.stringify(inp);
        const out = calibrate(inp, data);
        expect(JSON.stringify(inp)).toBe(frozen);
        expect(calibrate(inp, data)).toEqual(out);
        const exp = refCalibrate(c.mu, c.sigma, c.kappa, c.ins, c.typeId, c.purpose, alpha);
        expect(arr(out.v1).map(r3), "v1").toEqual(exp.v1.map(r3));
        expect(arr(out.v2).map(r3), "v2").toEqual(exp.v2.map(r3));
      }
    });
  }
});

describe("AC-04-06 / AC-04-07 target_vector 용도 범위·moved_axes", () => {
  it("속성 기반 1,000회: target_vector ∈ 용도 범위·소수 3자리, moved_axes 형식", () => {
    const r = rng(406);
    const bad: string[] = [];
    for (const i of Array.from({ length: 1000 }, (_v, k) => k)) {
      const typeId = TYPES[Math.floor(r() * TYPES.length)]!;
      const purpose = PURPOSES[Math.floor(r() * PURPOSES.length)]!;
      const mu = KEYS.map(() => r3(r()));
      const sigma = KEYS.map(() => r3(0.05 + 0.25 * r()));
      const kappa = r3(r());
      const ins = KEYS.filter(() => Math.floor(r() * 10) === 0);
      const variant = VARIANTS[i % VARIANTS.length]!;
      const inp = {
        taste: taste(mu, sigma, kappa, typeId, [...ins]),
        purpose,
        brand: null,
        jobSeed: `p${i}`,
      };
      const s = compileSpecs(inp, data)[variant];
      const t = arr(s.target_vector);
      const p = PURPOSE[purpose];
      t.forEach((x, k) => {
        if (x < p.lo[k]! || x > p.hi[k]!) bad.push(`#${i} ${purpose} ${KEYS[k]} ${x}`);
        if (r3(x) !== x) bad.push(`#${i} 소수 3자리 아님 ${x}`);
      });
      // |v2−μ| ≥ 0.20 ⇔ moved_axes 대조는 BLK-007(0.20이 thresholds 잎 값과 겹치나 키·SC 행 없음)로 단위 테스트에서 한다.
      // 여기서는 기록 형식만 본다.
      const tr = s.calibration_trace;
      for (const m of tr.moved_axes) {
        expect(["type", "purpose", "distance"]).toContain(m.reason);
        expect(KEYS as readonly string[]).toContain(m.axis);
        expect(typeof m.from === "number" && typeof m.to === "number").toBe(true);
      }
    }
    expect(bad).toEqual([]);
  });
});

describe("AC-04-08 변형 간 L2 차이(골든 θ*)", () => {
  const L2_7 = (s: DesignSpec): string[] => [
    s.l2["type.pairing_id"]!,
    s.l2["color.palette_id"]!,
    s.l2["shape.radius_family"]!,
    `${s.l2["depth.style"]}|${s.l2["depth.shadow_level"]}`,
    s.l2["space.density"]!,
    s.layout_constraints.hero_variants.join(","),
    s.signature.id,
  ];
  it("골든 세트 전체에서 변형 쌍마다 7키 중 l2DiffMin개 이상 다르다", () => {
    const dir = join(ROOT, "data/golden");
    const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
    const cases = files.map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")) as Obj);
    expect(cases).toHaveLength(32);
    const bad: string[] = [];
    for (const c of cases) {
      const th = (c.persona as Obj).thetaStar as Obj;
      const typeId = (c.expected as Obj).typeId as string;
      const mu = KEYS.map((k) => th[k] as number);
      const specs = compileSpecs(
        {
          taste: taste(mu, SIGMA_SURE, 0.8, typeId),
          purpose: c.purpose as Purpose,
          brand: null,
          jobSeed: `golden-${c.id as string}`,
        },
        data,
      );
      for (const [x, y] of [
        ["v_true", "v_fit"],
        ["v_true", "v_bal"],
        ["v_fit", "v_bal"],
      ] as const) {
        const a = L2_7(specs[x]);
        const b = L2_7(specs[y]);
        const diff = a.filter((v, i) => v !== b[i]).length;
        if (diff < L2_DIFF_MIN) bad.push(`${c.id as string} ${x}/${y} ${diff}`);
      }
    }
    expect(bad).toEqual([]);
  });
});

describe("AC-04-09 변형 식별자", () => {
  it("코드(packages·apps·scripts, 주석 제외)에 옛 변형 식별자 0건", () => {
    const pat = "V-TRUE|V-FIT|V-BAL|as_is|faithful|purpose_fit|balanced";
    let out = "";
    try {
      out = execFileSync(
        "git",
        [
          "grep",
          "-n",
          "-E",
          pat,
          "--",
          "packages",
          "apps",
          "scripts",
          ":!**/*.md",
          ":!**/*.test.ts",
        ],
        { cwd: ROOT, encoding: "utf8" },
      );
    } catch {
      out = "";
    }
    const code = out
      .split("\n")
      .filter((l) => l.trim() !== "")
      .filter((l) => {
        const src = l.split(":").slice(2).join(":").trim();
        return !(src.startsWith("//") || src.startsWith("*") || src.startsWith("/*"));
      });
    expect(code).toEqual([]);
  });

  it("DesignSpec.variant enum = v_true·v_fit·v_bal", () => {
    const v = (DesignSpecSchema.shape.variant as unknown as { options: string[] }).options;
    expect([...v].sort()).toEqual(["v_bal", "v_fit", "v_true"]);
  });
});

describe("AC-04-10 LayoutTreeRaw JSON Schema·퍼징", () => {
  function objects(n: Json, path = "$"): { path: string; o: Obj }[] {
    if (n === null || typeof n !== "object") return [];
    if (Array.isArray(n)) return n.flatMap((x, i) => objects(x, `${path}[${i}]`));
    const here = n.type === "object" || "properties" in n ? [{ path, o: n }] : [];
    return [...here, ...Object.entries(n).flatMap(([k, v]) => objects(v, `${path}.${k}`))];
  }
  it("모든 object 스키마에 additionalProperties: false, 금지 키 경로 0", () => {
    const js = layoutTreeRawJsonSchema() as Json;
    const objs = objects(js);
    expect(objs.length).toBeGreaterThan(1);
    const missing = objs.filter((x) => x.o.additionalProperties !== false).map((x) => x.path);
    expect(missing).toEqual([]);
    const banned = /^(style|className|css|html|color|px|font|script|on[A-Za-z].*)$/;
    const keys = objs.flatMap((x) => Object.keys((x.o.properties as Obj | undefined) ?? {}));
    expect(keys.filter((k) => banned.test(k))).toEqual([]);
  });

  it("퍼징 1,000건(무작위 문자열·<script>·style 키) 거부율 100%", () => {
    const valid = JSON.parse(
      readFileSync(
        join(
          ROOT,
          "fixtures/layouts",
          readdirSync(join(ROOT, "fixtures/layouts")).filter((f) => f.endsWith(".json"))[0]!,
        ),
        "utf8",
      ),
    ) as Obj;
    const raw = (valid.raw ?? valid) as Obj;
    expect(LayoutTreeRawSchema.safeParse(raw).success, "기준 픽스처 유효").toBe(true);
    const r = rng(410);
    const junk = (): string => {
      const pool = [
        "<script>alert(1)</script>",
        "javascript:alert(1)",
        "deck:x#1<b>",
        "</style>",
        "\u0000",
        "a".repeat(300),
        "{{x}}",
      ];
      return pool[Math.floor(r() * pool.length)]! + String(Math.floor(r() * 1e6));
    };
    const injectors: ((t: Obj) => void)[] = [
      (t) => void ((t.sections as Obj[])[0]!.style = "color:red"),
      (t) => void ((t.sections as Obj[])[0]!.className = junk()),
      (t) => void ((t.sections as Obj[])[0]!.html = junk()),
      (t) => void ((t.sections as Obj[])[0]!.onclick = junk()),
      (t) => void (t.script = junk()),
      (t) => void ((t.sections as Obj[])[0]!.id = junk()),
      (t) => void ((t.sections as Obj[])[0]!.variant = junk()),
      (t) => {
        const slots = (t.sections as Obj[])[0]!.slots as Obj;
        const k = Object.keys(slots)[0]!;
        slots[k] = { copy: junk() };
      },
      (t) => void ((t.footer as Obj).style = "x"),
      (t) => {
        const slots = (t.sections as Obj[])[0]!.slots as Obj;
        const k = Object.keys(slots)[0]!;
        slots[k] = { ...(slots[k] as Obj), style: "x" };
      },
    ];
    let rejected = 0;
    for (const i of Array.from({ length: 1000 }, (_v, k) => k)) {
      const t = JSON.parse(JSON.stringify(raw)) as Obj;
      injectors[i % injectors.length]!(t);
      if (!LayoutTreeRawSchema.safeParse(t).success) rejected++;
    }
    expect(rejected).toBe(1000);
  });
});

describe("AC-04-30 시그니처 정확히 1개(명세서)", () => {
  it("72조합 모두 signature.id 1개, 03장 카탈로그 안, intensity 1|2", () => {
    const ids = new Set((data.signatures as Obj[]).map((s) => s.id as string));
    for (const typeId of TYPES)
      for (const purpose of PURPOSES) {
        const specs = compileSpecs(
          {
            taste: taste(ANCHOR[typeId]!, SIGMA_SURE, 0.8, typeId),
            purpose,
            brand: null,
            jobSeed: "ac-04-30",
          },
          data,
        );
        for (const v of VARIANTS) {
          const sig = specs[v].signature;
          expect(typeof sig.id).toBe("string");
          expect(ids.has(sig.id), `${typeId}/${purpose}/${v} ${sig.id}`).toBe(true);
          expect(sig.id).not.toBe("SIG-05");
          expect([1, 2]).toContain(sig.intensity);
        }
      }
  });
});
