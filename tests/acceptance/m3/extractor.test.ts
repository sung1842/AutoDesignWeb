// M3 수용 테스트(4/5): 추출기 단일 경로·왕복·앵커 분리·성능·정규화기 버전
// (05장 5.5.6·5.8·5.9, AC-05-12·14·15·22·24·25, 09장 9.4.5 ③④⑤). API 계약은 ASSUMPTIONS ASM-080.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { extractL2, l1Distance, toL1 } from "../../../packages/extractor/src/index.js";
import { fallbackMockup, loadDesignData } from "../../../packages/design-spec/src/index.js";
import { compilePage } from "../../../packages/renderer/src/index.js";
import { openHarness, type Harness } from "../../../apps/worker/src/render/harness.js";
import { evaluateCandidate } from "../../../apps/worker/src/quality/evaluate.js";
import { createDbPort, q, type DbPort } from "../../../packages/db/src/index.js";
import { getThresholds, thresholdNumber } from "../../../packages/config/src/index.js";
import { ROOT, run } from "../_support/sh.js";

const data = loadDesignData(ROOT);
const KEYS = ["expression", "temperature", "shape", "density", "depth"] as const;
const TYPES = data.presets.map((p) => p.typeId).sort();
const ROUNDTRIP = thresholdNumber("release.extractor.roundtripAbsMax");
const RELIABLE_MIN = thresholdNumber("release.extractor.reliableAxesMin");
const ANCHOR_MIN = thresholdNumber("release.extractor.anchorMinDist");
const GATE_P95 = thresholdNumber("perf.versionGateP95Sec");
const VIEWPORTS = getThresholds().generation.renderViewports as number[];
/** 05장 5.5.6 사양 상수: 이미 렌더된 페이지 extractL2() p95(초). */
const EXTRACT_L2_P95_SEC = 2.5;
/** 05장 5.9 토큰 수준 사양 상수: radius ±1px. */
const TOKEN_RADIUS_PX = 1;

const p95 = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil(0.95 * s.length) - 1)]!;
};
const euclid = (a: number[], b: number[]): number =>
  Math.sqrt(a.reduce((s, x, i) => s + (x - b[i]!) ** 2, 0));

/** 프리셋 앵커 렌더 = 앵커 취향(μ = predictL1(기본 L2))의 v_true 명세 + 표준 트리, 1280(ASM-080). */
function anchorPage(typeId: string): {
  spec: unknown;
  tree: unknown;
  html: string;
  purpose: string;
} {
  const type = (
    JSON.parse(readFileSync(join(ROOT, "data/taxonomy/types.json"), "utf8")) as {
      items: { id: string; goodPurposes: string[] }[];
    }
  ).items.find((t) => t.id === typeId);
  const purpose = type?.goodPurposes[0] ?? "saas";
  // fallbackMockup(명세 생략) = anchorTaste(typeId) v_true 명세 + 표준 트리(design-spec stubs)
  const { spec, tree } = fallbackMockup(typeId, purpose, "v_true", data);
  const { html } = compilePage(spec, tree, data);
  return { spec, tree, html, purpose };
}

interface NormalizerFile {
  version: string;
  provenance: string;
  reliable: Record<string, boolean>;
}
function releasedNormalizer(): NormalizerFile {
  const dir = join(ROOT, "data/normalizers");
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort();
  return JSON.parse(readFileSync(join(dir, files[files.length - 1]!), "utf8")) as NormalizerFile;
}

let h: Harness;
beforeAll(async () => {
  h = await openHarness();
});
afterAll(async () => {
  await h?.close();
});

describe("AC-05-12 L1 계산 단일 경로·extractor 의존성", () => {
  it("extractor 밖에 extractL2·toL1 중복 구현 0", () => {
    const hits: string[] = [];
    const walk = (d: string): void => {
      if (!existsSync(d)) return;
      for (const f of readdirSync(d)) {
        if (f === "node_modules" || f === "dist") continue;
        const p = join(d, f);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(ts|tsx)$/.test(p) && !/\.test\.tsx?$/.test(p)) {
          const s = readFileSync(p, "utf8");
          if (/(function|const|let)\s+(extractL2|toL1)\b/.test(s)) hits.push(p);
        }
      }
    };
    for (const root of ["packages", "apps", "scripts"]) walk(join(ROOT, root));
    expect(hits.filter((p) => !p.includes("/packages/extractor/"))).toEqual([]);
  });

  it("extractor 의존성 트리에 llm 패키지·provider SDK 0", () => {
    const seen = new Set<string>();
    const banned: string[] = [];
    const visit = (pkgDir: string): void => {
      const pj = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8")) as {
        name: string;
        dependencies?: Record<string, string>;
      };
      if (seen.has(pj.name)) return;
      seen.add(pj.name);
      for (const dep of Object.keys(pj.dependencies ?? {})) {
        if (
          /^@tastefit\/llm$|openai|anthropic|@google\/(genai|generative-ai)|mistral|cohere/i.test(
            dep,
          )
        )
          banned.push(`${pj.name} → ${dep}`);
        if (dep.startsWith("@tastefit/"))
          visit(join(ROOT, "packages", dep.slice("@tastefit/".length)));
      }
    };
    visit(join(ROOT, "packages/extractor"));
    expect(banned).toEqual([]);
  });

  it("L1 = toL1(extractL2(page)) 경로가 하네스 extractL1과 같다", async () => {
    const { html } = anchorPage(TYPES[0]!);
    const viaHarness = await h.extractL1(html, 1280);
    const viaPath = await h.withPage(html, 1280, async (page) => {
      const l2 = await extractL2(page as never, h.extractOptions());
      const l1 = toL1(l2, h.normalizer());
      return KEYS.map((k) => l1[k]);
    });
    expect(viaPath).toEqual(viaHarness);
  }, 120_000);
});

