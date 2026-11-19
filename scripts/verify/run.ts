// pnpm verify:mN / verify:fast 실행기(09장 9.4.1·9.5.1, U-09·S-03·S-23).
//   사용: tsx scripts/verify/run.ts m0 | fast
//   모든 단계는 LLM_MODE=mock, NO_EXTERNAL_NETWORK=1. 단계마다 reports/verify-<id>.partial.json 갱신(재시작 시 처음부터),
//   끝에 reports/verify-<id>.json과 reports/verify-<id>-<n>.json을 쓴다. fast는 보고서를 남기지 않는다.
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MILESTONES, fastPlan, verifyPlan, type Milestone } from "./plan.js";

type Status = "pass" | "fail" | "blocked" | "temp" | "manual" | "needs_live" | "needs_ci";
interface Step {
  name: string;
  status: Status;
  durationMs: number;
  details: string;
  blockedBy?: string[];
}

const ENV = { ...process.env, LLM_MODE: "mock", NO_EXTERNAL_NETWORK: "1", FORCE_COLOR: "0" };
const tail = (s: string, n = 40): string => s.split("\n").slice(-n).join("\n");

function sh(cmd: string, args: string[]): { code: number; out: string } {
  const r = spawnSync(cmd, args, { env: ENV, encoding: "utf8", maxBuffer: 256 << 20 });
  return { code: r.status ?? -1, out: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

interface Blk {
  id: string;
  open: boolean;
  lockedConflict: boolean;
  repro: string[];
}
/** BLOCKED.md 항목(open 여부·유형·재현 명령). */
export function readBlocked(path = "BLOCKED.md"): Blk[] {
  if (!existsSync(path)) return [];
  const out: Blk[] = [];
  let cur: Blk | null = null;
  for (const l of readFileSync(path, "utf8").split("\n")) {
    const h = /^## (BLK-\d+) · [^·]+ · ([\w-]+)/.exec(l);
    if (h && h[1]) {
      cur = { id: h[1], open: false, lockedConflict: h[2] === "locked-conflict", repro: [] };
      out.push(cur);
    } else if (cur && /^- 재현/.test(l)) cur.repro.push(l.replace(/^- 재현[^:]*:\s*/, ""));
    else if (cur && /^- 상태:\s*open/.test(l)) cur.open = true;
  }
  return out;
}

/** 실패한 테스트(파일, 이름)를 덮는 open locked-conflict BLK. 재현 명령의 테스트 파일과 -t 패턴으로 대조한다. */
function blkForTest(blks: Blk[], file: string, name: string): string | null {
  for (const b of blks) {
    if (!b.open || !b.lockedConflict) continue;
    for (const r of b.repro) {
      const t = /-t\s+"([^"]+)"/.exec(r);
      if (r.includes(file) && t && t[1] && name.includes(t[1])) return b.id;
    }
  }
  return null;
}

interface VitestJson {
  numTotalTests: number;
  testResults: Array<{
    name: string;
    assertionResults: Array<{ fullName: string; status: string }>;
  }>;
}

