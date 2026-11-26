// M5 수용 테스트(3/7): LLM 게이트웨이·models.yaml·MockProvider(09장 9.6.1·9.6.2, 06장 6.9.2, 08장 8.8.4).
// AC-04-15(역할별 결정 응답 + 장애 주입), AC-08-38·39·40, AC-06-22, 9.6.2 계약 테스트(시나리오 파서·gen_layout 리터럴 0),
// AC-09-18 편향 심사기. 공급자 계층(MockProvider.complete)만 본다. 예산·llm_calls 행·재시도는 pipeline 테스트(e·f).
// 계약: ASSUMPTIONS ASM-107.
import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CopyDeckSchema, LayoutTreeRawSchema } from "../../../packages/layout-schema/src/index.js";
import {
  compileSpecs,
  loadDesignData,
  type TasteResult,
  type Vec5,
} from "../../../packages/design-spec/src/index.js";
import {
  LlmError,
  UnapprovedProcessorError,
  assertLiveReady,
  checkModelsCompliance,
  createMockProvider,
  loadModels,
  mockSeed,
  parseScenario,
  type MockCall,
} from "../../../packages/llm/src/index.js";
import { ROOT, run } from "../_support/sh.js";

const data = loadDesignData(ROOT);
const vec = (a: number[]): Vec5 => ({
  expression: a[0] ?? 0,
  temperature: a[1] ?? 0,
  shape: a[2] ?? 0,
  density: a[3] ?? 0,
  depth: a[4] ?? 0,
});
const taste: TasteResult = {
  mu: vec([0.3, 0.23, 0.12, 0.62, 0]),
  sigma: vec([0.08, 0.08, 0.08, 0.08, 0.08]),
  kappa: 0.8,
  insensitive_axes: [],
  type_id: "T2",
};
const BRAND = {
  name: "온결 베이커리",
  description: "망원동에서 매일 아침 굽는 사워도우 빵집",
  primaryAction: "reserve",
  keyPoints: ["매일 아침 굽는 빵", "천연 발효종"],
};
const PURPOSES = ["saas", "portfolio", "local_business"] as const;
/** 후보 인덱스 = variantIndex × 2 + slotIndex(9.6.2). */
const CANDIDATES = [0, 1, 2, 3, 4, 5] as const;
/** 05장 5.6.2 점수 값 집합. */
const SCORES = [1, 2, 3, 4, 5];
const specsFor = (purpose: (typeof PURPOSES)[number]) =>
  compileSpecs({ taste, purpose, brand: null, jobSeed: `m5-llm-${purpose}` }, data);

