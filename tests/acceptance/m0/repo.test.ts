// M0 수용 테스트: 저장소 정적 검사·네트워크 가드·LLM 모드(AC-07-01, AC-09-01·02·08·09·11·14·15).
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { ROOT, git, run, tmpRepo } from "../_support/sh.js";

// 구현 전에도 다른 테스트가 돌도록 구현 모듈은 테스트 안에서 동적 import한다.
interface ConfigMod {
  installNetworkGuard: (env: Record<string, string>) => () => void;
}
interface LlmMod {
  createGateway: (
    env: Record<string, string>,
    opts: { fixturesDir: string },
  ) => {
    invoke: (req: { role: string; promptVersion: number; input: unknown }) => Promise<unknown>;
  };
}
const config = () =>
  import("../../../packages/config/src/index.js") as unknown as Promise<ConfigMod>;
const llm = () => import("../../../packages/llm/src/index.js") as unknown as Promise<LlmMod>;
const MS = ["m0", "m1", "m2", "m3", "m4", "m5", "m6", "m7", "m8"];

const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
  scripts: Record<string, string>;
};

describe("M0 저장소 정적 검사", () => {
  it("AC-09-02: 필수 스크립트가 package.json에 있다", () => {
    const need = [
      "verify:fast",
      "guard",
      "data:validate",
      "seed:temp",
      "survey:build",
      "eval:golden",
      "release:check",
    ];
    for (const m of MS) need.push(`verify:${m}`);
    for (const s of need) expect(pkg.scripts[s], s).toBeTypeOf("string");
  });

  it("AC-09-02: 각 verify:mN 계획은 verify:m(N-1)의 모든 단계를 포함한다", async () => {
    const plan = (await import("../../../scripts/verify/plan.js")) as {
      verifyPlan: Record<string, string[]>;
    };
    MS.forEach((m, i) => {
      expect(pkg.scripts[`verify:${m}`]).toContain("scripts/verify");
      const cur = plan.verifyPlan[m] ?? [];
      expect(cur.length, m).toBeGreaterThan(0);
      const prev = i === 0 ? [] : (plan.verifyPlan[MS[i - 1] as string] ?? []);
      for (const step of prev) expect(cur, `${m} ⊇ 이전`).toContain(step);
    });
  });

  it("AC-09-01: 클린 클론에서 pnpm i --frozen-lockfile 성공(전체 verify:m8 실행은 release:check, ASM-002)", async () => {
    const d = tmpRepo({ linkModules: false });
    const r = await run("pnpm", ["i", "--frozen-lockfile", "--offline"], d);
    expect(r.code, r.out).toBe(0);
  });

  it("AC-09-09: web 의존성 트리에 playwright 0개, renderer에 tailwind·shadcn·lucide 0개", async () => {
    const tree = async (filter: string) =>
      (await run("pnpm", ["-s", "--filter", filter, "list", "--depth", "Infinity", "--json"], ROOT))
        .out;
    expect(await tree("./apps/web")).not.toMatch(/playwright/);
    expect(await tree("./packages/renderer")).not.toMatch(
      /tailwindcss|shadcn|lucide-react|@radix-ui/,
    );
  });

  it("AC-09-09: provider SDK import가 packages/llm 밖에 0개", () => {
    const bad: string[] = [];
    const sdk =
      /from\s+["'](@ai-sdk\/(openai|anthropic|google)[^"']*|openai|@anthropic-ai\/sdk|@google\/generative-ai)["']/;
    const walk = (dir: string) => {
      for (const n of readdirSync(dir)) {
        const p = join(dir, n);
        if (["node_modules", "dist", ".git", ".next"].includes(n)) continue;
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(ts|tsx|js|mjs)$/.test(n) && sdk.test(readFileSync(p, "utf8"))) bad.push(p);
      }
    };
    for (const top of ["apps", "packages", "scripts"])
      if (existsSync(join(ROOT, top))) walk(join(ROOT, top));
    expect(bad.filter((p) => !p.startsWith(join(ROOT, "packages/llm")))).toEqual([]);
  });

  it("AC-09-11: spec-lock 이후 모든 커밋이 Conventional Commits + Milestone 꼬리말", () => {
    const log = git(ROOT, "log", "--format=%H%x00%B%x1e", "spec-lock..HEAD");
    const bad: string[] = [];
    for (const rec of log
      .split("\x1e")
      .map((s) => s.trim())
      .filter(Boolean)) {
      const [sha, body = ""] = rec.split("\x00");
      const subject = body.split("\n")[0] ?? "";
      const conv =
        /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([\w./-]+\))?!?: .+/.test(
          subject,
        );
      const footer = /^Milestone: M[0-8]$/m.test(body);
      if (!conv || !footer) bad.push(`${sha?.slice(0, 7)} ${subject}`);
    }
    expect(bad).toEqual([]);
  });

  it("AC-09-14 / AC-09-15: CLAUDE.md 300줄 이하, 두 절 구조, 구현 규칙 절에 9.8.2의 절 포함", () => {
    const md = readFileSync(join(ROOT, "CLAUDE.md"), "utf8");
    // 300줄 상한(AC-09-14). 사양 상수 표에 없는 수라 비교 매처 대신 초과분이 비었는지로 본다(ASM-003).
    const lines = md.replace(/\n$/, "").split("\n");
    expect(lines.slice(300)).toEqual([]);
    expect(md).toMatch(/^## 세션 운영/m);
    expect(md).toMatch(/^## 구현 규칙/m);
    const impl = md.slice(md.indexOf("## 구현 규칙"));
    const heads = [
      "너의 역할과 목표",
      "우선순위",
      "매 세션 시작 시",
      "마일스톤별 읽을 장",
      "작업 루프",
      "절대 금지",
      "막혔을 때",
      "명령어",
    ];
    for (const h of heads) expect(impl, h).toMatch(new RegExp(`^### \\d+\\. ${h}`, "m"));
  });

  it("AC-09-15: 결정 기록·막힘·사람 할 일 경로가 09장 표와 CLAUDE.md에서 1:1", () => {
    const claude = readFileSync(join(ROOT, "CLAUDE.md"), "utf8");
    const ch9 = readFileSync(join(ROOT, "docs/spec/FINAL/09_implementation.md"), "utf8");
    for (const p of [
      "docs/ASSUMPTIONS.md",
      "docs/spec/DECISIONS_LOG.md",
      "BLOCKED.md",
      "HUMAN_TODO.md",
    ]) {
      expect(ch9, `09장 ${p}`).toContain(p);
      expect(claude, `CLAUDE.md ${p}`).toContain(p);
    }
  });
});

