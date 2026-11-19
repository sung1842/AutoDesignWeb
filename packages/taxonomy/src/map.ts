// mapL1toL2(03장 3.3): 앵커 상대 이동. 순수 함수, 입력 데이터는 호출자가 data/taxonomy에서 읽어 넘긴다.
// purpose = null(설문 자극물, 3.4.8) 경로만 구현한다. 용도 허용 집합 교차·snapToFeasible은 04장(M2·M3).

export const AXES = ["A1", "A2", "A3", "A4", "A5"] as const;
export type Axis = (typeof AXES)[number];
export type L1 = readonly [number, number, number, number, number];
export type L2 = Record<string, string>;

export interface TaxKey {
  id: string;
  values: string[];
  ordinal: boolean;
}
export interface MapRow {
  id: string;
  kind: "ordinal" | "categorical";
  axis?: Axis;
  sign?: number;
  /** null = 허용 집합(또는 페어링 웨이트) 크기 − 1 */
  k?: number | null;
}
export interface PresetLite {
  id: string;
  typeId: string;
  l1: L1;
  l2: L2;
  allowed: Record<string, string[]>;
}
export interface PairingLite {
  code: string;
  headlineWeights: string[];
  defaultHeadlineWeight: string;
  sig: { temp: number; expr: number; soft: number };
}
export interface PaletteLite {
  id: string;
  warm: number;
  chromaScore: number;
}
export interface MapData {
  taxonomy: TaxKey[];
  mapping: MapRow[];
  pairings: PairingLite[];
  palettes: PaletteLite[];
}

const ax = (a: Axis): number => AXES.indexOf(a);
const EPS = 1e-9;

/** 3.3.2 round: 0.5는 0 쪽으로(앵커 유지 우선). */
export function roundHalfToZero(x: number): number {
  const a = Math.abs(x);
  const r = Math.max(0, Math.ceil(a - 0.5 - EPS));
  return x < 0 ? -r : r;
}

/** 3.3.2 clampToAllowed: 범위로 자른 뒤 허용 밖이면 같은 방향의 가장 가까운 허용 값, 없으면 반대 방향. */
export function clampToAllowed(
  values: readonly string[],
  idx: number,
  allowed: readonly string[],
  dir: number,
): string {
  const n = values.length;
  const i = Math.min(n - 1, Math.max(0, idx));
  const ok = (j: number): boolean => allowed.includes(values[j] ?? "");
  if (ok(i)) return values[i] ?? "";
  const step = dir < 0 ? -1 : 1;
  for (const s of [step, -step])
    for (let j = i + s; j >= 0 && j < n; j += s) if (ok(j)) return values[j] ?? "";
  throw new Error(`허용 값 없음: ${values.join(",")}`);
}

function pickPairing(t: L1, p: PresetLite, data: MapData): PairingLite {
  const byCode = new Map(data.pairings.map((x) => [x.code, x]));
  const anchor = byCode.get(p.l2["type.pairing_id"] ?? "");
  if (!anchor) throw new Error(`앵커 페어링 없음: ${p.id}`);
  const d = (a: Axis): number => (t[ax(a)] ?? 0) - (p.l1[ax(a)] ?? 0);
  const target = {
    temp: anchor.sig.temp + d("A2"),
    expr: anchor.sig.expr + d("A1"),
    soft: anchor.sig.soft + d("A3"),
  };
  const cost = (f: PairingLite): number =>
    0.5 * (f.sig.temp - target.temp) ** 2 +
    0.25 * (f.sig.expr - target.expr) ** 2 +
    0.25 * (f.sig.soft - target.soft) ** 2;
  const cands = (p.allowed["type.pairing_id"] ?? [])
    .map((c) => byCode.get(c))
    .filter((x): x is PairingLite => x !== undefined)
    .sort((a, b) => (a.code < b.code ? -1 : 1));
  let best = anchor;
  let bestCost = cost(anchor);
  for (const f of cands) {
    const c = cost(f);
    if (c < bestCost - 1e-6) {
      best = f;
      bestCost = c;
    }
  }
  return best;
}

function pickPalette(t: L1, p: PresetLite, data: MapData): string {
  const ids = p.allowed["color.palette_id"] ?? [];
  const pals = ids
    .map((id) => data.palettes.find((q) => q.id === id))
    .filter((x): x is PaletteLite => x !== undefined);
  const pal0 = pals.find((q) => q.id.endsWith("-0")) ?? pals[0];
  if (!pal0) throw new Error(`팔레트 없음: ${p.id}`);
  const targetWarm = pal0.warm + ((t[1] ?? 0) - (p.l1[1] ?? 0));
  const targetChroma = pal0.chromaScore + ((t[0] ?? 0) - (p.l1[0] ?? 0));
  const cost = (q: PaletteLite): number =>
    Math.abs(q.warm - targetWarm) + 0.5 * Math.abs(q.chromaScore - targetChroma);
  let best = pal0;
  let bestCost = cost(pal0);
  for (const q of pals) {
    const c = cost(q);
    if (c < bestCost - 1e-6) {
      best = q;
      bestCost = c;
    }
  }
  return best.id;
}

/** 03장 3.3 `mapL1toL2(t, typeId)`(purpose = null). 반환 = L2 18키. */
export function mapL1toL2(t: L1, preset: PresetLite, data: MapData): L2 {
  const out: L2 = { ...preset.l2 };
  const pairing = pickPairing(t, preset, data);
  out["type.pairing_id"] = pairing.code;
  out["color.palette_id"] = pickPalette(t, preset, data);
  const tax = new Map(data.taxonomy.map((k) => [k.id, k]));
  for (const row of data.mapping) {
    if (row.kind !== "ordinal" || !row.axis) continue;
    const key = row.id;
    const full = tax.get(key)?.values ?? [];
    const allowed = preset.allowed[key] ?? full;
    const delta = (t[ax(row.axis)] ?? 0) - (preset.l1[ax(row.axis)] ?? 0);
    const sign = row.sign ?? 1;
    let list: string[];
    let fromAllowedOrder = false;
    if (key === "type.headline_weight") {
      list = pairing.headlineWeights.filter((w) => allowed.includes(w));
      fromAllowedOrder = true;
    } else if (row.k === null || row.k === undefined) {
      // 서수 = 허용 집합 안의 순서(media.treatment는 duotone 제외, 시그니처 전용)
      list = full.filter((v) => allowed.includes(v) && v !== "duotone");
      fromAllowedOrder = true;
    } else if (key === "depth.shadow_level") {
      list = full.slice(0, 3); // 3은 예약값(3.2.1)
    } else list = full;
    const k = row.k ?? Math.max(0, list.length - 1);
    const anchorVal = preset.l2[key] ?? "";
    let i0 = list.indexOf(anchorVal);
    if (i0 < 0 && key === "type.headline_weight") i0 = list.indexOf(pairing.defaultHeadlineWeight);
    if (i0 < 0) i0 = 0;
    const move = roundHalfToZero(sign * delta * k);
    out[key] = fromAllowedOrder
      ? (list[Math.min(list.length - 1, Math.max(0, i0 + move))] ?? anchorVal)
      : clampToAllowed(list, i0 + move, allowed, move);
  }
  return out;
}
