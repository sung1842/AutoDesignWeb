// 02장 2.5.4·2.6·2.7·2.9·2.10·2.12.2·2.13 진단 세션 엔진(ASM-090). 상태 = 사전 + 유효 응답 로그 재생(뒤로가기·재생 일치).
import {
  KAPPA_SPEC,
  choiceProbs,
  diagConst,
  fisherDiag,
  nearestType,
  pickNotice,
  priorPosterior,
  r6,
  rngFor,
  stage1Score,
  tuned,
  updateMNL,
  type Notice,
  type Posterior,
  type TypeCenter,
  type Vec,
} from "./model.js";

export interface CardItem {
  id: string;
  sv: string;
  template: string;
  /** x_card(실측 L1). 갱신·문항 선택 입력. */
  x: Vec;
  /** 계획 L1(엔진은 읽지 않는다, AC-02-11). */
  targetL1?: Vec;
  mobile?: boolean;
}
export interface PairItem {
  id: string;
  /** 대상 축 A1~A5. */
  axis: string;
  typeId: string;
  levels: [number, number];
  a: { id: string; x: Vec };
  b: { id: string; x: Vec };
}
export interface EngineItems {
  cards: CardItem[];
  pairs: PairItem[];
}
export interface Option {
  itemId: string;
  slot: number;
  x: Vec;
}
export interface Question {
  seq: number;
  stage: 1 | 2;
  kind: "four" | "ab" | "check";
  itemKey: string;
  axis?: string;
  pairId?: string;
  template?: string;
  options: Option[];
  policy: "dopt" | "explore" | "ab" | "check";
  debug: { argmaxOpenAxis?: string };
}
export interface Answer {
  seq: number;
  kind: "option" | "none_of_these" | "cant_tell";
  chosen?: string;
  latencyMs?: number;
}
interface LogRow {
  q: Question;
  a: Answer;
  /** 응답 직전 사후로 계산한 선택 확률(κ, 2.9.1). option일 때만. */
  ell?: number;
}

export class SurveyItemsInsufficient extends Error {
  constructor(
    readonly stage: 1 | 2,
    readonly itemKey: string,
  ) {
    super(`SURVEY_ITEMS_INSUFFICIENT stage ${stage} ${itemKey}`);
  }
}

const AXIS_IDS = ["A1", "A2", "A3", "A4", "A5"] as const;
const AXIS_KEYS = ["expression", "temperature", "shape", "density", "depth"] as const;
const TEMPLATES = ["tpl-hero", "tpl-grid", "tpl-text"] as const;
/** 2.6.2 수준쌍 동점 순서·cant_tell 1회 후 허용 쌍. */
const LEVEL_ORDER = ["0.2,0.5", "0.5,0.8", "0.2,0.8"] as const;
const WIDE_PAIR = "0.2,0.8";
/** 2.6.2 기준 유형의 승인 쌍 최소 수, 2.6.3 검증 문항 위치(2단계 3번째)·총 응답 상한, 1단계 카드 수. */
const STAGE_SPEC = {
  minPairsPerType: 2,
  checkAtStage2: 3,
  checkMaxAnswered: 14,
  cards: 4,
  extraFarCards: 2,
} as const;
/** 2.13.1 high 조건 margin, fast 비율, 2.13.2 표시 구간 배율. */
const RESULT_SPEC = { highMargin: 0.1, fastRatio: 0.5 } as const;
export const ENGINE_VERSION = "1.0.0";

const dist = (a: Vec, b: Vec): number =>
  Math.sqrt(a.reduce((s, x, i) => s + (x - (b[i] ?? 0)) ** 2, 0));
const lk = (l: [number, number]): string => `${l[0]},${l[1]}`;

export interface EngineInput {
  items: EngineItems;
  types: readonly TypeCenter[];
  seed: string;
  purpose: string | null;
  mobile?: boolean;
  versions?: { types?: string; items?: string; normalizer?: string };
}

