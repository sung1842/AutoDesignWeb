// 09장 9.2.4 B18 합성 부트스트랩 정규화기 재생성(`pnpm seed:temp --corpus`의 2단계, ASM-068).
// 코퍼스 = 프리셋 8 × 3.4.5 허용 변형 25개(seed 20261116) = 200 렌더(standardTree, 1280×800) → 특징 분위 101개.
// 매핑 가중치 = 5.5.4 mapping.initial 그대로, b0·b1만 predictL1(l2)를 목표로 축별 최소제곱.
// 홀드아웃(앵커 기본 L2 8·설문 카드 48·A/B 120의 L2)은 코퍼스에서 뺀다. reliable = 앵커 왕복(5.9 temp 분기).
// page.evaluate 함수는 tsx(esbuild keepNames)로 넘기면 __name 참조가 깨지므로 빌드된 worker dist를 쓴다.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  allowedValues,
  inFeasible,
  loadDesignData,
  predictL1,
  standardTree,
  type DesignData,
} from "../../packages/design-spec/src/index.js";
import { AXES, quantileRank, type Normalizer } from "../../packages/extractor/src/index.js";
import { compilePage } from "../../packages/renderer/src/index.js";
import { thresholdNumber } from "../../packages/config/src/index.js";
import type { L2 } from "../../packages/taxonomy/src/index.js";

type Obj = Record<string, unknown>;
export const CORPUS_SPEC = { seed: 20261116, perPreset: 25, maxTries: 5000 } as const;
const PURPOSES = ["saas", "local_business", "portfolio"] as const;
const r6 = (x: number): number => Math.round(x * 1e6) / 1e6;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const keyOf = (l2: L2): string =>
  JSON.stringify(Object.fromEntries(Object.entries(l2).sort(([a], [b]) => a.localeCompare(b))));

/** 홀드아웃 L2: 앵커 기본 + 카드·A/B 이미지(프리셋 기본 + l2Overrides). */
function holdouts(root: string, data: DesignData): Set<string> {
  const out = new Set(data.presets.map((p) => keyOf(p.l2)));
  const read = (rel: string): Obj[] =>
    (JSON.parse(readFileSync(join(root, rel), "utf8")) as { items: Obj[] }).items;
  const add = (presetId: unknown, ov: unknown): void => {
    const p = data.presets.find((x) => x.id === presetId);
    if (p) out.add(keyOf({ ...p.l2, ...((ov as L2 | undefined) ?? {}) } as L2));
  };
  for (const c of read("data/survey/card_plan.json")) add(c.presetId, c.l2Overrides);
  for (const ab of read("data/survey/ab_plan.json"))
    for (const im of ab.images as Obj[]) add(ab.basePresetId, im.l2Overrides);
  return out;
}

/** 3.4.5 허용 집합에서 키마다 균등 추출 → F 집합(inFeasible) 안·홀드아웃 밖·중복 없는 25개. */
export function corpusL2(
  root: string,
  data: DesignData,
): { typeId: string; purpose: string; l2: L2 }[] {
  const rand = mulberry32(CORPUS_SPEC.seed);
  const hold = holdouts(root, data);
  const out: { typeId: string; purpose: string; l2: L2 }[] = [];
  for (const p of data.presets) {
    const seen = new Set<string>();
    let tries = 0;
    while (seen.size < CORPUS_SPEC.perPreset) {
      if (++tries > CORPUS_SPEC.maxTries) throw new Error(`코퍼스 추출 실패 ${p.id}`);
      const l2 = { ...p.l2 } as L2;
      for (const key of Object.keys(p.l2)) {
        if (key === "icon.set") continue;
        const vals = allowedValues(key, l2, p, data);
        const v = key === "color.palette_id" ? p.palettes : vals;
        if (v.length) l2[key] = v[Math.floor(rand() * v.length)]!;
      }
      const purpose = PURPOSES[out.length % PURPOSES.length]!;
      const k = keyOf(l2);
      if (seen.has(k) || hold.has(k)) continue;
      if (!inFeasible(l2, { typeId: p.typeId, purpose, signatureId: null } as never, data))
        continue;
      seen.add(k);
      out.push({ typeId: p.typeId, purpose, l2 });
    }
  }
  return out;
}

/** 경험적 분위 101개(선형 보간, R type 7). */
export function quantiles(xs: number[]): number[] {
  const s = [...xs].sort((a, b) => a - b);
  return Array.from({ length: 101 }, (_, i) => {
    const h = ((s.length - 1) * i) / 100;
    const lo = Math.floor(h);
    const hi = Math.min(s.length - 1, lo + 1);
    return r6(s[lo]! + (s[hi]! - s[lo]!) * (h - lo));
  });
}

interface HarnessLike {
  features(html: string, vw: number): Promise<Obj>;
  close(): Promise<void>;
}

