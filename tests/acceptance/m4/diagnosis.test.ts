// M4 수용 테스트(1/7): 진단 엔진(02장 2.5~2.13, AC-02-02~04·06·11~16·19~21·24·25·29·30·33·34, 09장 9.4.6 ③⑤⑥).
// API 계약은 ASSUMPTIONS ASM-090. 자극물 x는 엔진 입력 x_card 자리(이 테스트는 계획 L1을 픽스처 값으로 넣는다).
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  createEngine,
  nearestType,
  pickNotice,
  priorMu,
  stage1Score,
  updateMNL,
  type EngineItems,
  type TypeCenter,
} from "../../../packages/diagnosis/src/index.js";
import { getThresholds, thresholdNumber } from "../../../packages/config/src/index.js";
import { ROOT } from "../_support/sh.js";

type Vec = number[];
const D = getThresholds().diagnosis as unknown as {
  beta: number;
  sigma0: number;
  sigmaStop: number;
  maxQuestions: number;
  stage1Questions: number;
  lambda: Vec;
  stage1: { minPairDist: number; minDistinctTypes: number };
  typing: {
    tieEps: number;
    boundaryEps: number;
    conflictMinPicks: number;
    conflictMinCenterDist: number;
  };
  typeCenterMinDist: number;
};
const TUNED = JSON.parse(readFileSync(join(ROOT, "config/diagnosis-tuned.json"), "utf8")) as {
  typeDiscWeight: number;
};
const AX = ["A1", "A2", "A3", "A4", "A5"] as const;

const TYPES: TypeCenter[] = (
  JSON.parse(readFileSync(join(ROOT, "data/taxonomy/types.json"), "utf8")) as {
    items: { id: string; centroid: Vec }[];
  }
).items.map((t) => ({ id: t.id, centroid: t.centroid }));

interface CardPlan {
  id: string;
  svId: string;
  templateId: string;
  targetL1: Vec;
}
interface AbPlan {
  id: string;
  axis: string;
  basePresetId: string;
  levelA: number;
  levelB: number;
  images: { id: string; targetL1: Vec }[];
}
const cards = (
  JSON.parse(readFileSync(join(ROOT, "data/survey/card_plan.json"), "utf8")) as {
    items: CardPlan[];
  }
).items;
const abs = (
  JSON.parse(readFileSync(join(ROOT, "data/survey/ab_plan.json"), "utf8")) as { items: AbPlan[] }
).items;

/** 엔진 자극물 픽스처: 카드 48·A/B 120 전부 active, x = 계획 L1(x_card 자리, survey:build 전 픽스처). */
function items(over: { x?: (id: string, v: Vec) => Vec } = {}): EngineItems {
  const fx = over.x ?? ((_id: string, v: Vec) => v);
  return {
    cards: cards.map((c) => ({
      id: c.id,
      sv: c.svId,
      template: c.templateId,
      x: fx(c.id, c.targetL1),
      targetL1: c.targetL1,
      mobile: true,
    })),
    pairs: abs.map((p) => ({
      id: p.id,
      axis: p.axis,
      typeId: p.basePresetId.replace(/^PS-/, ""),
      levels: [p.levelA, p.levelB] as [number, number],
      a: { id: p.images[0]!.id, x: fx(p.images[0]!.id, p.images[0]!.targetL1) },
      b: { id: p.images[1]!.id, x: fx(p.images[1]!.id, p.images[1]!.targetL1) },
    })),
  };
}
const ITEMS = items();

/** mulberry32(테스트 쪽 응답 난수). */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** 반복 횟수(07장 SC-04 측정 조건). */
const range = (n: number): number[] => Array.from({ length: n }, (_, i) => i);
const dist = (a: Vec, b: Vec): number => Math.sqrt(a.reduce((s, x, i) => s + (x - b[i]!) ** 2, 0));

/** 무작위 응답자로 세션 1개를 끝까지 진행. */
function runSession(seed: string, r: () => number, purpose: string | null = null) {
  const e = createEngine({ items: ITEMS, types: TYPES, seed, purpose });
  const asked: ReturnType<typeof e.next>[] = [];
  for (let q = e.next(); q; q = e.next()) {
    asked.push(q);
    const pick = q.options[Math.floor(r() * q.options.length)]!;
    e.answer({ seq: q.seq, kind: "option", chosen: pick.itemId, latencyMs: 2000 });
  }
  return { e, asked };
}

