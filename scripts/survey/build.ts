// pnpm survey:build — 02장 2.4.5 설문 자극물 사전 렌더(렌더 → 추출 x_card → 판정 → WebP → Storage → survey_items upsert, 멱등).
// 계약: ASSUMPTIONS ASM-093·094. 옵션: --only id,… --manifest p --storage-root d --no-db --report p --check [--items p]
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { withDotenv } from "../../packages/config/src/dotenv.js";
import { loadDesignData, surveyPage } from "../../packages/design-spec/src/index.js";
import { compilePage } from "../../packages/renderer/src/index.js";
import { mapL1toL2 } from "../../packages/taxonomy/src/index.js";
import { EXTRACTOR_VERSION } from "../../packages/extractor/src/index.js";
import { AXIS_KEYS } from "../../packages/data-contracts/src/index.js";
import { createDbPort, q, type Tx } from "../../packages/db/src/index.js";
import { FS_DEFAULT_ROOT, createFsStorage } from "../../packages/storage/src/index.js";
import {
  AXIS_IDS,
  STIMULI_SPEC,
  altOk,
  cardPoolOk,
  coverageIssues,
  judgeCard,
  judgePair,
  nearestType,
  stage1Issues,
  type CardJudge,
  type CheckCard,
} from "../../packages/diagnosis/src/index.js";
import { openHarness, type Harness } from "../../apps/worker/src/render/harness.js";
import {
  SURVEY_RENDER,
  dominantColors,
  encodeWebp,
  webpSize,
  type SurveyDevice,
} from "../../apps/worker/src/render/survey.js";
import { AXIS_PHRASES, TEMPLATE_DESC, level } from "../data/seed-temp.js";

type Obj = Record<string, unknown>;
type Vec = number[];
const ROOT = resolve(import.meta.dirname, "../..");
const BUCKET = "survey-assets";
/** 2.4.5 용량 상한(06장 DDL is_survey_asset 바이트와 같음). */
const MAX_BYTES: Record<SurveyDevice, number> = { desktop: 143360, mobile: 163840 };
const OUT: Record<SurveyDevice, { w: number; h: number }> = {
  desktop: { w: 1280, h: 800 },
  mobile: { w: 780, h: 1560 },
};
/** 2.1.2 앵커 수준(축 5 × 5), 나머지 축 = 0.5. 05장 5.9 앵커 행: 인접 수준 차 ≥ 0.10, 단조 증가. */
const ANCHOR = { levels: [0, 0.25, 0.5, 0.75, 1], rest: 0.5, minStep: 0.1 } as const;
const FULL_FOCUS = { x: 0, y: 0, w: 1, h: 1 };
/** 촬영·DOM 수집 규칙 버전(바뀌면 전부 다시 렌더). 2 = 장식 aria-hidden 텍스트 제외(ASM-098). */
const SHOT_VERSION = 2;

export interface Asset {
  path: string;
  sha256: string;
  w: number;
  h: number;
  bytes: number;
}
export interface ManItem {
  assetId: string;
  kind: "card" | "ab_image" | "ab_pair" | "anchor_ref";
  status: "draft" | "verified" | "active" | "retired";
  templateId: string;
  axis: string | null;
  level: number | null;
  pairImageIds: string[] | null;
  target: Vec | null;
  x: Vec | null;
  inputHash: string;
  domHash: string | null;
  assets: { desktop: Asset; mobile?: Asset } | null;
  altText: string | null;
  dominantColors: string[] | null;
  focusRegion: { x: number; y: number; w: number; h: number } | null;
  reasons: string[];
}
export interface Manifest {
  bundle: "survey-manifest";
  taxonomyVersion: string;
  normalizerVersion: string;
  extractorVersion: string;
  items: ManItem[];
}
interface ImagePlan {
  assetId: string;
  kind: "card" | "ab_image" | "anchor_ref";
  presetId: string;
  templateId: string;
  l2Overrides: Record<string, string>;
  target: Vec;
  altText: string;
  focus: { x: number; y: number; w: number; h: number };
  axis: string | null;
  level: number | null;
  sv?: string;
}
interface PairPlan {
  assetId: string;
  axis: string;
  levels: [number, number];
  imageIds: [string, string];
}

