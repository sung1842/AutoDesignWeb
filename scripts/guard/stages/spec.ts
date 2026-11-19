// guard:spec — spec 대조(07장 7.12.2 5·6단계, S-04·T-01·T-02). F01·F04.
//   5단계: spec:extract(FINAL) 출력 = config/thresholds.json·test-policy.json(바이트), thresholds-schema(zod strict)
//   6단계: baseRef 이후 docs/spec/** 변경 0(예외: DECISIONS_LOG.md append-only, 커밋마다 접두어 판정),
//          review-pass 태그 존재·spec:extract --from review-pass = --from spec-lock·review_pass_hashes 일치
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import {
  BLOCKS,
  blockHash,
  diffPaths,
  extractAll,
  rawBlock,
  readSource,
  type BlockName,
} from "../../spec/extract.js";
import { checkThresholdsSchema } from "../thresholds-schema.js";
import { baseRef, git, tagCommit, type Finding } from "../lib.js";

export const APPEND_ONLY = "docs/spec/DECISIONS_LOG.md";
const OUT: Record<BlockName, string> = {
  thresholds: "config/thresholds.json",
  "test-policy": "config/test-policy.json",
};

/** git show <ref>:<path> 바이트(없으면 null). */
function showBytes(ref: string, path: string): Buffer | null {
  const r = spawnSync("git", ["show", `${ref}:${path}`], { maxBuffer: 64 << 20 });
  return r.status === 0 ? r.stdout : null;
}

const isPrefix = (a: Buffer, b: Buffer): boolean =>
  a.length <= b.length && a.equals(b.subarray(0, a.length));

function progressHashes(): Record<BlockName, string> | null {
  if (!existsSync("PROGRESS.md")) return null;
  const m =
    /review_pass_hashes:\s*\{thresholds:\s*([0-9a-f]{64}),\s*testPolicy:\s*([0-9a-f]{64})\}/.exec(
      readFileSync("PROGRESS.md", "utf8"),
    );
  return m && m[1] && m[2] ? { thresholds: m[1], "test-policy": m[2] } : null;
}

export function specStage(): Finding[] {
  const out: Finding[] = [];
  const f = (fid: string, message: string): void =>
    void out.push({ stage: "guard:spec", fid, status: "fail", message });

  // 5단계: spec:extract 대조
  let fin: Record<BlockName, string> | null = null;
  try {
    fin = extractAll("FINAL");
  } catch (e) {
    f("F04", `spec:extract(FINAL) 실패: ${String(e)}`);
  }
  if (fin) {
    for (const name of Object.keys(BLOCKS) as BlockName[]) {
      const p = OUT[name];
      if (!existsSync(p)) {
        f("F04", `${p} 없음(pnpm spec:extract)`);
        continue;
      }
      const cur = readFileSync(p, "utf8");
      if (cur === fin[name]) continue;
      let paths: string[];
      try {
        paths = diffPaths(JSON.parse(fin[name]), JSON.parse(cur));
      } catch {
        paths = ["(JSON 파싱 실패)"];
      }
      f("F04", `${p} ≠ spec:extract 출력: ${paths.join(", ") || "(서식만 다름)"}`);
    }
  }

  const base = baseRef();
  // thresholds-schema: 고정점(baseRef 시점 07장 블록) 구조로 strict 검사
  if (existsSync(OUT.thresholds)) {
    let spec: unknown = null;
    try {
      spec = JSON.parse(
        base ? extractAll(base.commit).thresholds : (fin?.thresholds ?? "null"),
      ) as unknown;
    } catch (e) {
      f("F04", `thresholds-schema: 기준 블록 추출 실패: ${String(e)}`);
    }
    if (spec !== null) {
      let actual: unknown;
      try {
        actual = JSON.parse(readFileSync(OUT.thresholds, "utf8")) as unknown;
      } catch {
        actual = undefined;
      }
      for (const m of checkThresholdsSchema(spec, actual))
        f("F04", `thresholds-schema: ${OUT.thresholds} ${m}`);
    }
  }

  if (!base) return out; // baseRef 없음은 guard:lock이 FAIL로 보고한다

  // 6단계: baseRef 이후 docs/spec/** 변경(작업 트리 포함)
  const changed = new Set(
    [
      git("diff", "--name-only", base.commit, "--", "docs/spec"),
      git("ls-files", "--others", "--exclude-standard", "--", "docs/spec"),
    ]
      .join("\n")
      .split("\n")
      .filter(Boolean),
  );
  for (const p of changed) {
    if (p !== APPEND_ONLY) {
      f("F01", `${p}: ${base.name} 이후 docs/spec 변경(예외 목록 밖)`);
      continue;
    }
    const before = showBytes(base.commit, p);
    const now = existsSync(p) ? readFileSync(p) : null;
    if (!before || !now || !isPrefix(before, now))
      f("F01", `${p}: append-only 위반(${base.name} 시점 내용이 현재 내용의 접두어가 아님)`);
  }
  // 커밋마다 접두어 판정(중간 커밋에서 고쳤다가 되돌린 경우도 잡는다)
  const commits = git("rev-list", "--reverse", `${base.commit}..HEAD`, "--", APPEND_ONLY)
    .split("\n")
    .filter(Boolean);
  for (const c of commits) {
    const prev = showBytes(`${c}^`, APPEND_ONLY);
    const cur = showBytes(c, APPEND_ONLY);
    if (!prev || !cur || !isPrefix(prev, cur))
      f("F01", `${APPEND_ONLY}: 커밋 ${c.slice(0, 7)}에서 append-only 위반`);
  }

  // 6단계: review-pass 대조(human-lock이 baseRef이면 건너뜀)
  if (base.name !== "human-lock") {
    if (!tagCommit("review-pass")) f("F01", "review-pass 태그 없음(T-02)");
    else {
      try {
        const rpMd = readSource("review-pass");
        const rp = extractAll("review-pass");
        const sl = extractAll(base.commit);
        const want = progressHashes();
        if (!want) f("F01", "PROGRESS.md review_pass_hashes 없음");
        for (const name of Object.keys(BLOCKS) as BlockName[]) {
          if (rp[name] !== sl[name])
            f(
              "F04",
              `spec:extract review-pass ≠ ${base.name} (${name}): ${diffPaths(JSON.parse(rp[name]), JSON.parse(sl[name])).join(", ")}`,
            );
          if (want && want[name] !== blockHash(rawBlock(rpMd, name)))
            f("F04", `review-pass ${name} 블록 SHA-256 ≠ PROGRESS.md review_pass_hashes`);
        }
      } catch (e) {
        f("F01", `review-pass 대조 실패: ${String(e)}`);
      }
    }
  }
  return out;
}
