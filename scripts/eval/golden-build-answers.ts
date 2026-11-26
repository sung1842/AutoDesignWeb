// pnpm eval:golden:build-answers [--out <dir>] — 07장 7.2.2 골든 32행 answers·expected.muRef 생성(S-07, T-04, ASM-097).
// 기본은 data/golden 제자리 갱신. 자극물 = manifest.lock active x_card. 실패 = 종료 1(BLOCKED 대상).
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  buildGoldenAnswers,
  goldenContext,
  type GoldenCase,
} from "../../packages/diagnosis/src/index.js";

const ROOT = resolve(import.meta.dirname, "../..");
function main(): number {
  const a = process.argv.slice(2);
  const i = a.indexOf("--out");
  const out = i >= 0 && a[i + 1] ? resolve(a[i + 1] as string) : join(ROOT, "data/golden");
  const dir = join(ROOT, "data/golden");
  const files = readdirSync(dir)
    .filter((f) => /^GS-\d\d\.json$/.test(f))
    .sort();
  const ctx = goldenContext(ROOT);
  mkdirSync(out, { recursive: true });
  let fail = 0;
  for (const f of files) {
    const c = JSON.parse(readFileSync(join(dir, f), "utf8")) as GoldenCase;
    try {
      const b = buildGoldenAnswers(c, ctx);
      writeFileSync(join(out, f), `${JSON.stringify(b, null, 2)}\n`);
    } catch (e) {
      fail++;
      process.stderr.write(`${f}: ${(e as Error).message}\n`);
    }
  }
  process.stdout.write(
    `eval:golden:build-answers: ${files.length - fail}/${files.length} → ${out}\n`,
  );
  return fail === 0 ? 0 : 1;
}
process.exitCode = main();
