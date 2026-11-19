// M0 수용 테스트: guard(07장 7.12.2, 09장 9.5.5·9.5.6). 각 경우를 임시 git 저장소에서 재현한다.
import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { GUARD_FAIL, commit, edit, git, guard, run, tmpRepo } from "../_support/sh.js";

interface LockFile {
  entries: Record<string, { sha256: string; lockedBy: string }>;
}
const readLock = (dir: string): LockFile =>
  JSON.parse(readFileSync(join(dir, "config/lock/locked-hashes.json"), "utf8")) as LockFile;
const sha = (s: string | Buffer): string => createHash("sha256").update(s).digest("hex");

/** thresholds.json의 첫 숫자 잎 경로(점 표기)를 찾는다. */
function firstNumericLeaf(o: unknown, path: string[] = []): string[] | null {
  if (typeof o === "number") return path;
  if (o && typeof o === "object" && !Array.isArray(o)) {
    for (const [k, v] of Object.entries(o)) {
      const p = firstNumericLeaf(v, [...path, k]);
      if (p) return p;
    }
  }
  return null;
}
function bumpLeaf(json: string): { text: string; key: string } {
  const o = JSON.parse(json) as Record<string, unknown>;
  const p = firstNumericLeaf(o);
  if (!p) throw new Error("숫자 잎 없음");
  let cur = o as Record<string, unknown>;
  for (const k of p.slice(0, -1)) cur = cur[k] as Record<string, unknown>;
  const last = p[p.length - 1] as string;
  cur[last] = (cur[last] as number) + 1;
  return { text: JSON.stringify(o, null, 2) + "\n", key: p.join(".") };
}

