// 후보 1개 평가(04장 4.10: 렌더 5뷰포트 + 추출 + 린트 + 게이트 + 조화 + TM → QualityReport, ASM-080 ④·ASM-085).
// 파이프라인(M5)·골든·폴백 검증이 같은 함수를 쓴다.
import { createHash } from "node:crypto";
import { getThresholds } from "@tastefit/config";
import type { DesignData } from "@tastefit/design-spec";
import { AXES as L1_AXES, toL1 } from "@tastefit/extractor";
import {
  copyOfTree,
  lintAll,
  treeLint,
  type LintFinding,
  type Snapshot,
} from "@tastefit/linter";
import {
  GATE_FNS,
  QualityReportSchema,
  checkOriginality,
  harmonyScore,
  loadOriginalityConfig,
  tasteMatch,
  type OriginalityReport,
  type QualityReport,
  type ReferenceSig,
} from "@tastefit/scoring";
import type { Harness, PageMeasure } from "../render/harness.js";

type Obj = { [k: string]: unknown };
const isObj = (x: unknown): x is Obj => typeof x === "object" && x !== null && !Array.isArray(x);
const GATE_IDS = Array.from({ length: 13 }, (_, i) => `G-${String(i + 1).padStart(2, "0")}`);
/** 05장 L1 축 → 04장 4.10.4 축 키(A1~A5, 같은 순서). */
const TM_AXES = ["A1", "A2", "A3", "A4", "A5"] as const;
/** 린터 D 단계를 돌릴 뷰포트(4.13.2 AIL-24: 375·1280). */
const LINT_VIEWPORTS = [375, 1280] as const;
const L1_VW = 1280;
const FIRST_VIEW = { w: 1280, h: 800 } as const;

export interface EvaluateOptions {
  fallback?: boolean;
  brand?: Obj;
  candidateId?: string;
  /** 원본 유사도 비교 집합(08장 8.3.1). 기본 = 빈 집합(temp 레퍼런스 시드에 originality_sig 없음, ASM-078 ⑤). */
  references?: ReferenceSig[];
  /** axe 실행기(G-08). 없으면 G-08 = fail "axe 미실행"(BLK-008). */
  axe?: (html: string, vw: number) => Promise<{ id: string; impact: string }[]>;
  round?: 0 | 1;
  origin?: "llm" | "repair" | "fallback";
}
export interface EvaluateResult {
  viewports: number[];
  report: QualityReport;
  measures: PageMeasure[];
  lint: LintFinding[];
}

const oklab = (lch: unknown): [number, number, number] | null => {
  if (!Array.isArray(lch) || lch[2] === undefined) return null; // [L, C, h]
  const [l, c, h] = lch as number[];
  const r = ((h ?? 0) * Math.PI) / 180;
  return [l ?? 0, (c ?? 0) * Math.cos(r), (c ?? 0) * Math.sin(r)];
};
const get = (o: unknown, ...p: string[]): unknown =>
  p.reduce<unknown>((x, k) => (isObj(x) ? x[k] : undefined), o);

function originalitySig(spec: unknown, tree: unknown): ReferenceSig {
  const l2 = (get(spec, "l2") ?? {}) as Record<string, string>;
  const fam = (k: string): string => {
    const v = get(spec, "tokens", "font", k, "$value");
    return Array.isArray(v) && typeof v[0] === "string" ? v[0] : "";
  };
  return {
    reference_id: "",
    palette_oklab: {
      primary: oklab(get(spec, "tokens", "color", "primary", "$value", "components")) ?? [0, 0, 0],
      accent: oklab(get(spec, "tokens", "color", "accent", "$value", "components")),
    },
    font_substitute_ids: { display: fam("heading"), body: fam("body") },
    radius_family_id: l2["shape.radius_family"] ?? "",
    depth_id: l2["depth.style"] ?? "",
    layout_pattern_id: String(get(tree, "pattern_id") ?? ""),
    phash_1280: null,
    texts: [],
  };
}

async function firstViewHash(h: Harness, html: string): Promise<string> {
  const sharp = (await import("sharp")).default;
  const { phash64 } = await import("@tastefit/extractor");
  const { png } = await h.screenshot(html, FIRST_VIEW.w);
  const { data, info } = await sharp(png)
    .extract({ left: 0, top: 0, width: FIRST_VIEW.w, height: FIRST_VIEW.h })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return phash64(new Uint8Array(data), info.width, info.height, info.channels);
}

