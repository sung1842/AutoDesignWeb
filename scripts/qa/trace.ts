// pnpm qa:trace (07장 7.1.7 추적성·T-09 배정 위치 강제, AC-07-07·23)
//   (인자 없음)          FINAL 장의 모든 AC·TC가 qa/traceability.yaml에 매핑되고 매핑 테스트가 존재하는지 검사
//   --json               결과를 JSON으로 출력({results, tc, unassigned, duplicated, warnings})
//   --upto M<k>          종료 코드 판정을 M0..M<k> 배정 AC로 한정(진행 중 마일스톤용. 출력은 전체)
//   --spec-dir <dir>     추출 원천 디렉터리(기본 docs/spec/FINAL)
//   --audit              AC 배정(중복 0) + 리터럴 감사(audit.ts). 매핑 완전성은 보지 않는다(7.11.2 qa-trace 단계)
//   --docs·--key-coverage는 이후 단위에서 추가한다.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { audit } from "./audit.js";

export const AC_RE = /AC-\d{2}-\d{2,3}[a-z]?/g;
export const TC_RE = /TC-[A-Z]+-\d{2}/g;
export const TRACE_PATH = "qa/traceability.yaml";
export const MANUAL_PATH = "release/manual-checklist.md";

export interface AcResult {
  milestone: string;
  status: "pass" | "fail";
  reason?: string;
}
export interface TraceReport {
  results: Record<string, AcResult>;
  tc: Record<string, { status: "pass" | "fail"; reason?: string }>;
  unassigned: string[];
  duplicated: string[];
  warnings: string[];
}

/** 장 파일에서 AC·TC ID를 모은다. [P2] 표시가 있는 줄의 TC는 제외한다. */
export function extractIds(specDir: string): { ac: Set<string>; tc: Set<string> } {
  const ac = new Set<string>();
  const tc = new Set<string>();
  for (const f of readdirSync(specDir)
    .filter((n) => /^\d\d_.*\.md$/.test(n))
    .sort()) {
    for (const line of readFileSync(join(specDir, f), "utf8").split("\n")) {
      for (const m of line.matchAll(AC_RE)) ac.add(m[0]);
      if (!line.includes("[P2]")) for (const m of line.matchAll(TC_RE)) tc.add(m[0]);
    }
  }
  return { ac, tc };
}

const ID_PARTS = /^AC-(\d{2})-(\d{2,3})([a-z]?)$/;

/** 배정표 항목이 ID를 포함하는가. 범위 `AC-xx-a~b`는 접미사 ID 포함, 단일 항목은 정확히 그 ID만. */
export function entryCovers(entry: string, id: string): boolean {
  const range = /^AC-(\d{2})-(\d{2,3})~(\d{2,3})$/.exec(entry);
  if (!range) return entry === id;
  const m = ID_PARTS.exec(id);
  if (!m) return false;
  const n = Number(m[2]);
  return m[1] === range[1] && n >= Number(range[2]) && n <= Number(range[3]);
}

export function assign(
  ids: Iterable<string>,
  acMilestones: Record<string, string[]>,
): { milestoneOf: Map<string, string>; duplicated: string[]; warnings: string[] } {
  const milestoneOf = new Map<string, string>();
  const duplicated: string[] = [];
  const warnings: string[] = [];
  for (const id of ids) {
    const hits = Object.entries(acMilestones)
      .filter(([, es]) => es.some((e) => entryCovers(e, id)))
      .map(([m]) => m);
    if (hits.length > 1) duplicated.push(id);
    if (hits.length === 0) {
      warnings.push(`${id}: 배정표에 없음 → M8로 간주(다음 spec-lock 전에 표에 넣어야 함)`);
      milestoneOf.set(id, "M8");
    } else milestoneOf.set(id, hits[0] as string);
  }
  return { milestoneOf, duplicated, warnings };
}

/**
 * qa/traceability.yaml 읽기. 형식은 7.1.7 예시대로 한 줄에 `ID: [항목, 항목]`.
 * 항목은 `경로#"테스트 이름"`. 이 형식만 쓰므로 YAML 라이브러리 없이 줄 단위로 읽는다.
 */
