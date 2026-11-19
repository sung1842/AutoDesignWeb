// qa:trace 키 커버리지(07장 7.12.2 "qa:trace --audit 정의" 키 커버리지 행, 7.12.1 사양 상수 표, AC-07-22)
//   09장 9.4.x 통과 조건 표와 각 장 AC 문장에서 비교 기준으로 쓰인 수치(`N 이하/이상/미만/초과/안에/이내`,
//   `≤ N`·`≥ N`·`< N`·`> N`)가 thresholds 잎 값이거나 사양 상수 표 행의 값(또는 auditAllowLiterals)인지 본다.
//   단위 환산: `%`는 N/100, 초↔ms, 분→초도 후보로 본다. 둘 다 아니면 문서 위치(파일:줄)와 수치를 낸다.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { auditAllowLiterals, thresholdLeafNumbers } from "../guard/lib.js";
import { specConstantRows } from "./audit.js";

export interface CoverageHit {
  file: string;
  line: number;
  text: string;
  value: number;
  blockedBy?: string;
}

/**
 * BLK-003(locked-conflict): spec 잠금 문서에 이미 있는, 표·블록 밖 비교 수치. 사람 결정 전까지 blocked로 보고.
 * 항목: [파일, 일치 텍스트].
 */
export const BLK_003: ReadonlyArray<readonly [string, string]> = [
  ["06_architecture.md", "≤ 0.00001"],
  ["06_architecture.md", "< 96"],
  ["07_quality.md", "< 96"],
  ["09_implementation.md", "≥19"],
];

const PAT =
  /(?<![\w.-])(\d+(?:\.\d+)?)\s*(%|ms|s|초|분|일|개|건|회|점|px|KB|MB|원)?\s*(?:이하|이상|미만|초과|안에|이내)|(?:≤|≥|<=|>=|<|>)\s*\$?(\d+(?:\.\d+)?)\s*(%|ms|s|초)?/g;

const AC_LINE = /^\|\s*AC-\d\d-\d|^- \*\*AC-\d\d/;
/** 09장 9.4.2~9.4.10(M0~M8) 절 범위: `### 9.4.2`부터 `## 9.5` 전까지. */
function in94(lines: string[]): (i: number) => boolean {
  const s = lines.findIndex((l) => l.startsWith("### 9.4.2"));
  const e = lines.findIndex((l) => l.startsWith("## 9.5"));
  return (i) => s >= 0 && i >= s && (e < 0 || i < e);
}

export function keyCoverage(root: string, specDir: string): CoverageHit[] {
  const leaves = thresholdLeafNumbers(join(root, "config/thresholds.json"));
  const allow = auditAllowLiterals(join(root, "config/test-policy.json"));
  const sc = new Set<number>();
  for (const s of specConstantRows(specDir).values()) for (const n of s) sc.add(n);
  const known = (n: number, unit: string | undefined): boolean => {
    const c = [n];
    if (unit === "%") c.push(n / 100);
    if (unit === "s" || unit === "초") c.push(n * 1000);
    if (unit === "ms") c.push(n / 1000);
    if (unit === "분") c.push(n * 60);
    return c.some((x) => leaves.has(x) || sc.has(x) || allow.has(x));
  };
  const out: CoverageHit[] = [];
  if (!existsSync(specDir)) return out;
  for (const f of readdirSync(specDir)
    .filter((n) => /^\d\d_.*\.md$/.test(n))
    .sort()) {
    const lines = readFileSync(join(specDir, f), "utf8").split("\n");
    const is94 = f.startsWith("09_") ? in94(lines) : () => false;
    lines.forEach((l, i) => {
      if (!(AC_LINE.test(l) || (is94(i) && l.startsWith("|")))) return;
      for (const m of l.matchAll(PAT)) {
        const n = Number(m[1] ?? m[3]);
        if (known(n, m[2] ?? m[4])) continue;
        const text = m[0].trim();
        const blk = BLK_003.some(([bf, bt]) => bf === f && bt === text);
        out.push({
          file: f,
          line: i + 1,
          text,
          value: n,
          ...(blk ? { blockedBy: "BLK-003" } : {}),
        });
      }
    });
  }
  return out;
}