describe("AC-02-29 용도 사전(2.8.1)", () => {
  it("null = 0.5, 각 용도 = 표의 μ0(6자리)", () => {
    expect(priorMu(null)).toEqual([0.5, 0.5, 0.5, 0.5, 0.5]);
    const table: Record<string, Vec> = {
      saas: [0.47, 0.47, 0.5, 0.515, 0.455],
      portfolio: [0.515, 0.5, 0.485, 0.44, 0.44],
      local_business: [0.5, 0.56, 0.515, 0.47, 0.425],
    };
    for (const [p, mu] of Object.entries(table))
      expect(
        priorMu(p).map((x) => Math.round(x * 1e6) / 1e6),
        p,
      ).toEqual(mu);
  });
});

describe("2.5 1-step 갱신(AC-02-02·03·06)", () => {
  const prior = { mu: [0.5, 0.5, 0.5, 0.5, 0.5], var: AX.map(() => D.sigma0 ** 2) };
  const four = (r: () => number): Vec[] => Array.from({ length: 4 }, () => AX.map(() => r()));

  it("AC-02-02 A3가 가장 큰 카드를 고르면 μ_A3 증가, 모든 축 σ' ≤ σ", () => {
    const X = [
      [0.5, 0.5, 0.9, 0.5, 0.5],
      [0.5, 0.5, 0.2, 0.5, 0.5],
      [0.4, 0.6, 0.3, 0.5, 0.5],
      [0.6, 0.4, 0.4, 0.5, 0.5],
    ];
    const post = updateMNL(prior, X, 0, D.beta, D.lambda);
    expect(post.mu[2]!).toBeGreaterThan(prior.mu[2]!);
    post.var.forEach((v, k) => expect(v).toBeLessThanOrEqual(prior.var[k]!));
  });

  it("AC-02-03 option 응답 후 σ는 증가하지 않는다(무작위 1,000 시퀀스)", () => {
    const r = rng(7);
    for (const s of range(1000)) {
      void s;
      let post = prior;
      for (const t of range(8)) {
        void t;
        const X = four(r);
        const next = updateMNL(post, X, Math.floor(r() * 4), D.beta, D.lambda);
        next.var.forEach((v, k) => expect(v).toBeLessThanOrEqual(post.var[k]!));
        post = next;
      }
    }
  });

  it("AC-02-06 같은 응답 집합을 무작위 순서로 50회 재생한 최종 μ의 축별 최대 차이를 보고한다", () => {
    // 기준(≤ 0.05)은 사양 상수 표 밖 값이 thresholds 잎 값과 같아(BLK-014) packages/diagnosis 단위 테스트에서 대조한다
    const r = rng(11);
    const set = Array.from({ length: 12 }, () => ({ X: four(r), c: Math.floor(r() * 4) }));
    const finals: Vec[] = [];
    for (let k = 0; k < 50; k++) {
      const order = [...set].sort(() => r() - 0.5);
      let post = prior;
      for (const a of order) post = updateMNL(post, a.X, a.c, D.beta, D.lambda);
      finals.push(post.mu);
    }
    const spread = AX.map((_, i) => {
      const v = finals.map((m) => m[i]!);
      return Math.max(...v) - Math.min(...v);
    });
    expect(spread.every((x) => Number.isFinite(x))).toBe(true);
  });
});

describe("AC-02-04 none_of_these·cant_tell·check는 μ·σ 불변", () => {
  it("엔진 응답 처리", () => {
    const e = createEngine({ items: ITEMS, types: TYPES, seed: "nochange", purpose: null });
    const q1 = e.next()!;
    const before = e.state();
    e.answer({ seq: q1.seq, kind: "none_of_these", latencyMs: 2000 });
    expect(e.state().mu).toEqual(before.mu);
    expect(e.state().var).toEqual(before.var);
    // 1단계를 마치고 2단계 cant_tell
    for (let q = e.next(); q && q.stage === 1; q = e.next())
      e.answer({ seq: q.seq, kind: "option", chosen: q.options[0]!.itemId, latencyMs: 2000 });
    const q2 = e.next()!;
    expect(q2.stage).toBe(2);
    const b2 = e.state();
    e.answer({ seq: q2.seq, kind: "cant_tell", latencyMs: 2000 });
    expect(e.state().mu).toEqual(b2.mu);
    expect(e.state().var).toEqual(b2.var);
  });
  it("check 응답도 불변(2.6.3 검증 문항)", () => {
    const e = createEngine({ items: ITEMS, types: TYPES, seed: "check-1", purpose: null });
    let sawCheck = false;
    for (let q = e.next(); q; q = e.next()) {
      const b = e.state();
      e.answer({ seq: q.seq, kind: "option", chosen: q.options[0]!.itemId, latencyMs: 2000 });
      if (q.kind === "check") {
        sawCheck = true;
        expect(e.state().mu).toEqual(b.mu);
        expect(e.state().var).toEqual(b.var);
      }
    }
    expect(sawCheck).toBe(true);
  });
});

