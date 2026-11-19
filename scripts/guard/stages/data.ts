// guard:data — provenance·확인 필드 위조(09장 9.5.5 F13·F18). baseRef 이후 커밋의 data/ 변경을 본다.
import { baseRef, git, gitOk, type Finding } from "../lib.js";

const FIELDS =
  /"?(provenance|verified_by|approved|tos_checked_at|robots_checked_at)"?\s*:\s*"?([^",\n}]*)/g;

function fieldMap(text: string): Map<string, string> {
  const m = new Map<string, string>();
  for (const x of text.matchAll(FIELDS)) if (x[1]) m.set(x[1], (x[2] ?? "").trim());
  return m;
}
const tmpIds = (text: string): Set<string> =>
  new Set([...text.matchAll(/\btmp_[A-Za-z0-9_-]+/g)].map((x) => x[0]));

export function dataStage(): Finding[] {
  const out: Finding[] = [];
  const base = baseRef();
  if (!base) return out;
  const commits = git("rev-list", "--reverse", `${base.commit}..HEAD`, "--", "data/")
    .split("\n")
    .filter(Boolean);
  for (const c of commits) {
    const files = git("diff-tree", "--no-commit-id", "--name-only", "-r", c, "--", "data/")
      .split("\n")
      .filter(Boolean);
    for (const p of files) {
      const before = gitOk("show", `${c}^:${p}`);
      const after = gitOk("show", `${c}:${p}`);
      if (before === null || after === null) continue;
      const b = fieldMap(before);
      const a = fieldMap(after);
      if (b.get("provenance") === "temp" && a.get("provenance") !== "temp") {
        out.push({
          stage: "guard:data",
          fid: "F13",
          status: "fail",
          message: `${p}: provenance temp→${a.get("provenance") ?? "(삭제)"} (${c.slice(0, 7)})`,
        });
      }
      for (const k of ["verified_by", "approved", "tos_checked_at", "robots_checked_at"]) {
        if (b.has(k) && b.get(k) !== a.get(k) && b.get("provenance") === "temp") {
          out.push({
            stage: "guard:data",
            fid: "F18",
            status: "fail",
            message: `${p}: temp 확인 필드 ${k} 변경 (${c.slice(0, 7)})`,
          });
        }
      }
      const lost = [...tmpIds(before)].filter(
        (id) => !after.includes(id) && after.includes(id.slice(4)),
      );
      if (lost.length)
        out.push({
          stage: "guard:data",
          fid: "F13",
          status: "fail",
          message: `${p}: tmp_ 접두사 제거 ${lost.join(", ")}`,
        });
    }
  }
  return out;
}
