// M0 수용 테스트: spec 고정점(07장 7.12.1·7.12.2 6단계, AC-07-24, T-02·U-10).
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { GUARD_FAIL, ROOT, commit, edit, git, guard, run, tmpRepo } from "../_support/sh.js";

/** 07장 spec:thresholds 블록의 첫 숫자 값을 1 올린다. */
function bumpThresholdsBlock(md: string): string {
  const i = md.indexOf("<!-- spec:thresholds -->");
  const j = md.indexOf("```json", i);
  const head = md.slice(0, j);
  const rest = md.slice(j);
  return (
    head + rest.replace(/: (\d+)([,\s])/, (_m, n: string, t: string) => `: ${Number(n) + 1}${t}`)
  );
}

const extract = (d: string, from: string, out: string) =>
  run("pnpm", ["-s", "spec:extract", "--from", from, "--out", out], d);

function listFiles(dir: string, acc: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) {
      if (n !== "node_modules" && n !== ".git" && n !== "dist") listFiles(p, acc);
    } else if (/\.(ts|js|mjs)$/.test(n)) acc.push(p);
  }
  return acc;
}

describe("M0 spec:extract", () => {
  it("AC-07-24: 실제 태그 배치에서 --from review-pass와 --from FINAL 출력이 같은 바이트", async () => {
    const d = tmpRepo();
    expect(git(d, "ls-tree", "--name-only", "review-pass", "docs/spec/")).not.toContain("FINAL");
    expect(git(d, "ls-tree", "--name-only", "spec-lock", "docs/spec/")).toContain("FINAL");
    const a = await extract(d, "review-pass", "out-rp");
    const b = await extract(d, "FINAL", "out-final");
    expect(a.code, a.out).toBe(0);
    expect(b.code, b.out).toBe(0);
    for (const f of ["thresholds.json", "test-policy.json"]) {
      expect(readFileSync(join(d, "out-final", f), "utf8")).toBe(
        readFileSync(join(d, "out-rp", f), "utf8"),
      );
    }
  });

  it("AC-07-24: --from FINAL이 커밋된 config/*.json과 바이트 동일", async () => {
    const d = tmpRepo();
    const r = await extract(d, "FINAL", "out-final");
    expect(r.code, r.out).toBe(0);
    for (const f of ["thresholds.json", "test-policy.json"]) {
      expect(readFileSync(join(d, "out-final", f), "utf8")).toBe(
        readFileSync(join(d, "config", f), "utf8"),
      );
    }
  });

  it("AC-07-24: FINAL 값 1개를 바꾸면 두 출력이 달라지고 guard 6단계가 FAIL", async () => {
    const d = tmpRepo();
    edit(d, "docs/spec/FINAL/07_quality.md", bumpThresholdsBlock);
    commit(d);
    const chk = await run("pnpm", ["-s", "spec:extract", "--check-review-pass"], d);
    expect(chk.code).toBe(GUARD_FAIL);
    const r = await guard(d);
    expect(r.code).toBe(GUARD_FAIL);
    expect(r.out).toContain("review-pass");
  });

  it("AC-07-24: review-pass 태그가 없으면 guard FAIL", async () => {
    const d = tmpRepo();
    git(d, "tag", "-d", "review-pass");
    const r = await guard(d);
    expect(r.code).toBe(GUARD_FAIL);
    expect(r.out).toContain("review-pass");
  });

  it("AC-07-24: 입력 경로는 코드 상수 SPEC_SOURCE 1개이고 09장 9.8.1과 같다", () => {
    const hits = listFiles(join(ROOT, "scripts")).filter((p) =>
      /\bconst SPEC_SOURCE\b/.test(readFileSync(p, "utf8")),
    );
    expect(hits).toHaveLength(1);
    const src = readFileSync(hits[0] as string, "utf8");
    expect(src).toContain("docs/spec/v2/07_quality.md");
    expect(src).toContain("docs/spec/FINAL/07_quality.md");
  });
});
