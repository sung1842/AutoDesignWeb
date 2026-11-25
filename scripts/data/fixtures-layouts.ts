// fixtures/layouts/*.json 생성(09장 9.4.4 ①: 용도 3 × 10 이상, AC-04-11: 용도별 패턴 1~4). ASM-054.
// 결정론: 유형·variant 선택은 픽스처 번호로 순환하고, variant는 그 유형 앵커 명세의 allowed_variants 안에서만 고른다.
// 기존 수동 픽스처(saas-ps1.json)는 건드리지 않는다. provenance = temp.
import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  loadDesignData,
  patternRaw,
  standardTree,
  templateDeck,
} from "../../packages/design-spec/src/index.js";

const ROOT = join(import.meta.dirname, "../..");
const OUT = join(ROOT, "fixtures/layouts");
const data = loadDesignData(ROOT);
const TYPES = ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8"];
const PURPOSES = [
  ["saas", "PS"],
  ["local_business", "PL"],
  ["portfolio", "PP"],
] as const;
const PER_PURPOSE = 10;

mkdirSync(OUT, { recursive: true });
const keep = new Set(["saas-ps1.json"]);
let n = 0;
for (const [purpose, pre] of PURPOSES) {
  const deck = templateDeck(purpose, ROOT);
  // stats는 입력 숫자가 있을 때만 쓰는 블록(4.6.2) → 픽스처에만 [예시] 수치 3개를 둔다(PS-2용)
  if ((deck["stats.items"] ?? []).length === 0)
    deck["stats.items"] = [1, 2, 3].map((k) => ({
      value: `[예시] ${k}0%`,
      label: `[예시] 지표 ${k}`,
    }));
  for (let i = 0; i < PER_PURPOSE; i++) {
    const patternId = `${pre}-${(i % 4) + 1}`;
    const name = `${purpose.replace("_", "-")}-${pre.toLowerCase()}${(i % 4) + 1}-${String(i).padStart(2, "0")}.json`;
    if (keep.has(name)) continue;
    const typeId = TYPES[(i * 3 + PURPOSES.findIndex((p) => p[0] === purpose)) % TYPES.length]!;
    const { spec } = standardTree(typeId, purpose, data);
    const lc = spec.layout_constraints;
    // variant 순환: 블록별 허용 목록의 (i + 블록 순번) 번째
    const pick: Record<string, string> = {};
    Object.entries(lc.allowed_variants).forEach(([block, vs], k) => {
      if (vs.length > 0) pick[block] = vs[(i + k) % vs.length]!;
    });
    if (lc.hero_variants.length > 0) pick.hero = lc.hero_variants[i % lc.hero_variants.length]!;
    const raw = patternRaw(spec, patternId, deck, data, pick);
    raw.spec_id = "0000000000000000";
    const fx = { purpose, typeId, provenance: "temp", raw, deck };
    writeFileSync(join(OUT, name), JSON.stringify(fx, null, 2) + "\n");
    n++;
  }
}
const total = readdirSync(OUT).filter((f) => f.endsWith(".json")).length;
process.stdout.write(`fixtures:layouts: ${n}개 생성, 전체 ${total}개\n`);
