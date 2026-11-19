// pnpm dev:stack (06장 6.13.1 스택 프로파일, 09장 9.4.2): 로컬 전체 기동.
// STACK_PROFILE 미지정이면 `docker info` 성공 여부로 고른다. native: PG16 + shim → web(:3000)·worker 기동.
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { up } from "./native-pg.js";

function pickProfile(): "supabase" | "native" {
  const forced = process.env.STACK_PROFILE;
  if (forced === "supabase" || forced === "native") return forced;
  const r = spawnSync("docker", ["info"], { stdio: "ignore" });
  return r.status === 0 ? "supabase" : "native";
}

function main(): void {
  const profile = pickProfile();
  if (profile === "supabase") {
    process.stderr.write("dev:stack: supabase 프로파일은 CI 전용(needs_ci, 06장 6.13.1 규칙 4)\n");
    process.exit(1);
  }
  spawnSync("pnpm", ["-s", "env:init"], { stdio: "inherit" });
  up();
  const env = { ...process.env, STACK_PROFILE: "native" };
  const kids: ChildProcess[] = [];
  for (const app of ["web", "worker"]) {
    const p = spawn("pnpm", ["-s", "--filter", `./apps/${app}`, "run", "dev"], {
      env,
      stdio: "inherit",
    });
    p.on("exit", (code) => {
      process.stderr.write(`dev:stack: ${app} 종료(${code ?? "signal"})\n`);
      stop(code ?? 1);
    });
    kids.push(p);
  }
  let stopping = false;
  function stop(code: number): void {
    if (stopping) return;
    stopping = true;
    for (const k of kids) if (k.exitCode === null) k.kill("SIGTERM");
    setTimeout(() => process.exit(code), 500);
  }
  process.on("SIGTERM", () => stop(0));
  process.on("SIGINT", () => stop(0));
  process.stdout.write("dev:stack: native 기동(PG :54322, web :3000, worker health :8081)\n");
}

main();