describe("9.4.5 ③ · AC-05-22 프리셋 앵커 왕복, ④ · AC-05-24 앵커 분리", () => {
  const measured: Record<string, number[]> = {};
  beforeAll(async () => {
    for (const t of TYPES) measured[t] = await h.extractL1(anchorPage(t).html, 1280);
  }, 600_000);

  it("③ 축별 |x̂−x| ≤ roundtripAbsMax. temp 정규화기는 초과 축 = reliable false, reliable 축 수 ≥ reliableAxesMin", () => {
    const norm = releasedNormalizer();
    const exceeded = new Set<string>();
    for (const t of TYPES) {
      const intended = data.presets.find((p) => p.typeId === t)!.l1; // 3.4.7 원천(data/taxonomy)
      KEYS.forEach((k, i) => {
        if (Math.abs(measured[t]![i]! - intended[i]!) > ROUNDTRIP) exceeded.add(k);
      });
    }
    if (norm.provenance === "human") {
      expect([...exceeded]).toEqual([]);
    } else {
      for (const k of exceeded)
        expect(norm.reliable[k], `${k} 초과 축은 reliable=false`).toBe(false);
      expect(
        KEYS.length - exceeded.size,
        `reliable 축(초과: ${[...exceeded].join(",")})`,
      ).toBeGreaterThanOrEqual(RELIABLE_MIN);
    }
  });

  it("④ 서로 다른 프리셋 앵커 렌더 간 추출 L1 거리 최소 ≥ anchorMinDist", () => {
    let min = Infinity;
    for (let i = 0; i < TYPES.length; i++)
      for (let j = i + 1; j < TYPES.length; j++)
        min = Math.min(min, euclid(measured[TYPES[i]!]!, measured[TYPES[j]!]!));
    expect(min).toBeGreaterThanOrEqual(ANCHOR_MIN);
  });

  it("AC-05-22 eval:extractor:selfcheck — 토큰 수준(radius ±1px, 배경·accent ΔE2000 < 5, 본문 폰트 일치)", async () => {
    const r = await run(
      "pnpm",
      ["-s", "eval:extractor:selfcheck", "--json", "reports/extractor-selfcheck.json"],
      ROOT,
    );
    expect(r.code, r.out.slice(-600)).toBe(0);
    const rep = JSON.parse(
      readFileSync(join(ROOT, "reports/extractor-selfcheck.json"), "utf8"),
    ) as {
      presets: {
        typeId: string;
        intended: number[];
        measured: number[];
        radiusErrPx: number;
        bgDeltaE: number;
        accentDeltaE: number;
        bodyFontMatch: boolean;
      }[];
    };
    expect(rep.presets.map((p) => p.typeId).sort()).toEqual(TYPES);
    for (const p of rep.presets) {
      expect(p.intended).toEqual(data.presets.find((x) => x.typeId === p.typeId)!.l1);
      KEYS.forEach((_, i) => expect(p.measured[i]).toBeCloseTo(measured[p.typeId]![i]!, 6));
      expect(p.radiusErrPx, p.typeId).toBeLessThanOrEqual(TOKEN_RADIUS_PX);
      // ΔE2000 < 5 대조는 사양 상수 표 밖 값이 thresholds 잎 값과 겹쳐(BLK-014) 스크립트 종료 코드·단위 테스트로 본다
      expect(typeof p.bgDeltaE).toBe("number");
      expect(typeof p.accentDeltaE).toBe("number");
      expect(p.bodyFontMatch, p.typeId).toBe(true);
    }
  }, 600_000);
});

