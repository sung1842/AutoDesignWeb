// M5 수용 테스트(8): MockProvider 시나리오 전체(09장 9.6.2) × 07장 7.4.3 TC-R 기대, 비용·시간 시나리오(06장 6.9.4 ⑦).
// AC-00-14, AC-04-22·37, AC-06-07b·21·39·40·61, AC-07-02, AC-09-07.
// 시나리오마다 잡을 1회만 돌려(ran 캐시) 여러 AC가 같은 결과를 본다. slow·timeout은 실제 시계(120s SLO)라 각 ≈ 135s.
// 계약: ASSUMPTIONS ASM-109(파이프라인)·ASM-111(A11 = generation_jobs.warnings)·ASM-114(이 파일).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { openPipe, r15, type Jar, type Pipe, type Row } from "../_support/pipe.js";

/** 06장 6.9.4 잡 상한 기본값(JOB_COST_CAP_USD 미설정). */
const CAP_EFF = 0.3;
/** AC-06-61 비용 일치 허용 오차. */
const COST_EPS = 0.00001;
/** AC-06-40 SLO 진입 시각(초)·허용 오차·종료 상한. */
const SLO_S = 120;
const SLO_TOL_S = 2;
const SLO_END_S = 135;
/** TC-R-03 Mock Retry-After(ms, 9.6.2 rate_limit). */
const RETRY_AFTER_MS = 1000;
/** AC-06-61 ④ 지연·두 물결 간격·허용 오차(ms, U-01·V-01). */
const SLOW_T1_MS = 4000;
const WAVE_GAP_MS = 3000;
const WAVE_TOL_MS = 50;
/** TC-R-17 가짜 시계: 첫 판독 뒤 61초 앞으로(잡 경과 > 60초). */
const COPY_TIMEOUT_JUMP_MS = 61_000;

/** 09장 9.6.2 표의 시나리오 전부(+ TC-R-07 조합은 timeout = 1차·폴백 모두). budget_exhausted는 요청 단계에서 따로 본다. */
const SCENARIOS = [
  "ok",
  "mixed",
  "invalid_json",
  "schema_violation",
  "forbidden_field",
  "lint_error",
  "low_score@*",
  "timeout",
  "slow",
  "rate_limit",
  "server_error",
  "injection_echo",
  "cost_spike",
  "cost_ramp",
  "usage_overrun",
  "copy_schema_fail@gen_copy",
  "copy_timeout@gen_copy",
  "copy_refusal@gen_copy",
  "judge_position_bias@judge_vision",
];

let P: Pipe;
type Ran = {
  jobId: string;
  row: Row;
  view: Row;
  jar: Jar;
  calls: Row[];
  mockups: Row[];
  stderr: string[];
};
const ran = new Map<string, Ran>();
const num = (v: unknown) => Number(v ?? 0);
const ms = (v: unknown) => new Date(String(v)).getTime();

/** 시나리오 잡을 1회 실행하고(캐시) 호출·노출·미처리 예외 로그를 모은다. */
async function scenario(name: string, o: { now?: () => Date } = {}): Promise<Ran> {
  const hit = ran.get(name);
  if (hit) return hit;
  const stderr: string[] = [];
  const orig = process.stderr.write.bind(process.stderr);
  process.stderr.write = ((chunk: string | Uint8Array, ...rest: unknown[]) => {
    stderr.push(String(chunk));
    return (orig as (c: string | Uint8Array, ...r: unknown[]) => boolean)(chunk, ...rest);
  }) as typeof process.stderr.write;
  try {
    const j = await P.job(name, o);
    const r: Ran = {
      jobId: j.jobId,
      row: j.row,
      view: j.view,
      jar: j.jar,
      calls: await P.calls(j.jobId),
      mockups: await P.mockups(j.jobId),
      stderr: stderr.filter((l) => l.includes("[generation]")),
    };
    ran.set(name, r);
    return r;
  } finally {
    process.stderr.write = orig;
  }
}
const ledger = (jobId: string) =>
  P.rows("select kind from quota_ledger where job_id = $1 order by kind", [jobId]);
