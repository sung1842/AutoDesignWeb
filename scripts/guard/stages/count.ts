// guard:count — 테스트 삭제·축소 감시(09장 9.5.5 F03). 기준선 .guard/test-count.json.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { gitOk, readJson, type Finding } from "../lib.js";

export const COUNT_PATH = ".guard/test-count.json";
interface CountFile {
  vitest: number;
  playwright: number;
}

export function currentCounts(): CountFile {
  const r = spawnSync("pnpm", ["-s", "exec", "vitest", "list", "--json"], {
    encoding: "utf8",
    maxBuffer: 64 << 20,
  });
  const start = r.stdout.indexOf("[");
  const list = start >= 0 ? (JSON.parse(r.stdout.slice(start)) as unknown[]) : [];
  // Playwright 시나리오(e2e/)는 M2 이후 추가된다. 그 전에는 0.
  return { vitest: list.length, playwright: 0 };
}

export function countStage(): Finding[] {
  const out: Finding[] = [];
  const f = (m: string): void =>
    void out.push({ stage: "guard:count", fid: "F03", status: "fail", message: m });
  if (!existsSync(COUNT_PATH)) return out;
  const base = readJson<CountFile>(COUNT_PATH);
  const prevRaw = gitOk("show", `HEAD^:${COUNT_PATH}`);
  if (prevRaw) {
    const prev = JSON.parse(prevRaw) as CountFile;
    if (base.vitest < prev.vitest || base.playwright < prev.playwright)
      f(`${COUNT_PATH} 기준선 하향`);
  }
  const cur = currentCounts();
  if (cur.vitest < base.vitest) f(`vitest 케이스 수 감소: ${cur.vitest} < 기준선 ${base.vitest}`);
  if (cur.playwright < base.playwright)
    f(`playwright 케이스 수 감소: ${cur.playwright} < 기준선 ${base.playwright}`);
  return out;
}

/** pnpm guard:count --update: 현재 수로 기준선을 올린다(내릴 수 없음). */
export function updateCounts(): number {
  const cur = currentCounts();
  const prev = existsSync(COUNT_PATH)
    ? readJson<CountFile>(COUNT_PATH)
    : { vitest: 0, playwright: 0 };
  const next = {
    vitest: Math.max(cur.vitest, prev.vitest),
    playwright: Math.max(cur.playwright, prev.playwright),
  };
  mkdirSync(".guard", { recursive: true });
  writeFileSync(COUNT_PATH, JSON.stringify(next, null, 2) + "\n");
  process.stdout.write(`guard:count: vitest ${next.vitest}, playwright ${next.playwright}\n`);
  return cur.vitest < prev.vitest ? 1 : 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.argv.includes("--update")) process.exitCode = updateCounts();
  else {
    const fs = countStage();
    for (const x of fs) process.stderr.write(`[${x.fid}] ${x.message}\n`);
    process.exitCode = fs.length ? 1 : 0;
  }
}
