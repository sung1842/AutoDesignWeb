// 09장 9.6.2 MockProvider: 역할별 결정적 응답 + 장애 주입(ASM-107 ①②⑥⑦). 공급자 계층만(스키마 검증·재시도·예산은 callLlm).
// 미구현(M5-06): mixed 2·4번, low_score 고정 트리, 효과표(mock-variant-effects.json) 기반 variant 선택·수리 규칙. 해당 경로는 오류로 드러낸다.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { findRepoRoot } from "@tastefit/config";
import {
  PATTERNS,
  fillSectionMin,
  loadDesignData,
  patternRaw,
  type DesignData,
  type SpecForTree,
} from "@tastefit/design-spec";
import { LlmError, type LlmRole } from "./gateway.js";
import { parseScenario, scenarioApplies, type Scenario } from "./scenario.js";

export type CallKind = "initial" | "repair_schema" | "repair_quality" | "diversity";
export type CacheState = "none" | "cache_write" | "cached";
export interface MockCall {
  role: LlmRole;
  callKind: CallKind;
  /** variantIndex × 2 + slotIndex(0..5). 후보와 무관한 호출은 null. */
  candidateIndex: number | null;
  attempt: number;
  input: unknown;
  signal: AbortSignal;
  cacheState?: CacheState;
}
export interface MockUsage {
  tokensIn: number;
  cachedTokensIn: number;
  cacheWriteTokensIn: number;
  tokensOut: number;
  images: number;
}
export type MockResult =
  | {
      kind: "ok";
      text: string;
      usage: MockUsage;
      latencyMs: number;
      /** 실제 청구 단가 배율(cost_spike 10, cost_ramp 1.2). */
      priceMultiplier: number;
      /** 추정식 반영 배율(usage_overrun은 1). */
      estimateMultiplier: number;
    }
  | { kind: "rate_limited"; retryAfterMs: number }
  | { kind: "provider_error"; httpStatus: number }
  | { kind: "refused" }
  | { kind: "aborted" };
export interface MockProvider {
  readonly scenario: Scenario;
  complete(call: MockCall): Promise<MockResult>;
}
export type Sleep = (ms: number, signal: AbortSignal) => Promise<void>;

/** 9.6.2 사양 상수(thresholds 아님). */
const MOCK = {
  defaultLatencyMs: 200,
  slowMs: 25_000,
  copyLagMs: 1,
  retryAfterMs: 1000,
  overrun: 3,
  spike: 10,
  ramp: 1.2,
  charsPerToken: 3,
} as const;

/** 공통 시드 = SHA-256(designSpec.hash, candidateIndex, role, callKind, attempt) 하위 32비트(T-18). */
export function mockSeed(k: {
  specHash: string;
  candidateIndex: number | null;
  role: string;
  callKind: string;
  attempt: number;
}): number {
  const h = createHash("sha256")
    .update(JSON.stringify([k.specHash, k.candidateIndex, k.role, k.callKind, k.attempt]))
    .digest();
  return h.readUInt32BE(h.length - 4);
}

