// 07장 7.2.2 골든 응답 로그 생성·재생(build-answers, M1a). 계약 ASSUMPTIONS ASM-097.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { findRepoRoot } from "@tastefit/config";
import { createEngine, type EngineItems, type Question } from "./engine.js";
import { r6, type TypeCenter, type Vec } from "./model.js";

export const GOLDEN_AXES = ["expression", "temperature", "shape", "density", "depth"] as const;
type L1 = Record<(typeof GOLDEN_AXES)[number], number>;

export interface GoldenAnswer {
  seq: number;
  stage: 1 | 2;
  kind: "pick4" | "ab" | "check";
  item_id: string;
  shown: { option_id: string; slot: number }[];
  answer: "option" | "none_of_these" | "cant_tell";
  chosen_option_id: string | null;
}
export interface GoldenCase {
  id: string;
  kind: "core" | "edge";
  purpose: string;
  persona: { thetaStar: L1; simulator: { beta: number; policy: string; seed: number } };
  answers: GoldenAnswer[] | null;
  expected: { typeId: string; muRef: L1 | null } & Record<string, unknown>;
  [k: string]: unknown;
}

/** 7.2.3 θ* 클립 범위, 7.2.2 오프셋 축 교체 규칙((A1, A2) → (A3, A4)). */
export const GOLDEN_SPEC = { clip: [0.05, 0.95], swapTo: [2, 3] } as const;

interface ManItem {
  assetId: string;
  kind: string;
  status: string;
  templateId: string;
  axis: string | null;
  level: number | null;
  pairImageIds: string[] | null;
  x: Vec | null;
  assets: { mobile?: unknown } | null;
}
/** manifest.lock의 active 항목 → 엔진 입력(x = x_card). */
export function engineItemsFromManifest(items: readonly ManItem[]): EngineItems {
  const act = items.filter((i) => i.status === "active");
  const by = new Map(act.map((i) => [i.assetId, i]));
  return {
    cards: act
      .filter((i) => i.kind === "card" && i.x)
      .map((i) => ({
        id: i.assetId,
        sv: /^C-(SV\d\d)-/.exec(i.assetId)?.[1] ?? i.assetId,
        template: i.templateId,
        x: i.x as Vec,
        mobile: !!i.assets?.mobile,
      })),
    pairs: act
      .filter((i) => i.kind === "ab_pair" && i.pairImageIds?.length === 2)
      .flatMap((p) => {
        const [a, b] = (p.pairImageIds ?? []).map((id) => by.get(id));
        if (!a?.x || !b?.x) return [];
        return [
          {
            id: p.assetId,
            axis: p.axis ?? "",
            typeId: /^ABP-(T\d)-/.exec(p.assetId)?.[1] ?? "",
            levels: [Number(a.level), Number(b.level)] as [number, number],
            a: { id: a.assetId, x: a.x },
            b: { id: b.assetId, x: b.x },
          },
        ];
      }),
  };
}

let CTX: { items: EngineItems; types: TypeCenter[] } | null = null;
/** 저장소 기본 입력: data/survey/manifest.lock.json active + data/taxonomy/types.json. */
export function goldenContext(root: string = findRepoRoot()): {
  items: EngineItems;
  types: TypeCenter[];
} {
  if (CTX) return CTX;
  const read = <T>(rel: string): T => JSON.parse(readFileSync(join(root, rel), "utf8")) as T;
  CTX = {
    items: engineItemsFromManifest(
      read<{ items: ManItem[] }>("data/survey/manifest.lock.json").items,
    ),
    types: read<{ items: TypeCenter[] }>("data/taxonomy/types.json").items,
  };
  return CTX;
}

const vecOf = (o: L1): Vec => GOLDEN_AXES.map((k) => o[k]);
const objOf = (v: Vec): L1 =>
  Object.fromEntries(GOLDEN_AXES.map((k, i) => [k, r6(v[i] ?? 0)])) as L1;
const slots = (q: Question) => [...q.options].sort((a, b) => a.slot - b.slot);

