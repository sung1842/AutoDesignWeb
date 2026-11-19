// M0 수용 테스트 공용 헬퍼(자체 잠금 대상). 임시 git 저장소에서 guard·qa:trace를 재현한다.
import { spawn, spawnSync } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  writeFileSync,
  mkdirSync,
  symlinkSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

export interface RunResult {
  code: number;
  out: string;
}

/** 명령을 실행하고 종료 코드와 stdout+stderr를 돌려준다. */
export function run(
  cmd: string,
  args: string[],
  cwd: string,
  env: Record<string, string> = {},
): Promise<RunResult> {
  return new Promise((done) => {
    const p = spawn(cmd, args, {
      cwd,
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    p.stdout.on("data", (d: Buffer) => (out += d.toString()));
    p.stderr.on("data", (d: Buffer) => (out += d.toString()));
    p.on("close", (code) => done({ code: code ?? -1, out }));
  });
}

export function git(cwd: string, ...args: string[]): string {
  const r = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
  return r.stdout.trim();
}

/** 현재 HEAD(태그 포함)를 임시 디렉터리로 클론하고 node_modules를 연결한다. */
export function tmpRepo(opts: { linkModules?: boolean } = {}): string {
  const dir = mkdtempSync(join(tmpdir(), "tf-acc-"));
  git(ROOT, "clone", "--quiet", "--local", "--no-hardlinks", ROOT, dir);
  for (const t of git(ROOT, "tag", "--list").split("\n").filter(Boolean)) {
    if (!git(dir, "tag", "--list", t))
      git(dir, "tag", "-a", t, git(ROOT, "rev-list", "-n1", t), "-m", "restore");
  }
  git(dir, "config", "user.email", "acc@test.local");
  git(dir, "config", "user.name", "acc");
  if (opts.linkModules !== false) {
    // 루트와 각 워크스페이스(apps/*, packages/*)의 node_modules를 연결한다(설치 없이 재현).
    const rels = ["."];
    for (const top of ["apps", "packages"]) {
      if (existsSync(join(ROOT, top)))
        for (const n of readdirSync(join(ROOT, top))) rels.push(join(top, n));
    }
    for (const rel of rels) {
      const src = join(ROOT, rel, "node_modules");
      if (existsSync(src) && existsSync(join(dir, rel)))
        symlinkSync(src, join(dir, rel, "node_modules"));
    }
  }
  return dir;
}

export function edit(dir: string, rel: string, f: (s: string) => string): void {
  const p = join(dir, rel);
  const s = existsSync(p) ? readFileSync(p, "utf8") : "";
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, f(s));
}

/** 변경을 커밋한다. 메시지는 Conventional Commits + Milestone 꼬리말. */
export function commit(dir: string, subject = "test(acc): fixture change"): void {
  git(dir, "add", "-A");
  git(dir, "commit", "--quiet", "-m", `${subject}\n\nMilestone: M0`);
}

export const guard = (dir: string, env: Record<string, string> = {}): Promise<RunResult> =>
  run("pnpm", ["-s", "guard"], dir, env);

export const qaTrace = (dir: string, args: string[] = []): Promise<RunResult> =>
  run("pnpm", ["-s", "qa:trace", ...args], dir);

/** guard 종료 코드 규약(test-policy exitCodes): 1 = fail. 0·2(needs_ci 보류)는 fail이 아니다. */
export const GUARD_FAIL = 1;