export async function evaluateCandidate(
  h: Harness,
  c: { spec: unknown; tree: unknown; html: string },
  data: DesignData,
  opts: EvaluateOptions = {},
): Promise<EvaluateResult> {
  void data;
  const t0 = performance.now();
  const gen = getThresholds().generation;
  const viewports = (
    isObj(gen) && Array.isArray(gen.renderViewports) ? gen.renderViewports : []
  ).filter((x): x is number => typeof x === "number");
  const measures: PageMeasure[] = [];
  for (const vw of viewports) measures.push(await h.measure(c.html, vw, { spec: c.spec }));
  const tRender = performance.now();

  const feats = await h.features(c.html, L1_VW);
  const nz = h.normalizer();
  const l1 = toL1(feats, nz);
  const tExtract = performance.now();

  const copy = copyOfTree(c.tree);
  const snaps: Snapshot[] = [];
  for (const vw of LINT_VIEWPORTS) snaps.push(await h.lintSnapshot(c.html, vw, { spec: c.spec }));
  const lint: LintFinding[] = [
    ...lintAll({ spec: c.spec, tree: c.tree, copy, brand: opts.brand }),
    ...snaps.flatMap((snapshot) => lintAll({ snapshot, spec: c.spec }, { stages: ["D", "P"] })),
  ];
  const tLint = performance.now();

  const cfg = loadOriginalityConfig();
  const refs = opts.references ?? [];
  const phash = refs.some((r) => r.phash_1280) ? await firstViewHash(h, c.html) : null;
  const originality: OriginalityReport = checkOriginality(
    { sig: originalitySig(c.spec, c.tree), phash, texts: copy.map((x) => x.text) },
    refs,
    cfg,
  );
  const s1280 = snaps.find((s) => s.vw === L1_VW) ?? snaps[0];
  const reg = s1280?.regions;
  const brandName =
    (typeof opts.brand?.name === "string" ? opts.brand.name : null) ?? reg?.wordmark ?? "";
  const axeRuns = opts.axe
    ? await Promise.all(
        LINT_VIEWPORTS.map(async (vw) => ({
          vw,
          violations: await (opts.axe as NonNullable<EvaluateOptions["axe"]>)(c.html, vw),
        })),
      )
    : null;
  const inputs: Record<string, unknown> = {
    "G-01": { spec: c.spec, tree: c.tree },
    "G-08": axeRuns ? { axe: axeRuns } : { axe: [] },
    "G-09": { lint },
    "G-10": {
      brandName,
      nav: [reg?.nav ?? ""],
      hero: [reg?.hero ?? ""],
      footer: [reg?.footer ?? ""],
    },
    "G-11": { originality },
    "G-13": { texts: copy.map((x) => x.text) },
  };
  const hard = GATE_IDS.map((id) => {
    const fn = GATE_FNS[id];
    const r = fn ? fn(inputs[id] ?? { measures }) : { id, pass: false, violations: ["미구현"] };
    const violations = id === "G-08" && !axeRuns ? ["axe 미실행(BLK-008)"] : r.violations;
    const pass = id === "G-08" && !axeRuns ? false : r.pass;
    return {
      id,
      status: pass ? ("pass" as const) : ("fail" as const),
      measured: violations,
      limit: 0,
      ...(pass ? {} : { code: `GATE_FAILED:${id}` }),
    };
  });
  const tGates = performance.now();

  const hs = harmonyScore(c.spec, c.tree, { violations: treeLint(c.spec, c.tree) });
  const tv = (get(c.spec, "target_vector") ?? {}) as Record<string, number>;
  const sg = (get(c.spec, "calibration_trace", "sigma") ?? {}) as Record<string, number>;
  const reliable = Object.fromEntries(
    TM_AXES.map((a, i) => {
      const k = L1_AXES[i] ?? "expression";
      return [a, nz.reliable?.[k] === true && l1[k] !== null];
    }),
  ) as Record<(typeof TM_AXES)[number], boolean>;
  const v = L1_AXES.map((k) => l1[k] ?? 0);
  const t = L1_AXES.map((k) => tv[k] ?? 0);
  const taste = tasteMatch({ v, t, sigma: L1_AXES.map((k) => sg[k] ?? 0), reliable });
  const errs = [...new Set(lint.filter((f) => f.severity === "error").map((f) => f.rule))];
  const warns = [...new Set(lint.filter((f) => f.severity === "warn").map((f) => f.rule))];
  const fallback = opts.fallback === true;
  const report = QualityReportSchema.parse({
    candidate_id:
      opts.candidateId ??
      `${String(get(c.spec, "spec_id") ?? "spec")}:${String(get(c.spec, "variant") ?? "")}`,
    variant: get(c.spec, "variant") ?? "v_true",
    pattern_id: String(get(c.tree, "pattern_id") ?? "none"),
    spec_id: String(get(c.spec, "spec_id") ?? "none"),
    compile_hash: createHash("sha256").update(c.html).digest("hex"),
    hard,
    harmony: hs.total,
    harmonyItems: hs.items.map((i) => ({ id: i.id, score: i.points, measured: i.measured })),
    tasteMatch: taste.tm,
    sFree: taste.sFree,
    taste: { v, t, d: taste.d, spec_drift: false },
    clipped: false,
    lint: {
      error: errs,
      warn: warns,
      hits: lint.map((f) => ({ rule: f.rule, severity: f.severity, message_ko: f.message })),
    },
    judge: { mode: "log", j: null, raw: [] },
    originality,
    rank_score: null,
    round: opts.round ?? 0,
    origin: opts.origin ?? (fallback ? "fallback" : "llm"),
    auto_fixes: [],
    timings_ms: {
      compile: 0,
      render: Math.round(tRender - t0),
      extract: Math.round(tExtract - tRender),
      gates: Math.round(tGates - tLint),
      lint: Math.round(tLint - tExtract),
      judge: 0,
    },
    visible: false,
    fallback,
    hide_reason: null,
    warnings: taste.warnings,
  });
  return { viewports, report, measures, lint };
}