const never = new AbortController().signal;
function call(over: Partial<MockCall> & Pick<MockCall, "role" | "input">): MockCall {
  return { callKind: "initial", candidateIndex: 0, attempt: 1, signal: never, ...over };
}
/** 가짜 sleep: 지연 ms를 기록하고 바로 끝난다(abort면 거부). */
function fakeSleep() {
  const waits: number[] = [];
  const sleep = (ms: number, signal: AbortSignal): Promise<void> => {
    waits.push(ms);
    return signal.aborted ? Promise.reject(new Error("aborted")) : Promise.resolve();
  };
  return { waits, sleep };
}
async function copyDeck(purpose: (typeof PURPOSES)[number], scenario = "ok") {
  const p = createMockProvider({ scenario, latencyMs: 0, sleep: fakeSleep().sleep });
  const r = await p.complete(
    call({ role: "gen_copy", candidateIndex: null, input: { brand: BRAND, purpose } }),
  );
  if (r.kind !== "ok") throw new Error(`gen_copy ${r.kind}`);
  return JSON.parse(r.text) as unknown;
}
async function layout(
  purpose: (typeof PURPOSES)[number],
  candidateIndex: number,
  scenario = "ok",
  over: Partial<MockCall> = {},
) {
  const specs = specsFor(purpose);
  const variant = (["v_true", "v_fit", "v_bal"] as const)[Math.floor(candidateIndex / 2)]!;
  const deck = await copyDeck(purpose);
  const p = createMockProvider({ scenario, latencyMs: 0, sleep: fakeSleep().sleep });
  return p.complete(
    call({
      role: "gen_layout",
      candidateIndex,
      input: { spec: specs[variant], purpose, brand: BRAND, deck },
      ...over,
    }),
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("9.6.2 시나리오 키 파서(계약 테스트)", () => {
  it("세 형식(scenario·scenario@candidateIndex·scenario@role)과 ! 를 받는다", () => {
    expect(parseScenario("ok")).toEqual({ name: "ok", sticky: false, scope: { kind: "all" } });
    expect(parseScenario("low_score@*")).toEqual({
      name: "low_score",
      sticky: false,
      scope: { kind: "all" },
    });
    expect(parseScenario("schema_violation!@2")).toEqual({
      name: "schema_violation",
      sticky: true,
      scope: { kind: "candidate", index: 2 },
    });
    expect(parseScenario("copy_timeout@gen_copy")).toEqual({
      name: "copy_timeout",
      sticky: false,
      scope: { kind: "role", role: "gen_copy" },
    });
    // copy_schema_fail@gen_copy는 정의상 ! 동작
    expect(parseScenario("copy_schema_fail@gen_copy").sticky).toBe(true);
  });
  it("모르는 시나리오·범위 밖 후보·모르는 역할은 오류(E_MOCK_SCENARIO)", () => {
    for (const bad of ["nope", "ok@6", "ok@-1", "ok@gen_banana", "mixed!!", ""]) {
      expect(() => parseScenario(bad), bad).toThrow(LlmError);
      try {
        parseScenario(bad);
      } catch (e) {
        expect((e as LlmError).code, bad).toBe("E_MOCK_SCENARIO");
      }
    }
    expect(() => createMockProvider({ scenario: "nope" })).toThrow(LlmError);
  });
});

describe("06장 6.9.2 models.yaml · 08장 8.8", () => {
  it("역할 4개, 프롬프트 파일 존재, mock 단가 고정값(S-13), judge 계열 ≠ 생성 계열", () => {
    const m = loadModels();
    expect(Object.keys(m.roles).sort()).toEqual(
      ["gen_copy", "gen_layout", "judge_vision", "ref_tagger"].sort(),
    );
    for (const [role, r] of Object.entries(m.roles)) {
      const f = join(ROOT, "packages/llm/prompts", `${r.prompt.id}@v${r.prompt.version}.md`);
      expect(existsSync(f), `${role} ${f}`).toBe(true);
      expect(r.prompt.id).toBe(role);
    }
    expect(m.pricing["mock/mock-page"]).toMatchObject({
      input_per_mtok: 3,
      output_per_mtok: 15,
      cached_input_per_mtok: 0.3,
      cache_write_per_mtok: 3.75,
    });
    expect(m.pricing["mock/mock-vision"]).toMatchObject({
      input_per_mtok: 1,
      output_per_mtok: 5,
      cached_input_per_mtok: 0.1,
      cache_write_per_mtok: 1.25,
    });
    const fam = (role: keyof typeof m.roles) => m.roles[role].primary.family;
    expect(fam("judge_vision")).not.toBe(fam("gen_layout"));
    expect(fam("judge_vision")).not.toBe(fam("gen_copy"));
  });
  it("judge 계열이 생성 계열과 같으면 loadModels가 거부한다(4.10.5)", () => {
    const src = readFileSync(join(ROOT, "packages/llm/models.yaml"), "utf8");
    const dir = mkdtempSync(join(tmpdir(), "tf-models-"));
    const m = loadModels();
    const same = src.replace(
      new RegExp(`family: ${m.roles.judge_vision.primary.family}\\b`, "g"),
      `family: ${m.roles.gen_layout.primary.family}`,
    );
    writeFileSync(join(dir, "models.yaml"), same);
    expect(() => loadModels(join(dir, "models.yaml"))).toThrow(/family/);
  });
  it("AC-08-38 미등록·미승인 processor_id로 live 기동·호출 → UnapprovedProcessorError, 외부 요청 0", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const m = loadModels();
    const unknown = structuredClone(m);
    unknown.roles.gen_layout.primary.processor_id = "no-such-processor";
    expect(() => assertLiveReady(unknown, { today: "2026-11-27" })).toThrow(
      UnapprovedProcessorError,
    );
    // 현재 processors.yaml의 LLM 공급자는 approved:false(temp, 사람만 true로 바꿈) → 그대로도 거부
    expect(() => assertLiveReady(m, { today: "2026-11-27" })).toThrow(UnapprovedProcessorError);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
  it("AC-06-22 approved:false 공급자를 primary로 둔 live 기동 → 종료 코드 1, 외부 요청 0", async () => {
    const r = await run("pnpm", ["-s", "llm:check"], ROOT, {
      LLM_MODE: "live",
      NO_EXTERNAL_NETWORK: "1",
    });
    expect(r.code, r.out).toBe(1);
    expect(r.out).toContain("UnapprovedProcessorError");
    const ok = await run("pnpm", ["-s", "llm:check"], ROOT, { LLM_MODE: "mock" });
    expect(ok.code, ok.out).toBe(0);
  });
  it("AC-08-39 모든 운영 항목(폴백 포함)이 L1~L5 필드를 갖고 모두 충족, 무료 티어 키 표식 0", () => {
    const m = loadModels();
    const entries = Object.values(m.roles).flatMap((r) => [r.primary, ...r.fallbacks]);
    for (const e of entries)
      for (const k of ["L1", "L2", "L3", "L4", "L5"] as const)
        expect(typeof e.compliance[k], `${e.processor_id} ${k}`).toBe("boolean");
    const env = readFileSync(join(ROOT, ".env.example"), "utf8");
    expect(env).not.toMatch(/^[A-Z0-9_]*_FREE_[A-Z0-9_]*=/m);
    // 충족 여부는 사람이 공급자 원문을 확인해 채운다(temp 상태면 미충족 목록이 나온다)
    expect(checkModelsCompliance(m)).toEqual([]);
  });
  it("AC-08-40 라우터 의존성(OpenRouter·LiteLLM) 0건", () => {
    const pkgs = ["package.json"];
    for (const top of ["apps", "packages"])
      for (const n of readdirSync(join(ROOT, top)))
        if (existsSync(join(ROOT, top, n, "package.json"))) pkgs.push(join(top, n, "package.json"));
    for (const p of pkgs) {
      const j = JSON.parse(readFileSync(join(ROOT, p), "utf8")) as Record<string, unknown>;
      const names = ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"]
        .flatMap((k) => Object.keys((j[k] as Record<string, string> | undefined) ?? {}))
        .join(" ");
      expect(names, p).not.toMatch(/openrouter|litellm/i);
    }
  });
});

describe("AC-04-15 MockProvider 역할별 결정 응답(ok)", () => {
  it("gen_copy: 용도마다 CopyDeck 스키마 통과, hero.headline 3개의 kind가 모두 다름, 2회 동일", async () => {
    for (const purpose of PURPOSES) {
      const d = await copyDeck(purpose);
      const r = CopyDeckSchema(purpose).safeParse(d);
      expect(r.success, `${purpose} ${JSON.stringify(r.error?.issues?.slice(0, 3))}`).toBe(true);
      const kinds = (d as { "hero.headline": { kind: string }[] })["hero.headline"].map(
        (h) => h.kind,
      );
      expect(new Set(kinds).size).toBe(3);
      expect(JSON.stringify(await copyDeck(purpose))).toBe(JSON.stringify(d));
    }
  });
  it("gen_layout: 후보 6개 모두 LayoutTreeRaw 통과, 텍스트 리터럴 0(덱 참조만), 같은 입력 2회 바이트 동일", async () => {
    for (const purpose of PURPOSES)
      for (const i of CANDIDATES) {
        const r = await layout(purpose, i);
        expect(r.kind).toBe("ok");
        if (r.kind !== "ok") continue;
        const tree = JSON.parse(r.text) as unknown;
        const p = LayoutTreeRawSchema.safeParse(tree);
        expect(p.success, `${purpose}#${i} ${JSON.stringify(p.error?.issues?.slice(0, 3))}`).toBe(
          true,
        );
        // 문자열 잎은 덱 참조·식별자·열거값뿐: 공백이 든 문자열(문장) 0개
        const leaves: string[] = [];
        const walk = (v: unknown): void => {
          if (typeof v === "string") leaves.push(v);
          else if (Array.isArray(v)) v.forEach(walk);
          else if (v && typeof v === "object") Object.values(v).forEach(walk);
        };
        walk(tree);
        expect(
          leaves.filter((s) => /\s/.test(s)),
          `${purpose}#${i}`,
        ).toEqual([]);
        const again = await layout(purpose, i);
        expect(again.kind === "ok" && again.text).toBe(r.text);
      }
  });
  it("공통 시드 = hash(designSpec.hash, candidateIndex, role, callKind, attempt) 하위 32비트: 인자마다 다르다", () => {
    const base = {
      specHash: "a".repeat(64),
      candidateIndex: 0,
      role: "gen_layout",
      callKind: "initial",
      attempt: 1,
    } as const;
    const s0 = mockSeed(base);
    expect(Number.isInteger(s0) && s0 >= 0 && s0 < 2 ** 32).toBe(true);
    expect(mockSeed({ ...base, candidateIndex: 1 })).not.toBe(s0);
    expect(mockSeed({ ...base, callKind: "diversity" })).not.toBe(s0);
    expect(mockSeed({ ...base, attempt: 2 })).not.toBe(s0);
    expect(mockSeed({ ...base })).toBe(s0);
  });
  it("judge_vision: A/B 순서를 바꿔도 승자 후보 ID가 같다, 항목 5개(R1~R5)", async () => {
    const p = createMockProvider({ scenario: "ok", latencyMs: 0, sleep: fakeSleep().sleep });
    const ids = ["cand-aaaa", "cand-bbbb"];
    const judge = async (a: string, b: string) => {
      const r = await p.complete(
        call({
          role: "judge_vision",
          candidateIndex: 0,
          input: { candidates: [{ id: a }, { id: b }] },
        }),
      );
      if (r.kind !== "ok") throw new Error(r.kind);
      const j = JSON.parse(r.text) as { items: { id: string; winner: string }[]; overall: string };
      expect(j.items.map((x) => x.id)).toEqual(["R1", "R2", "R3", "R4", "R5"]);
      return j.overall === "A" ? a : j.overall === "B" ? b : "tie";
    };
    expect(await judge(ids[0]!, ids[1]!)).toBe(await judge(ids[1]!, ids[0]!));
  });
  it("AC-09-18 judge_position_bias@judge_vision: ID와 무관하게 항상 위치 A 승", async () => {
    const p = createMockProvider({
      scenario: "judge_position_bias@judge_vision",
      latencyMs: 0,
      sleep: fakeSleep().sleep,
    });
    for (const [a, b] of [
      ["x1", "x2"],
      ["x2", "x1"],
    ]) {
      const r = await p.complete(
        call({ role: "judge_vision", input: { candidates: [{ id: a }, { id: b }] } }),
      );
      expect(r.kind === "ok" && (JSON.parse(r.text) as { overall: string }).overall).toBe("A");
    }
  });
  it("ref_tagger: JSON, 점수 1~5 정수, 같은 입력 2회 동일", async () => {
    const p = createMockProvider({ scenario: "ok", latencyMs: 0, sleep: fakeSleep().sleep });
    const go = () =>
      p.complete(
        call({ role: "ref_tagger", candidateIndex: null, input: { referenceId: "ref-001" } }),
      );
    const r = await go();
    expect(r.kind).toBe("ok");
    const scores: number[] = [];
    const walk = (k: string, v: unknown): void => {
      if (k === "score" && typeof v === "number") scores.push(v);
      if (v && typeof v === "object") for (const [kk, vv] of Object.entries(v)) walk(kk, vv);
    };
    walk("", JSON.parse(r.kind === "ok" ? r.text : "{}"));
    expect(scores.length).toBeGreaterThan(0);
    for (const s of scores) expect(SCORES, String(s)).toContain(s);
    const r2 = await go();
    expect(r2.kind === "ok" && r2.text).toBe(r.kind === "ok" && r.text);
  });
});

describe("AC-04-15 장애 주입(9.6.2 표, Mock 동작만)", () => {
  it("invalid_json·schema_violation·forbidden_field·lint_error·injection_echo 출력 형태", async () => {
    const t = async (s: string) => {
      const r = await layout("saas", 0, s);
      return r.kind === "ok" ? r.text : `<${r.kind}>`;
    };
    const bad = await t("invalid_json");
    expect(() => JSON.parse(bad) as unknown).toThrow();
    expect(LayoutTreeRawSchema.safeParse(JSON.parse(await t("schema_violation"))).success).toBe(
      false,
    );
    expect(await t("forbidden_field")).toMatch(/className|"style"|<script/);
    const lint = await copyDeck("saas", "lint_error");
    expect(JSON.stringify(lint)).toContain("✨ New");
    expect(JSON.stringify(await copyDeck("saas", "injection_echo"))).toContain(
      "https://evil.example",
    );
  });
  it("rate_limit → rate_limited(retryAfterMs), server_error → provider_error 500, copy_refusal@gen_copy → refused", async () => {
    expect((await layout("saas", 0, "rate_limit")).kind).toBe("rate_limited");
    const se = await layout("saas", 0, "server_error");
    expect(se.kind === "provider_error" && se.httpStatus).toBe(500);
    const p = createMockProvider({
      scenario: "copy_refusal@gen_copy",
      latencyMs: 0,
      sleep: fakeSleep().sleep,
    });
    const r = await p.complete(
      call({ role: "gen_copy", candidateIndex: null, input: { brand: BRAND, purpose: "saas" } }),
    );
    expect(r.kind).toBe("refused");
    // 역할 범위 밖은 정상
    expect((await layout("saas", 0, "copy_refusal@gen_copy")).kind).toBe("ok");
  });
  it("timeout → abort 전까지 끝나지 않고 abort 시 aborted", async () => {
    const p = createMockProvider({ scenario: "timeout", latencyMs: 0 });
    const ac = new AbortController();
    const specs = specsFor("saas");
    const pending = p.complete(
      call({
        role: "gen_layout",
        signal: ac.signal,
        input: { spec: specs.v_true, purpose: "saas", brand: BRAND, deck: await copyDeck("saas") },
      }),
    );
    const raced = await Promise.race([
      pending,
      new Promise((r) => setTimeout(() => r("still"), 50)),
    ]);
    expect(raced).toBe("still");
    ac.abort();
    expect((await pending).kind).toBe("aborted");
  });
  it("slow → 호출당 25초 지연(가짜 sleep), 기본 지연 = MOCK_LLM_LATENCY_MS(기본 200)", async () => {
    const s = fakeSleep();
    const p = createMockProvider({ scenario: "slow", sleep: s.sleep });
    await p.complete(
      call({ role: "gen_copy", candidateIndex: null, input: { brand: BRAND, purpose: "saas" } }),
    );
    expect(s.waits).toContain(25_000);
    const d = fakeSleep();
    await createMockProvider({ scenario: "ok", sleep: d.sleep }).complete(
      call({ role: "gen_copy", candidateIndex: null, input: { brand: BRAND, purpose: "saas" } }),
    );
    expect(d.waits).toContain(200);
  });
  it("장애 범위: 기본은 initial에만, ! 는 재호출에도, @candidateIndex는 그 후보만", async () => {
    const valid = (r: Awaited<ReturnType<typeof layout>>) =>
      r.kind === "ok" && LayoutTreeRawSchema.safeParse(JSON.parse(r.text)).success;
    expect(valid(await layout("saas", 2, "schema_violation@2"))).toBe(false);
    expect(
      valid(
        await layout("saas", 2, "schema_violation@2", { callKind: "repair_schema", attempt: 1 }),
      ),
    ).toBe(true);
    expect(valid(await layout("saas", 3, "schema_violation@2"))).toBe(true);
    expect(
      valid(await layout("saas", 2, "schema_violation!@2", { callKind: "repair_schema" })),
    ).toBe(false);
  });
  it("usage = mock-prompt-sizes.json 블록 문자 수 ÷ 3 올림, cacheState별 보고, usage_overrun 3배·cost_spike 10배·cost_ramp 1.2배", async () => {
    const sizes = JSON.parse(
      readFileSync(join(ROOT, "fixtures/llm/mock-prompt-sizes.json"), "utf8"),
    ) as {
      roles: Record<
        string,
        { static: number; dynamic: number; output: number; repair_dynamic?: number }
      >;
    };
    const L = sizes.roles.gen_layout!;
    const tok = (c: number) => Math.ceil(c / 3);
    const run1 = async (scenario: string, cacheState: MockCall["cacheState"]) => {
      const r = await layout("saas", 0, scenario, { cacheState });
      if (r.kind !== "ok") throw new Error(r.kind);
      return r;
    };
    const w = await run1("ok", "cache_write");
    expect(w.usage).toEqual({
      tokensIn: tok(L.dynamic),
      cachedTokensIn: 0,
      cacheWriteTokensIn: tok(L.static),
      tokensOut: tok(L.output),
      images: 0,
    });
    const c = await run1("ok", "cached");
    expect(c.usage).toEqual({
      tokensIn: tok(L.dynamic),
      cachedTokensIn: tok(L.static),
      cacheWriteTokensIn: 0,
      tokensOut: tok(L.output),
      images: 0,
    });
    expect(c.priceMultiplier).toBe(1);
    const o = await run1("usage_overrun", "cached");
    expect(o.usage.tokensOut).toBe(3 * tok(L.output));
    expect(o.estimateMultiplier).toBe(1);
    const sp = await run1("cost_spike", "cached");
    expect([sp.priceMultiplier, sp.estimateMultiplier]).toEqual([10, 10]);
    const rp = await run1("cost_ramp", "cached");
    expect([rp.priceMultiplier, rp.estimateMultiplier]).toEqual([1.2, 1.2]);
  });
});