const read = <T>(rel: string): T => JSON.parse(readFileSync(join(ROOT, rel), "utf8")) as T;
const items = <T>(rel: string): T[] => read<{ items: T[] }>(rel).items;
const sha = (s: string | Buffer): string => createHash("sha256").update(s).digest("hex");
const arg = (a: string[], k: string): string | undefined => {
  const i = a.indexOf(k);
  return i >= 0 ? a[i + 1] : undefined;
};
const phrase = (l1: Vec): string =>
  l1
    .map((v, i) => ({ i, d: Math.abs(v - 0.5), v }))
    .sort((a, b) => b.d - a.d || a.i - b.i)
    .slice(0, 3)
    .sort((a, b) => a.i - b.i)
    .map((a) => AXIS_PHRASES[`A${a.i + 1}`]?.[level(a.v)] ?? "")
    .join(", ");
const r4 = (v: number): number => Math.round(v * 1e4) / 1e4;
const axisKey = (a: string): string => AXIS_KEYS[AXIS_IDS.indexOf(a as never)] ?? a;
const l1Obj = (v: Vec): Obj => Object.fromEntries(AXIS_KEYS.map((k, i) => [k, v[i]]));

function normalizerVersion(): string {
  const last = readdirSync(join(ROOT, "data/normalizers"))
    .filter((f) => f.endsWith(".json"))
    .sort()
    .at(-1);
  return last?.replace(/\.json$/, "") ?? "none";
}

function plans(): { images: ImagePlan[]; pairs: PairPlan[]; taxonomyVersion: string } {
  const cp = read<{ taxonomyVersion: string; items: Obj[] }>("data/survey/card_plan.json");
  const images: ImagePlan[] = cp.items.map((c) => ({
    assetId: String(c.id),
    kind: "card",
    presetId: String(c.presetId),
    templateId: String(c.templateId),
    l2Overrides: c.l2Overrides as Record<string, string>,
    target: c.targetL1 as Vec,
    altText: String(c.altKo),
    focus: FULL_FOCUS,
    axis: null,
    level: null,
    sv: String(c.svId),
  }));
  const pairs: PairPlan[] = [];
  const seen = new Set<string>();
  for (const p of items<Obj>("data/survey/ab_plan.json")) {
    const fr = p.focusRegion as number[];
    const imgs = p.images as { id: string; targetL1: Vec; l2Overrides: Record<string, string> }[];
    pairs.push({
      assetId: String(p.id),
      axis: String(p.axis),
      levels: [Number(p.levelA), Number(p.levelB)],
      imageIds: [imgs[0]?.id ?? "", imgs[1]?.id ?? ""],
    });
    for (const im of imgs) {
      if (seen.has(im.id)) continue;
      seen.add(im.id);
      const lv = Number(im.id.split("-").at(-1)) / 100;
      images.push({
        assetId: im.id,
        kind: "ab_image",
        presetId: String(p.basePresetId),
        templateId: String(p.templateId),
        l2Overrides: im.l2Overrides,
        target: im.targetL1,
        altText: `선택지 {n}: ${TEMPLATE_DESC[String(p.templateId)] ?? ""}, ${phrase(im.targetL1)}`,
        focus: { x: fr[0] ?? 0, y: fr[1] ?? 0, w: fr[2] ?? 1, h: fr[3] ?? 1 },
        axis: String(p.axis),
        level: lv,
      });
    }
  }
  images.push(...anchorPlans());
  return { images, pairs, taxonomyVersion: cp.taxonomyVersion };
}