export function readTrace(root: string): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const p = join(root, TRACE_PATH);
  if (!existsSync(p)) return out;
  for (const raw of readFileSync(p, "utf8").split("\n")) {
    const line = raw.replace(/\s+#(?!").*$/, "").trim();
    const m = /^((?:AC|TC)-[\w-]+):\s*\[(.*)\]\s*$/.exec(line);
    if (!m || !m[1]) continue;
    const items = [...(m[2] ?? "").matchAll(/([^,\s#][^,#]*)#"([^"]*)"/g)].map(
      (x) => `${(x[1] ?? "").trim()}#"${x[2] ?? ""}"`,
    );
    out.set(m[1], [...(out.get(m[1]) ?? []), ...items]);
  }
  return out;
}

/** 매핑 항목이 실제 테스트를 가리키는가(파일 존재 + 테스트 이름 문자열 존재 + 이름에 ID 포함). */
export function itemExists(root: string, item: string, id: string): string | null {
  const m = /^(.*)#"(.*)"$/.exec(item);
  if (!m || !m[1] || m[2] === undefined) return `형식 오류: ${item}`;
  const [, file, name] = m;
  const p = join(root, file);
  if (!existsSync(p)) return `파일 없음: ${file}`;
  const text = readFileSync(p, "utf8");
  if (file === MANUAL_PATH) {
    return text.split("\n").some((l) => l.startsWith(`| ${id} `))
      ? null
      : `${MANUAL_PATH}에 ${id} 행 없음`;
  }
  if (!name.includes(id)) return `테스트 이름에 ID 없음: ${item}`;
  const quoted = [`"${name}"`, `'${name}'`, `\`${name}\``];
  return quoted.some((q) => text.includes(q)) ? null : `테스트 없음: ${item}`;
}

export function trace(root: string, specDir = join(root, "docs/spec/FINAL")): TraceReport {
  const policy = JSON.parse(readFileSync(join(root, "config/test-policy.json"), "utf8")) as {
    acMilestones: Record<string, string[]>;
  };
  const { ac, tc } = extractIds(specDir);
  const { milestoneOf, duplicated, warnings } = assign([...ac].sort(), policy.acMilestones);
  const map = readTrace(root);
  const results: Record<string, AcResult> = {};
  for (const id of [...ac].sort()) {
    const milestone = milestoneOf.get(id) as string;
    const items = map.get(id) ?? [];
    const dir = `tests/acceptance/${milestone.toLowerCase()}/`;
    let reason: string | undefined;
    if (items.length === 0) reason = "qa/traceability.yaml 매핑 없음";
    else {
      const ok = items.filter((it) => it.startsWith(dir) || it.startsWith(`${MANUAL_PATH}#`));
      if (ok.length === 0) reason = `배정 위치(${dir}) 밖에만 매핑됨`;
      else {
        const errs = ok.map((it) => itemExists(root, it, id)).filter((e): e is string => !!e);
        if (errs.length === ok.length) reason = errs.join("; ");
      }
    }
    results[id] = reason ? { milestone, status: "fail", reason } : { milestone, status: "pass" };
  }
  const tcOut: TraceReport["tc"] = {};
  for (const id of [...tc].sort()) {
    const items = map.get(id) ?? [];
    const errs = items.map((it) => itemExists(root, it, id)).filter((e): e is string => !!e);
    tcOut[id] =
      items.length === 0
        ? { status: "fail", reason: "qa/traceability.yaml 매핑 없음" }
        : errs.length === items.length
          ? { status: "fail", reason: errs.join("; ") }
          : { status: "pass" };
  }
  return { results, tc: tcOut, unassigned: [], duplicated, warnings };
}

function arg(argv: string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

function main(argv: string[]): number {
  const root = process.cwd();
  const specDir = arg(argv, "--spec-dir") ?? join(root, "docs/spec/FINAL");
  const r = trace(root, specDir);
  if (argv.includes("--audit")) return auditMain(root, specDir, r);
  const upto = arg(argv, "--upto");
  const k = upto ? Number(upto.replace(/^M/, "")) : 8;
  const gated = Object.entries(r.results).filter(([, v]) => Number(v.milestone.slice(1)) <= k);
  const fails = gated.filter(([, v]) => v.status === "fail");
  const tcFails = upto ? [] : Object.entries(r.tc).filter(([, v]) => v.status === "fail");
  if (argv.includes("--json")) process.stdout.write(JSON.stringify(r, null, 2) + "\n");
  else {
    for (const w of r.warnings) process.stdout.write(`WARN ${w}\n`);
    for (const id of r.duplicated) process.stdout.write(`FAIL ${id}: 중복 배정\n`);
    for (const [id, v] of fails) process.stdout.write(`FAIL ${id} (${v.milestone}): ${v.reason}\n`);
    for (const [id, v] of tcFails) process.stdout.write(`FAIL ${id}: ${v.reason}\n`);
    process.stdout.write(
      `qa:trace: AC ${gated.length - fails.length}/${gated.length} pass${upto ? ` (≤${upto})` : ""}, ${upto ? "TC 판정 제외" : `TC ${Object.keys(r.tc).length - tcFails.length}/${Object.keys(r.tc).length}`}\n`,
    );
  }
  return fails.length || tcFails.length || r.duplicated.length || r.unassigned.length ? 1 : 0;
}

function auditMain(root: string, specDir: string, r: TraceReport): number {
  const hits = audit(root, specDir);
  for (const id of r.duplicated) process.stdout.write(`FAIL ${id}: 중복 배정\n`);
  for (const w of r.warnings) process.stdout.write(`WARN ${w}\n`);
  for (const h of hits) {
    const via = h.decl === h.use ? "" : ` (리터럴 위치 ${h.decl})`;
    process.stdout.write(`FAIL audit ${h.use}: thresholds 잎 값 리터럴 ${h.value}${via}\n`);
  }
  process.stdout.write(
    `qa:trace --audit: 중복 배정 ${r.duplicated.length}, 리터럴 ${hits.length}\n`,
  );
  return hits.length || r.duplicated.length ? 1 : 0;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exitCode = main(process.argv.slice(2));
