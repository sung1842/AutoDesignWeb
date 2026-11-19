// guard:lock — 잠금 해시(09장 9.5.6 판정 규칙 1~5, 07장 7.12.2 1·2·7단계). F01·F04.
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { baseRef, git, gitOk, trackedFiles, type Finding } from "../lib.js";

export const LOCK_PATH = "config/lock/locked-hashes.json";
const SPEC_OUT = new Set(["config/thresholds.json", "config/test-policy.json"]);
/** 자체 잠금 디렉터리(규칙 5: entry 없는 새 파일 금지). */
const LOCKED_DIRS = [/^tests\/acceptance\//, /^scripts\/verify\//, /^scripts\/guard\//];
const TUNED = "config/diagnosis-tuned.json";

interface Entry {
  sha256: string;
  lockedBy: string;
  commit?: string;
}
interface LockFile {
  version: number;
  baseRef: string;
  entries: Record<string, Entry>;
}

const sha = (b: Buffer | string): string => createHash("sha256").update(b).digest("hex");
const fidFor = (p: string): string => (SPEC_OUT.has(p) ? "F04" : "F01");

export function lockStage(env: Record<string, string | undefined> = process.env): Finding[] {
  const out: Finding[] = [];
  const f = (fid: string, message: string): void =>
    void out.push({ stage: "guard:lock", fid, status: "fail", message });
  const base = baseRef();
  if (!base) f("F01", "baseRef 없음: human-lock·spec-lock 태그가 모두 없다(T-02)");
  if (!existsSync(LOCK_PATH)) {
    f("F01", `${LOCK_PATH} 없음`);
    return out;
  }
  const raw = readFileSync(LOCK_PATH);
  const lock = JSON.parse(raw.toString("utf8")) as LockFile;

  // 규칙 1: HEAD entry 해시 일치
  for (const [p, e] of Object.entries(lock.entries)) {
    if (!["human", "spec", "agent"].includes(e.lockedBy))
      f("F01", `${p}: lockedBy 값 오류(${e.lockedBy})`);
    if (!existsSync(p)) f(fidFor(p), `${p}: 잠금 파일 삭제·이동`);
    else if (sha(readFileSync(p)) !== e.sha256) f(fidFor(p), `${p}: 잠금 해시 불일치(수정됨)`);
  }

  // 규칙 2·3: baseRef·직전 커밋 entries ⊆ HEAD, 공통 entry 해시 동일(tuned는 sim-tune 커밋만)
  const compareWith = (ref: string, label: string): void => {
    const prevRaw = gitOk("show", `${ref}:${LOCK_PATH}`);
    if (prevRaw === null) return;
    const prev = JSON.parse(prevRaw) as LockFile;
    for (const [p, e] of Object.entries(prev.entries)) {
      const cur = lock.entries[p];
      if (!cur) f(fidFor(p), `${p}: ${label} 잠금 entry 삭제`);
      else if (cur.sha256 !== e.sha256 || cur.lockedBy !== e.lockedBy) {
        const simTune = p === TUNED && /^chore\(sim-tune\):/.test(git("log", "-1", "--format=%s"));
        if (!simTune) f(fidFor(p), `${p}: ${label} 대비 잠금 entry 변경`);
      }
    }
  };
  if (base) compareWith(base.commit, base.name);
  if (gitOk("rev-parse", "-q", "--verify", "HEAD^")) compareWith("HEAD^", "직전 커밋");

  // 규칙 5: 잠금 디렉터리의 entry 없는 파일
  for (const p of trackedFiles()) {
    if (LOCKED_DIRS.some((r) => r.test(p)) && !lock.entries[p] && lockedDirActive(p, lock)) {
      f("F01", `${p}: 잠금 디렉터리에 entry 없는 새 파일(규칙 5)`);
    }
  }

  // 7.12.2 2·7단계: QA_LOCK_DIGEST
  const digest = env.QA_LOCK_DIGEST;
  if (!digest) {
    out.push({
      stage: "lock-digest",
      fid: "F01",
      status: "needs_ci",
      message: "QA_LOCK_DIGEST 없음(로컬) → CI에서 대조",
    });
  } else if (digest !== sha(raw)) {
    f("F01", `QA_LOCK_DIGEST 불일치: ${LOCK_PATH} 다이제스트가 저장소 변수와 다르다`);
  }
  return out;
}

/** 디렉터리가 이미 잠금 대상이 되었는지(그 디렉터리에 entry가 하나라도 있으면 활성). */
function lockedDirActive(p: string, lock: LockFile): boolean {
  const dir =
    p
      .split("/")
      .slice(0, p.startsWith("tests/acceptance/") ? 3 : 2)
      .join("/") + "/";
  return Object.keys(lock.entries).some((k) => k.startsWith(dir));
}