describe("AC-05-14 · 9.4.5 ⑤ 성능", () => {
  it("이미 렌더된 페이지 extractL2() p95 ≤ 2.5s(20회)", async () => {
    const ms: number[] = [];
    for (let i = 0; i < 20; i++) {
      const { html } = anchorPage(TYPES[i % TYPES.length]!);
      ms.push(
        await h.withPage(html, 1280, async (page) => {
          const t0 = performance.now();
          await extractL2(page as never, h.extractOptions());
          return performance.now() - t0;
        }),
      );
    }
    expect(p95(ms) / 1000).toBeLessThanOrEqual(EXTRACT_L2_P95_SEC);
  }, 600_000);

  it("⑤ 후보 1개 렌더+추출+린트+게이트(뷰포트 5) p95 ≤ versionGateP95Sec(20회)", async () => {
    const ms: number[] = [];
    for (let i = 0; i < 20; i++) {
      const { spec, tree, html } = anchorPage(TYPES[i % TYPES.length]!);
      const t0 = performance.now();
      const res = await evaluateCandidate(h, { spec, tree, html }, data);
      ms.push(performance.now() - t0);
      expect(res.viewports.sort((a, b) => a - b)).toEqual([...VIEWPORTS].sort((a, b) => a - b));
      expect(res.report.hard.length).toBe(13);
      expect(res.report.harmonyItems.length).toBe(12);
    }
    expect(p95(ms) / 1000).toBeLessThanOrEqual(GATE_P95);
  }, 900_000);
});

describe("AC-05-15 eval:extractor", () => {
  it("reports/extractor_eval.md 생성, ρ ≥ spearmanMin·MAE ≤ maeMax 축 ≥ reliableAxesMin, 미달 축 reliable=false", async () => {
    const r = await run("pnpm", ["-s", "eval:extractor"], ROOT);
    expect(r.code, r.out.slice(-600)).toBe(0);
    expect(existsSync(join(ROOT, "reports/extractor_eval.md"))).toBe(true);
    const ev = JSON.parse(readFileSync(join(ROOT, "reports/extractor_eval.json"), "utf8")) as {
      normalizer: string;
      axes: { axis: string; rho: number; mae: number }[];
    };
    const norm = releasedNormalizer();
    expect(ev.normalizer).toBe(norm.version);
    const rho = thresholdNumber("release.extractor.spearmanMin");
    const mae = thresholdNumber("release.extractor.maeMax");
    const good = ev.axes.filter((a) => a.rho >= rho && a.mae <= mae);
    expect(good.length).toBeGreaterThanOrEqual(RELIABLE_MIN);
    for (const a of ev.axes.filter((x) => !(x.rho >= rho && x.mae <= mae)))
      expect(norm.reliable[a.axis], a.axis).toBe(false);
  }, 900_000);
});

describe("AC-05-25 정규화기 버전", () => {
  it("버전이 다른 L1 거리 호출은 예외, 같은 버전은 유클리드 거리", () => {
    const a = { version: "2026-S0", vector: [0.1, 0.2, 0.3, 0.4, 0.5] };
    const b = { version: "2026-S1", vector: [0.1, 0.2, 0.3, 0.4, 0.5] };
    expect(() => l1Distance(a, b)).toThrow();
    const c = { version: "2026-S0", vector: [0.1, 0.2, 0.3, 0.4, 1.0] };
    expect(l1Distance(a, c)).toBeCloseTo(0.5, 9);
  });

  describe("DB: released 정규화기 UPDATE 거부", () => {
    const DB_URL = "postgres://tastefit_app:tastefit_app@127.0.0.1:54322/tastefit_m3acc";
    const ENV = {
      DATABASE_URL_DIRECT: DB_URL,
      DATABASE_URL_POOLED: DB_URL,
      STACK_PROFILE: "native",
    };
    let db: DbPort;
    beforeAll(async () => {
      const up = await run("pnpm", ["-s", "db:native", "up"], ROOT);
      expect(up.code, up.out).toBe(0);
      const r = await run("pnpm", ["-s", "db:reset"], ROOT, ENV);
      expect(r.code, r.out).toBe(0);
      db = createDbPort(DB_URL);
    }, 300_000);
    afterAll(async () => {
      await db?.close();
    });

    it("released 행 UPDATE는 service role에서도 실패, draft 행 UPDATE는 성공", async () => {
      await db.withService(async (tx) => {
        await q(
          tx,
          "insert into normalizers(version, status, body, corpus_hash, released_at) values ('2026-S1','released','{}'::jsonb,'x', now()), ('2026-S2','draft','{}'::jsonb,'y', null)",
        );
      });
      await expect(
        db.withService((tx) =>
          q(tx, "update normalizers set corpus_hash = 'z' where version = '2026-S1'"),
        ),
      ).rejects.toThrow();
      await expect(
        db.withService((tx) =>
          q(tx, "update normalizers set corpus_hash = 'z' where version = '2026-S2'"),
        ),
      ).resolves.toBeDefined();
    });
  });
});