const sumCost = (c: Row[]) => c.reduce((a, x) => a + num(x.cost_usd), 0);

/** 07장 7.4.3 공통 기대: 시안 ≥1 또는 재시도 화면(명시 오류 코드), 무한 로딩 0, 미처리 예외 0, R-15 일치. */
function commonOk(name: string, r: Ran): void {
  const st = String(r.row.status);
  expect(["succeeded", "partial", "fallback", "failed"], name).toContain(st);
  expect(r.row.finished_at, `${name} 종료 시각`).toBeTruthy();
  expect(r.stderr, `${name} 미처리 예외`).toEqual([]);
  if (st === "failed") expect(String(r.row.error_code ?? ""), name).not.toBe("");
  else expect(r.mockups.length, name).toBeGreaterThanOrEqual(1);
  if (r.row.error_code !== "BLOCKED_BRAND") {
    const want = r15(num(r.row.n_real), num(r.row.n_fallback));
    expect(st, name).toBe(
      r.row.copy_source === "template" && want === "succeeded" ? "partial" : want,
    );
  }
  const v = r.view as { status?: string; mockups?: unknown[]; error?: { code?: string } };
  expect(v.status, `${name} GenerationView`).toBe(st);
}

/** 07장 7.4.3 TC-R 시나리오별 추가 기대(AC-09-07: 최종 상태·노출 수·llm_calls). */
const TCR: Record<string, (r: Ran) => void> = {
  ok: (r) => {
    expect(r.row.status).toBe("succeeded");
    expect(r.mockups.filter((m) => m.is_fallback === false)).toHaveLength(3);
  },
  mixed: (r) => {
    expect(r.calls.filter((c) => c.call_kind === "diversity")).toHaveLength(1);
    expect(
      r.calls.filter((c) => c.call_kind === "repair_quality" && c.role === "gen_layout"),
    ).toHaveLength(1);
  },
  invalid_json: (r) => {
    expect(r.calls.some((c) => c.call_kind === "repair_schema")).toBe(true);
    expect(r.row.status).not.toBe("failed");
  },
  schema_violation: (r) => {
    expect(r.calls.some((c) => c.call_kind === "repair_schema")).toBe(true);
    expect(r.row.status).not.toBe("failed");
  },
  forbidden_field: (r) => {
    // TC-S-02: style·className·<script>는 스키마 단계에서 거부되어 노출 트리에 없다
    const t = JSON.stringify(r.mockups.map((m) => m.layout_tree));
    expect(t).not.toMatch(/"style"|"className"|<script/i);
  },
  lint_error: (r) => {
    expect(r.row.status).toBe("fallback");
    expect(r.mockups.every((m) => m.is_fallback === true)).toBe(true);
  },
  "low_score@*": (r) => {
    expect(r.row.status).toBe("fallback");
    expect(r.mockups.every((m) => m.is_fallback === true)).toBe(true);
  },
  timeout: (r) => {
    // TC-R-07: 1차·폴백 모델 모두 타임아웃 → 결정론 폴백 ≥ 1, status=fallback
    expect(r.calls.some((c) => c.status === "timeout")).toBe(true);
    expect(r.row.status).toBe("fallback");
    expect(r.mockups.filter((m) => m.is_fallback === true).length).toBeGreaterThanOrEqual(1);
  },
  slow: (r) => {
    expect(["partial", "fallback"]).toContain(r.row.status);
    expect(r.calls.some((c) => c.status === "aborted")).toBe(true);
  },
  rate_limit: (r) => {
    // TC-R-03: 429 뒤 Retry-After 이상 기다려 재시도(attempt 2)
    const rl = r.calls.filter((c) => c.status === "rate_limited");
    expect(rl.length).toBeGreaterThanOrEqual(1);
    for (const a of rl) {
      const retry = r.calls.find(
        (c) =>
          c.candidate_id === a.candidate_id &&
          c.role === a.role &&
          c.call_kind === a.call_kind &&
          num(c.attempt) === num(a.attempt) + 1,
      );
      expect(retry, "재시도 행").toBeTruthy();
      expect(ms(retry?.started_at) - ms(a.started_at)).toBeGreaterThanOrEqual(RETRY_AFTER_MS);
    }
  },
  server_error: (r) => {
    // TC-R-02: 연속 2회 500이면 폴백 모델 전환
    expect(r.calls.filter((c) => c.status === "provider_error").length).toBeGreaterThanOrEqual(2);
    expect(r.calls.some((c) => c.is_fallback === true)).toBe(true);
  },
  injection_echo: (r) => {
    const t = JSON.stringify([r.mockups.map((m) => m.layout_tree), r.row.copy_deck ?? {}]);
    expect(t).not.toContain("evil.example");
  },
  cost_spike: (r) => {
    expect(r.calls.some((c) => c.status === "budget_skipped" && c.error_code === "COST_CAP")).toBe(
      true,
    );
    expect(sumCost(r.calls)).toBeLessThanOrEqual(CAP_EFF);
    expect(["partial", "fallback"]).toContain(r.row.status);
  },
  cost_ramp: (r) => expect(r.row.status).toBe("partial"),
  usage_overrun: (r) => expect(r.row.status).toBe("succeeded"),
  "copy_schema_fail@gen_copy": (r) => {
    expect(r.row.copy_source).toBe("template");
    expect(r.row.status).not.toBe("succeeded");
  },
  "copy_timeout@gen_copy": (r) => {
    expect(r.row.copy_source).toBe("template");
    expect(r.calls.filter((c) => c.role === "gen_copy" && c.is_fallback === true)).toHaveLength(0);
  },
  "copy_refusal@gen_copy": (r) => {
    expect(r.row.status).toBe("failed");
    expect(r.row.error_code).toBe("BLOCKED_BRAND");
  },
  "judge_position_bias@judge_vision": (r) => expect(r.row.status).not.toBe("failed"),
};

