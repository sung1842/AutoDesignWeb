// pnpm guard (07장 7.12.2 1~8단계, 09장 9.5.5). 결과를 출력하고 종료 코드를 test-policy exitCodes로 낸다.
//   0 pass · 1 fail · 2 needs_ci 보류만 · 3 BLOCKED 기록 항목 있음(fail 없음)
import { countStage } from "./stages/count.js";
import { dataStage } from "./stages/data.js";
import { depsStage } from "./stages/deps.js";
import { lockStage } from "./stages/lock.js";
import { patternStage } from "./stages/patterns.js";
import { specStage } from "./stages/spec.js";
import { verifyScriptsStage } from "./stages/verify-scripts.js";
import type { Finding } from "./lib.js";

export const STAGES: ReadonlyArray<[string, () => Finding[]]> = [
  ["guard:lock", () => lockStage()],
  ["guard:spec", () => specStage()],
  ["guard:patterns", () => patternStage()],
  ["guard:verify-scripts", () => verifyScriptsStage()],
  ["guard:data", () => dataStage()],
  ["guard:deps", () => depsStage()],
  ["guard:count", () => countStage()],
];

export function exitCodeOf(fs: readonly Finding[]): number {
  if (fs.some((f) => f.status === "fail")) return 1;
  if (fs.some((f) => f.status === "blocked")) return 3;
  if (fs.some((f) => f.status === "needs_ci")) return 2;
  return 0;
}

function main(): number {
  const all: Finding[] = [];
  for (const [name, run] of STAGES) {
    let fs: Finding[];
    try {
      fs = run();
    } catch (e) {
      fs = [{ stage: name, fid: "F00", status: "fail", message: `단계 실행 오류: ${String(e)}` }];
    }
    all.push(...fs);
    const fails = fs.filter((f) => f.status === "fail").length;
    process.stdout.write(`${fails ? "FAIL" : "ok  "} ${name}${fails ? ` (${fails})` : ""}\n`);
  }
  for (const f of all) {
    const tag =
      f.status === "fail"
        ? "FAIL"
        : f.status === "blocked"
          ? `BLOCKED ${f.blockedBy ?? ""}`
          : "NEEDS_CI";
    process.stdout.write(`  [${f.fid}] ${tag} ${f.stage}: ${f.message}\n`);
  }
  const code = exitCodeOf(all);
  process.stdout.write(`guard: exit ${code}\n`);
  return code;
}

process.exitCode = main();
