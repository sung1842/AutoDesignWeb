// guard:self-lock (09장 9.5.6 자체 잠금, 판정 규칙 4). HEAD 커밋에서 새로 추가된 파일만 등록한다.
// 사용: pnpm guard:self-lock <경로...>  (경로가 디렉터리면 그 아래 HEAD 추가 파일 전부)
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export const LOCK_PATH = "config/lock/locked-hashes.json";

interface Entry {
  sha256: string;
  lockedBy: "human" | "spec" | "agent";
  lockedAt: string;
  commit?: string;
}
interface LockFile {
  version: number;
  baseRef: "human-lock" | "spec-lock";
  entries: Record<string, Entry>;
}

const git = (...a: string[]): string => execFileSync("git", a, { encoding: "utf8" }).trim();
const sha256 = (p: string): string => createHash("sha256").update(readFileSync(p)).digest("hex");

function main(argv: string[]): number {
  if (argv.length === 0) {
    process.stderr.write("guard:self-lock: 경로를 지정하세요\n");
    return 1;
  }
  const added = git("diff-tree", "--no-commit-id", "--name-status", "-r", "--root", "HEAD")
    .split("\n")
    .filter((l) => l.startsWith("A\t"))
    .map((l) => l.slice(2));
  const lock: LockFile = existsSync(LOCK_PATH)
    ? (JSON.parse(readFileSync(LOCK_PATH, "utf8")) as LockFile)
    : {
        version: 1,
        baseRef: git("tag", "--list", "human-lock") ? "human-lock" : "spec-lock",
        entries: {},
      };
  const commit = git("rev-parse", "--short", "HEAD");
  const lockedAt = new Date().toISOString().replace(/\.\d+Z$/, "Z");
  const errors: string[] = [];
  const targets: string[] = [];
  for (const raw of argv) {
    const p = raw.replace(/\/$/, "");
    const hit = added.filter((f) => f === p || f.startsWith(`${p}/`));
    if (hit.length === 0) errors.push(`${p}: HEAD 커밋에서 새로 추가된 파일이 아님(규칙 4)`);
    targets.push(...hit);
  }
  for (const f of targets) {
    if (lock.entries[f]) errors.push(`${f}: 이미 잠금 entry가 있음`);
  }
  if (errors.length > 0) {
    for (const e of errors) process.stderr.write(`guard:self-lock FAIL ${e}\n`);
    return 1;
  }
  for (const f of targets)
    lock.entries[f] = { sha256: sha256(f), lockedBy: "agent", lockedAt, commit };
  mkdirSync(dirname(LOCK_PATH), { recursive: true });
  writeFileSync(LOCK_PATH, JSON.stringify(lock, null, 2) + "\n");
  process.stdout.write(`guard:self-lock: ${targets.length}개 등록 (${commit})\n`);
  return 0;
}

process.exitCode = main(process.argv.slice(2));