/** TC-R-17 가짜 시계: 첫 판독은 실제 시각, 이후는 61초 앞. */
function jumpClock(): () => Date {
  let first = true;
  return () => {
    const t = Date.now() + (first ? 0 : COPY_TIMEOUT_JUMP_MS);
    first = false;
    return new Date(t);
  };
}
const opts = (name: string) => (name === "copy_timeout@gen_copy" ? { now: jumpClock() } : {});

beforeAll(async () => {
  P = await openPipe("tastefit_m5scen");
});
afterAll(async () => {
  await P?.close();
});

describe("비용 시나리오(06장 6.9.4 ⑦)", () => {
  it("AC-00-14 · AC-06-21 · AC-04-37 ① cost_spike: 넘는 호출 budget_skipped(COST_CAP) ≥ 1, 잡 비용 ≤ capEff, partial|fallback, DB 예외·WORKER_LOST 0", async () => {
    const r = await scenario("cost_spike");
    const skipped = r.calls.filter((c) => c.status === "budget_skipped");
    expect(skipped.length).toBeGreaterThanOrEqual(1);
    expect(skipped.every((c) => c.error_code === "COST_CAP")).toBe(true);
    expect(skipped.every((c) => num(c.cost_usd) === 0)).toBe(true);
    expect(sumCost(r.calls)).toBeLessThanOrEqual(CAP_EFF);
    expect(num(r.row.cost_usd)).toBeLessThanOrEqual(CAP_EFF);
    expect(["partial", "fallback"]).toContain(r.row.status);
    expect(r.row.error_code).not.toBe("WORKER_LOST");
    expect(r.stderr).toEqual([]);
  });
  it("AC-06-61 · AC-04-37 ② cost_ramp: budget_skipped 순서 judge_vision 6 → repair_quality 1, 그 사이 repair_quality ok 1, partial, 합계 ≤ capEff", async () => {
    const r = await scenario("cost_ramp");
    const seq = r.calls.filter(
      (c) =>
        c.status === "budget_skipped" ||
        (c.call_kind === "repair_quality" && c.role === "gen_layout"),
    );
    const sig = seq.map((c) => `${String(c.role)}:${String(c.call_kind)}:${String(c.status)}`);
    expect(sig).toEqual([
      ...Array<string>(6).fill("judge_vision:initial:budget_skipped"),
      "gen_layout:repair_quality:ok",
      "gen_layout:repair_quality:budget_skipped",
    ]);
    expect(seq.slice(0, 6).every((c) => c.error_code === "SKIP_VISION")).toBe(true);
    expect(seq[7]?.error_code).toBe("SKIP_REPAIR");
    expect(r.row.status).toBe("partial");
    expect(sumCost(r.calls)).toBeLessThanOrEqual(CAP_EFF);
  });
  it("AC-06-61 · AC-06-07b usage_overrun: A11 정확히 1, 초과 이후 출발한 ok 0, 출발 = 카피 1 + 레이아웃 후보 0~4, cost_usd = Σ, 합계 ≤ capEff×3, succeeded", async () => {
    const r = await scenario("usage_overrun");
    const warn = (r.row.warnings as string[] | null) ?? [];
    expect(warn.filter((w) => w === "A11")).toHaveLength(1);
    expect(Math.abs(num(r.row.cost_usd) - sumCost(r.calls))).toBeLessThanOrEqual(COST_EPS);
    expect(sumCost(r.calls)).toBeLessThanOrEqual(CAP_EFF * 3);
    const cands = await P.cands(r.jobId);
    const slotOf = (id: unknown) => cands.find((c) => c.id === id)?.slot;
    const started = r.calls.filter((c) => c.status !== "budget_skipped");
    expect(started.filter((c) => c.role === "gen_copy")).toHaveLength(1);
    expect(
      started
        .filter((c) => c.role === "gen_layout")
        .map((c) => slotOf(c.candidate_id))
        .sort(),
    ).toEqual([0, 1, 2, 3, 4]);
    expect(started.filter((c) => c.role !== "gen_copy" && c.role !== "gen_layout")).toHaveLength(0);
    // 초과 확정(누적 > capEff) 이후 출발한 ok 호출 0(AC-06-07b: 그 잡의 이후 reserve 전부 실패)
    let acc = 0;
    let overAt = Number.POSITIVE_INFINITY;
    for (const c of [...started].sort((a, b) => ms(a.started_at) - ms(b.started_at))) {
      acc += num(c.cost_usd);
      if (acc > CAP_EFF) {
        overAt = Math.min(overAt, ms(c.started_at));
        break;
      }
    }
    const later = r.calls.filter(
      (c) => c.status === "ok" && ms(c.started_at) > overAt && c.role === "judge_vision",
    );
    expect(later).toHaveLength(0);
    expect(
      r.calls.filter((c) => c.role === "judge_vision").every((c) => c.status === "budget_skipped"),
    ).toBe(true);
    expect(r.row.status).toBe("succeeded");
    expect(r.mockups.filter((m) => m.is_fallback === false)).toHaveLength(3);
    expect(r.stderr).toEqual([]);
  });
  it("AC-06-61 usage_overrun 같은 시드 2회: 거부 호출 집합 동일", async () => {
    const a = await scenario("usage_overrun");
    const seed = num(a.row.job_seed);
    const b = await P.job("usage_overrun", { seed });
    const cands = async (id: string) => P.cands(id);
    const key = async (id: string) => {
      const cs = await cands(id);
      return (await P.calls(id))
        .filter((c) => c.status === "budget_skipped")
        .map(
          (c) =>
            `${String(c.role)}:${String(c.call_kind)}:${String(cs.find((x) => x.id === c.candidate_id)?.slot ?? "-")}`,
        )
        .sort();
    };
    expect(await key(b.jobId)).toEqual(await key(a.jobId));
  });
  it("AC-06-61 ④ MOCK_LLM_LATENCY_MS=4000 ok: budget_skipped 0, 후보 1~5 gen_layout started_at = 후보 0 + 3s ± 50ms", async () => {
    const prev = process.env.MOCK_LLM_LATENCY_MS;
    process.env.MOCK_LLM_LATENCY_MS = String(SLOW_T1_MS);
    try {
      const j = await P.job("ok");
      const cs = await P.cands(j.jobId);
      const slotOf = (id: unknown) => cs.find((c) => c.id === id)?.slot;
      const c = await P.calls(j.jobId);
      expect(c.filter((x) => x.status === "budget_skipped")).toHaveLength(0);
      const init = c.filter((x) => x.role === "gen_layout" && x.call_kind === "initial");
      const t0 = ms(init.find((x) => slotOf(x.candidate_id) === 0)?.started_at);
      const rest = init.filter((x) => slotOf(x.candidate_id) !== 0);
      expect(rest).toHaveLength(5);
      for (const x of rest)
        expect(Math.abs(ms(x.started_at) - t0 - WAVE_GAP_MS)).toBeLessThanOrEqual(WAVE_TOL_MS);
    } finally {
      if (prev === undefined) delete process.env.MOCK_LLM_LATENCY_MS;
      else process.env.MOCK_LLM_LATENCY_MS = prev;
    }
  });
  it("AC-04-37 ③ 일일 예산 초과 상태에서 신규 생성 요청 → 503 GEN_BUDGET_EXCEEDED(TC-C-01 budget_exhausted)", async () => {
    const u = await P.user();
    const p = await P.call(u.jar, "POST", "/api/projects", {
      resultId: u.resultId,
      purpose: "local_business",
      brand: {
        name: "한결 공방",
        description: "손으로 만드는 가죽 소품 공방",
        primaryAction: "contact",
      },
      useSampleContent: false,
    });
    expect(p.status).toBe(201);
    await P.rows(
      "insert into feature_flags (key, value) values ('GEN_DAILY_BUDGET_USD', '0.01') on conflict (key) do update set value = excluded.value, updated_at = now()",
      [],
    );
    try {
      await P.rows(
        `insert into llm_calls (job_id, owner_id, role, call_kind, purpose, processor_id, model, prompt_id, prompt_version, prompt_sha256, mode, cost_usd, status, request_hash)
         select id, owner_id, 'gen_layout', 'initial', 'user_job', 'mock', 'mock-page', 'gen_layout', 1, '', 'mock', 0.02, 'ok', 'h' from generation_jobs limit 1`,
        [],
      );
      const g = await P.call(
        u.jar,
        "POST",
        `/api/projects/${String(p.body.projectId)}/generations`,
        { kind: "initial" },
        { "idempotency-key": `k_${randomUUID()}`, "x-mock-scenario": "budget_exhausted" },
      );
      const err = g.body.error as { code?: string } | undefined;
      expect([g.status, err?.code]).toEqual([503, "GEN_BUDGET_EXCEEDED"]);
    } finally {
      await P.rows("delete from feature_flags where key = 'GEN_DAILY_BUDGET_USD'", []);
    }
  });
});

