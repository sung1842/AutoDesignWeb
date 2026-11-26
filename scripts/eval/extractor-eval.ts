// pnpm eval:extractor — 05장 5.7.4 추출기 평가(사람 라벨 대비 축별 Spearman ρ·MAE, AC-05-15).
// 사람 라벨(provenance human)이 없으면 평가할 수 없으므로 보고서에 그 사실을 적고 종료 코드 1(BLK-017, ASM-080 ⑦).
// temp 라벨로 합격 처리하지 않는다.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "../..");
const LABELS = join(ROOT, "data/references/labels.json");

function main(): number {
  const nzDir = join(ROOT, "data/normalizers");
  const last = readdirSync(nzDir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .at(-1);
  const nz = last
    ? (JSON.parse(readFileSync(join(nzDir, last), "utf8")) as { version: string })
    : { version: "none" };
  const labels = existsSync(LABELS)
    ? (JSON.parse(readFileSync(LABELS, "utf8")) as { provenance?: string; items?: unknown[] })
    : null;
  const human = labels?.provenance === "human" && (labels.items?.length ?? 0) > 0;
  mkdirSync(join(ROOT, "reports"), { recursive: true });
  const body = {
    normalizer: nz.version,
    labels: human ? "human" : "none",
    axes: [] as { axis: string; rho: number; mae: number }[],
    blocked: human ? null : "BLK-017",
  };
  writeFileSync(join(ROOT, "reports/extractor_eval.json"), `${JSON.stringify(body, null, 2)}\n`);
  writeFileSync(
    join(ROOT, "reports/extractor_eval.md"),
    `# 추출기 평가(05장 5.7.4)\n\n- 정규화기: ${nz.version}\n- 사람 라벨: ${human ? "있음" : "없음 → 평가 불가(BLK-017, HUMAN_TODO)"}\n`,
  );
  if (!human) {
    process.stderr.write(
      "eval:extractor: 사람 라벨(data/references/labels.json, provenance human) 없음 — BLK-017\n",
    );
    return 1;
  }
  process.stderr.write("eval:extractor: 사람 라벨 평가는 라벨 형식 확정 후 구현(BLK-017)\n");
  return 1;
}
process.exitCode = main();