describe("M0 guard", () => {
  it("baseline: 클린 클론에서 guard가 fail(1)이 아니다", async () => {
    const r = await guard(tmpRepo());
    expect(r.code, r.out).not.toBe(GUARD_FAIL);
  });

  describe("AC-09-03: 9개 위반 각각 종료 코드 1 + F-ID 출력", () => {
    it("AC-09-03: 잠금 파일 1바이트 수정 → F01", async () => {
      const d = tmpRepo();
      const locked = Object.keys(readLock(d).entries).find((p) =>
        p.startsWith("tests/acceptance/"),
      );
      expect(locked).toBeDefined();
      edit(d, locked as string, (s) => s + " ");
      commit(d);
      const r = await guard(d);
      expect(r.code).toBe(GUARD_FAIL);
      expect(r.out).toContain("F01");
    });

    it("AC-09-03: it.skip 추가 → F02", async () => {
      const d = tmpRepo();
      edit(
        d,
        "tests/unit/acc-skip.test.ts",
        () => 'import { it } from "vitest";\nit.skip("x", () => {});\n',
      );
      commit(d);
      const r = await guard(d);
      expect(r.code).toBe(GUARD_FAIL);
      expect(r.out).toContain("F02");
    });

    it("AC-09-03: @ts-ignore 추가 → F05", async () => {
      const d = tmpRepo();
      edit(
        d,
        "packages/config/src/acc-ts.ts",
        () => "// @ts-ignore\nexport const x: number = 'a';\n",
      );
      commit(d);
      const r = await guard(d);
      expect(r.code).toBe(GUARD_FAIL);
      expect(r.out).toContain("F05");
    });

    it("AC-09-03: 테스트 1건 삭제 → F03", async () => {
      const d = tmpRepo();
      const body =
        'import { it, expect } from "vitest";\nit("acc a", () => expect(true).toBe(true));\nit("acc b", () => expect(true).toBe(true));\n';
      edit(d, "tests/unit/acc-count.test.ts", () => body);
      commit(d, "test(unit): add");
      const base = await run("pnpm", ["-s", "guard:count", "--update"], d);
      expect(base.code, base.out).toBe(0);
      commit(d, "chore(guard): test-count baseline");
      edit(d, "tests/unit/acc-count.test.ts", (s) => s.replace(/it\("acc b".*\n/, ""));
      commit(d);
      const r = await guard(d);
      expect(r.code).toBe(GUARD_FAIL);
      expect(r.out).toContain("F03");
    });

    it("AC-09-03: verify:* 스크립트 변경 → F08", async () => {
      const d = tmpRepo();
      edit(d, "package.json", (s) => {
        const o = JSON.parse(s) as { scripts: Record<string, string> };
        o.scripts["verify:m0"] = "echo ok";
        return JSON.stringify(o, null, 2) + "\n";
      });
      commit(d);
      const r = await guard(d);
      expect(r.code).toBe(GUARD_FAIL);
      expect(r.out).toContain("F08");
    });

    it("AC-09-03 / AC-07-04 / AC-07-16: thresholds 값 변경 → F04, 경로·키 출력", async () => {
      const d = tmpRepo();
      let key = "";
      edit(d, "config/thresholds.json", (s) => {
        const b = bumpLeaf(s);
        key = b.key;
        return b.text;
      });
      commit(d);
      const r = await guard(d);
      expect(r.code).toBe(GUARD_FAIL);
      expect(r.out).toContain("F04");
      expect(r.out).toContain("config/thresholds.json");
      expect(r.out).toContain(key);
    });

    it("AC-09-03: provenance temp→human 변경 → F13", async () => {
      const d = tmpRepo();
      const f = "data/acc/acc-provenance.json";
      edit(d, f, () => JSON.stringify({ id: "tmp_acc", provenance: "temp" }, null, 2) + "\n");
      commit(d, "chore(data): temp seed");
      edit(d, f, (s) => s.replace('"temp"', '"human"'));
      commit(d);
      const r = await guard(d);
      expect(r.code).toBe(GUARD_FAIL);
      expect(r.out).toContain("F13");
    });

    it("AC-09-03 / AC-07-17: human-lock·spec-lock 태그가 모두 없으면 FAIL", async () => {
      const d = tmpRepo();
      for (const t of ["spec-lock", "human-lock"])
        if (git(d, "tag", "--list", t)) git(d, "tag", "-d", t);
      const r = await guard(d);
      expect(r.code).toBe(GUARD_FAIL);
      expect(r.out).toContain("F01");
    });

    it("AC-09-03 / AC-07-17: spec-lock 이후 docs/spec 장 파일 1줄 수정 → FAIL", async () => {
      const d = tmpRepo();
      edit(d, "docs/spec/FINAL/02_diagnosis.md", (s) => s + "\n수정\n");
      commit(d);
      const r = await guard(d);
      expect(r.code).toBe(GUARD_FAIL);
      expect(r.out).toContain("F01");
    });
  });

  describe("AC-07-25: DECISIONS_LOG append-only 예외 1개", () => {
    it("AC-07-25: 끝에 AD 1줄 추가만 한 커밋은 PASS", async () => {
      const d = tmpRepo();
      edit(d, "docs/spec/DECISIONS_LOG.md", (s) => s + "AD-999 | 2026-11-19 | 테스트 | 테스트\n");
      commit(d, "docs(log): AD append");
      const r = await guard(d);
      expect(r.code, r.out).not.toBe(GUARD_FAIL);
    });

    it("AC-07-25: 기존 줄 수정 → FAIL", async () => {
      const d = tmpRepo();
      edit(d, "docs/spec/DECISIONS_LOG.md", (s) => s.replace(/AD-0\d\d/, "AD-998"));
      commit(d);
      expect((await guard(d)).code).toBe(GUARD_FAIL);
    });

    it("AC-07-25: 기존 줄 삭제 → FAIL", async () => {
      const d = tmpRepo();
      edit(d, "docs/spec/DECISIONS_LOG.md", (s) =>
        s
          .split("\n")
          .filter((l) => !/AD-001\b/.test(l))
          .join("\n"),
      );
      commit(d);
      expect((await guard(d)).code).toBe(GUARD_FAIL);
    });

    it("AC-07-25: FINAL/07_quality.md 1바이트 변경 → FAIL", async () => {
      const d = tmpRepo();
      edit(d, "docs/spec/FINAL/07_quality.md", (s) => s + " ");
      commit(d);
      expect((await guard(d)).code).toBe(GUARD_FAIL);
    });

    it("AC-07-25: docs/spec/INDEX.md 변경 → FAIL", async () => {
      const d = tmpRepo();
      edit(d, "docs/spec/INDEX.md", (s) => s + "\n");
      commit(d);
      expect((await guard(d)).code).toBe(GUARD_FAIL);
    });

    it("AC-07-25: CLAUDE.md·07·09장의 DECISIONS_LOG 경로가 하나뿐이다", () => {
      const files = [
        "CLAUDE.md",
        "docs/spec/FINAL/07_quality.md",
        "docs/spec/FINAL/09_implementation.md",
      ];
      const paths = new Set<string>();
      for (const f of files) {
        const s = readFileSync(join(process.cwd(), f), "utf8");
        for (const m of s.matchAll(/[\w./-]*DECISIONS_LOG[\w.]*/g)) paths.add(m[0]);
      }
      expect([...paths]).toEqual(["docs/spec/DECISIONS_LOG.md"]);
    });
  });

  it("AC-07-04: locked-hashes.json까지 함께 바꿔도 QA_LOCK_DIGEST 불일치로 FAIL", async () => {
    const d = tmpRepo();
    const digest = sha(readFileSync(join(d, "config/lock/locked-hashes.json")));
    edit(d, "config/thresholds.json", (s) => bumpLeaf(s).text);
    edit(d, "config/lock/locked-hashes.json", (s) => {
      const o = JSON.parse(s) as LockFile;
      const e = o.entries["config/thresholds.json"];
      expect(e).toBeDefined();
      if (e) e.sha256 = sha(readFileSync(join(d, "config/thresholds.json")));
      return JSON.stringify(o, null, 2) + "\n";
    });
    commit(d);
    const r = await guard(d, { QA_LOCK_DIGEST: digest });
    expect(r.code).toBe(GUARD_FAIL);
    expect(r.out).toContain("QA_LOCK_DIGEST");
  });

  it("AC-07-05: 판정 코드의 임계값 리터럴 비교 → FAIL", async () => {
    const d = tmpRepo();
    edit(
      d,
      "packages/scoring/src/acc-literal.ts",
      () => "export const ok = (tasteScore: number): boolean => tasteScore >= 75;\n",
    );
    commit(d);
    const r = await guard(d);
    expect(r.code).toBe(GUARD_FAIL);
    expect(r.out).toContain("packages/scoring/src/acc-literal.ts");
  });

  it("AC-07-06: 테스트 파일의 maxDiffPixelRatio 재지정 → FAIL", async () => {
    const d = tmpRepo();
    edit(
      d,
      "tests/unit/acc-visual.test.ts",
      () =>
        'import { it } from "vitest";\nconst o = { maxDiffPixelRatio: 0.2 };\nit("v", () => void o);\n',
    );
    commit(d);
    expect((await guard(d)).code).toBe(GUARD_FAIL);
  });

  it("AC-07-06: 판정 코드의 SKIP_GATE 문자열 → FAIL", async () => {
    const d = tmpRepo();
    edit(d, "packages/pipeline/src/acc-skip.ts", () => 'export const flag = "SKIP_GATE";\n');
    commit(d);
    expect((await guard(d)).code).toBe(GUARD_FAIL);
  });

  it("AC-07-16: thresholds에 블록에 없는 키 추가 → thresholds-schema FAIL", async () => {
    const d = tmpRepo();
    edit(
      d,
      "config/thresholds.json",
      (s) => JSON.stringify({ ...(JSON.parse(s) as object), accExtra: 1 }, null, 2) + "\n",
    );
    commit(d);
    const r = await guard(d);
    expect(r.code).toBe(GUARD_FAIL);
    expect(r.out).toContain("thresholds-schema");
  });

  it("AC-07-16: thresholds에서 키 1개 삭제 → thresholds-schema FAIL", async () => {
    const d = tmpRepo();
    edit(d, "config/thresholds.json", (s) => {
      const o = JSON.parse(s) as Record<string, unknown>;
      delete o.perf;
      return JSON.stringify(o, null, 2) + "\n";
    });
    commit(d);
    const r = await guard(d);
    expect(r.code).toBe(GUARD_FAIL);
    expect(r.out).toContain("thresholds-schema");
  });

  it("AC-07-22: forbidden-allowlist.json에 숫자 리터럴 항목 → FAIL", async () => {
    const d = tmpRepo();
    edit(d, "config/forbidden-allowlist.json", (s) => {
      const o = (s ? JSON.parse(s) : {}) as Record<string, unknown>;
      return JSON.stringify({ ...o, literals: [80] }, null, 2) + "\n";
    });
    commit(d);
    const r = await guard(d);
    expect(r.code).toBe(GUARD_FAIL);
    expect(r.out).toContain("forbidden-allowlist");
  });

  it("AC-09-09 ⑦: renderer에 lucide-react 추가 → deps 검사 FAIL(F12)", async () => {
    const d = tmpRepo();
    edit(d, "packages/renderer/package.json", (s) => {
      const o = JSON.parse(s) as { dependencies?: Record<string, string> };
      o.dependencies = { ...(o.dependencies ?? {}), "lucide-react": "^0.400.0" };
      return JSON.stringify(o, null, 2) + "\n";
    });
    commit(d);
    const r = await guard(d);
    expect(r.code).toBe(GUARD_FAIL);
    expect(r.out).toContain("F12");
  });
});
