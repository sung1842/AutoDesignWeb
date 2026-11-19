// M0 수용 테스트: env 검증·로컬 스택·health(06장 6.13.2, AC-06-32·AC-06-50, 09장 9.4.2 ③④⑤).
import { describe, expect, it, afterAll } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, run } from "../_support/sh.js";

/** .env.example를 키→값 맵으로 읽는다(주석·빈 값 제외). */
function envExample(): Record<string, string> {
  const o: Record<string, string> = {};
  for (const l of readFileSync(join(ROOT, ".env.example"), "utf8").split("\n")) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
    if (m && m[1] && m[2]) o[m[1]] = m[2];
  }
  return o;
}
/** worker health 서버 주소(ASSUMPTIONS ASM-001: 고정 포트, env 아님). */
const WORKER_HEALTH_ORIGIN = "http://127.0.0.1:8081";
const BASE = (): Record<string, string> => ({
  ...envExample(),
  APP_ENV: "local",
  STACK_PROFILE: "native",
  LLM_MODE: "mock",
});
const without = (e: Record<string, string>, k: string): Record<string, string> => {
  const c = { ...e };
  delete c[k];
  return c;
};
// 부모 프로세스 env가 새지 않도록 값을 비운 채 넘긴다(빈 문자열 = 미설정으로 본다, 06장 6.13.2).
const blank = (k: string): Record<string, string> => ({ [k]: "" });

/** 앱 기동 진입점의 env 검사만 실행한다(`--check-env`: 검증 후 즉시 종료). */
const boot = (app: "web" | "worker", env: Record<string, string>) =>
  run("pnpm", ["-s", "--filter", `./apps/${app}`, "run", "start:check-env"], ROOT, env);

describe("M0 env 검증", () => {
  for (const [app, key] of [
    ["web", "PREVIEW_SIGNING_SECRET"],
    ["worker", "DATABASE_URL_DIRECT"],
    ["web", "WEB_ORIGIN"],
    ["worker", "APP_ENV"],
  ] as const) {
    it(`AC-06-32: ${app}에서 필수 env ${key} 제거 → 종료 코드 1 + 변수명 출력`, async () => {
      const r = await boot(app, { ...without(BASE(), key), ...blank(key) });
      expect(r.code).toBe(1);
      expect(r.out).toContain(key);
    });
  }

  it("AC-06-32: 기본 env(.env.example + local)로는 web·worker env 검사 통과", async () => {
    for (const app of ["web", "worker"] as const) {
      const r = await boot(app, BASE());
      expect(r.code, r.out).toBe(0);
    }
  });

  it("AC-06-32: APP_ENV=prod에서 LLM_MODE=mock이면 기동 거부", async () => {
    const r = await boot("worker", { ...BASE(), APP_ENV: "prod", LLM_MODE: "mock" });
    expect(r.code).toBe(1);
    expect(r.out).toContain("LLM_MODE");
  });

  it("AC-06-32: APP_ENV=prod에서 RETENTION_NOW 설정 시 기동 거부", async () => {
    const r = await boot("worker", {
      ...BASE(),
      APP_ENV: "prod",
      LLM_MODE: "live",
      RETENTION_NOW: "2026-01-01T00:00:00Z",
    });
    expect(r.code).toBe(1);
    expect(r.out).toContain("RETENTION_NOW");
  });
});

describe("M0 로컬 스택", () => {
  let stack: ChildProcess | undefined;
  afterAll(() => {
    if (stack?.pid) process.kill(-stack.pid, "SIGTERM");
  });

  async function waitOk(url: string, signal: AbortSignal): Promise<Response> {
    for (;;) {
      if (signal.aborted) throw new Error(`timeout: ${url}`);
      // 기동 전 연결 거부는 재시도 대상이다(실패를 삼키지 않고 null로 구분).
      const r = await fetch(url, { signal }).then(
        (x) => x,
        () => null,
      );
      if (r && r.status === 200) return r;
      await new Promise((res) => setTimeout(res, 1000));
    }
  }

  it("AC-06-50 / 9.4.2 ③④: Docker 없이 dev:stack native 기동 → /api/health·worker /health 200", async () => {
    const env = BASE();
    stack = spawn("pnpm", ["-s", "dev:stack"], {
      cwd: ROOT,
      env: { ...process.env, ...env },
      detached: true,
      stdio: "ignore",
    });
    // 기동 상한 120초(AC-06-50 사양). 판정은 deadline 도달 여부로 한다.
    const signal = AbortSignal.timeout(120_000);
    const web = await waitOk(`${env.WEB_ORIGIN ?? ""}/api/health`, signal);
    expect(await web.json()).toEqual({ status: "ok", db: "ok", queue: "ok" });
    const worker = await waitOk(`${WORKER_HEALTH_ORIGIN}/health`, signal);
    expect(worker.status).toBe(200);
  });
});