describe("점수 미달·시간(06장 6.9.4·6.10)", () => {
  it("AC-06-39 low_score@*: fallback, quota_ledger reserve·refund 각 1행, /api/me 일 사용량 변화 0", async () => {
    const r = await scenario("low_score@*");
    expect(r.row.status).toBe("fallback");
    expect((await ledger(r.jobId)).map((x) => x.kind)).toEqual(["refund", "reserve"]);
    // 잡 소유자는 이 잡 전 사용량 0(새 사용자) → 환불 뒤에도 0
    const me = (await P.call(r.jar, "GET", "/api/me")).body.quota as Record<string, number>;
    expect(me.dayUsed).toBe(0);
  });
  it("AC-06-40 slow: started_at + 120s ± 2s에 진행 중 호출 aborted, 노출 ≥ 1, finished_at − started_at ≤ 135s", async () => {
    const r = await scenario("slow");
    const t0 = ms(r.row.started_at);
    const aborted = r.calls.filter((c) => c.status === "aborted");
    expect(aborted.length).toBeGreaterThanOrEqual(1);
    // aborted 행의 종료 시각 = started_at + latency_ms
    const rows = await P.rows(
      "select started_at, latency_ms from llm_calls where job_id = $1 and status = 'aborted'",
      [r.jobId],
    );
    for (const a of rows) {
      const end = (ms(a.started_at) + num(a.latency_ms) - t0) / 1000;
      expect(end).toBeGreaterThanOrEqual(SLO_S - SLO_TOL_S);
      expect(end).toBeLessThanOrEqual(SLO_S + SLO_TOL_S);
    }
    expect(r.mockups.length).toBeGreaterThanOrEqual(1);
    expect((ms(r.row.finished_at) - t0) / 1000).toBeLessThanOrEqual(SLO_END_S);
  });
});

