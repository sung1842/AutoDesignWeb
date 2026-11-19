// guard:tuned — 진단 튜닝 자체 잠금(07장 7.12.2 8단계 a~e, 7.12.1 스키마, 02장 2.16.2, T-03·V-03). F20.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { git, readJson, type Finding } from "../lib.js";
import { LOCK_PATH } from "./lock.js";

export const TUNED = "config/diagnosis-tuned.json";
export const TUNING_LOG = "sim/reports/tuning-log.json";
const REPORTS = "sim/reports";
const SIM_TUNE = /^chore\(sim-tune\):/;

/** 7.12.1 스키마(zod strict). */
export const tunedSchema = z.strictObject({
  typeDiscWeight: z.number(),
  llChance: z.number(),
  llRef: z.number(),
  calibKappa: z.number(),
  candidateSamples: z.number().int(),
  priorWeight: z.number(),
  bridgeRelocated: z.boolean(),
});

interface Tunable {
  [k: string]: { values: unknown[] };
}
interface Trial {
  cached?: boolean;
  gateRun?: unknown;
}

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/** gateRun 값이 지표값을 담는가(PASS/FAIL만 허용, 7.12.1). */
function gateHasMetrics(g: unknown): boolean {
  if (g === null || g === undefined || typeof g === "boolean" || typeof g === "string")
    return false;
  if (typeof g === "number") return true;
  if (typeof g === "object")
    return Object.entries(g as Record<string, unknown>).some(
      ([k, v]) => typeof v === "number" || (typeof v === "object" && v !== null && k !== "seedSet"),
    );
  return false;
}
const isGateRun = (g: unknown): boolean => g !== null && g !== undefined && g !== false;

/** 객체 안에서 tuned 해시 필드(tunedSha256·tuned_sha256)를 찾는다. */
function findTunedHash(o: unknown): string | null {
  if (!o || typeof o !== "object") return null;
  for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
    if ((k === "tunedSha256" || k === "tuned_sha256") && typeof v === "string") return v;
    const r = findTunedHash(v);
    if (r) return r;
  }
  return null;
}

export function tunedStage(): Finding[] {
  const out: Finding[] = [];
  const f = (m: string): void =>
    void out.push({ stage: "guard:tuned", fid: "F20", status: "fail", message: m });
  if (!existsSync(TUNED)) return out;

  // a. 스키마
  let tuned: Record<string, unknown> = {};
  try {
    const r = tunedSchema.safeParse(readJson<unknown>(TUNED));
    if (!r.success)
      for (const i of r.error.issues)
        f(`${TUNED} 스키마: ${i.path.join(".") || "(root)"} ${i.message}`);
    else tuned = r.data;
  } catch (e) {
    f(`${TUNED} 읽기 실패: ${String(e)}`);
  }

  // b. 값 ∈ tunable.*.values (llChance·llRef는 쌍으로 llChanceRef.values)
  const th = readJson<{
    diagnosis: { tunable: Tunable };
    release: { surveySim: { maxTuningTrials: number; maxGateRuns: number } };
  }>("config/thresholds.json");
  if (Object.keys(tuned).length) {
    for (const [k, v] of Object.entries(th.diagnosis.tunable)) {
      const cur = k === "llChanceRef" ? [tuned.llChance, tuned.llRef] : tuned[k];
      if (!v.values.some((x) => same(x, cur)))
        f(`${TUNED} ${k}=${JSON.stringify(cur)} ∉ diagnosis.tunable.${k}.values`);
    }
  }

  // c. tuning-log 시도 수·gate 실행 수·gateRun 지표값
  if (existsSync(TUNING_LOG)) {
    const log = readJson<{ trials?: Trial[] }>(TUNING_LOG);
    const trials = log.trials ?? [];
    const dev = trials.filter((t) => t.cached !== true).length;
    const gates = trials.filter((t) => isGateRun(t.gateRun));
    const { maxTuningTrials, maxGateRuns } = th.release.surveySim;
    if (dev > maxTuningTrials)
      f(`${TUNING_LOG} dev 시도 ${dev} > release.surveySim.maxTuningTrials`);
    if (gates.length > maxGateRuns)
      f(`${TUNING_LOG} gate 실행 ${gates.length} > release.surveySim.maxGateRuns`);
    if (gates.some((t) => gateHasMetrics(t.gateRun)))
      f(`${TUNING_LOG} gateRun 항목에 지표값 필드가 있음(PASS/FAIL만 허용)`);
  }

  // d. 파일을 바꾼 커밋(생성 커밋 제외): 제목 chore(sim-tune):, 변경 파일 ⊆ {tuned, tuning-log}
  const commits = git("log", "--format=%H", "--", TUNED).split("\n").filter(Boolean);
  for (const c of commits) {
    const parentHas = git("ls-tree", "--name-only", `${c}^`, "--", TUNED).trim() !== "";
    if (!parentHas) continue;
    const subject = git("log", "-1", "--format=%s", c);
    const files = git("diff-tree", "--no-commit-id", "--name-only", "-r", c)
      .split("\n")
      .filter(Boolean);
    if (!SIM_TUNE.test(subject))
      f(`${TUNED} 변경 커밋 ${c.slice(0, 7)}의 제목이 chore(sim-tune):이 아님`);
    // locked-hashes.json은 tuned entry 해시 갱신에 필요(ASM-006). 다른 entry 변경은 guard:lock 규칙 3이 잡는다
    const extra = files.filter((p) => p !== TUNED && p !== TUNING_LOG && p !== LOCK_PATH);
    if (extra.length)
      f(`${TUNED} 변경 커밋 ${c.slice(0, 7)}에 다른 파일 변경: ${extra.join(", ")}`);
  }

  // e. 최신 sim 리포트의 tuned 해시 = 현재 파일 SHA-256
  if (existsSync(REPORTS)) {
    const reports = readdirSync(REPORTS)
      .filter((n) => n.endsWith(".json") && join(REPORTS, n) !== TUNING_LOG)
      .sort();
    const latest = reports[reports.length - 1];
    if (latest) {
      const want = createHash("sha256").update(readFileSync(TUNED)).digest("hex");
      const got = findTunedHash(readJson<unknown>(join(REPORTS, latest)));
      if (got !== want)
        f(`${REPORTS}/${latest}: 기록된 tuned 해시(${got ?? "없음"}) ≠ ${TUNED} SHA-256`);
    }
  }
  return out;
}
