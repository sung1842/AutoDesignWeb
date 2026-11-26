// pnpm presets:lint-matrix [--preset PS-Tn] [--json <path>] — 03장 3.4.1 S-33·AC-03-43.
// 프리셋마다 3.4.5 허용 집합 중 값 1개만 바꾼 조합 전부를 standardTree로 렌더해 AIL error를 센다.
// error가 난 조합은 harmony.json.conflicts(CF-13~)에 등록돼 있어야 한다(등록 안 된 error가 있으면 종료 코드 1).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  allowedValues,
  loadDesignData,
  standardTree,
} from "../../packages/design-spec/src/index.js";
import { compilePage } from "../../packages/renderer/src/index.js";
import { copyOfTree, lintAll, type LintFinding } from "../../packages/linter/src/index.js";
import { openHarness } from "../../apps/worker/src/render/harness.js";

const ROOT = join(import.meta.dirname, "../..");
/** 렌더 단계 D·P를 돌릴 뷰포트(4.13.2 AIL-24: 375·1280). */
const VIEWPORTS = [375, 1280] as const;
const PURPOSE = "saas";

interface Registered {
  id: string;
  preset?: string;
  key?: string;
  value?: string;
}
function registered(): Registered[] {
  const h = JSON.parse(readFileSync(join(ROOT, "data/taxonomy/harmony.json"), "utf8")) as {
    conflicts?: Registered[];
  };
  return h.conflicts ?? [];
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const arg = (k: string): string | undefined => {
    const i = args.indexOf(k);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const only = arg("--preset");
  const out = arg("--json");
  const data = loadDesignData(ROOT);
  const reg = registered();
  const h = await openHarness();
  const presets: {
    presetId: string;
    combos: number;
    errors: { key: string; value: string; rules: string[]; cf: string | null }[];
  }[] = [];
  let unregistered = 0;
  try {
    for (const p of data.presets.filter((x) => !only || x.id === only)) {
      const errors: (typeof presets)[number]["errors"] = [];
      let combos = 0;
      for (const key of Object.keys(p.allowed).sort()) {
        for (const value of allowedValues(key, p.l2, p, data)) {
          if (p.l2[key as keyof typeof p.l2] === value) continue;
          combos++;
          const { spec, tree } = standardTree(p.typeId, PURPOSE, data, {
            l2: { ...p.l2, [key]: value } as never,
          });
          const { html } = compilePage(spec, tree, data);
          const lint: LintFinding[] = lintAll({ spec, tree, copy: copyOfTree(tree) });
          for (const vw of VIEWPORTS)
            lint.push(
              ...lintAll(
                { snapshot: await h.lintSnapshot(html, vw, { spec }), spec },
                { stages: ["D", "P"] },
              ),
            );
          const rules = [
            ...new Set(
              lint
                .filter((f) => f.severity === "error" && f.rule.startsWith("AIL-"))
                .map((f) => f.rule),
            ),
          ].sort();
          if (rules.length === 0) continue;
          const cf =
            reg.find((c) => c.preset === p.id && c.key === key && c.value === value)?.id ?? null;
          if (!cf) unregistered++;
          errors.push({ key, value, rules, cf });
          process.stdout.write(`${p.id} ${key}=${value} ${rules.join(",")} ${cf ?? "미등록"}\n`);
        }
      }
      presets.push({ presetId: p.id, combos, errors });
      process.stdout.write(`${p.id}: 조합 ${combos}, error 조합 ${errors.length}\n`);
    }
  } finally {
    await h.close();
  }
  if (out) {
    mkdirSync(dirname(join(ROOT, out)), { recursive: true });
    writeFileSync(join(ROOT, out), `${JSON.stringify({ presets }, null, 2)}\n`);
  }
  process.stdout.write(`presets:lint-matrix: 미등록 error 조합 ${unregistered}\n`);
  return unregistered === 0 ? 0 : 1;
}
process.exitCode = await main();