/** 앵커 참조 25장(ASM-093 ⑦): tpl-hero, 대상 축 수준·나머지 0.5, L2 = mapL1toL2(최근접 유형 프리셋). */
function anchorPlans(): ImagePlan[] {
  const types = items<{ id: string; centroid: Vec; anchorPresetId: string }>(
    "data/taxonomy/types.json",
  );
  const presets = readdirSync(join(ROOT, "data/taxonomy/presets"))
    .filter((f) => f.endsWith(".json"))
    .map((f) => items<Obj>(`data/taxonomy/presets/${f}`)[0] as Obj);
  const map = {
    taxonomy: items("data/taxonomy/taxonomy.json"),
    mapping: items("data/taxonomy/mapping.json"),
    pairings: items("data/fonts/pairings.json"),
    palettes: items("data/taxonomy/palettes.json"),
  };
  const sig0 = AXIS_IDS.map(() => 1);
  const out: ImagePlan[] = [];
  AXIS_IDS.forEach((a, k) => {
    for (const lv of ANCHOR.levels) {
      const l1 = AXIS_IDS.map((_, j) => (j === k ? lv : ANCHOR.rest));
      const t = nearestType(l1, sig0, types).typeId;
      const pid = types.find((x) => x.id === t)?.anchorPresetId ?? "";
      const p = presets.find((x) => x.id === pid);
      if (!p) throw new Error(`앵커 프리셋 없음 ${pid}`);
      const l2 = mapL1toL2(l1 as never, p as never, map as never) as Record<string, string>;
      const base = p.l2 as Record<string, string>;
      const ov = Object.fromEntries(Object.entries(l2).filter(([kk, v]) => base[kk] !== v));
      out.push({
        assetId: `ANC-${a}-${String(Math.round(lv * 100)).padStart(3, "0")}`,
        kind: "anchor_ref",
        presetId: pid,
        templateId: "tpl-hero",
        l2Overrides: ov,
        target: l1,
        altText: `기준 이미지 ${a}: ${AXIS_PHRASES[a]?.[level(lv)] ?? ""}`,
        focus: FULL_FOCUS,
        axis: a,
        level: lv,
      });
    }
  });
  return out;
}

const approvalsTemp = (): boolean =>
  read<{ provenance: string }>("data/survey/approvals.json").provenance === "temp";
const approvedSet = (): Set<string> =>
  new Set(
    items<{ assetId: string; decision: string }>("data/survey/approvals.json")
      .filter((a) => a.decision === "approved")
      .map((a) => a.assetId),
  );

interface Ctx {
  h: Harness;
  data: ReturnType<typeof loadDesignData>;
  storage: ReturnType<typeof createFsStorage>;
  tv: string;
  nv: string;
  stats: { rendered: number; uploaded: number; skipped: number };
}

/** 이미지 1장: 렌더·촬영·인코딩·업로드·추출. 같은 inputHash + 저장소 파일 sha 일치면 이전 항목 재사용. */
async function buildImage(c: Ctx, p: ImagePlan, prev: ManItem | undefined): Promise<ManItem> {
  const { spec, tree } = surveyPage(
    { presetId: p.presetId, templateId: p.templateId, l2Overrides: p.l2Overrides },
    c.data,
  );
  const { html } = compilePage(spec, tree, c.data) as { html: string };
  const devices: SurveyDevice[] = p.kind === "anchor_ref" ? ["desktop"] : ["desktop", "mobile"];
  const inputHash = sha(
    JSON.stringify({
      html,
      nv: c.nv,
      ev: EXTRACTOR_VERSION,
      r: SURVEY_RENDER,
      devices,
      shot: SHOT_VERSION,
    }),
  );
  if (prev && prev.inputHash === inputHash && prev.assets) {
    let same = true;
    for (const [, a] of Object.entries(prev.assets) as [string, Asset][]) {
      const b = await c.storage.get(BUCKET, a.path.slice(BUCKET.length + 1));
      if (!b || sha(b) !== a.sha256) same = false;
    }
    if (same) {
      c.stats.skipped++;
      return { ...prev, reasons: prev.reasons.filter((r) => !r.startsWith("gate:")) };
    }
  }
  c.stats.rendered++;
  const reasons: string[] = [];
  const assets: Record<string, Asset> = {};
  let domHash: string | null = null;
  let colors: string[] | null = null;
  for (const d of devices) {
    const shot = await c.h.surveyShot(html, SURVEY_RENDER[d]);
    if (shot.blocked.length) reasons.push(`render:${d} 외부 요청 ${shot.blocked.length}`);
    if (shot.failed.length) reasons.push(`render:${d} 실패 요청 ${shot.failed.join(",")}`);
    const webp = await encodeWebp(shot.png, d);
    const sz = await webpSize(webp);
    if (sz.w !== OUT[d].w || sz.h !== OUT[d].h) reasons.push(`size:${d} ${sz.w}×${sz.h}`);
    if (webp.length > MAX_BYTES[d]) reasons.push(`bytes:${d} ${webp.length} > ${MAX_BYTES[d]}`);
    const h = sha(webp);
    const path = `${c.tv}/${p.assetId}.${d}.${h.slice(0, 12)}.webp`;
    const put = await c.storage.put(BUCKET, path, webp, { contentType: "image/webp" });
    if (put.written) c.stats.uploaded++;
    assets[d] = { path: `${BUCKET}/${path}`, sha256: h, w: sz.w, h: sz.h, bytes: webp.length };
    if (d === "desktop") {
      domHash = sha([...shot.texts, "\u0000", ...[...shot.srcs].sort()].join("\n"));
      colors = await dominantColors(shot.png);
    }
  }
  let x: Vec | null = null;
  try {
    x = (await c.h.extractL1(html, OUT.desktop.w)).map(r4);
  } catch (e) {
    reasons.push(`extract:${(e as Error).message}`);
  }
  if (!altOk(p.altText)) reasons.push(`alt:길이 ${[...p.altText].length}`);
  return {
    assetId: p.assetId,
    kind: p.kind,
    status: "draft",
    templateId: p.templateId,
    axis: p.axis,
    level: p.kind === "ab_image" ? p.level : null,
    pairImageIds: null,
    target: p.target,
    x,
    inputHash,
    domHash,
    assets: assets as ManItem["assets"],
    altText: p.altText,
    dominantColors: colors,
    focusRegion: p.focus,
    reasons,
  };
}