function vitestStep(name: string, args: string[], allowEmpty = false): Omit<Step, "durationMs"> {
  const dir = mkdtempSync(join(tmpdir(), "tf-verify-"));
  const outFile = join(dir, "r.json");
  const r = sh("pnpm", [
    "exec",
    "vitest",
    "run",
    ...args,
    "--reporter=json",
    `--outputFile=${outFile}`,
  ]);
  if (!existsSync(outFile)) {
    rmSync(dir, { recursive: true, force: true });
    if (allowEmpty && /No test files found/.test(r.out))
      return { name, status: "pass", details: "변경 영향 테스트 0건" };
    return { name, status: "fail", details: tail(r.out) };
  }
  const j = JSON.parse(readFileSync(outFile, "utf8")) as VitestJson;
  rmSync(dir, { recursive: true, force: true });
  if (j.numTotalTests === 0 && !allowEmpty)
    return { name, status: "fail", details: "테스트 0건 = 실패(9.4.2)" };
  const blks = readBlocked();
  const failed: Array<{ file: string; test: string; blk: string | null }> = [];
  for (const f of j.testResults) {
    const rel = f.name.replace(`${process.cwd()}/`, "");
    for (const a of f.assertionResults)
      if (a.status === "failed")
        failed.push({ file: rel, test: a.fullName, blk: blkForTest(blks, rel, a.fullName) });
  }
  if (r.code !== 0 && failed.length === 0) return { name, status: "fail", details: tail(r.out) };
  if (failed.length === 0) return { name, status: "pass", details: `${j.numTotalTests}건 통과` };
  const list = failed.map((x) => `${x.blk ? `[${x.blk}] ` : ""}${x.file} > ${x.test}`).join("\n");
  if (failed.every((x) => x.blk))
    return {
      name,
      status: "blocked",
      details: `${j.numTotalTests - failed.length}/${j.numTotalTests} 통과, blocked:\n${list}`,
      blockedBy: [...new Set(failed.map((x) => x.blk as string))],
    };
  return { name, status: "fail", details: `실패 ${failed.length}건:\n${list}` };
}

/** guard 종료 코드: 0 pass · 1 fail · 2 needs_ci만 · 3 BLOCKED(open BLK) 항목. */
function guardStep(): Omit<Step, "durationMs"> {
  const r = sh("pnpm", ["-s", "guard"]);
  const ids = [...new Set([...r.out.matchAll(/BLOCKED (BLK-\d+)/g)].map((m) => m[1] as string))];
  const open = new Set(
    readBlocked()
      .filter((b) => b.open && b.repro.length)
      .map((b) => b.id),
  );
  if (r.code === 0) return { name: "guard", status: "pass", details: tail(r.out, 12) };
  if (r.code === 2) return { name: "guard", status: "needs_ci", details: tail(r.out, 12) };
  if (r.code === 3 && ids.length && ids.every((i) => open.has(i)))
    return { name: "guard", status: "blocked", details: tail(r.out, 20), blockedBy: ids };
  return { name: "guard", status: "fail", details: tail(r.out) };
}

function cmdStep(name: string, cmd: string, args: string[]): Omit<Step, "durationMs"> {
  const r = sh(cmd, args);
  return {
    name,
    status: r.code === 0 ? "pass" : "fail",
    details: tail(r.out, r.code === 0 ? 3 : 40),
  };
}

function runStep(step: string, m: Milestone | "fast"): Omit<Step, "durationMs"> {
  if (step === "guard") return guardStep();
  if (step === "lint") return cmdStep(step, "pnpm", ["-s", "lint"]);
  if (step === "typecheck") return cmdStep(step, "pnpm", ["-s", "typecheck"]);
  if (step === "unit")
    return vitestStep(step, [
      "--exclude",
      "tests/acceptance/**",
      "--exclude",
      "**/node_modules/**",
    ]);
  if (step === "unit:changed")
    return vitestStep(
      step,
      ["--changed", "HEAD^", "--exclude", "tests/acceptance/**", "--exclude", "**/node_modules/**"],
      true,
    );
  if (step === "trace")
    return cmdStep(step, "pnpm", ["-s", "qa:trace", "--upto", (m as string).toUpperCase()]);
  const acc = /^acceptance:(m\d)$/.exec(step);
  if (acc && acc[1]) {
    const dir = `tests/acceptance/${acc[1]}`;
    if (!existsSync(dir))
      return { name: step, status: "fail", details: `${dir} 없음 — 테스트 0건 = 실패(9.4.2)` };
    return vitestStep(step, [dir]);
  }
  const e2e = /^e2e:(m\d)$/.exec(step);
  if (e2e && e2e[1]) {
    const dir = `e2e/${e2e[1]}`;
    if (!existsSync(dir) || readdirSync(dir).length === 0)
      return {
        name: step,
        status: "pass",
        details: `${dir} 없음(이 마일스톤 E2E 없음, AC 매핑은 trace 단계가 검사)`,
      };
    return cmdStep(step, "pnpm", ["exec", "playwright", "test", dir, "--retries=0"]);
  }
  return { name: step, status: "fail", details: `알 수 없는 단계 ${step}` };
}

