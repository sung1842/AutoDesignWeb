// pnpm spec:extract (07장 7.12.1·7.12.2 5·6단계, T-02·T-03·U-10, AD-019)
//   (인자 없음)            FINAL 작업 트리에서 config/thresholds.json·test-policy.json 생성
//   --from <FINAL|ref>     추출 원천. FINAL = 작업 트리, 그 밖 = git ref(경로는 SPEC_SOURCE)
//   --out <dir>            출력 디렉터리(기본 config)
//   --check-review-pass    --from review-pass 출력과 FINAL 출력·review_pass_hashes 대조(다르면 종료 1)
//   --init-tuned           config/diagnosis-tuned.json이 없을 때만 tunable.*.initial로 생성
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** ref별 추출 원천 경로(코드 상수 1개, 09장 9.8.1·U-10). */
export const SPEC_SOURCE: Readonly<Record<string, string>> = Object.freeze({
  "review-pass": "docs/spec/v2/07_quality.md",
  default: "docs/spec/FINAL/07_quality.md",
});

export const BLOCKS = { thresholds: "thresholds.json", "test-policy": "test-policy.json" } as const;
export type BlockName = keyof typeof BLOCKS;

export function sourcePath(from: string): string {
  return SPEC_SOURCE[from] ?? (SPEC_SOURCE.default as string);
}

/** 원천 문서 텍스트. FINAL은 작업 트리, 그 밖은 git ref. */
export function readSource(from: string, cwd = process.cwd()): string {
  const p = sourcePath(from);
  if (from === "FINAL") return readFileSync(join(cwd, p), "utf8");
  return execFileSync("git", ["show", `${from}:${p}`], {
    cwd,
    encoding: "utf8",
    maxBuffer: 64 << 20,
  });
}

/** `<!-- spec:<name> -->` 바로 다음 ```json 펜스 본문(펜스 줄 제외, 마지막 줄바꿈 포함, AD-019). */
export function rawBlock(md: string, name: BlockName): string {
  const marker = `<!-- spec:${name} -->`;
  const i = md.indexOf(marker);
  if (i < 0) throw new Error(`블록 표지 없음: ${marker}`);
  const open = md.indexOf("```json\n", i);
  if (open < 0) throw new Error(`json 펜스 없음: ${marker}`);
  const start = open + "```json\n".length;
  const close = md.indexOf("\n```", start - 1);
  if (close < 0) throw new Error(`펜스 닫힘 없음: ${marker}`);
  return md.slice(start, close + 1);
}

export const blockHash = (raw: string): string =>
  createHash("sha256").update(raw, "utf8").digest("hex");

/** 키 순서 유지, 2칸 들여쓰기 + 끝 줄바꿈. */
export function serialize(raw: string): string {
  return JSON.stringify(JSON.parse(raw), null, 2) + "\n";
}

export function extractAll(from: string, cwd = process.cwd()): Record<BlockName, string> {
  const md = readSource(from, cwd);
  return {
    thresholds: serialize(rawBlock(md, "thresholds")),
    "test-policy": serialize(rawBlock(md, "test-policy")),
  };
}

/** 두 JSON 값의 다른 잎 경로(점 표기). */
export function diffPaths(a: unknown, b: unknown, path = ""): string[] {
  const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null;
  if (isObj(a) && isObj(b) && Array.isArray(a) === Array.isArray(b)) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    return [...keys].flatMap((k) => diffPaths(a[k], b[k], path ? `${path}.${k}` : k));
  }
  return JSON.stringify(a) === JSON.stringify(b) ? [] : [path || "(root)"];
}

function progressHashes(cwd: string): Record<string, string> | null {
  const p = join(cwd, "PROGRESS.md");
  if (!existsSync(p)) return null;
  const m =
    /review_pass_hashes:\s*\{thresholds:\s*([0-9a-f]{64}),\s*testPolicy:\s*([0-9a-f]{64})\}/.exec(
      readFileSync(p, "utf8"),
    );
  return m && m[1] && m[2] ? { thresholds: m[1], "test-policy": m[2] } : null;
}

/** review-pass 대조. 문제 목록(빈 배열 = 통과). */
export function checkReviewPass(cwd = process.cwd()): string[] {
  const errs: string[] = [];
  let rpMd: string;
  try {
    rpMd = readSource("review-pass", cwd);
  } catch {
    return ["review-pass 태그 또는 그 시점 원천 파일이 없음"];
  }
  const fin = extractAll("FINAL", cwd);
  const want = progressHashes(cwd);
  for (const name of Object.keys(BLOCKS) as BlockName[]) {
    const raw = rawBlock(rpMd, name);
    const rp = serialize(raw);
    if (rp !== fin[name]) {
      const paths = diffPaths(JSON.parse(rp), JSON.parse(fin[name]));
      errs.push(`review-pass ≠ FINAL (${name}): ${paths.join(", ")}`);
    }
    if (!want) errs.push("PROGRESS.md review_pass_hashes 없음");
    else if (want[name] !== blockHash(raw))
      errs.push(`review-pass ${name} 블록 SHA-256 ≠ review_pass_hashes`);
  }
  return [...new Set(errs)];
}

interface Tunable {
  [k: string]: { values: unknown[]; initial: unknown };
}

export function initTuned(cwd = process.cwd()): string {
  const out = join(cwd, "config/diagnosis-tuned.json");
  if (existsSync(out)) return "이미 있음(변경 없음)";
  const t = JSON.parse(extractAll("FINAL", cwd).thresholds) as { diagnosis: { tunable: Tunable } };
  const o: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(t.diagnosis.tunable)) {
    if (k === "llChanceRef") {
      const [c, r] = v.initial as [number, number];
      o.llChance = c;
      o.llRef = r;
    } else o[k] = v.initial;
  }
  writeFileSync(out, JSON.stringify(o, null, 2) + "\n");
  return "생성";
}

function arg(argv: string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

function main(argv: string[]): number {
  if (argv.includes("--check-review-pass")) {
    const errs = checkReviewPass();
    for (const e of errs) process.stderr.write(`spec:extract FAIL ${e}\n`);
    if (errs.length === 0)
      process.stdout.write("spec:extract: review-pass = FINAL (바이트 동일)\n");
    return errs.length === 0 ? 0 : 1;
  }
  if (argv.includes("--init-tuned")) {
    process.stdout.write(`spec:extract --init-tuned: ${initTuned()}\n`);
    return 0;
  }
  const from = arg(argv, "--from") ?? "FINAL";
  const outDir = arg(argv, "--out") ?? "config";
  const all = extractAll(from);
  mkdirSync(outDir, { recursive: true });
  for (const name of Object.keys(BLOCKS) as BlockName[])
    writeFileSync(join(outDir, BLOCKS[name]), all[name]);
  process.stdout.write(`spec:extract: ${from} → ${outDir}/{thresholds,test-policy}.json\n`);
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exitCode = main(process.argv.slice(2));