/** 판정(5.9·2.4.7): gate 사유를 다시 계산하고 status를 정한다. temp 승인 묶음이면 verified → active. */
function judge(
  man: Map<string, ManItem>,
  pl: ReturnType<typeof plans>,
): { cardPool: { ok: boolean; ratio: number } } {
  const temp = approvalsTemp();
  const approved = approvedSet();
  const activeIf = (id: string): ManItem["status"] =>
    temp || approved.has(id) ? "active" : "verified";
  const clean = (i: ManItem): boolean => i.x !== null && i.reasons.length === 0;
  const judges: CardJudge[] = [];
  for (const p of pl.images) {
    const i = man.get(p.assetId);
    if (!i) continue;
    i.reasons = i.reasons.filter((r) => !r.startsWith("gate:"));
    i.status = "draft";
    if (p.kind !== "card" || !clean(i)) continue;
    const j = judgeCard(p.target, i.x as Vec);
    if (j.ok) {
      judges.push(j);
      i.status = activeIf(i.assetId);
    } else i.reasons.push(...j.reasons.map((r) => `gate:${r}`));
  }
  const inPair = new Set<string>();
  for (const p of pl.pairs) {
    const [a, b] = p.imageIds.map((id) => man.get(id));
    if (!a || !b) {
      man.delete(p.assetId);
      continue;
    }
    const pair: ManItem = {
      assetId: p.assetId,
      kind: "ab_pair",
      status: "draft",
      templateId: a.templateId,
      axis: p.axis,
      level: null,
      pairImageIds: [...p.imageIds],
      target: null,
      x: null,
      inputHash: sha(`${a.inputHash}:${b.inputHash}`),
      domHash: null,
      assets: null,
      altText: null,
      dominantColors: null,
      focusRegion: a.focusRegion,
      reasons: [],
    };
    if (!clean(a) || !clean(b)) pair.reasons.push("gate:이미지 렌더·추출 실패");
    else {
      const j = judgePair(p.axis, p.levels, a.x as Vec, b.x as Vec);
      pair.reasons.push(...j.reasons.map((r) => `gate:${r}`));
      if (a.domHash !== b.domHash) pair.reasons.push("gate:DOM 차이(AC-02-09)");
    }
    if (pair.reasons.length === 0) {
      pair.status = activeIf(p.assetId);
      if (pair.status === "active") p.imageIds.forEach((id) => inPair.add(id));
    }
    man.set(p.assetId, pair);
  }
  for (const p of pl.images)
    if (p.kind === "ab_image") {
      const i = man.get(p.assetId);
      if (!i) continue;
      if (inPair.has(p.assetId)) i.status = "active";
      else i.reasons.push("gate:활성 쌍 없음");
    }
  // 앵커 참조: 축별 5수준 단조 증가·인접 차 ≥ 0.10(5.9)
  for (const [k, a] of AXIS_IDS.entries()) {
    const row = pl.images.filter((p) => p.kind === "anchor_ref" && p.axis === a);
    const got = row.map((p) => man.get(p.assetId));
    if (got.some((i) => !i)) continue;
    const xs = got.map((i) => (clean(i as ManItem) ? ((i as ManItem).x as Vec)[k] : NaN));
    const bad = xs.flatMap((v, n) =>
      n > 0 && !((v ?? NaN) - (xs[n - 1] ?? NaN) >= ANCHOR.minStep)
        ? [`gate:${a} 수준 ${n} 단조·간격 미달`]
        : [],
    );
    for (const i of got as ManItem[]) {
      i.reasons.push(...bad);
      i.status = clean(i) ? "active" : "draft";
    }
  }
  return { cardPool: cardPoolOk(judges) };
}

