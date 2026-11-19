// guard 공용(07장 7.12.2, 09장 9.5.5·9.5.6). 판정 결과 형식과 저장소 접근 도우미.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

export type Status = "fail" | "needs_ci" | "blocked";
export interface Finding {
  stage: string;
  fid: string;
  status: Status;
  message: string;
  blockedBy?: string;
}

export const git = (...a: string[]): string =>
  execFileSync("git", a, { encoding: "utf8", maxBuffer: 256 << 20 }).trim();

export function gitOk(...a: string[]): string | null {
  const r = spawnSync("git", a, { encoding: "utf8", maxBuffer: 256 << 20 });
  return r.status === 0 ? r.stdout.trim() : null;
}

export const tagCommit = (t: string): string | null =>
  gitOk("rev-parse", "-q", "--verify", `refs/tags/${t}^{commit}`);

/** baseRef = human-lock ?? spec-lock(T-02). */
export function baseRef(): { name: string; commit: string } | null {
  for (const name of ["human-lock", "spec-lock"]) {
    const c = tagCommit(name);
    if (c) return { name, commit: c };
  }
  return null;
}

/** 추적 중인 파일(작업 트리 기준, 삭제 제외). */
export function trackedFiles(): string[] {
  return git("ls-files", "-z", "--cached", "--others", "--exclude-standard")
    .split("\0")
    .filter((f) => f && existsSync(f));
}

export const readText = (p: string): string => readFileSync(p, "utf8");
export const readJson = <T>(p: string): T => JSON.parse(readText(p)) as T;

export const CODE_RE = /\.(ts|tsx|mts|cts|js|mjs|cjs|jsx)$/;
export const TEST_RE = /(\.test|\.spec)\.(ts|tsx|js|mjs)$|^e2e\//;
export const SKIP_DIRS = /(^|\/)(node_modules|dist|\.next|coverage|\.turbo)\//;

/** thresholds.json 숫자 잎 값 집합(배열 원소 포함). */
export function thresholdLeafNumbers(path = "config/thresholds.json"): Set<number> {
  const out = new Set<number>();
  if (!existsSync(path)) return out;
  const walk = (v: unknown): void => {
    if (typeof v === "number") out.add(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(readJson<unknown>(path));
  return out;
}

export function auditAllowLiterals(path = "config/test-policy.json"): Set<number> {
  if (!existsSync(path)) return new Set([0, 1, 0.5, 100]);
  const p = readJson<{ auditAllowLiterals?: number[] }>(path);
  return new Set(p.auditAllowLiterals ?? []);
}
