// /terms 이용약관(08장 8.5·AC-08-26). 원문은 legal/terms.md(temp, 사람 확정). 제목(#)·단락만 렌더하고 HTML은 해석하지 않는다.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { findRepoRoot } from "@tastefit/config";
import { termsBlocks } from "../../lib/terms";

export const dynamic = "force-dynamic";

export default function Page() {
  const md = readFileSync(join(findRepoRoot(), "legal/terms.md"), "utf8");
  return (
    <main className="svc-wrap">
      {termsBlocks(md).map((b, i) =>
        b.kind === "h1" ? (
          <h1 key={i}>{b.text}</h1>
        ) : b.kind === "h2" ? (
          <h2 key={i}>{b.text}</h2>
        ) : (
          <p key={i}>{b.text}</p>
        ),
      )}
    </main>
  );
}
