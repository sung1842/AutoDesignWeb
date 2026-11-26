// pnpm sim:survey [--gate | --dev] [--synthetic] [--tune] [--out <dir>] — 02장 2.16 시뮬레이터 CLI(ASM-091).
//   자극물: data/survey/manifest.lock.json의 x_card(survey:build 산출). 없으면 --synthetic만(target_l1 + 잡음, verdict n/a).
//   --synthetic --gate는 종료 코드 1(AC-02-35). --gate 종료 코드: PASS 0, FAIL 1.
//   --tune: dev 시드로 2.16.2 좌표 탐색 → config/diagnosis-tuned.json + sim/reports/tuning-log.json(커밋은 chore(sim-tune): 단독).
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { getThresholds } from "../../packages/config/src/index.js";
import {
  CONDITIONS,
  NON_BLOCKING,
  coordinates,
  judge,
  mulberry32,
  pooled,
  simulate,
  tune,
  tuned as loadTuned,
  type Check,
  type EngineItems,
  type SimMetrics,
  type Tuned,
  type Vec,
} from "../../packages/diagnosis/src/index.js";

const ROOT = join(import.meta.dirname, "../..");
type Obj = Record<string, unknown>;
const read = <T>(rel: string): T => JSON.parse(readFileSync(join(ROOT, rel), "utf8")) as T;

interface Stimuli {
  items: EngineItems;
  perceived: Map<string, Vec>;
  source: "x_card" | "synthetic";
}
function stimuli(synthetic: boolean, seed: number): Stimuli {
  const cards = read<{
    items: { id: string; svId: string; templateId: string; targetL1: Vec; status?: string }[];
  }>("data/survey/card_plan.json").items;
  const ab = read<{
    items: {
      id: string;
      axis: string;
      basePresetId: string;
      levelA: number;
      levelB: number;
      images: { id: string; targetL1: Vec }[];
    }[];
  }>("data/survey/ab_plan.json").items;
  const perceived = new Map<string, Vec>();
  for (const c of cards) perceived.set(c.id, c.targetL1);
  for (const p of ab) for (const im of p.images) perceived.set(im.id, im.targetL1);
  let xOf: (id: string, noise: number) => Vec | undefined;
  let active: (id: string) => boolean;
  if (synthetic) {
    const r = mulberry32(seed);
    xOf = (id, noise) =>
      perceived.get(id)?.map((v) => Math.min(1, Math.max(0, v + (2 * r() - 1) * noise)));
    active = () => true;
  } else {
    const p = join(ROOT, "data/survey/manifest.lock.json");
    if (!existsSync(p))
      throw new Error(
        "x_card 없음: data/survey/manifest.lock.json(pnpm survey:build 먼저). 합성 자극물은 --synthetic",
      );
    const man = read<{ items: { assetId: string; x: Vec; status: string }[] }>(
      "data/survey/manifest.lock.json",
    ).items;
    const m = new Map(man.map((x) => [x.assetId, x]));
    xOf = (id) => m.get(id)?.x;
    active = (id) => m.get(id)?.status === "active";
  }
  const items: EngineItems = {
    cards: cards
      .filter((c) => active(c.id))
      .map((c) => ({
        id: c.id,
        sv: c.svId,
        template: c.templateId,
        x: xOf(c.id, 0.05) ?? c.targetL1,
        mobile: true,
      })),
    pairs: ab
      .filter((p) => p.images.every((im) => active(im.id)))
      .map((p) => ({
        id: p.id,
        axis: p.axis,
        typeId: p.basePresetId.replace(/^PS-/, ""),
        levels: [p.levelA, p.levelB] as [number, number],
        a: { id: p.images[0]?.id ?? "", x: xOf(p.images[0]?.id ?? "", 0.03) ?? [] },
        b: { id: p.images[1]?.id ?? "", x: xOf(p.images[1]?.id ?? "", 0.03) ?? [] },
      })),
  };
  return { items, perceived, source: synthetic ? "synthetic" : "x_card" };
}

/** --n: 조건당 인원 덮어쓰기(스모크 실행 전용, gate·tune에서는 무시). */
let N_OVERRIDE: number | null = null;
function runAll(st: Stimuli, seeds: number[], t: Tuned): Record<string, SimMetrics> {
  const S = (
    getThresholds().release as unknown as {
      surveySim: { populationPerSeed: number; populationPA: number };
    }
  ).surveySim;
  const types = read<{ items: { id: string; centroid: Vec }[] }>("data/taxonomy/types.json").items;
  const out: Record<string, SimMetrics> = {};
  for (const c of CONDITIONS)
    out[c.id] = pooled(
      seeds.map((seed) =>
        simulate({
          items: st.items,
          perceived: st.perceived,
          types,
          condition: c,
          n: N_OVERRIDE ?? (c.population === "P-A" ? S.populationPA : S.populationPerSeed),
          seed,
          tuned: t,
        }),
      ),
    );
  return out;
}