function deferrableOk(step: Step): boolean {
  if (!["temp", "manual", "needs_live", "needs_ci"].includes(step.status)) return true;
  const pol = JSON.parse(readFileSync("config/test-policy.json", "utf8")) as {
    deferrable: Record<string, string[]>;
  };
  const allowed = pol.deferrable[step.status] ?? [];
  // guard의 needs_ci는 lock-digest 하나뿐(7.12.2 7단계)
  const id = step.name === "guard" ? "lock-digest" : step.name;
  return allowed.some((p) => (p.endsWith("*") ? id.startsWith(p.slice(0, -1)) : p === id));
}

function main(argv: string[]): number {
  const id = argv[0] ?? "";
  const isFast = id === "fast";
  if (!isFast && !(MILESTONES as readonly string[]).includes(id)) {
    process.stderr.write("사용: tsx scripts/verify/run.ts <m0..m8|fast>\n");
    return 1;
  }
  const plan = isFast ? fastPlan : verifyPlan[id as Milestone];
  const gitSha = sh("git", ["rev-parse", "HEAD"]).out.trim();
  const startedAt = new Date().toISOString();
  const steps: Step[] = [];
  const report = (final: boolean): Record<string, unknown> => {
    const bad = steps.some((s) => s.status === "fail" || !deferrableOk(s));
    const blocked = steps.some((s) => s.status === "blocked");
    return {
      milestone: id.toUpperCase(),
      gitSha,
      startedAt,
      ...(final ? { finishedAt: new Date().toISOString() } : {}),
      steps,
      result: bad ? "fail" : blocked ? "pass_blocked" : "pass",
    };
  };
  if (!isFast) mkdirSync("reports", { recursive: true });
  const partial = `reports/verify-${id}.partial.json`;
  for (const s of plan) {
    const t0 = Date.now();
    const r = runStep(s, isFast ? "fast" : (id as Milestone));
    const step: Step = { ...r, durationMs: Date.now() - t0 };
    steps.push(step);
    process.stdout.write(
      `${step.status.padEnd(8)} ${s} (${Math.round(step.durationMs / 1000)}s)${step.blockedBy ? ` ${step.blockedBy.join(",")}` : ""}\n`,
    );
    if (step.status === "fail") process.stdout.write(`${tail(step.details, 20)}\n`);
    if (!isFast) writeFileSync(partial, JSON.stringify(report(false), null, 2) + "\n");
  }
  const final = report(true);
  if (!isFast) {
    writeFileSync(`reports/verify-${id}.json`, JSON.stringify(final, null, 2) + "\n");
    const n =
      readdirSync("reports").filter((f) => new RegExp(`^verify-${id}-\\d+\\.json$`).test(f))
        .length + 1;
    writeFileSync(`reports/verify-${id}-${n}.json`, JSON.stringify(final, null, 2) + "\n");
    rmSync(partial, { force: true });
  }
  const limitMin = isFast ? 3 : MILESTONES.indexOf(id as Milestone) <= 3 ? 10 : 20;
  const took = (Date.now() - Date.parse(startedAt)) / 60000;
  if (took > limitMin)
    process.stdout.write(
      `WARN 실행 시간 ${took.toFixed(1)}분 > 상한 ${limitMin}분(경고만, 9.4.1)\n`,
    );
  process.stdout.write(`verify:${id}: ${String(final.result)}\n`);
  return final.result === "fail" ? 1 : 0;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exitCode = main(process.argv.slice(2));