describe("M0 네트워크·LLM 모드", () => {
  it("AC-09-08: NO_EXTERNAL_NETWORK=1에서 외부 fetch는 즉시 예외", async () => {
    const restore = (await config()).installNetworkGuard({ NO_EXTERNAL_NETWORK: "1" });
    await expect(fetch("https://example.com")).rejects.toThrow(/E_EXTERNAL_NETWORK/);
    restore();
  });

  it("AC-09-08: 가드는 localhost를 막지 않는다", async () => {
    const restore = (await config()).installNetworkGuard({ NO_EXTERNAL_NETWORK: "1" });
    const err = await fetch("http://127.0.0.1:9/").then(
      () => null,
      (e: unknown) => e,
    );
    expect(String(err)).not.toMatch(/E_EXTERNAL_NETWORK/);
    restore();
  });

  it("AC-07-01: LLM_MODE=replay에서 녹화 없는 요청은 E_REPLAY_MISS", async () => {
    const gw = (await llm()).createGateway(
      { LLM_MODE: "replay" },
      { fixturesDir: join(ROOT, "fixtures/llm-empty-acc") },
    );
    await expect(
      gw.invoke({ role: "gen_copy", promptVersion: 1, input: { acc: true } }),
    ).rejects.toMatchObject({ code: "E_REPLAY_MISS" });
  });

  it("AC-07-01: CI 워크플로의 모든 잡이 NO_EXTERNAL_NETWORK=1·LLM_MODE=mock 환경으로 실행된다", () => {
    const ci = readFileSync(join(ROOT, ".github/workflows/ci.yml"), "utf8");
    expect(ci).toMatch(/NO_EXTERNAL_NETWORK:\s*["']?1/);
    expect(ci).toMatch(/LLM_MODE:\s*["']?mock/);
    expect(ci).not.toMatch(/LLM_(PRIMARY|SECONDARY)_API_KEY/);
  });
});