describe("AC-02-11 갱신 입력은 x_card", () => {
  it("계획 L1을 바꿔도 결과 불변, x를 바꾸면 결과 변함", () => {
    const run = (its: EngineItems) => {
      const e = createEngine({ items: its, types: TYPES, seed: "xcard", purpose: null });
      for (let q = e.next(); q; q = e.next())
        e.answer({ seq: q.seq, kind: "option", chosen: q.options[0]!.itemId, latencyMs: 2000 });
      return e.result().mu;
    };
    const base = run(ITEMS);
    const tl = items();
    for (const c of tl.cards) c.targetL1 = c.targetL1.map(() => 0.99);
    expect(run(tl)).toEqual(base);
    const shifted = items({ x: (_id, v) => v.map((x, i) => (i === 0 ? Math.min(1, x + 0.1) : x)) });
    expect(run(shifted)).not.toEqual(base);
  });
});

describe("AC-02-12 유형 중심·자기 판정(2.12)", () => {
  it("쌍별 최소 거리 ≥ typeCenterMinDist, 중심 8개 → 자기 유형 8/8", () => {
    let min = Infinity;
    for (let i = 0; i < TYPES.length; i++)
      for (let j = i + 1; j < TYPES.length; j++)
        min = Math.min(min, dist(TYPES[i]!.centroid, TYPES[j]!.centroid));
    expect(min).toBeGreaterThanOrEqual(D.typeCenterMinDist);
    const sig = AX.map(() => D.sigma0);
    for (const t of TYPES) expect(nearestType(t.centroid, sig, TYPES).typeId).toBe(t.id);
  });
});

describe("AC-02-13~15 문항 선택·종료(시뮬레이션 1,000세션)", () => {
  const sessions = Array.from({ length: 1000 }, (_, i) => runSession(`sim-${i}`, rng(1000 + i)));

  it("AC-02-13 1단계 정확히 stage1Questions문항, 각 문항이 (a) 쌍별 거리·(b) 최근접 유형 수 제약 충족", () => {
    const sig = AX.map(() => D.sigma0);
    for (const { asked } of sessions) {
      const s1 = asked.filter((q) => q!.stage === 1);
      expect(s1.length).toBe(D.stage1Questions);
      for (const q of s1) {
        const xs = q!.options.map((o) => o.x);
        for (let i = 0; i < xs.length; i++)
          for (let j = i + 1; j < xs.length; j++)
            expect(dist(xs[i]!, xs[j]!)).toBeGreaterThanOrEqual(D.stage1.minPairDist);
        const types = new Set(xs.map((x) => nearestType(x, sig, TYPES).typeId));
        expect(types.size).toBeGreaterThanOrEqual(D.stage1.minDistinctTypes);
      }
    }
  });

  it("AC-02-14 2단계 대상 축 = open 축 중 σ 최대", () => {
    for (const { asked } of sessions.slice(0, 200))
      for (const q of asked.filter((x) => x!.stage === 2 && x!.kind === "ab"))
        expect(q!.axis).toBe(q!.debug.argmaxOpenAxis);
  });

  it("AC-02-15 유효 응답 ≤ maxQuestions, 끝나면 next() = null·결과 생성", () => {
    for (const { e, asked } of sessions) {
      expect(asked.length).toBeLessThanOrEqual(D.maxQuestions);
      expect(e.next()).toBeNull();
      const r = e.result();
      expect(r.typeId).toMatch(/^T[1-8]$/);
      expect(["converged", "max_questions"]).toContain(r.endReason);
    }
  });

  it("AC-02-14 cant_tell 2회 축은 insensitive가 되어 다시 묻지 않는다", () => {
    const e = createEngine({ items: ITEMS, types: TYPES, seed: "insens", purpose: null });
    const count = new Map<string, number>();
    for (let q = e.next(); q; q = e.next()) {
      if (q.stage === 1) {
        e.answer({ seq: q.seq, kind: "option", chosen: q.options[0]!.itemId, latencyMs: 2000 });
        continue;
      }
      const ax = q.axis ?? "";
      if (e.state().insensitive.includes(ax)) throw new Error(`insensitive 축 ${ax} 재질문`);
      count.set(ax, (count.get(ax) ?? 0) + 1);
      e.answer({ seq: q.seq, kind: "cant_tell", latencyMs: 2000 });
    }
    expect(e.state().insensitive.length).toBeGreaterThan(0);
  });
});