function report(
  st: Stimuli,
  mode: string,
  seeds: number[],
  results: Record<string, SimMetrics>,
  checks: Check[],
): Obj {
  const last = readdirSync(join(ROOT, "data/normalizers"))
    .filter((f) => f.endsWith(".json"))
    .sort()
    .at(-1);
  const nz = read<{ version: string; provenance: string }>(
    `data/normalizers/${last ?? "2026-S0.json"}`,
  );
  const blocking = checks.every((c) => c.pass);
  return {
    mode,
    seeds,
    stimulus: {
      source: st.source,
      normalizer_version: nz.version,
      normalizer_provenance: nz.provenance,
    },
    conditions: CONDITIONS.map((c) => {
      const m = results[c.id];
      return {
        ...c,
        blocking: !NON_BLOCKING.includes(c.variant),
        rmse: m?.rmse,
        top1: m?.top1,
        top2: m?.top2,
        coverage: m?.coverage,
        kappaMean: m?.kappaMean,
        maxQuestions: m?.maxQuestions,
        errors: m?.errors,
        ...(m?.priorTypeChange !== undefined ? { priorTypeChange: m.priorTypeChange } : {}),
      };
    }),
    rmseCurve: results["PU-b8"]?.curve ?? [],
    checks,
    margin_warning: checks.some((c) => c.marginWarning === true),
    verdict: st.source === "synthetic" ? "n/a" : blocking ? "PASS" : "FAIL",
  };
}
function writeReport(dir: string, name: string, rep: Obj): void {
  const base = resolve(ROOT, dir);
  mkdirSync(base, { recursive: true });
  writeFileSync(join(base, `${name}.json`), `${JSON.stringify(rep, null, 2)}\n`);
  const rows = (rep.conditions as Obj[])
    .map(
      (c) =>
        `| ${String(c.id)} | ${String(c.variant)} | ${c.blocking ? "차단" : "비차단"} | ${Number(c.rmse).toFixed(3)} | ${Number(c.top1).toFixed(3)} | ${Number(c.coverage).toFixed(3)} | ${Number(c.kappaMean).toFixed(3)} |`,
    )
    .join("\n");
  const checks = (rep.checks as Check[])
    .map(
      (c) =>
        `| ${c.key} | ${c.value.toFixed(4)} | ${JSON.stringify(c.limit)} | ${c.pass ? "PASS" : "FAIL"}${c.marginWarning ? " (margin_warning)" : ""} |`,
    )
    .join("\n");
  writeFileSync(
    join(base, `${name}.md`),
    `# sim:survey ${String(rep.mode)} — ${String(rep.verdict)}\n\n자극물: ${JSON.stringify(rep.stimulus)}\n\n| 조건 | 변형 | 판정 | RMSE | top-1 | 포함률 | κ |\n|---|---|---|---|---|---|---|\n${rows}\n\n| 지표 | 값 | 합격선 | 판정 |\n|---|---|---|---|\n${checks}\n`,
  );
}

function main(): number {
  const args = new Set(process.argv.slice(2));
  const outAt = process.argv.indexOf("--out");
  const outDir = outAt >= 0 ? (process.argv[outAt + 1] ?? "sim/reports") : "sim/reports";
  const synthetic = args.has("--synthetic");
  const gate = args.has("--gate");
  const S = (
    getThresholds().release as unknown as {
      surveySim: {
        seeds: { gate: number[]; dev: number[] };
        maxTuningTrials: number;
        maxGateRuns: number;
      };
    }
  ).surveySim;
  if (synthetic && gate) {
    process.stderr.write(
      "sim:survey: --synthetic --gate는 판정하지 않는다(x_card만 gate, AC-02-35)\n",
    );
    return 1;
  }
  const nAt = process.argv.indexOf("--n");
  if (nAt >= 0 && !gate && !args.has("--tune")) N_OVERRIDE = Number(process.argv[nAt + 1]);
  const st = stimuli(synthetic, S.seeds.dev[0] ?? 1);
  if (args.has("--tune")) {
    const tunable = (
      getThresholds().diagnosis as unknown as { tunable: Parameters<typeof coordinates>[0] }
    ).tunable;
    const res = tune({
      start: loadTuned(),
      coordinates: coordinates(tunable),
      dev: (t) => judge(runAll(st, S.seeds.dev, t)),
      gate: (t) => judge(runAll(st, S.seeds.gate, t)).every((c) => c.pass),
      maxTrials: S.maxTuningTrials,
      maxGateRuns: S.maxGateRuns,
    });
    mkdirSync(join(ROOT, "sim/reports"), { recursive: true });
    writeFileSync(
      join(ROOT, "sim/reports/tuning-log.json"),
      `${JSON.stringify(res.log, null, 2)}\n`,
    );
    writeFileSync(
      join(ROOT, "config/diagnosis-tuned.json"),
      `${JSON.stringify(res.final, null, 2)}\n`,
    );
    process.stdout.write(
      `sim:survey --tune: gate ${res.gateRuns}회, dev ${res.devTrials}회, ${res.passed ? "PASS" : "상한 도달(sim-limit)"}\n`,
    );
    return res.passed ? 0 : 3;
  }
  const seeds = gate ? S.seeds.gate : S.seeds.dev;
  const results = runAll(st, seeds, loadTuned());
  const checks = judge(results);
  const rep = report(st, gate ? "gate" : "dev", seeds, results, checks);
  const name = `${gate ? "gate" : synthetic ? "synthetic" : "dev"}-latest`;
  writeReport(outDir, name, rep);
  for (const c of checks)
    if (!c.pass)
      process.stdout.write(`FAIL ${c.key} ${c.value.toFixed(4)} (${JSON.stringify(c.limit)})\n`);
  process.stdout.write(
    `sim:survey ${String(rep.mode)}: ${String(rep.verdict)} → ${outDir}/${name}.json\n`,
  );
  return gate ? (rep.verdict === "PASS" ? 0 : 1) : 0;
}
process.exitCode = main();