describe("장애 주입 8종(AC-04-22)", () => {
  // 타임아웃, 500, 429, 깨진 JSON, 스키마 위반 반복, 린터 error 반복, 1차·폴백 모두 다운(timeout 전 호출), 동시 요청 2건
  const FAULTS = [
    "timeout",
    "server_error",
    "rate_limit",
    "invalid_json",
    "schema_violation!",
    "lint_error!",
  ];
  it("AC-04-22 장애 6종(timeout·server_error·rate_limit·invalid_json·schema_violation!·lint_error!): 무한 대기 0, 미처리 예외 0, 시안 ≥ 1 또는 재시도 화면", async () => {
    for (const f of FAULTS) commonOk(f, await scenario(f));
  });
  it("AC-04-22 같은 사용자 동시 생성 요청 2건 → 1건만 접수, 2번째 409 JOB_IN_PROGRESS + details.jobId", async () => {
    const u = await P.user();
    const p = await P.call(u.jar, "POST", "/api/projects", {
      resultId: u.resultId,
      purpose: "local_business",
      brand: {
        name: "한결 공방",
        description: "손으로 만드는 가죽 소품 공방",
        primaryAction: "contact",
      },
      useSampleContent: false,
    });
    const path = `/api/projects/${String(p.body.projectId)}/generations`;
    const [a, b] = await Promise.all(
      [0, 1].map(() =>
        P.call(
          u.jar,
          "POST",
          path,
          { kind: "initial" },
          { "idempotency-key": `k_${randomUUID()}` },
        ),
      ),
    );
    const st = [a?.status, b?.status].sort();
    expect(st).toEqual([202, 409]);
    const won = a?.status === 202 ? a : b;
    const lost = a?.status === 409 ? a : b;
    const err = lost?.body.error as { code?: string; details?: { jobId?: string } } | undefined;
    expect(err?.code).toBe("JOB_IN_PROGRESS");
    expect(err?.details?.jobId).toBe(won?.body.jobId);
  });
});

describe("9.6.2 전 시나리오 × 7.4.3 TC-R(AC-07-02·AC-09-07)", () => {
  it("AC-07-02 전 시나리오(+TC-R-07 조합)에서 7.4.3 공통 기대 충족", async () => {
    for (const s of SCENARIOS) commonOk(s, await scenario(s, opts(s)));
  });
  it("AC-09-07 각 잡의 최종 상태·노출 수·llm_calls가 TC-R 기대와 일치, 모두 시안 ≥ 1 또는 명시 오류 코드", async () => {
    for (const s of SCENARIOS) {
      const r = await scenario(s, opts(s));
      expect(TCR[s], `TC-R 기대 정의 ${s}`).toBeTypeOf("function");
      TCR[s]?.(r);
      expect(r.mockups.length >= 1 || String(r.row.error_code ?? "") !== "", s).toBe(true);
      expect(r.calls.length, `${s} llm_calls 기록`).toBeGreaterThan(0);
    }
  });
});