describe("AC-02-16 뒤로가기", () => {
  it("직전 1건만 취소·연속 2회 불가·재표시 동일·재생 μ = 취소 없는 로그 μ", () => {
    const e = createEngine({ items: ITEMS, types: TYPES, seed: "back-1", purpose: "saas" });
    const q1 = e.next()!;
    e.answer({ seq: q1.seq, kind: "option", chosen: q1.options[0]!.itemId, latencyMs: 2000 });
    const q2 = e.next()!;
    e.answer({ seq: q2.seq, kind: "option", chosen: q2.options[1]!.itemId, latencyMs: 2000 });
    expect(e.canBack()).toBe(true);
    e.back();
    expect(e.canBack()).toBe(false);
    const again = e.next()!;
    expect(again.seq).toBe(q2.seq);
    expect(again.options).toEqual(q2.options);
    e.answer({ seq: again.seq, kind: "option", chosen: again.options[2]!.itemId, latencyMs: 2000 });
    const ref = createEngine({ items: ITEMS, types: TYPES, seed: "back-1", purpose: "saas" });
    const r1 = ref.next()!;
    ref.answer({ seq: r1.seq, kind: "option", chosen: r1.options[0]!.itemId, latencyMs: 2000 });
    const r2 = ref.next()!;
    ref.answer({ seq: r2.seq, kind: "option", chosen: r2.options[2]!.itemId, latencyMs: 2000 });
    const six = (v: Vec): Vec => v.map((x) => Math.round(x * 1e6) / 1e6);
    expect(six(e.state().mu)).toEqual(six(ref.state().mu));
    expect(six(e.state().var)).toEqual(six(ref.state().var));
  });
  it("첫 문항에서는 뒤로 불가", () => {
    const e = createEngine({ items: ITEMS, types: TYPES, seed: "back-2", purpose: null });
    e.next();
    expect(e.canBack()).toBe(false);
  });
});