/** survey_items upsert. 값이 같으면 쓰지 않는다(바뀐 행 수 반환). DB CHECK를 못 넘는 항목(용량·규격)은 건너뛴다. */
async function upsert(tx: Tx, tv: string, list: ManItem[]): Promise<number> {
  let changed = 0;
  const cols = [
    "kind",
    "stage",
    "template_id",
    "axis",
    "level",
    "pair_image_ids",
    "target_l1",
    "x_card",
    "assets",
    "alt_text",
    "dominant_colors",
    "focus_region",
    "status",
  ];
  for (const i of list) {
    if (
      i.reasons.some((r) => /^(bytes|size|render):/.test(r)) ||
      (i.kind !== "ab_pair" && !i.dominantColors)
    )
      continue;
    const ab = i.kind === "ab_image" || i.kind === "ab_pair";
    const vals = [
      i.kind,
      i.kind === "card" ? 1 : ab ? 2 : null,
      i.templateId,
      ab && i.axis ? axisKey(i.axis) : null,
      i.kind === "ab_image" ? i.level : null,
      i.pairImageIds,
      i.target ? JSON.stringify(l1Obj(i.target)) : null,
      i.x ? JSON.stringify(l1Obj(i.x)) : null,
      i.assets ? JSON.stringify(i.assets) : null,
      i.altText,
      i.dominantColors,
      i.focusRegion ? JSON.stringify(i.focusRegion) : null,
      i.status,
    ];
    const r = await q(
      tx,
      `insert into survey_items (taxonomy_version, id, ${cols.join(", ")})
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11::jsonb, $12, $13, $14::jsonb, $15)
       on conflict (taxonomy_version, id) do update set ${cols.map((c) => `${c} = excluded.${c}`).join(", ")}
       where (${cols.map((c) => `survey_items.${c}`).join(", ")}) is distinct from (${cols.map((c) => `excluded.${c}`).join(", ")})`,
      [tv, i.assetId, ...vals],
    );
    changed += r.rowCount ?? 0;
  }
  return changed;
}