export function createEngine(input: EngineInput) {
  const D = diagConst();
  const tu = tuned();
  const sig0 = Array.from({ length: AXIS_IDS.length }, () => D.sigma0);
  const cardType = new Map(
    input.items.cards.map((c) => [c.id, nearestType(c.x, sig0, input.types).typeId]),
  );
  const cardById = new Map(input.items.cards.map((c) => [c.id, c]));
  let log: LogRow[] = [];
  let backed = false;
  let pending: Question | null = null;

  interface Derived {
    post: Posterior;
    noneCount: number;
    lastNoneMean: Vec | null;
    cantTell: number[];
    insensitive: Set<number>;
    svCount: Map<string, number>;
    prevSv: Set<string>;
    firstAb: LogRow | null;
    checked: boolean;
    rows: LogRow[];
  }
  /** 로그 재생(2.15·AC-02-16·18). */
  function derive(rows: LogRow[]): Derived {
    let post = priorPosterior(input.purpose);
    const d: Derived = {
      post,
      noneCount: 0,
      lastNoneMean: null,
      cantTell: AXIS_IDS.map(() => 0),
      insensitive: new Set(),
      svCount: new Map(),
      prevSv: new Set(),
      firstAb: null,
      checked: false,
      rows: [],
    };
    for (const row of rows) {
      const { q, a } = row;
      const X = q.options.map((o) => o.x);
      if (q.stage === 1) {
        d.prevSv = new Set(q.options.map((o) => cardById.get(o.itemId)?.sv ?? ""));
        for (const sv of d.prevSv) d.svCount.set(sv, (d.svCount.get(sv) ?? 0) + 1);
      }
      const r: LogRow = { q, a };
      if (q.kind === "check") d.checked = true;
      else if (a.kind === "option") {
        const c = q.options.findIndex((o) => o.itemId === a.chosen);
        r.ell = choiceProbs(X, post.mu, D.beta, D.lambda)[c];
        post = updateMNL(post, X, c, D.beta, D.lambda);
      } else if (a.kind === "none_of_these") {
        d.noneCount++;
        d.lastNoneMean =
          X[0]?.map((_, k) => X.reduce((s, x) => s + (x[k] ?? 0), 0) / X.length) ?? null;
      } else if (a.kind === "cant_tell" && q.axis) {
        const k = AXIS_IDS.indexOf(q.axis as (typeof AXIS_IDS)[number]);
        if (k >= 0) {
          d.cantTell[k] = (d.cantTell[k] ?? 0) + 1;
          if ((d.cantTell[k] ?? 0) >= D.cantTellInsensitiveAfter) d.insensitive.add(k);
        }
      }
      if (q.kind === "ab" && !d.firstAb) d.firstAb = r;
      d.rows.push(r);
    }
    d.post = post;
    return d;
  }
  let cur = derive([]);

  function converged(d: Derived): boolean {
    return d.post.var.every((v, k) => Math.sqrt(v) <= D.sigmaStop || d.insensitive.has(k));
  }
  function done(d: Derived): "converged" | "max_questions" | null {
    if (d.rows.length >= D.maxQuestions) return "max_questions";
    if (d.rows.length >= D.stage1Questions && converged(d)) return "converged";
    return null;
  }

  function shuffle<T>(xs: T[], r: () => number): T[] {
    const a = [...xs];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [a[i], a[j]] = [a[j] as T, a[i] as T];
    }
    return a;
  }

  function stage1(seq: number, d: Derived): Question {
    const template = TEMPLATES[(seq - 1) % TEMPLATES.length] ?? "tpl-hero";
    const pool = input.items.cards
      .filter((c) => c.template === template && (!input.mobile || c.mobile))
      .sort((a, b) => (a.id < b.id ? -1 : 1));
    const r = rngFor(input.seed, seq);
    const combos: CardItem[][] = [];
    for (let n = 0; n < tu.candidateSamples && pool.length >= STAGE_SPEC.cards; n++) {
      const pick = new Set<number>();
      while (pick.size < STAGE_SPEC.cards) pick.add(Math.floor(r() * pool.length));
      combos.push([...pick].map((i) => pool[i] as CardItem));
    }
    const hard = (S: CardItem[]): boolean => {
      for (let i = 0; i < S.length; i++)
        for (let j = i + 1; j < S.length; j++)
          if (dist((S[i] as CardItem).x, (S[j] as CardItem).x) < D.stage1.minPairDist) return false;
      return new Set(S.map((c) => cardType.get(c.id))).size >= D.stage1.minDistinctTypes;
    };
    const soft = [
      (S: CardItem[]) => !S.some((c) => d.prevSv.has(c.sv)),
      (S: CardItem[]) => S.every((c) => (d.svCount.get(c.sv) ?? 0) < D.stage1.maxAppearPerVector),
      (S: CardItem[]) => {
        const lastWasNone = d.rows.at(-1)?.a.kind === "none_of_these";
        if (!lastWasNone || !d.lastNoneMean) return true;
        const m = d.lastNoneMean;
        return S.filter((c) => dist(c.x, m) >= D.noneAvoidDist).length >= STAGE_SPEC.extraFarCards;
      },
    ];
    let ok: CardItem[][] = [];
    for (let relax = 0; relax <= soft.length; relax++) {
      const active = soft.slice(relax);
      ok = combos.filter((S) => hard(S) && active.every((f) => f(S)));
      if (ok.length > 0) break;
    }
    if (ok.length === 0) throw new SurveyItemsInsufficient(1, `${template}#${seq}`);
    const key = (S: CardItem[]): string =>
      S.map((c) => c.id)
        .sort()
        .join("+");
    const explore = r() < D.stage1.epsilonExplore || d.noneCount >= D.noneExploreAfter;
    let chosen: CardItem[];
    if (explore) chosen = ok[0] as CardItem[];
    else {
      let best = -Infinity;
      chosen = ok[0] as CardItem[];
      for (const S of ok) {
        const s = stage1Score(
          d.post,
          S.map((c) => c.x),
          input.types,
        );
        if (s > best || (s === best && key(S) < key(chosen))) {
          best = s;
          chosen = S;
        }
      }
    }
    const placed = shuffle(chosen, r);
    return {
      seq,
      stage: 1,
      kind: "four",
      itemKey: key(chosen),
      template,
      options: placed.map((c, slot) => ({ itemId: c.id, slot, x: c.x })),
      policy: explore ? "explore" : "dopt",
      debug: {},
    };
  }

  function stage2(seq: number, d: Derived): Question | null {
    const r = rngFor(input.seed, seq);
    const n2 = d.rows.filter((x) => x.q.stage === 2).length;
    // 2.6.3 검증 문항
    if (
      n2 + 1 === STAGE_SPEC.checkAtStage2 &&
      !d.checked &&
      d.firstAb &&
      d.firstAb.a.kind !== "cant_tell" &&
      d.rows.length <= STAGE_SPEC.checkMaxAnswered
    ) {
      const f = d.firstAb.q;
      return {
        ...f,
        seq,
        kind: "check",
        policy: "check",
        options: [...f.options].reverse().map((o, slot) => ({ ...o, slot })),
        debug: {},
      };
    }
    const sd = d.post.var.map(Math.sqrt);
    const open = AXIS_IDS.map((_, k) => k).filter(
      (k) => (sd[k] ?? 0) > D.sigmaStop && !d.insensitive.has(k),
    );
    if (open.length === 0) return null;
    const kStar = open.reduce(
      (best, k) => ((d.post.var[k] ?? 0) > (d.post.var[best] ?? 0) ? k : best),
      open[0] as number,
    );
    const axis = AXIS_IDS[kStar] as string;
    const order = nearestType(d.post.mu, sd, input.types).order;
    let cands: PairItem[] = [];
    for (const t of order) {
      cands = input.items.pairs.filter((p) => p.typeId === t && p.axis === axis);
      if (cands.length >= STAGE_SPEC.minPairsPerType) break;
    }
    if ((d.cantTell[kStar] ?? 0) === 1) cands = cands.filter((p) => lk(p.levels) === WIDE_PAIR);
    if (cands.length === 0) throw new SurveyItemsInsufficient(2, `${axis}`);
    const lvl = (p: PairItem): number =>
      LEVEL_ORDER.indexOf(lk(p.levels) as (typeof LEVEL_ORDER)[number]);
    let best = cands[0] as PairItem;
    let bestH = -Infinity;
    for (const p of [...cands].sort((a, b) => lvl(a) - lvl(b))) {
      const h = fisherDiag([p.a.x, p.b.x], d.post.mu, D.beta, D.lambda)[kStar] ?? 0;
      if (h > bestH) {
        bestH = h;
        best = p;
      }
    }
    const sides = r() < NEUTRAL_SIDE ? [best.a, best.b] : [best.b, best.a];
    return {
      seq,
      stage: 2,
      kind: "ab",
      itemKey: best.id,
      axis,
      pairId: best.id,
      options: sides.map((o, slot) => ({ itemId: o.id, slot, x: o.x })),
      policy: "ab",
      debug: { argmaxOpenAxis: axis },
    };
  }

  function next(): Question | null {
    if (pending) return pending;
    if (done(cur)) return null;
    const seq = cur.rows.length + 1;
    const q = cur.rows.length < D.stage1Questions ? stage1(seq, cur) : stage2(seq, cur);
    pending = q;
    return q;
  }

  function answer(a: Answer): void {
    const q = pending ?? next();
    if (!q || q.seq !== a.seq)
      throw new Error(`answer: 기대 seq ${q?.seq ?? "없음"}, 받은 ${a.seq}`);
    if (a.kind === "option" && !q.options.some((o) => o.itemId === a.chosen))
      throw new Error(`answer: 선택지 밖 ${a.chosen ?? ""}`);
    log = [...log, { q, a }];
    cur = derive(log);
    pending = null;
    backed = false;
  }
  function canBack(): boolean {
    return !backed && log.length > 0;
  }
  function back(): void {
    if (!canBack()) throw new Error("back: 불가(직전 1건만, 연속 불가)");
    const last = log.at(-1) as LogRow;
    log = log.slice(0, -1);
    cur = derive(log);
    pending = last.q; // 같은 문항·같은 위치로 다시 표시
    backed = true;
  }

  function result() {
    const d = cur;
    const sd = d.post.var.map(Math.sqrt);
    const nt = nearestType(d.post.mu, sd, input.types);
    const opts = d.rows.filter((x) => x.a.kind === "option" && x.q.kind !== "check");
    const flags: string[] = [];
    let typeId = nt.typeId;
    let secondTypeId = nt.secondTypeId;
    let isBoundary = nt.isBoundary;
    if (nt.isTie) flags.push("tie");
    if (opts.length < D.typing.lowSignalMinPicks) flags.push("low_signal");
    else {
      // 2.12.2 상충
      const picks = new Map<string, number>();
      for (const x of opts.filter((o) => o.q.stage === 1)) {
        const t = cardType.get(x.a.chosen ?? "") ?? "";
        picks.set(t, (picks.get(t) ?? 0) + 1);
      }
      const many = [...picks.entries()].filter(([, n]) => n >= D.typing.conflictMinPicks);
      const center = (id: string): Vec => input.types.find((t) => t.id === id)?.centroid ?? [];
      for (let i = 0; i < many.length; i++)
        for (let j = i + 1; j < many.length; j++) {
          const [A, nA] = many[i] as [string, number];
          const [B, nB] = many[j] as [string, number];
          if (
            dist(center(A), center(B)) < D.typing.conflictMinCenterDist ||
            flags.includes("conflict")
          )
            continue;
          const dA = r6(dist(d.post.mu, center(A)));
          const dB = r6(dist(d.post.mu, center(B)));
          const idx = (id: string): number => input.types.findIndex((t) => t.id === id);
          const aFirst = dA < dB || (dA === dB && (nA > nB || (nA === nB && idx(A) < idx(B))));
          typeId = aFirst ? A : B;
          secondTypeId = aFirst ? B : A;
          isBoundary = true;
          flags.push("conflict");
        }
    }
    // 2.10 위치 편향
    const s1 = opts.filter((o) => o.q.stage === 1);
    const ab = opts.filter((o) => o.q.stage === 2);
    const biased = (rows: LogRow[]): boolean => {
      if (rows.length < D.positionBias.minAnswers) return false;
      const slots = rows.map((x) => x.q.options.find((o) => o.itemId === x.a.chosen)?.slot ?? -1);
      const top = Math.max(...[...new Set(slots)].map((s) => slots.filter((y) => y === s).length));
      return top / rows.length >= D.positionBias.sameSlotRatio;
    };
    const positionBias = biased(s1) || biased(ab);
    if (positionBias) flags.push("position_bias");
    const fast = d.rows.filter((x) => (x.a.latencyMs ?? Infinity) < D.fastAnswerMs).length;
    if (d.rows.length > 0 && fast / d.rows.length >= RESULT_SPEC.fastRatio)
      flags.push("fast_answers");
    // 2.9.1 κ
    let kappa = 0;
    const scored = opts.filter((o) => o.ell !== undefined);
    if (scored.length >= D.consistency.minScored) {
      const L =
        scored.reduce((s, o) => s + Math.log((o.ell ?? 0) * o.q.options.length), 0) / scored.length;
      const k0 = Math.min(1, Math.max(0, (L - tu.llChance) / (tu.llRef - tu.llChance)));
      const chk = d.rows.find((x) => x.q.kind === "check");
      const firstPick = d.firstAb?.a.chosen;
      const adj =
        !chk || chk.a.kind !== "option"
          ? 0
          : chk.a.chosen === firstPick
            ? D.consistency.checkBonus
            : -D.consistency.checkBonus;
      kappa = Math.min(1, Math.max(0, k0 + adj));
      if (positionBias)
        kappa =
          kappa >= KAPPA_SPEC.high
            ? KAPPA_SPEC.midCap
            : kappa >= KAPPA_SPEC.low
              ? KAPPA_SPEC.lowCap
              : kappa;
    } else if (!flags.includes("low_signal")) flags.push("low_signal");
    const confidence =
      flags.includes("low_signal") ||
      flags.includes("conflict") ||
      kappa < KAPPA_SPEC.low ||
      (flags.includes("fast_answers") && nt.margin < RESULT_SPEC.highMargin)
        ? "low"
        : nt.margin >= RESULT_SPEC.highMargin && kappa >= KAPPA_SPEC.high && flags.length === 0
          ? "high"
          : "medium";
    const notice: Notice | null = pickNotice({ flags, kappa, isBoundary });
    const order = nt.order.filter((t) => t !== typeId);
    return {
      typeId,
      secondTypeId,
      adjacentTypeIds: order.slice(0, 2),
      isBoundary,
      confidence,
      flags,
      notice,
      kappa: r6(kappa),
      mu: d.post.mu.map(r6),
      var: d.post.var.map(r6),
      axes: AXIS_KEYS.map((key, k) => ({
        key,
        mu: r6(d.post.mu[k] ?? 0),
        sigma: r6(sd[k] ?? 0),
        sigmaDisplay: r6((sd[k] ?? 0) * tu.calibKappa),
        state: d.insensitive.has(k)
          ? "insensitive"
          : (sd[k] ?? 0) > D.sigmaStop
            ? "open"
            : "confirmed",
      })),
      insensitiveAxes: [...d.insensitive].map((k) => AXIS_KEYS[k] as string),
      endReason: done(d),
      seed: input.seed,
      consistencyDetail: { positionBias, scored: scored.length },
      versions: {
        engine: ENGINE_VERSION,
        types: input.versions?.types ?? "unknown",
        items: input.versions?.items ?? "unknown",
        normalizer: input.versions?.normalizer ?? "unknown",
      },
    };
  }

  return {
    next,
    answer,
    back,
    canBack,
    result,
    state: () => ({
      mu: [...cur.post.mu],
      var: [...cur.post.var],
      insensitive: [...cur.insensitive].map((k) => AXIS_IDS[k] as string),
      answered: cur.rows.length,
    }),
    log: () => log.map((r) => ({ ...r })),
  };
}
/** A/B 좌우 배정 기준(공정 동전). */
const NEUTRAL_SIDE = 0.5;