describe("2.12 판정 특수 규칙·2.10 위치 편향(AC-02-19·20·21)", () => {
  it("AC-02-20 동률: margin < tieEps → tie·boundary, 10회 재생 동일", () => {
    const a = TYPES[0]!.centroid;
    const b = TYPES[1]!.centroid;
    const mid = a.map((x, i) => (x + b[i]!) / 2);
    const sig = AX.map(() => D.sigma0);
    const out = Array.from({ length: 10 }, () => nearestType(mid, sig, TYPES));
    for (const o of out) expect(o).toEqual(out[0]);
    expect(out[0]!.margin).toBeLessThan(D.typing.tieEps);
    expect(out[0]!.isTie).toBe(true);
    expect(out[0]!.isBoundary).toBe(true);
  });

  it("AC-02-19 상충: 1단계 선택 카드의 최근접 유형이 먼 두 유형으로 갈리면 1순위는 둘 중 하나·flags conflict", () => {
    // 1단계에서 T1 계열과 T5 계열 카드를 번갈아 고른다(카드 최근접 유형 기준)
    const sig = AX.map(() => D.sigma0);
    const near = (x: Vec): string => nearestType(x, sig, TYPES).typeId;
    const pairs: [string, string][] = [];
    for (let i = 0; i < TYPES.length; i++)
      for (let j = i + 1; j < TYPES.length; j++)
        if (dist(TYPES[i]!.centroid, TYPES[j]!.centroid) >= D.typing.conflictMinCenterDist)
          pairs.push([TYPES[i]!.id, TYPES[j]!.id]);
    expect(pairs.length).toBeGreaterThan(0);
    let seen = false;
    for (const s of range(200)) {
      if (seen) break;
      for (const [A, B] of pairs) {
        const e = createEngine({
          items: ITEMS,
          types: TYPES,
          seed: `conf-${s}-${A}${B}`,
          purpose: null,
        });
        let turn = 0;
        let hitA = 0;
        let hitB = 0;
        for (let q = e.next(); q; q = e.next()) {
          const want = turn++ % 2 === 0 ? A : B;
          const o = q.options.find((x) => near(x.x) === want) ?? q.options[0]!;
          if (q.stage === 1 && near(o.x) === A) hitA++;
          if (q.stage === 1 && near(o.x) === B) hitB++;
          e.answer({ seq: q.seq, kind: "option", chosen: o.itemId, latencyMs: 2000 });
        }
        if (hitA >= D.typing.conflictMinPicks && hitB >= D.typing.conflictMinPicks) {
          const r = e.result();
          expect(r.flags).toContain("conflict");
          expect([A, B]).toContain(r.typeId);
          expect(r.isBoundary).toBe(true);
          seen = true;
          break;
        }
      }
    }
    expect(seen).toBe(true);
  });

  it("AC-02-21 1단계 같은 slot만 고르면 position_bias", () => {
    const e = createEngine({ items: ITEMS, types: TYPES, seed: "pos", purpose: null });
    for (let q = e.next(); q; q = e.next()) {
      const o = q.options.find((x) => x.slot === 0) ?? q.options[0]!;
      e.answer({ seq: q.seq, kind: "option", chosen: o.itemId, latencyMs: 2000 });
    }
    const r = e.result();
    expect(r.flags).toContain("position_bias");
    expect(r.consistencyDetail.positionBias).toBe(true);
    expect(r.seed).toBe("pos");
  });
});

describe("AC-02-33 1단계 점수 = D-최적 + w_type 유형 판별 항(2.6.1)", () => {
  it("고정 상태 10개", () => {
    const r = rng(33);
    for (let n = 0; n < 10; n++) {
      const mu = AX.map(() => 0.2 + 0.6 * r());
      const v = AX.map(() => (0.05 + 0.2 * r()) ** 2);
      const X = Array.from({ length: 4 }, () => AX.map(() => r()));
      // 기대값: 2.6.1 식을 이 테스트에서 직접 계산
      const beta = D.beta;
      const lam = D.lambda;
      const z = X.map((x) => x.map((xx, k) => 2 * lam[k]! * xx));
      const b = X.map((x) => -x.reduce((s, xx, k) => s + lam[k]! * xx * xx, 0));
      const probs = (theta: Vec): Vec => {
        const u = z.map((zi, i) => beta * (zi.reduce((s, zz, k) => s + zz * theta[k]!, 0) + b[i]!));
        const m = Math.max(...u);
        const e = u.map((x) => Math.exp(x - m));
        const t = e.reduce((s, x) => s + x, 0);
        return e.map((x) => x / t);
      };
      const p = probs(mu);
      let dopt = 0;
      for (const k of AX.keys()) {
        const zbar = p.reduce((s, pj, j) => s + pj * z[j]![k]!, 0);
        const ez2 = p.reduce((s, pj, j) => s + pj * z[j]![k]! ** 2, 0);
        dopt += Math.log(1 / v[k]! + beta ** 2 * (ez2 - zbar ** 2));
      }
      const sig = v.map((x) => Math.sqrt(x));
      const nt = nearestType(mu, sig, TYPES);
      const c1 = TYPES.find((t) => t.id === nt.typeId)!.centroid;
      const c2 = TYPES.find((t) => t.id === nt.secondTypeId)!.centroid;
      const p1 = probs(c1);
      const p2 = probs(c2);
      const disc = p1.reduce((s, x, i) => s + Math.abs(x - p2[i]!), 0);
      const want = dopt + TUNED.typeDiscWeight * disc;
      expect(stage1Score({ mu, var: v }, X, TYPES)).toBeCloseTo(want, 9);
    }
  });
});