/** --check(AC-02-07·37, 9.4.6 ①): 커버리지·(템플릿, 문항 순번) 후보·카드 풀 비율·대체 텍스트·축별 활성 쌍. */
function check(args: string[], manPath: string): number {
  const types = items<{ id: string; centroid: Vec }>("data/taxonomy/types.json");
  const plan = new Map(
    items<{ id: string; svId: string; templateId: string; targetL1: Vec }>(
      "data/survey/card_plan.json",
    ).map((c) => [c.id, c]),
  );
  const fx = arg(args, "--items");
  const issues: string[] = [];
  let active: CheckCard[];
  if (fx) {
    const rows = (
      JSON.parse(readFileSync(fx, "utf8")) as {
        items: { assetId: string; status: string; x: Vec }[];
      }
    ).items;
    active = rows.flatMap((r) => {
      const c = plan.get(r.assetId);
      return c && r.status === "active"
        ? [{ id: c.id, sv: c.svId, template: c.templateId, x: r.x, mobile: true }]
        : [];
    });
  } else {
    if (!existsSync(manPath)) {
      process.stdout.write(`survey:build --check: manifest 없음 ${manPath}\n`);
      return 1;
    }
    const m = JSON.parse(readFileSync(manPath, "utf8")) as Manifest;
    const cards = m.items.filter((i) => i.kind === "card" && i.status === "active" && i.x);
    active = cards.flatMap((i) => {
      const c = plan.get(i.assetId);
      return c
        ? [
            {
              id: c.id,
              sv: c.svId,
              template: c.templateId,
              x: i.x as Vec,
              mobile: !!i.assets?.mobile,
            },
          ]
        : [];
    });
    const pool = cardPoolOk(cards.map((i) => judgeCard(i.target as Vec, i.x as Vec)));
    if (!pool.ok)
      issues.push(`CARDPOOL ratio=${pool.ratio.toFixed(3)} < ${STIMULI_SPEC.cardWithinRatio}`);
    for (const i of m.items)
      if (i.kind !== "ab_pair" && !(i.altText && altOk(i.altText))) issues.push(`ALT ${i.assetId}`);
    for (const a of AXIS_IDS) {
      const n = m.items.filter(
        (i) => i.kind === "ab_pair" && i.axis === a && i.status === "active",
      ).length;
      if (n < STIMULI_SPEC.pairsPerAxisMin)
        issues.push(`PAIRS axis=${a} active=${n} < ${STIMULI_SPEC.pairsPerAxisMin}`);
    }
  }
  issues.push(...coverageIssues(active, types), ...stage1Issues(active, types));
  for (const s of issues) process.stdout.write(`${s}\n`);
  process.stdout.write(`survey:build --check: 활성 카드 ${active.length}, 문제 ${issues.length}\n`);
  return issues.length ? 1 : 0;
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const manPath = resolve(arg(args, "--manifest") ?? join(ROOT, "data/survey/manifest.lock.json"));
  if (args.includes("--check")) return check(args, manPath);
  const env = withDotenv(ROOT);
  const pl = plans();
  const only = arg(args, "--only")?.split(",").filter(Boolean);
  const want = new Set<string>();
  if (only)
    for (const id of only) {
      want.add(id);
      for (const p of pl.pairs) if (p.assetId === id) p.imageIds.forEach((x) => want.add(x));
    }
  const prev: Manifest | null = existsSync(manPath)
    ? (JSON.parse(readFileSync(manPath, "utf8")) as Manifest)
    : null;
  const man = new Map((prev?.items ?? []).map((i) => [i.assetId, i]));
  const ctx: Ctx = {
    h: await openHarness(),
    data: loadDesignData(ROOT),
    storage: createFsStorage({
      root: arg(args, "--storage-root") ?? FS_DEFAULT_ROOT,
      webOrigin: env.WEB_ORIGIN ?? "http://localhost:3000",
      secret: env.LOCAL_JWT_SECRET ?? "survey-build-unsigned",
    }),
    tv: pl.taxonomyVersion,
    nv: normalizerVersion(),
    stats: { rendered: 0, uploaded: 0, skipped: 0 },
  };
  try {
    const todo = pl.images.filter((p) => !only || want.has(p.assetId));
    let n = 0;
    for (const p of todo) {
      man.set(p.assetId, await buildImage(ctx, p, man.get(p.assetId)));
      if (++n % 10 === 0) process.stdout.write(`survey:build ${n}/${todo.length}\n`);
    }
  } finally {
    await ctx.h.close();
  }
  const { cardPool } = judge(man, pl);
  const out: Manifest = {
    bundle: "survey-manifest",
    taxonomyVersion: ctx.tv,
    normalizerVersion: ctx.nv,
    extractorVersion: EXTRACTOR_VERSION,
    items: [...man.values()].sort((a, b) => (a.assetId < b.assetId ? -1 : 1)),
  };
  mkdirSync(dirname(manPath), { recursive: true });
  writeFileSync(manPath, `${JSON.stringify(out, null, 2)}\n`);
  let dbChanged = 0;
  if (!args.includes("--no-db")) {
    const url = env.DATABASE_URL_DIRECT;
    if (!url) {
      process.stderr.write("survey:build: DATABASE_URL_DIRECT 없음(--no-db로 건너뛸 수 있음)\n");
      return 1;
    }
    const db = createDbPort(url);
    try {
      const list = only ? out.items.filter((i) => want.has(i.assetId)) : out.items;
      dbChanged = await db.withService((tx) => upsert(tx, ctx.tv, list));
    } finally {
      await db.close();
    }
  }
  const cnt = (k: ManItem["kind"]) =>
    out.items.filter((i) => i.kind === k && i.status === "active").length;
  const report = {
    ...ctx.stats,
    dbChanged,
    counts: {
      cardsActive: cnt("card"),
      abImagesActive: cnt("ab_image"),
      pairsActive: Object.fromEntries(
        AXIS_IDS.map((a) => [
          a,
          out.items.filter((i) => i.kind === "ab_pair" && i.axis === a && i.status === "active")
            .length,
        ]),
      ),
      anchorsActive: cnt("anchor_ref"),
      cardPool,
    },
  };
  const rp = arg(args, "--report");
  if (rp) writeFileSync(rp, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`survey:build: ${JSON.stringify(report)}\n`);
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exitCode = await main();