export async function seedNormalizer(root: string): Promise<string> {
  const dist = join(root, "apps/worker/dist/render/harness.js");
  if (!existsSync(dist))
    throw new Error("seed:temp --corpus: worker dist 없음 → `pnpm -s build` 먼저");
  const { openHarness } = (await import(dist)) as { openHarness: () => Promise<HarnessLike> };
  const { EXTRACTOR_VERSION } = await import("../../packages/extractor/src/index.js");
  const data = loadDesignData(root);
  const path = join(root, "data/normalizers/2026-S0.json");
  const base = JSON.parse(readFileSync(path, "utf8")) as Obj & Normalizer;
  if ((base as Obj).provenance === "human") return "skip(human) data/normalizers/2026-S0.json";
  const corpus = corpusL2(root, data);
  const h = await openHarness();
  const feats: Obj[] = [];
  const anchors: Obj[] = [];
  try {
    for (const c of corpus) {
      const { spec, tree } = standardTree(c.typeId, c.purpose, data, { l2: c.l2 });
      feats.push(await h.features(compilePage(spec, tree, data).html, 1280));
    }
    for (const p of data.presets) {
      const { spec, tree } = standardTree(p.typeId, "saas", data);
      anchors.push(await h.features(compilePage(spec, tree, data).html, 1280));
    }
  } finally {
    await h.close();
  }
  // 분위표(사용 특징만, transform 후)
  const features: Normalizer["features"] = {};
  for (const [fid, def] of Object.entries(base.features)) {
    const xs = feats
      .map((f) => f[fid])
      .filter((v): v is number => typeof v === "number")
      .map((v) => (def.transform === "log1p" ? Math.log1p(v) : v));
    if (xs.length === 0) throw new Error(`코퍼스 특징 전부 null: ${fid}`);
    features[fid] = { transform: def.transform, q: quantiles(xs) };
  }
  const sOf = (f: Obj, axis: (typeof AXES)[number]): number | null => {
    const m = base.mapping[axis];
    let w = 0;
    let s = 0;
    for (const [fid, wt] of Object.entries(m.weights)) {
      const v = f[fid];
      const d = features[fid];
      if (typeof v !== "number" || !d) continue;
      const N = quantileRank(d.q, d.transform === "log1p" ? Math.log1p(v) : v);
      s += wt * ((m.sign[fid] ?? 1) < 0 ? 1 - N : N);
      w += wt;
    }
    return w > 0 ? s / w : null;
  };
  const mapping: Obj = {};
  const fit: Obj = {};
  for (const axis of AXES) {
    const pts = corpus
      .map((c, i) => ({ x: sOf(feats[i]!, axis), y: predictL1(c.l2, data)[axis] }))
      .filter((p): p is { x: number; y: number } => p.x !== null);
    const mx = pts.reduce((a, p) => a + p.x, 0) / pts.length;
    const my = pts.reduce((a, p) => a + p.y, 0) / pts.length;
    const sxx = pts.reduce((a, p) => a + (p.x - mx) ** 2, 0);
    const sxy = pts.reduce((a, p) => a + (p.x - mx) * (p.y - my), 0);
    const b1 = sxx > 0 ? sxy / sxx : 1;
    const b0 = sxx > 0 ? my - b1 * mx : 0;
    const mae = pts.reduce((a, p) => a + Math.abs(b0 + b1 * p.x - p.y), 0) / pts.length;
    mapping[axis] = { ...base.mapping[axis], b0: r6(b0), b1: r6(b1), source: "initial" };
    fit[axis] = { n: pts.length, mae: r6(mae) };
  }
  // 5.9 temp 분기: 앵커 왕복 |x̂ − predictL1(기본 L2)| ≤ roundtripAbsMax 인 축만 reliable
  const tol = thresholdNumber("release.extractor.roundtripAbsMax");
  const reliable: Record<string, boolean> = {};
  const roundtrip: Obj = {};
  for (const axis of AXES) {
    const m = mapping[axis] as { b0: number; b1: number };
    const errs = data.presets.map((p, i) => {
      const s = sOf(anchors[i]!, axis);
      const x = s === null ? NaN : Math.min(1, Math.max(0, m.b0 + m.b1 * s));
      return r6(Math.abs(x - predictL1(p.l2, data)[axis]));
    });
    reliable[axis] = errs.every((e) => e <= tol);
    roundtrip[axis] = Math.max(...errs);
  }
  const body: Obj = {
    version: "2026-S0",
    provenance: "temp",
    extractor_version: EXTRACTOR_VERSION,
    font_class_table_version: base.font_class_table_version,
    trend_feature_def_version: base.trend_feature_def_version,
    corpus: {
      n: corpus.length,
      seed: CORPUS_SPEC.seed,
      hash: `sha256:${createHash("sha256").update(JSON.stringify(corpus)).digest("hex")}`,
      fit,
      anchor_roundtrip_max: roundtrip,
    },
    features,
    mapping,
    reliable,
    subjective: base.subjective,
    inter_rater: "unverified",
  };
  writeFileSync(path, `${JSON.stringify(body, null, 2)}\n`);
  return "data/normalizers/2026-S0.json";
}
