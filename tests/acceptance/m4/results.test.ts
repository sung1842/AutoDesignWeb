// M4 수용 테스트(7/7): 결과·재생·이벤트 일치·품질 감시·정적 검사(02장 AC-02-05·17·18·23·26·27·28·31,
// 01장 AC-01-09·57(서버·정적 부분), 05장 AC-05-10(API)). 호출 방식은 ASM-095.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { getThresholds } from "../../../packages/config/src/index.js";
import { createDbPort, q, type DbPort } from "../../../packages/db/src/index.js";
import { seedSimilarSites, seedSurveyFixture } from "../../../packages/db/src/testing/fixtures.js";
import { ResultViewSchema } from "../../../packages/api-contract/src/index.js";
import { loadDesignData } from "../../../packages/design-spec/src/index.js";
import { mapL1toL2 } from "../../../packages/taxonomy/src/index.js";
import { handle } from "../../../apps/web/src/server/api.js";
import { refreshPairStats, replayProfile } from "../../../apps/web/src/server/survey.js";
import { ROOT, run } from "../_support/sh.js";

const DB_URL = "postgres://tastefit_app:tastefit_app@127.0.0.1:54322/tastefit_m4results";
const ENV = { DATABASE_URL_DIRECT: DB_URL, DATABASE_URL_POOLED: DB_URL, STACK_PROFILE: "native" };
const ORIGIN = "http://localhost:3000";
const TH = getThresholds() as unknown as {
  diagnosis: { similarSites: { maxScore: number; tau: number } };
};
const TYPES = (
  JSON.parse(readFileSync(join(ROOT, "data/taxonomy/types.json"), "utf8")) as {
    items: { id: string; nameKo: string; descriptionKo: string }[];
  }
).items;
let db: DbPort;

type View = {
  id: string;
  status: string;
  question: { seq: number; itemKey: string; kind: string; items: string[] } | null;
};
async function call(method: string, path: string, body?: unknown, cookie?: string | null) {
  const h = new Headers({ origin: ORIGIN });
  if (body !== undefined) h.set("content-type", "application/json");
  if (cookie) h.set("cookie", cookie);
  const res = await handle(
    new Request(`${ORIGIN}${path}`, {
      method,
      headers: h,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    }),
    { db, webOrigin: ORIGIN },
  );
  const sc = res.headers.get("set-cookie");
  const m = sc ? /anon_id=([^;]+)/.exec(sc) : null;
  const text = await res.text();
  return {
    status: res.status,
    body: (text ? JSON.parse(text) : {}) as Record<string, unknown>,
    text,
    cookie: m ? `anon_id=${m[1]}` : (cookie ?? null),
  };
}
const ans = (v: View, pick: number, answer = "option") => ({
  seq: v.question!.seq,
  itemKey: v.question!.itemKey,
  shownItemIds: v.question!.items,
  answer,
  ...(answer === "option"
    ? { chosenItemId: v.question!.items[pick % v.question!.items.length] }
    : {}),
  latencyMs: 1400,
  clientTs: new Date().toISOString(),
});
const rows = async (sql: string, p: unknown[] = []) =>
  (await db.withService((tx) => q(tx, sql, p))).rows;
/** 끝까지 응답한다. picks[i]번째 선택지, cantTellAt에 해당하는 seq는 cant_tell(A/B만). */
async function complete(o: { cantTell?: boolean } = {}) {
  const a = await call("POST", "/api/surveys", { entry: "direct" });
  let v = a.body as unknown as View;
  let n = 0;
  while (v.question) {
    const kind = o.cantTell && v.question.kind === "ab" && n % 2 === 0 ? "cant_tell" : "option";
    v = (await call("POST", `/api/surveys/${v.id}/responses`, ans(v, n, kind), a.cookie))
      .body as unknown as View;
    n++;
  }
  return { id: v.id, cookie: a.cookie };
}

beforeAll(async () => {
  const up = await run("pnpm", ["-s", "db:native", "up"], ROOT);
  expect(up.code, up.out).toBe(0);
  const r = await run("pnpm", ["-s", "db:reset"], ROOT, ENV);
  expect(r.code, r.out).toBe(0);
  const s = await run("pnpm", ["-s", "db:seed"], ROOT, ENV);
  expect(s.code, s.out).toBe(0);
  db = createDbPort(DB_URL);
  await seedSurveyFixture(db);
  await seedSimilarSites(db);
});
afterAll(async () => {
  await db?.close();
});