const realSleep: Sleep = (ms, signal) =>
  new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new Error("aborted"));
    const t = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = (): void => {
      clearTimeout(t);
      reject(new Error("aborted"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
const untilAbort = (signal: AbortSignal): Promise<void> =>
  new Promise((resolve) => {
    if (signal.aborted) return resolve();
    signal.addEventListener("abort", () => resolve(), { once: true });
  });

type Sizes = Record<
  string,
  { static: number; dynamic: number; output: number; repair_dynamic?: number; images?: number }
>;
let SIZES: Sizes | null = null;
let DATA: DesignData | null = null;
function sizes(): Sizes {
  SIZES ??= (
    JSON.parse(
      readFileSync(join(findRepoRoot(), "fixtures/llm/mock-prompt-sizes.json"), "utf8"),
    ) as {
      roles: Sizes;
    }
  ).roles;
  return SIZES;
}
function data(): DesignData {
  DATA ??= loadDesignData(findRepoRoot());
  return DATA;
}

function usageOf(c: MockCall, mult: number): MockUsage {
  const s = sizes()[c.role];
  if (!s) throw new LlmError("E_LLM_ROLE", `mock-prompt-sizes에 ${c.role} 없음`);
  const tok = (n: number): number => Math.ceil(n / MOCK.charsPerToken) * mult;
  const dyn = c.callKind !== "initial" && s.repair_dynamic ? s.repair_dynamic : s.dynamic;
  const cs = c.cacheState ?? "none";
  return {
    tokensIn: tok(dyn + (cs === "none" ? s.static : 0)),
    cachedTokensIn: cs === "cached" ? tok(s.static) : 0,
    cacheWriteTokensIn: cs === "cache_write" ? tok(s.static) : 0,
    tokensOut: tok(s.output),
    images: (s.images ?? 0) * mult,
  };
}

// ---- gen_copy ----
type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj => typeof x === "object" && x !== null && !Array.isArray(x);
const str = (x: unknown): string => (typeof x === "string" ? x : "");
const chars = (s: string): number => Array.from(s).length;
/** 상한을 넘으면 문장 경계(없으면 공백)에서 자른다. 하한 미만이면 pads를 이어 붙인다. */
function fit(s: string, min: number, max: number, pads: readonly string[] = []): string {
  let t = s.replace(/\s+/g, " ").trim();
  for (const p of pads) {
    if (chars(t) >= min) break;
    t = `${t} ${p}`.trim();
  }
  if (chars(t) <= max) return t;
  const a = Array.from(t).slice(0, max).join("");
  const sentence = Math.max(a.lastIndexOf("다."), a.lastIndexOf("요."));
  if (sentence >= 0 && chars(a.slice(0, sentence + 2)) >= min) return a.slice(0, sentence + 2);
  const sp = a.lastIndexOf(" ");
  return sp >= 0 && chars(a.slice(0, sp)) >= min ? a.slice(0, sp) : a;
}
const CTA: Record<string, [string, string, string]> = {
  saas: ["무료로 시작하기", "데모 신청하기", "앱 내려받기"],
  local_business: ["예약하기", "오시는 길", "메뉴 보기"],
  portfolio: ["작업 보기", "작업 의뢰하기", "이력 보기"],
};
const EYEBROW: Record<string, string> = {
  saas: "서비스 소개",
  local_business: "동네 가게",
  portfolio: "작업 소개",
};

function synthDeck(input: unknown): Obj {
  const i = isObj(input) ? input : {};
  const b = isObj(i.brand) ? i.brand : {};
  const purpose = str(i.purpose) || "saas";
  const N = str(b.name) || "브랜드";
  const D = str(b.description) || `${N}를 소개하는 페이지입니다.`;
  const kp = (
    Array.isArray(b.keyPoints) ? b.keyPoints : Array.isArray(b.key_points) ? b.key_points : []
  )
    .map(str)
    .filter(Boolean);
  const k = (n: number): string => kp[n % Math.max(kp.length, 1)] ?? D;
  const pads = [
    `${N}의 이야기를 차분하게 전합니다.`,
    "필요한 내용을 차례대로 정리했어요.",
    "자세한 내용은 아래에서 확인해 주세요.",
    "처음 방문한 분도 편하게 둘러볼 수 있어요.",
    "궁금한 점은 언제든 문의해 주세요.",
  ];
  const sentence = (s: string): string => (/[.!?]$/.test(s) ? s : `${s}.`);
  const long = (n: number, min: number, max: number): string =>
    fit([sentence(D), ...kp.map(sentence), ...pads.slice(n)].join(" "), min, max, pads);
  const example = (n: number) => ({
    quote: `[예시] 고객 후기 ${n}을 여기에 넣어 주세요.`,
    name: "김○○",
    placeholder: true,
  });
  const deck: Obj = {
    "hero.headline": [
      { kind: "factual", text: fit(`${N}, ${D}`, 8, 24, ["소개"]) },
      { kind: "benefit", text: fit(k(0), 8, 24, [`${N}에서`, "만나 보세요"]) },
      { kind: "emotive", text: fit(`오늘도 ${N}에서 쉬어 가요`, 8, 24, ["천천히"]) },
    ],
    "hero.sub": [long(0, 30, 80), fit(`${sentence(k(1))} ${pads[2]}`, 30, 80, pads)],
    "hero.eyebrow": [EYEBROW[purpose] ?? "소개", fit(N, 2, 14, ["소개"])],
    "cta.primary": [...(CTA[purpose] ?? CTA.saas!)],
    "cta.secondary": ["자세히 보기", "문의하기"],
    "about.title": [fit(`${N} 이야기`, 6, 20, ["소개"])],
    "about.body": [long(0, 80, 240), long(1, 80, 240)],
    "footer.tagline": [fit(D, 1, 30)],
    "meta.title": [fit(`${N} | ${D}`, 1, 60)],
    "meta.description": [fit(`${sentence(D)} ${pads[2]}`, 1, 160)],
    "proof.items": [example(1), example(2), example(3)],
  };
  const tb = (n: number, t: [number, number], bd: [number, number]) => ({
    title: fit(k(n), t[0], t[1], ["소개"]),
    body: fit(`${sentence(k(n))} ${pads[n % pads.length]}`, bd[0], bd[1], pads),
  });
  if (purpose === "saas") {
    deck["value.items"] = [0, 1, 2].map((n) => tb(n, [6, 18], [30, 90]));
    deck["feature.items"] = [0, 1, 2].map((n) => tb(n + 1, [6, 20], [40, 120]));
    deck["faq.items"] = [
      "어떻게 시작하나요?",
      "비용은 어떻게 되나요?",
      "데이터는 안전한가요?",
      "도움이 필요하면 어디로 연락하나요?",
    ].map((q, n) => ({
      q,
      a: fit(`[예시] ${pads[n]} ${pads[(n + 1) % pads.length]}`, 40, 160, pads),
    }));
  } else if (purpose === "local_business") {
    deck["highlight.items"] = [0, 1, 2].map((n) => tb(n, [4, 16], [20, 60]));
    deck["story.body"] = [long(0, 80, 240), long(2, 80, 240)];
    deck["menu.groups"] = [
      {
        title: "대표 메뉴",
        items: [1, 2, 3].map((n) => ({
          name: `[예시] 메뉴 ${n}`,
          desc: fit(`[예시] ${k(n - 1)}`, 1, 40),
          price: "[예시] 0,000원",
          placeholder: true,
        })),
      },
    ];
  } else {
    deck["work.items"] = [1, 2, 3, 4].map((n) => ({
      title: `[예시] 작업 ${n}`,
      caption: fit(`[예시] ${k(n - 1)}`, 1, 40),
    }));
    deck["service.items"] = [0, 1, 2].map((n) => tb(n, [4, 16], [30, 90]));
  }
  return deck;
}

/** B14 금지어 사전 첫 2건(lint_error 시나리오). */
function clicheTerms(): [string, string] {
  const it = (
    JSON.parse(readFileSync(join(findRepoRoot(), "data/linter/cliche_ko.json"), "utf8")) as {
      items: { text: string }[];
    }
  ).items;
  return [it[0]?.text ?? "혁신적인", it[1]?.text ?? "차세대"];
}

function copyText(c: MockCall, s: Scenario | null): string {
  const deck = synthDeck(c.input);
  switch (s?.name) {
    case "invalid_json":
      return '{"hero.headline": [';
    case "schema_violation":
    case "copy_schema_fail":
      delete deck["hero.sub"];
      (deck["hero.headline"] as unknown[]).push({ kind: "factual", text: "x" });
      break;
    case "forbidden_field":
      deck.style = "color:red";
      deck.className = "<script>alert(1)</script>";
      break;
    case "lint_error": {
      const [a, b] = clicheTerms();
      (deck["hero.eyebrow"] as string[])[0] = "✨ New";
      (deck["hero.sub"] as string[])[0] = fit(
        `${a} ${b} ${(deck["hero.sub"] as string[])[0]}`,
        30,
        80,
      );
      break;
    }
    case "injection_echo":
      (deck["hero.sub"] as string[])[0] =
        "지금 https://evil.example 에서 확인하세요. 문의 010-1234-5678";
      break;
    default:
  }
  return JSON.stringify(deck);
}

// ---- gen_layout ----
function layoutText(c: MockCall, s: Scenario | null): string {
  const i = isObj(c.input) ? c.input : {};
  const spec = i.spec as SpecForTree & { layout_constraints: { pattern_slots: [string, string] } };
  const deck = (isObj(i.deck) ? i.deck : synthDeck(i)) as Record<string, never[]>;
  if (!spec?.layout_constraints)
    throw new LlmError("E_MOCK_SCENARIO", "gen_layout 입력에 spec 없음");
  const idx = c.candidateIndex ?? 0;
  let slot = idx % 2;
  if (s?.name === "low_score")
    throw new LlmError("E_MOCK_SCENARIO", "low_score 고정 트리는 M5-06에서 구현");
  // mixed 1: 이웃 후보(같은 변형 슬롯 0)와 같은 block 시퀀스
  if (s?.name === "mixed" && idx === 1) slot = 0;
  const patternId = spec.layout_constraints.pattern_slots[slot] ?? "";
  const pat = Object.values(PATTERNS)
    .flat()
    .find((p) => p.id === patternId);
  // 덱에 없는 목록 키를 쓰는 블록은 고르지 않는다(stats.items가 비면 stats 블록 미사용, 4.6.2)
  const listKey: Record<string, string> = { stats: "stats.items", proof: "proof.items" };
  const usable = (b: string): boolean => !listKey[b] || (deck[listKey[b]]?.length ?? 0) > 0;
  const order = pat
    ? fillSectionMin(["hero", ...pat.order.filter(usable)], spec.layout_constraints)
    : undefined;
  const tree = patternRaw(
    spec,
    patternId,
    deck,
    data(),
    {},
    order ? { order } : {},
  ) as unknown as Obj;
  const sections = tree.sections as Obj[];
  switch (s?.name) {
    case "invalid_json":
      return '```json\n{"schemaVersion":';
    case "schema_violation":
      delete tree.footer;
      if (sections[0]) sections[0].id = "Bad Id";
      break;
    case "forbidden_field":
      if (sections[0]) {
        sections[0].className = "hero";
        sections[0].style = "<script>alert(1)</script>";
      }
      break;
    case "injection_echo":
      if (sections[0])
        sections[0].slots = {
          ...(sections[0].slots as Obj),
          cta: { link: { label: "deck:cta.primary#0", target: "https://evil.example" } },
        };
      break;
    case "mixed":
      // mixed 3: 범위 밖 덱 index
      if (idx === 3) {
        const walk = (v: unknown): void => {
          if (isObj(v))
            for (const [k, x] of Object.entries(v)) {
              if (k === "copy" && typeof x === "string") (v as Obj)[k] = x.replace(/#\d$/, "#9");
              else walk(x);
            }
          else if (Array.isArray(v)) v.forEach(walk);
        };
        walk(sections);
      }
      if (idx === 2 || idx === 4)
        throw new LlmError("E_MOCK_SCENARIO", `mixed@${idx}는 M5-06에서 구현`);
      break;
    default:
  }
  return JSON.stringify(tree);
}

// ---- judge_vision · ref_tagger ----
function judgeText(c: MockCall, s: Scenario | null): string {
  const i = isObj(c.input) ? c.input : {};
  const ids = (Array.isArray(i.candidates) ? i.candidates : []).map((x) =>
    str(isObj(x) ? x.id : ""),
  );
  let overall: "A" | "B" | "tie" = "A";
  if (s?.name !== "judge_position_bias") {
    const sorted = [...ids].sort();
    const h = createHash("sha256").update(sorted.join("|")).digest();
    const winnerId = sorted[(h[0] ?? 0) % Math.max(sorted.length, 1)] ?? "";
    overall = ids[0] === winnerId ? "A" : ids[1] === winnerId ? "B" : "tie";
  }
  return JSON.stringify({
    items: ["R1", "R2", "R3", "R4", "R5"].map((id) => ({
      id,
      winner: overall,
      reason: "mock 판정",
    })),
    overall,
  });
}
function tagText(c: MockCall): string {
  const h = createHash("sha256")
    .update(JSON.stringify(c.input ?? null))
    .digest();
  const axes = ["expression", "temperature", "shape", "density", "depth"];
  const tax = data().taxonomy as unknown as { id: string; values: string[] }[];
  const first = (prefix: string): string =>
    tax.find((t) => t.id.startsWith(prefix))?.values[0] ?? "";
  return JSON.stringify({
    axes: Object.fromEntries(
      axes.map((a, n) => [a, { score: ((h[n] ?? 0) % 5) + 1, evidence: "mock" }]),
    ),
    l2: {
      depth_id: first("depth"),
      layout_pattern_id: first("layout"),
      palette_structure_id: first("palette"),
      image_style_id: first("image"),
      texture_grain: false,
    },
    confidence: 0.5,
  });
}

export function createMockProvider(
  o: { scenario?: string; latencyMs?: number; sleep?: Sleep } = {},
): MockProvider {
  const scenario = parseScenario(o.scenario ?? process.env.MOCK_LLM_SCENARIO ?? "ok");
  const latency = o.latencyMs ?? Number(process.env.MOCK_LLM_LATENCY_MS ?? MOCK.defaultLatencyMs);
  const sleep = o.sleep ?? realSleep;
  const inScope = (c: MockCall): boolean =>
    scenario.scope.kind === "all" ||
    (scenario.scope.kind === "candidate" && c.candidateIndex === scenario.scope.index) ||
    (scenario.scope.kind === "role" && c.role === scenario.scope.role);

  return {
    scenario,
    async complete(c) {
      const on = scenarioApplies(scenario, c);
      const s = on ? scenario : null;
      if (s && (s.name === "timeout" || (s.name === "copy_timeout" && c.role === "gen_copy"))) {
        await untilAbort(c.signal);
        return { kind: "aborted" };
      }
      const wait =
        s?.name === "slow"
          ? MOCK.slowMs
          : c.role === "gen_copy"
            ? latency + MOCK.copyLagMs
            : latency;
      try {
        await sleep(wait, c.signal);
      } catch {
        return { kind: "aborted" };
      }
      if (s?.name === "rate_limit")
        return { kind: "rate_limited", retryAfterMs: MOCK.retryAfterMs };
      if (s?.name === "server_error") return { kind: "provider_error", httpStatus: 500 };
      if (s?.name === "copy_refusal" && c.role === "gen_copy") return { kind: "refused" };
      const text =
        c.role === "gen_copy"
          ? copyText(c, s)
          : c.role === "gen_layout"
            ? layoutText(c, s)
            : c.role === "judge_vision"
              ? judgeText(c, s)
              : tagText(c);
      // 단가·usage 시나리오는 범위만 보고 호출 종류와 무관하게 적용(6.9.4 ⑦)
      const cost = inScope(c) ? scenario.name : "ok";
      const mult = cost === "cost_spike" ? MOCK.spike : cost === "cost_ramp" ? MOCK.ramp : 1;
      return {
        kind: "ok",
        text,
        usage: usageOf(c, cost === "usage_overrun" ? MOCK.overrun : 1),
        latencyMs: wait,
        priceMultiplier: mult,
        estimateMultiplier: mult,
      };
    },
  };
}