/** persona 시뮬레이터(argmax): θ*와 λ 가중 제곱거리가 가장 작은 선택지(동률은 slot 순). */
function simulateAnswers(
  c: GoldenCase,
  theta: Vec,
  ctx: { items: EngineItems; types: TypeCenter[] },
): GoldenAnswer[] {
  const eng = createEngine({ ...ctx, seed: String(c.persona.simulator.seed), purpose: c.purpose });
  const out: GoldenAnswer[] = [];
  for (let q = eng.next(); q; q = eng.next()) {
    const opts = slots(q);
    const d = opts.map((o) => o.x.reduce((s, v, k) => s + (v - (theta[k] ?? 0)) ** 2, 0));
    const best = opts[d.indexOf(Math.min(...d))] ?? opts[0];
    eng.answer({ seq: q.seq, kind: "option", chosen: best?.itemId });
    out.push({
      seq: q.seq,
      stage: q.stage,
      kind: q.kind === "check" ? "check" : opts.length === 2 ? "ab" : "pick4",
      item_id: q.itemKey,
      shown: opts.map((o) => ({ option_id: o.itemId, slot: o.slot })),
      answer: "option",
      chosen_option_id: best?.itemId ?? null,
    });
  }
  return out;
}

/** 응답 로그를 엔진으로 재생(02장 2.15). 로그가 현재 문항과 맞지 않으면 typeId "" (M1a FAIL). */
export function replayGolden(
  c: GoldenCase,
  o: { beta?: number; items?: EngineItems; types?: TypeCenter[] } = {},
): { mu: Vec; typeId: string } {
  const ctx = o.items && o.types ? { items: o.items, types: o.types } : goldenContext();
  const eng = createEngine({
    ...ctx,
    seed: String(c.persona.simulator.seed),
    purpose: c.purpose,
    ...(o.beta === undefined ? {} : { beta: o.beta }),
  });
  try {
    for (const a of c.answers ?? []) {
      eng.next();
      eng.answer({
        seq: a.seq,
        kind: a.answer,
        ...(a.chosen_option_id ? { chosen: a.chosen_option_id } : {}),
      });
    }
  } catch {
    return { mu: GOLDEN_AXES.map(() => NaN), typeId: "" };
  }
  const r = eng.result();
  return { mu: r.mu, typeId: r.typeId };
}

/** 7.2.2 규칙: 생성 → 재생 typeId 검사 → 불일치면 오프셋 축 교체 1회 → 그래도면 오류. */
export function buildGoldenAnswers(
  c: GoldenCase,
  ctx: { items: EngineItems; types: TypeCenter[] } = goldenContext(),
): GoldenCase {
  const theta0 = vecOf(c.persona.thetaStar);
  const center = ctx.types.find((t) => t.id === c.expected.typeId)?.centroid ?? theta0;
  const tries: Vec[] = [theta0];
  const off = theta0.map((v, k) => r6(v - (center[k] ?? 0)));
  const nz = off.filter((v) => v !== 0);
  const swapped = center.map((v) => v);
  GOLDEN_SPEC.swapTo.forEach((k, i) => {
    swapped[k] = Math.min(
      GOLDEN_SPEC.clip[1],
      Math.max(GOLDEN_SPEC.clip[0], (center[k] ?? 0) + (nz[i] ?? 0)),
    );
  });
  tries.push(swapped);
  for (const th of tries) {
    const answers = simulateAnswers(c, th, ctx);
    const r = replayGolden({ ...c, answers }, ctx);
    if (r.typeId === c.expected.typeId)
      return {
        ...c,
        persona: { ...c.persona, thetaStar: th === theta0 ? c.persona.thetaStar : objOf(th) },
        answers,
        expected: { ...c.expected, muRef: objOf(r.mu) },
      };
  }
  throw new Error(
    `build-answers: ${c.id} 재생 유형이 ${c.expected.typeId}와 다름(오프셋 축 교체 후에도)`,
  );
}