describe("AC-02-05 카드 L2는 mapL1toL2만, 100회 동일", () => {
  it("AC-02-05 survey:build 카드 경로에 범주형 평균 코드 0, 같은 입력 L2 100회 동일", () => {
    const src = readFileSync(join(ROOT, "scripts/survey/build.ts"), "utf8");
    expect(src).toContain("mapL1toL2(");
    expect(src).not.toMatch(/\b(mean|average|avg)\s*\(/i);
    const data = loadDesignData(ROOT);
    const items = <T>(rel: string): T[] =>
      (JSON.parse(readFileSync(join(ROOT, rel), "utf8")) as { items: T[] }).items;
    const map = {
      taxonomy: items("data/taxonomy/taxonomy.json"),
      mapping: items("data/taxonomy/mapping.json"),
      pairings: items("data/fonts/pairings.json"),
      palettes: items("data/taxonomy/palettes.json"),
    };
    const preset = data.presets.find((p) => p.typeId === "T7")!;
    const sv09 = [0.15, 0.4, 0.65, 0.85, 0.8];
    const first = JSON.stringify(mapL1toL2(sv09 as never, preset as never, map as never));
    for (const i of Array.from({ length: 100 }, (_, k) => k))
      expect(
        JSON.stringify(mapL1toL2(sv09 as never, preset as never, map as never)),
        String(i),
      ).toBe(first);
  });
});

describe("AC-02-17 · AC-02-31 응답 저장·이벤트 일치", () => {
  it("AC-02-17 같은 (session_id, question_id) 중복 제출은 1행", async () => {
    const a = await call("POST", "/api/surveys", { entry: "direct" });
    const v = a.body as unknown as View;
    const body = ans(v, 0);
    await Promise.all(
      Array.from({ length: 10 }, () =>
        call("POST", `/api/surveys/${v.id}/responses`, body, a.cookie),
      ),
    );
    const r = await rows("select question_id from survey_answers where session_id = $1", [v.id]);
    expect(r).toHaveLength(1);
  });
  it("AC-02-31 survey_answer 이벤트 answer 값 집합 = survey_answers, sigma_max_after = 응답 후 max σ, chosen_position = slot", async () => {
    const s = await complete({ cantTell: true });
    const db1 = await rows(
      "select seq, answer, chosen_option_id, shown from survey_answers where session_id = $1 and not superseded order by seq",
      [s.id],
    );
    const ev = await rows(
      "select props from events where name = 'survey_answer' and props->>'survey_session_id' = $1",
      [s.id],
    );
    const props = ev.map((e) => e.props as Record<string, unknown>);
    expect(new Set(props.map((p) => p.answer))).toEqual(new Set(db1.map((r) => r.answer)));
    for (const r of db1) {
      const p = props.find((x) => x.seq === r.seq)!;
      const shown = r.shown as { option_id: string; slot: number }[];
      expect(p.chosen_position).toBe(
        r.chosen_option_id ? shown.find((x) => x.option_id === r.chosen_option_id)!.slot : null,
      );
    }
    const last = props.find((p) => p.seq === db1.at(-1)?.seq)!;
    const prof = (
      await rows("select profile from diagnosis_results where session_id = $1", [s.id])
    )[0]?.profile as { var: number[] };
    expect(last.sigma_max_after).toBeCloseTo(Math.sqrt(Math.max(...prof.var)), 5);
  });
});

describe("AC-02-18 재생 = 저장 프로필", () => {
  it("AC-02-18 완료 세션 응답 로그 재생 결과(μ·σ·type·second·κ)가 저장값과 소수 6자리 동일", async () => {
    for (const k of ["a", "b", "c"]) {
      const s = await complete({ cantTell: k === "b" });
      const stored = (
        await rows("select profile from diagnosis_results where session_id = $1", [s.id])
      )[0]?.profile as Record<string, unknown>;
      const re = await db.withService((tx) => replayProfile(tx, s.id));
      for (const f of ["mu", "var", "typeId", "secondTypeId", "kappa"] as const)
        expect(JSON.stringify((re as Record<string, unknown>)[f]), `${k} ${f}`).toBe(
          JSON.stringify(stored[f]),
        );
    }
  });
});

describe("AC-02-23 진단 중 LLM·렌더·추출 호출 0", () => {
  it("AC-02-23 진단 서버 경로 import 그래프에 llm·renderer·extractor·worker·playwright 0", () => {
    const seen = new Set<string>();
    const bad: string[] = [];
    const walk = (f: string): void => {
      if (seen.has(f)) return;
      seen.add(f);
      const src = readFileSync(f, "utf8");
      for (const m of src.matchAll(/from\s+"([^"]+)"/g)) {
        const spec = m[1] ?? "";
        if (/@tastefit\/(llm|renderer|extractor|pipeline)|playwright|apps\/worker/.test(spec))
          bad.push(`${f}: ${spec}`);
        if (spec.startsWith(".")) {
          const base = join(f, "..", spec).replace(/\.js$/, "");
          for (const c of [`${base}.ts`, `${base}.tsx`, join(base, "index.ts")])
            if (statOk(c)) walk(c);
        }
      }
    };
    const statOk = (p: string): boolean => {
      try {
        return statSync(p).isFile();
      } catch {
        return false;
      }
    };
    walk(join(ROOT, "apps/web/src/server/api.ts"));
    expect(seen.size).toBeGreaterThan(1);
    expect(bad).toEqual([]);
    const diag = readFileSync(join(ROOT, "packages/diagnosis/package.json"), "utf8");
    expect(diag).not.toMatch(/@tastefit\/(llm|renderer|extractor)/);
  });
});