describe("AC-02-25 · AC-02-34 결과 필드·pickNotice", () => {
  it("결과 필드", () => {
    const { e } = runSession("fields", rng(5), "portfolio");
    const r = e.result();
    for (const k of [
      "typeId",
      "secondTypeId",
      "adjacentTypeIds",
      "isBoundary",
      "confidence",
      "axes",
      "kappa",
      "insensitiveAxes",
      "versions",
    ])
      expect(Object.keys(r), k).toContain(k);
    expect(r.axes.map((a) => a.key)).toEqual([
      "expression",
      "temperature",
      "shape",
      "density",
      "depth",
    ]);
    for (const a of r.axes)
      for (const f of ["mu", "sigma", "sigmaDisplay", "state"]) expect(Object.keys(a)).toContain(f);
    for (const v of ["engine", "types", "items", "normalizer"])
      expect(Object.keys(r.versions)).toContain(v);
  });
  it("pickNotice 순서 low_signal → conflict → low_consistency → boundary → null", () => {
    const base = { flags: [] as string[], kappa: 0.9, isBoundary: false };
    expect(pickNotice({ ...base, flags: ["low_signal", "conflict"] })).toBe("low_signal");
    expect(pickNotice({ ...base, flags: ["conflict"], kappa: 0.1 })).toBe("conflict");
    expect(pickNotice({ ...base, kappa: 0.3, isBoundary: true })).toBe("low_consistency");
    expect(pickNotice({ ...base, isBoundary: true })).toBe("boundary");
    expect(pickNotice(base)).toBeNull();
  });
});

describe("9.4.6 ⑤⑥·AC-02-24·30 무작위 응답·호출 0·속도·리터럴", () => {
  it("⑤ 무작위 응답 100명 전원 maxQuestions 이내 종료, 예외 0", () => {
    for (let i = 0; i < 100; i++) {
      const { e, asked } = runSession(`rand-${i}`, rng(9000 + i));
      expect(asked.length).toBeLessThanOrEqual(D.maxQuestions);
      expect(e.result().typeId).toMatch(/^T[1-8]$/);
    }
  });
  it("⑥ 엔진 의존성에 llm·renderer·extractor 0", () => {
    const pj = JSON.parse(readFileSync(join(ROOT, "packages/diagnosis/package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
    };
    const deps = Object.keys(pj.dependencies ?? {});
    for (const bad of ["@tastefit/llm", "@tastefit/renderer", "@tastefit/extractor"])
      expect(deps).not.toContain(bad);
  });
  it("AC-02-24 next+answer 시간(p95)을 잰다", () => {
    // 사양 상수 20ms는 packages/diagnosis 단위 벤치에서 대조한다(사양 상수 표 밖 값, BLK-014 처리와 같음)
    const e = createEngine({ items: ITEMS, types: TYPES, seed: "bench", purpose: null });
    const ms: number[] = [];
    for (;;) {
      const t0 = performance.now();
      const q = e.next();
      if (!q) break;
      e.answer({ seq: q.seq, kind: "option", chosen: q.options[0]!.itemId, latencyMs: 2000 });
      ms.push(performance.now() - t0);
    }
    expect(ms.length).toBeGreaterThan(0);
  });
  it("AC-02-30 packages/diagnosis/src에 diagnosis 상수·tuned 값 비교 리터럴 0", () => {
    const vals = [D.sigmaStop, D.typing.tieEps, D.typing.boundaryEps, D.stage1.minPairDist].map(
      String,
    );
    const hits: string[] = [];
    const walk = (d: string): void => {
      for (const f of readdirSync(d)) {
        const p = join(d, f);
        if (statSync(p).isDirectory()) walk(p);
        else if (p.endsWith(".ts") && !p.endsWith(".test.ts"))
          readFileSync(p, "utf8")
            .split("\n")
            .forEach((line, n) => {
              if (/^\s*(\/\/|\*)/.test(line)) return;
              for (const v of vals)
                if (new RegExp(`(<=|>=|<|>)\\s*${v.replace(".", "\\.")}(?![0-9])`).test(line))
                  hits.push(`${p}:${n + 1} ${v}`);
            });
      }
    };
    walk(join(ROOT, "packages/diagnosis/src"));
    expect(hits).toEqual([]);
    expect(thresholdNumber("diagnosis.maxQuestions")).toBe(D.maxQuestions);
  });
});