describe("AC-02-26 · AC-02-27 · AC-05-10 결과 내용", () => {
  let res: ReturnType<typeof ResultViewSchema.parse>;
  let text = "";
  beforeAll(async () => {
    const s = await complete();
    const r = await call("GET", `/api/surveys/${s.id}/result`, undefined, s.cookie);
    res = ResultViewSchema.parse(r.body);
    text = r.text;
  });
  it("AC-02-26 닮은 사이트는 후보 뷰에서만·도메인 중복 0·s ≤ maxScore·matchAxes 2개", async () => {
    expect(res.similarSites.length).toBeGreaterThan(0);
    const view = await rows("select domain, l1 from similar_site_candidates");
    const byDomain = new Map(view.map((v) => [String(v.domain), v.l1 as Record<string, number>]));
    expect(new Set(res.similarSites.map((x) => x.domain)).size).toBe(res.similarSites.length);
    const S = TH.diagnosis.similarSites;
    const w0 = res.axes.map((a) => 1 / (a.sigmaDisplay ** 2 + S.tau ** 2));
    const w = w0.map((x) => x / w0.reduce((p, c) => p + c, 0));
    for (const site of res.similarSites) {
      const l1 = byDomain.get(site.domain);
      expect(l1, site.domain).toBeDefined();
      const sc = Math.sqrt(
        res.axes.reduce((acc, a, k) => acc + (w[k] ?? 0) * ((l1![a.key] ?? 0) - a.mu) ** 2, 0),
      );
      expect(sc).toBeLessThanOrEqual(S.maxScore);
      expect(site.matchAxes).toHaveLength(2);
    }
  });
  it("AC-02-27 결과 유형 텍스트 = types.json 바이트 동일, MBTI 0", () => {
    for (const t of [res.type, ...res.adjacentTypes]) {
      const src = TYPES.find((x) => x.id === t.id)!;
      expect(t.nameKo).toBe(src.nameKo);
      expect(t.descriptionKo).toBe(src.descriptionKo);
    }
    expect(text).not.toContain("MBTI");
  });
  it("AC-05-10 결과·설문 API 응답 본문에 ref-screenshots 경로 0", async () => {
    expect(text).not.toContain("ref-screenshots");
    const items = await call("GET", "/api/survey-items");
    expect(items.text).not.toContain("ref-screenshots");
  });
});

describe("AC-02-28 A/B 품질 감시", () => {
  it("AC-02-28 노출 ≥ 30·cant_tell > 30% 쌍은 이후 세션 문항에서 제외", async () => {
    // 한 쌍(X)에만 노출 30·cant_tell 10(33%)을 만든다: 세션 3개 × 응답 10행
    const X = "ABP-T1-A1-2050";
    await db.withService(async (tx) => {
      for (const s of [0, 1, 2]) {
        const sid = String(
          (
            await q(
              tx,
              `insert into diagnosis_sessions (anon_id, taxonomy_version, seed, status, entry, versions)
               values (gen_random_uuid(), '2026-S4', 1, 'abandoned', 'direct', '{}') returning id`,
            )
          ).rows[0]?.id,
        );
        for (const k of Array.from({ length: 10 }, (_, i) => i + 1))
          await q(
            tx,
            `insert into survey_answers (session_id, seq, question_id, stage, kind, item_id, shown, answer, chosen_option_id,
               latency_ms, policy, propensity, client_ts)
             values ($1, $2, $3, 2, 'ab', $4, '[{"option_id":"AB-T1-A1-20","slot":0},{"option_id":"AB-T1-A1-50","slot":1}]',
               $5, $6, 1000, 'ab_fisher', 1, now())`,
            [
              sid,
              k,
              `q-${sid}-${k}-0`,
              X,
              k <= 3 + (s === 0 ? 1 : 0) ? "cant_tell" : "option",
              k <= 3 + (s === 0 ? 1 : 0) ? null : "AB-T1-A1-20",
            ],
          );
      }
    });
    await db.withService((tx) => refreshPairStats(tx, "2026-S4"));
    const st = (await rows("select stats from survey_items where id = $1", [X]))[0]
      ?.stats as Record<string, unknown>;
    expect(st.flag).toBe("low_discrimination");
    const shown = new Set<string>();
    for (const k of Array.from({ length: 15 }, (_, i) => i)) {
      const a = await call("POST", "/api/surveys", { entry: "direct" });
      let v = a.body as unknown as View;
      while (v.question) {
        if (v.question.kind === "ab") shown.add(v.question.itemKey);
        v = (await call("POST", `/api/surveys/${v.id}/responses`, ans(v, k), a.cookie))
          .body as unknown as View;
      }
    }
    expect(shown.size).toBeGreaterThan(0);
    expect(shown.has(X)).toBe(false);
  });
});

describe("AC-01-57 · AC-01-09 안내·계약(서버·정적)", () => {
  it("AC-01-57 apps/web 화면 코드에 sigma·kappa 임계 비교 0, S03 문구 키는 copy/ko.ts에 1벌", () => {
    const dir = join(ROOT, "apps/web/src/app");
    const files: string[] = [];
    const walk = (d: string): void => {
      for (const n of readdirSync(d)) {
        const p = join(d, n);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.tsx?$/.test(n)) files.push(p);
      }
    };
    walk(dir);
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      expect(src, f).not.toMatch(/\b(sigma|kappa|sigmaDisplay)\s*[<>]=?/);
    }
    const ko = readFileSync(join(ROOT, "apps/web/src/copy/ko.ts"), "utf8");
    for (const k of [
      "result.notice.lowSignal",
      "result.notice.conflict",
      "result.notice.lowConsistency",
      "result.notice.boundary",
    ])
      expect(ko.split(`"${k}"`).length - 1, k).toBe(1);
  });
  it("AC-01-09 응답 계약: option이면 chosenItemId ∈ shownItemIds, 아니면 400", async () => {
    const a = await call("POST", "/api/surveys", { entry: "direct" });
    const v = a.body as unknown as View;
    const bad = { ...ans(v, 0), chosenItemId: "NOT-SHOWN" };
    expect((await call("POST", `/api/surveys/${v.id}/responses`, bad, a.cookie)).status).toBe(400);
    const noLatency = { ...ans(v, 0) } as Record<string, unknown>;
    delete noLatency.latencyMs;
    expect((await call("POST", `/api/surveys/${v.id}/responses`, noLatency, a.cookie)).status).toBe(
      400,
    );
    const ok = await call("POST", `/api/surveys/${v.id}/responses`, ans(v, 0), a.cookie);
    expect(ok.status).toBe(200);
  });
});
