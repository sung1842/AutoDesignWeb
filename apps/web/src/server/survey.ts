// 진단(익명) API 서비스: 06장 6.2.2·6.4.3·6.5.1, 02장 2.3. 엔진은 결정론 순수 함수라 매 요청 응답 로그를 재생해 상태를 만든다.
// LLM·렌더 호출 0(09장 M4 ⑥). 계약: ASSUMPTIONS ASM-095·099.
import { randomInt, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { findRepoRoot, getThresholds } from "@tastefit/config";
import { q, type Tx } from "@tastefit/db";
import {
  createEngine,
  SurveyItemsInsufficient,
  ENGINE_VERSION,
  type EngineItems,
  type Question,
  type Vec,
} from "@tastefit/diagnosis";
import type { ResultView, SubmitAnswerReq, SurveyView } from "@tastefit/api-contract";
import { ApiError } from "./http";
import { serverEvent } from "./events";

type Obj = Record<string, unknown>;
const AXIS_KEYS = ["expression", "temperature", "shape", "density", "depth"] as const;
const AXIS_ID: Record<string, string> = {
  expression: "A1",
  temperature: "A2",
  shape: "A3",
  density: "A4",
  depth: "A5",
};
/** 02장 2.3.2 이탈: 마지막 활동 30분. SurveyView.maxQuestions = diagnosis.maxQuestions. */
const SESSION = { abandonMin: 30 } as const;
const D = getThresholds().diagnosis as unknown as {
  maxQuestions: number;
  stage1Questions: number;
  stage1: { epsilonExplore: number };
  similarSites: { maxScore: number; tau: number; count: number };
};

interface TypeRow {
  id: string;
  nameKo: string;
  descriptionKo: string;
  keywordsKo: string[];
  centroid: Vec;
  anchorPresetId: string;
}
interface RepoData {
  types: TypeRow[];
  presets: Map<string, { l2: Record<string, string> }>;
  pairings: Map<string, string>;
  palettes: Map<string, string[]>;
}
let REPO: RepoData | null = null;
function repo(): RepoData {
  if (REPO) return REPO;
  const root = findRepoRoot();
  const items = <T>(rel: string): T[] =>
    (JSON.parse(readFileSync(join(root, rel), "utf8")) as { items: T[] }).items;
  const presets = new Map<string, { l2: Record<string, string> }>();
  for (const t of items<TypeRow>("data/taxonomy/types.json")) {
    const p = items<{ id: string; l2: Record<string, string> }>(
      `data/taxonomy/presets/${t.anchorPresetId}.json`,
    )[0];
    if (p) presets.set(p.id, p);
  }
  REPO = {
    types: items<TypeRow>("data/taxonomy/types.json"),
    presets,
    pairings: new Map(
      items<{ id: string; nameKo: string }>("data/fonts/pairings.json").map((x) => [
        x.id,
        x.nameKo,
      ]),
    ),
    palettes: new Map(
      items<{ id: string; roles: Record<string, { hex: string }> }>(
        "data/taxonomy/palettes.json",
      ).map((x) => [
        x.id,
        ["bg", "surface", "fg", "primary", "accent"].flatMap((r) =>
          x.roles[r] ? [x.roles[r].hex] : [],
        ),
      ]),
    ),
  };
  return REPO;
}

const vec = (o: unknown): Vec => AXIS_KEYS.map((k) => Number((o as Obj | null)?.[k] ?? 0));

export async function currentSeason(tx: Tx): Promise<string> {
  const r = await q(
    tx,
    "select version from taxonomy_releases where status = 'active' order by release_date desc, version desc limit 1",
  );
  const v = r.rows[0]?.version;
  if (typeof v !== "string")
    throw new ApiError("SURVEY_ITEMS_INSUFFICIENT", "no active season", {
      stage: 1,
      itemKey: "season",
    });
  return v;
}

interface ItemRow {
  id: string;
  kind: string;
  stage: number | null;
  template_id: string;
  axis: string | null;
  level: number | null;
  pair_image_ids: string[] | null;
  x_card: Obj | null;
  assets: {
    desktop: { path: string; w: number; h: number };
    mobile?: { path: string; w: number; h: number };
  } | null;
  alt_text: string | null;
  dominant_colors: string[] | null;
  focus_region: Obj | null;
}
/** 활성 자극물. 품질 감시로 제외된 쌍(low_discrimination)은 빼되, 세션 시작(startedAt) 뒤에 제외된 쌍은 둔다
 * (진행 중 세션의 문항 풀이 바뀌면 응답 로그 재생이 달라지므로, 2.15·AC-02-18). */
export async function activeItems(
  tx: Tx,
  tv: string,
  startedAt: Date | null = null,
): Promise<ItemRow[]> {
  return (
    await q(
      tx,
      `select id, kind, stage, template_id, axis, level, pair_image_ids, x_card, assets, alt_text, dominant_colors, focus_region
         from survey_items where taxonomy_version = $1 and status = 'active'
           and not (kind = 'ab_pair' and coalesce(stats->>'flag', '') = 'low_discrimination'
                    and ($2::timestamptz is null or (stats->>'flagged_at')::timestamptz <= $2::timestamptz))
         order by id`,
      [tv, startedAt],
    )
  ).rows as unknown as ItemRow[];
}

/** 활성 행 → 엔진 입력(x = x_card, S-05). 쌍은 두 이미지가 활성일 때만. */
function engineItems(rows: ItemRow[]): EngineItems {
  const byId = new Map(rows.map((r) => [r.id, r]));
  return {
    cards: rows
      .filter((r) => r.kind === "card" && r.x_card)
      .map((r) => ({
        id: r.id,
        sv: /^C-(SV\d\d)-/.exec(r.id)?.[1] ?? r.id,
        template: r.template_id,
        x: vec(r.x_card),
        mobile: !!r.assets?.mobile,
      })),
    pairs: rows
      .filter((r) => r.kind === "ab_pair" && r.pair_image_ids?.length === 2)
      .flatMap((r) => {
        const [a, b] = (r.pair_image_ids ?? []).map((id) => byId.get(id));
        if (!a?.x_card || !b?.x_card) return [];
        return [
          {
            id: r.id,
            axis: AXIS_ID[r.axis ?? ""] ?? "",
            typeId: /^ABP-(T\d)-/.exec(r.id)?.[1] ?? "",
            levels: [Number(a.level), Number(b.level)] as [number, number],
            a: { id: a.id, x: vec(a.x_card) },
            b: { id: b.id, x: vec(b.x_card) },
          },
        ];
      }),
  };
}

export function surveyItemsView(rows: ItemRow[], tv: string, webOrigin: string) {
  const url = (p: string) => `${webOrigin.replace(/\/$/, "")}/api/_storage/public/${p}`;
  return {
    taxonomyVersion: tv,
    engineVersion: ENGINE_VERSION,
    items: rows.map((r) => ({
      id: r.id,
      stage: r.stage,
      kind: r.kind,
      templateId: r.template_id,
      ...(r.axis ? { axis: r.axis } : {}),
      ...(r.level !== null ? { level: Number(r.level) } : {}),
      ...(r.pair_image_ids ? { pairImageIds: r.pair_image_ids } : {}),
      xCard: r.x_card,
      assets: r.assets
        ? {
            desktop: {
              url: url(r.assets.desktop.path),
              w: r.assets.desktop.w,
              h: r.assets.desktop.h,
            },
            ...(r.assets.mobile
              ? {
                  mobile: {
                    url: url(r.assets.mobile.path),
                    w: r.assets.mobile.w,
                    h: r.assets.mobile.h,
                  },
                }
              : {}),
          }
        : null,
      altText: r.alt_text,
      dominantColors: r.dominant_colors,
      focusRegion: r.focus_region,
    })),
  };
}

interface Session {
  id: string;
  anon_id: string;
  user_id: string | null;
  taxonomy_version: string;
  seed: number;
  purpose_hint: string | null;
  status: string;
  entry: string;
  state: Obj | null;
  started_at: Date;
  last_active_at: Date;
}
interface AnswerRow {
  seq: number;
  question_id: string;
  item_id: string;
  shown: { option_id: string; slot: number }[];
  answer: "option" | "none_of_these" | "cant_tell";
  chosen_option_id: string | null;
  latency_ms: number;
}

const kindOf = (qq: Question): "pick4" | "ab" => (qq.options.length === 2 ? "ab" : "pick4");
const optionIds = (qq: Question): string[] =>
  [...qq.options].sort((a, b) => a.slot - b.slot).map((o) => o.itemId);

/** 세션 엔진: 활성 응답을 순서대로 재생한다. backed면 직전 문항으로 되돌린 상태(연속 뒤로가기 불가). */
async function engineFor(tx: Tx, s: Session) {
  const ans = (
    await q(
      tx,
      `select seq, question_id, item_id, shown, answer, chosen_option_id, latency_ms
         from survey_answers where session_id = $1 and not superseded order by seq`,
      [s.id],
    )
  ).rows as unknown as AnswerRow[];
  const rows = await activeItems(tx, s.taxonomy_version, s.started_at);
  const eng = createEngine({
    items: engineItems(rows),
    types: repo().types,
    seed: String(s.seed),
    purpose: s.purpose_hint,
    versions: { types: s.taxonomy_version, items: s.taxonomy_version },
  });
  for (const a of ans) {
    eng.next();
    eng.answer({
      seq: a.seq,
      kind: a.answer,
      ...(a.chosen_option_id ? { chosen: a.chosen_option_id } : {}),
      latencyMs: a.latency_ms,
    });
  }
  return { eng, ans };
}

function view(
  s: Session,
  eng: ReturnType<typeof createEngine>,
  backed: boolean,
  resultId: string | null,
): SurveyView {
  const qq = s.status === "completed" ? null : eng.next();
  const st = eng.state();
  return {
    id: s.id,
    status: s.status === "completed" ? "completed" : "in_progress",
    stage: (qq?.stage ?? (st.answered >= D.stage1Questions ? 2 : 1)) as 1 | 2,
    answered: st.answered,
    maxQuestions: 16,
    state: {
      ...st,
      seed: s.seed,
      versions: { engine: ENGINE_VERSION, taxonomy: s.taxonomy_version },
    },
    question: qq
      ? {
          seq: qq.seq,
          itemKey: qq.itemKey,
          kind: kindOf(qq),
          items: optionIds(qq),
          allowNone: kindOf(qq) === "pick4",
          allowCantTell: kindOf(qq) === "ab",
        }
      : null,
    canUndo: s.status !== "completed" && !backed && st.answered > 0,
    resultId,
  };
}

const notFound = (): ApiError => new ApiError("NOT_FOUND", "not found");
async function ownedSession(
  tx: Tx,
  id: string,
  anonId: string | null,
  lock = false,
): Promise<Session> {
  if (!anonId || !/^[0-9a-f-]{36}$/.test(id)) throw notFound();
  const r = await q(
    tx,
    `select * from diagnosis_sessions where id = $1 and anon_id = $2${lock ? " for update" : ""}`,
    [id, anonId],
  );
  const s = r.rows[0] as unknown as Session | undefined;
  if (!s) throw notFound();
  return s;
}
const resultIdOf = async (tx: Tx, sid: string): Promise<string | null> =>
  ((await q(tx, "select id from diagnosis_results where session_id = $1", [sid])).rows[0]?.id as
    string | undefined) ?? null;

function insufficient(e: unknown): never {
  if (e instanceof SurveyItemsInsufficient)
    throw new ApiError("SURVEY_ITEMS_INSUFFICIENT", e.message, {
      stage: e.stage,
      itemKey: e.itemKey,
    });
  throw e;
}

export async function startSurvey(
  tx: Tx,
  anonId: string,
  body: { entry: string; purposeHint?: string; restart?: boolean },
): Promise<{ status: 200 | 201; view: SurveyView }> {
  const tv = await currentSeason(tx);
  const open = (
    await q(
      tx,
      "select * from diagnosis_sessions where anon_id = $1 and status in ('in_progress','abandoned') for update",
      [anonId],
    )
  ).rows[0] as unknown as Session | undefined;
  if (open && open.taxonomy_version === tv && !body.restart) {
    await q(
      tx,
      "update diagnosis_sessions set status = 'in_progress', last_active_at = now() where id = $1",
      [open.id],
    );
    const s = { ...open, status: "in_progress" };
    const { eng } = await engineFor(tx, s);
    try {
      eng.next();
    } catch (e) {
      insufficient(e);
    }
    await serverEvent(tx, {
      name: "survey_start",
      anonId,
      tv,
      props: { survey_session_id: s.id, entry: body.entry, is_resume: true },
    });
    return { status: 200, view: view(s, eng, s.state?.backed === true, null) };
  }
  if (open)
    // 기존 미완료 세션은 결과 없이 종료(6.4.3 restart·시즌 변경, ASM-099 ②)
    await q(
      tx,
      `update diagnosis_sessions set status = 'completed', completed_at = now(),
         state = coalesce(state, '{}'::jsonb) || '{"ended":"restart"}'::jsonb where id = $1`,
      [open.id],
    );
  const s = (
    await q(
      tx,
      `insert into diagnosis_sessions (anon_id, taxonomy_version, seed, purpose_hint, status, entry, versions, state)
       values ($1, $2, $3, $4, 'in_progress', $5, $6, '{}') returning *`,
      [
        anonId,
        tv,
        randomInt(1, 2 ** 31 - 1),
        body.purposeHint ?? null,
        body.entry,
        JSON.stringify({ engine: ENGINE_VERSION, types: tv, items: tv, normalizer: tv }),
      ],
    )
  ).rows[0] as unknown as Session;
  const { eng } = await engineFor(tx, s);
  try {
    eng.next();
  } catch (e) {
    insufficient(e);
  }
  await serverEvent(tx, {
    name: "survey_start",
    anonId,
    tv,
    props: { survey_session_id: s.id, entry: body.entry, is_resume: false },
  });
  return { status: 201, view: view(s, eng, false, null) };
}

export async function currentSurvey(tx: Tx, anonId: string | null): Promise<SurveyView> {
  if (!anonId) throw notFound();
  const s = (
    await q(
      tx,
      "select * from diagnosis_sessions where anon_id = $1 and status in ('in_progress','abandoned')",
      [anonId],
    )
  ).rows[0] as unknown as Session | undefined;
  if (!s) throw notFound();
  const { eng } = await engineFor(tx, s);
  return view(s, eng, s.state?.backed === true, null);
}

const sameAnswer = (a: AnswerRow, b: SubmitAnswerReq): boolean =>
  a.item_id === b.itemKey &&
  a.answer === b.answer &&
  (a.chosen_option_id ?? undefined) === b.chosenItemId &&
  JSON.stringify([...a.shown].sort((x, y) => x.slot - y.slot).map((x) => x.option_id)) ===
    JSON.stringify(b.shownItemIds);

export async function submitAnswer(
  tx: Tx,
  id: string,
  anonId: string | null,
  b: SubmitAnswerReq,
): Promise<SurveyView> {
  const s = await ownedSession(tx, id, anonId, true);
  const { eng, ans } = await engineFor(tx, s);
  const prev = ans.find((a) => a.seq === b.seq);
  if (prev) {
    if (!sameAnswer(prev, b))
      throw new ApiError("SEQ_CONFLICT", "seq already answered", { seq: b.seq });
    return view(s, eng, s.state?.backed === true, await resultIdOf(tx, s.id));
  }
  if (s.status === "completed")
    throw new ApiError("SEQ_CONFLICT", "survey completed", { seq: b.seq });
  let qq: Question | null;
  try {
    qq = eng.next();
  } catch (e) {
    insufficient(e);
  }
  if (!qq || qq.seq !== b.seq)
    throw new ApiError("SEQ_CONFLICT", "unexpected seq", { expected: qq?.seq ?? null });
  const ids = optionIds(qq);
  if (b.itemKey !== qq.itemKey || JSON.stringify(b.shownItemIds) !== JSON.stringify(ids))
    throw new ApiError("VALIDATION_FAILED", "item mismatch", {
      issues: [{ path: "itemKey", code: "mismatch" }],
    });
  if (b.answer === "option" && !ids.includes(b.chosenItemId ?? ""))
    throw new ApiError("VALIDATION_FAILED", "chosen not shown", {
      issues: [{ path: "chosenItemId", code: "mismatch" }],
    });
  if (
    (b.answer === "none_of_these" && kindOf(qq) !== "pick4") ||
    (b.answer === "cant_tell" && kindOf(qq) !== "ab")
  )
    throw new ApiError("VALIDATION_FAILED", "answer kind", {
      issues: [{ path: "answer", code: "kind" }],
    });
  eng.answer({
    seq: b.seq,
    kind: b.answer,
    ...(b.chosenItemId ? { chosen: b.chosenItemId } : {}),
    latencyMs: b.latencyMs,
  });
  const attempt = Number(
    (
      await q(
        tx,
        "select count(*)::int as n from survey_answers where session_id = $1 and seq = $2",
        [s.id, b.seq],
      )
    ).rows[0]?.n ?? 0,
  );
  const policy = qq.policy === "ab" ? "ab_fisher" : qq.policy;
  const propensity =
    policy === "explore"
      ? D.stage1.epsilonExplore
      : policy === "dopt"
        ? 1 - D.stage1.epsilonExplore
        : 1;
  const shown = [...qq.options]
    .sort((x, y) => x.slot - y.slot)
    .map((o) => ({ option_id: o.itemId, slot: o.slot }));
  await q(
    tx,
    `insert into survey_answers (session_id, seq, question_id, stage, kind, item_id, shown, answer, chosen_option_id,
       latency_ms, policy, propensity, ux, client_ts)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
    [
      s.id,
      b.seq,
      `q-${s.id}-${b.seq}-${attempt}`,
      qq.stage,
      qq.kind === "check" ? "check" : kindOf(qq),
      qq.itemKey,
      JSON.stringify(shown),
      b.answer,
      b.chosenItemId ?? null,
      b.latencyMs,
      policy,
      propensity,
      b.ux ? JSON.stringify(b.ux) : null,
      b.clientTs,
    ],
  );
  const ux = (b.ux ?? {}) as Obj;
  const device =
    ux.viewportClass === "mobile" || ux.viewportClass === "tablet" ? ux.viewportClass : "desktop";
  await q(
    tx,
    "insert into impressions (session_id, seq, item_ids, slots, policy, propensity, device_class) values ($1, $2, $3, $4, $5, $6, $7)",
    [
      s.id,
      b.seq,
      shown.map((x) => x.option_id),
      shown.map((x) => x.slot),
      policy,
      propensity,
      device,
    ],
  );
  const st = eng.state();
  const strs = (k: string): string[] =>
    Array.isArray(ux[k]) ? (ux[k] as unknown[]).map(String) : [];
  await serverEvent(tx, {
    name: "survey_answer",
    anonId: s.anon_id,
    tv: s.taxonomy_version,
    device,
    props: {
      survey_session_id: s.id,
      stage: qq.stage,
      seq: b.seq,
      item_id: qq.itemKey,
      shown_option_ids: ids,
      answer: b.answer,
      ...(b.chosenItemId ? { chosen_option_id: b.chosenItemId } : {}),
      latency_ms: b.latencyMs,
      sigma_max_after: Math.sqrt(Math.max(...st.var)),
      chosen_position: b.chosenItemId
        ? (shown.find((x) => x.option_id === b.chosenItemId)?.slot ?? null)
        : null,
      viewport_class: typeof ux.viewportClass === "string" ? ux.viewportClass : null,
      viewed_option_ids: strs("viewedOptionIds"),
      zoomed_option_ids: strs("zoomedOptionIds"),
      descriptions_shown: ux.descriptionsShown === true,
      revised: attempt > 0,
      failed_option_ids: strs("failedOptionIds"),
    },
  });
  let status = s.status;
  let resultId: string | null = null;
  let next: Question | null;
  try {
    next = eng.next();
  } catch (e) {
    insufficient(e);
  }
  if (!next) {
    status = "completed";
    resultId = await finalize(tx, s, eng, ans.length + 1);
  }
  await q(
    tx,
    `update diagnosis_sessions set status = $2, last_active_at = now(), completed_at = case when $2 = 'completed' then now() else null end,
       state = $3 where id = $1`,
    [s.id, status, JSON.stringify({ ...st, backed: false })],
  );
  return view({ ...s, status }, eng, false, resultId);
}

/** 02장 2.4.4 품질 감시: 노출 ≥ 30이고 cant_tell 비율 > 30%면 flag = low_discrimination(선택 후보 제외).
 * 운영자가 복원한 쌍(flag = restored, ADM-08)은 다시 표시하지 않는다. */
export const PAIR_QUALITY = { minExposures: 30, cantTellMax: 0.3 } as const;
export async function refreshPairStats(tx: Tx, tv: string): Promise<number> {
  const r = await q(
    tx,
    `with a as (
       select sa.item_id, count(*)::int as n, count(*) filter (where sa.answer = 'cant_tell')::int as c
         from survey_answers sa join diagnosis_sessions s on s.id = sa.session_id
        where s.taxonomy_version = $1 and sa.kind = 'ab' and not sa.superseded
        group by sa.item_id)
     update survey_items si
        set stats = si.stats || jsonb_build_object('exposures', a.n, 'cant_tell_rate', round(a.c::numeric / a.n, 4))
                  || case when a.n >= $2 and a.c::float8 / a.n > $3
                               and coalesce(si.stats->>'flag', '') not in ('restored', 'low_discrimination')
                          then jsonb_build_object('flag', 'low_discrimination', 'flagged_at', now()) else '{}'::jsonb end
       from a
      where si.taxonomy_version = $1 and si.id = a.item_id and si.kind = 'ab_pair'`,
    [tv, PAIR_QUALITY.minExposures, PAIR_QUALITY.cantTellMax],
  );
  return r.rowCount ?? 0;
}

/** 02장 2.15·AC-02-18: 저장 응답 로그를 재생한 결과(완료 세션). */
export async function replayProfile(tx: Tx, sessionId: string) {
  const s = (await q(tx, "select * from diagnosis_sessions where id = $1", [sessionId]))
    .rows[0] as unknown as Session | undefined;
  if (!s) throw notFound();
  const { eng } = await engineFor(tx, s);
  return eng.result();
}

interface SiteRow {
  id: string;
  domain: string;
  url: string;
  title_ko: string | null;
  blurb_ko: string | null;
  l1: Obj;
}
/** 02장 2.14 닮은 사이트: w_k = 1/(σ_display² + τ²) 정규화, s = sqrt(Σ w (r − μ)²), 도메인 중복 0, s ≤ maxScore, 최대 count개. */
export async function similarSites(tx: Tx, mu: Vec, sigmaDisplay: Vec): Promise<SiteRow[]> {
  const S = D.similarSites;
  const w = siteWeights(sigmaDisplay);
  const rows = (
    await q(tx, "select id, domain, url, title_ko, blurb_ko, l1 from similar_site_candidates")
  ).rows as unknown as SiteRow[];
  const scored = rows
    .map((r) => {
      const v = vec(r.l1);
      return {
        r,
        s: Math.sqrt(v.reduce((acc, x, k) => acc + (w[k] ?? 0) * (x - (mu[k] ?? 0)) ** 2, 0)),
      };
    })
    .filter((x) => x.s <= S.maxScore)
    .sort((a, b) => a.s - b.s || (a.r.id < b.r.id ? -1 : 1));
  const out: SiteRow[] = [];
  const seen = new Set<string>();
  for (const x of scored) {
    if (out.length >= S.count) break;
    if (seen.has(x.r.domain)) continue;
    seen.add(x.r.domain);
    out.push(x.r);
  }
  return out;
}

async function finalize(
  tx: Tx,
  s: Session,
  eng: ReturnType<typeof createEngine>,
  n: number,
): Promise<string> {
  const r = eng.result();
  const rows = eng.log();
  const id = randomUUID();
  const sites = await similarSites(
    tx,
    r.mu,
    r.axes.map((x) => x.sigmaDisplay),
  );
  await q(
    tx,
    `insert into diagnosis_results (id, session_id, taxonomy_version, type_id, type_id_second, is_boundary, profile, similar_site_ids)
     values ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      id,
      s.id,
      s.taxonomy_version,
      r.typeId,
      r.secondTypeId || null,
      r.isBoundary,
      JSON.stringify(r),
      sites.map((x) => x.id),
    ],
  );
  await refreshPairStats(tx, s.taxonomy_version);
  await serverEvent(tx, {
    name: "survey_complete",
    anonId: s.anon_id,
    tv: s.taxonomy_version,
    props: {
      survey_session_id: s.id,
      n_questions: n,
      duration_s: Math.max(0, (Date.now() - new Date(s.started_at).getTime()) / 1000),
      early_stop: n < D.maxQuestions,
      n_none: rows.filter((x) => x.a.kind === "none_of_these").length,
      n_cant_tell: rows.filter((x) => x.a.kind === "cant_tell").length,
    },
  });
  return id;
}

export async function undo(
  tx: Tx,
  id: string,
  anonId: string | null,
  fromSeq: number,
): Promise<SurveyView> {
  const s = await ownedSession(tx, id, anonId, true);
  const { eng, ans } = await engineFor(tx, s);
  const last = ans.at(-1);
  if (s.status === "completed" || s.state?.backed === true || !last || fromSeq !== last.seq + 1)
    throw new ApiError("UNDO_NOT_ALLOWED", "undo not allowed");
  await q(
    tx,
    "update survey_answers set superseded = true where session_id = $1 and seq = $2 and not superseded",
    [s.id, last.seq],
  );
  const re = await engineFor(tx, s);
  await q(tx, "update diagnosis_sessions set last_active_at = now(), state = $2 where id = $1", [
    s.id,
    JSON.stringify({ ...re.eng.state(), backed: true }),
  ]);
  await serverEvent(tx, {
    name: "survey_back",
    anonId: s.anon_id,
    tv: s.taxonomy_version,
    props: { survey_session_id: s.id, from_seq: fromSeq },
  });
  void eng;
  return view(s, re.eng, true, null);
}

/** 2.14 가중치 w_k = 1/(σ_display² + τ²), 합 1. */
function siteWeights(sigmaDisplay: Vec): Vec {
  const raw = sigmaDisplay.map((sd) => 1 / (sd * sd + D.similarSites.tau * D.similarSites.tau));
  const tot = raw.reduce((a, b) => a + b, 0);
  return raw.map((x) => x / tot);
}
/** 2.14 match_axes: w_k·(r_k − μ_k)²가 가장 작은 2축(동률은 축 순서). */
const MATCH_AXES = 2;
function matchAxes(r: Vec, mu: Vec, w: Vec): (typeof AXIS_KEYS)[number][] {
  return AXIS_KEYS.map((k, i) => ({ k, i, d: (w[i] ?? 0) * ((r[i] ?? 0) - (mu[i] ?? 0)) ** 2 }))
    .sort((a, b) => a.d - b.d || a.i - b.i)
    .slice(0, MATCH_AXES)
    .map((x) => x.k);
}
/** 표시 시점에 뷰에 남아 있는 것만(opt-out 즉시 반영, 2.14 저장 행). */
async function shownSites(
  tx: Tx,
  ids: string[],
  mu: Vec,
  sigmaDisplay: Vec,
): Promise<ResultView["similarSites"]> {
  if (ids.length === 0) return [];
  const rows = (
    await q(
      tx,
      "select id, domain, url, title_ko, blurb_ko, l1 from similar_site_candidates where id = any($1)",
      [ids],
    )
  ).rows as unknown as SiteRow[];
  const by = new Map(rows.map((x) => [x.id, x]));
  const w = siteWeights(sigmaDisplay);
  return ids.flatMap((id) => {
    const x = by.get(id);
    return x
      ? [
          {
            title: x.title_ko ?? x.domain,
            blurb: x.blurb_ko ?? "",
            url: x.url,
            domain: x.domain,
            matchAxes: matchAxes(vec(x.l1), mu, w),
          },
        ]
      : [];
  });
}

function typeBrief(id: string) {
  const t = repo().types.find((x) => x.id === id);
  return {
    id,
    nameKo: t?.nameKo ?? id,
    descriptionKo: t?.descriptionKo ?? "",
    keywordsKo: (t?.keywordsKo ?? []).slice(0, RESULT_KEYWORDS),
  };
}
/** 01장 1.5.2 ① 키워드 3개. */
const RESULT_KEYWORDS = 3;

export async function resultView(tx: Tx, id: string, anonId: string | null): Promise<ResultView> {
  const s = await ownedSession(tx, id, anonId);
  const r = (await q(tx, "select * from diagnosis_results where session_id = $1", [s.id]))
    .rows[0] as Obj | undefined;
  if (!r) throw new ApiError("SURVEY_NOT_COMPLETED", "not completed");
  const p = r.profile as {
    typeId: string;
    secondTypeId: string;
    adjacentTypeIds: string[];
    isBoundary: boolean;
    confidence: "high" | "medium" | "low";
    flags: string[];
    notice: ResultView["notice"];
    axes: {
      key: (typeof AXIS_KEYS)[number];
      mu: number;
      sigmaDisplay: number;
      state: "open" | "confirmed" | "insensitive";
    }[];
  };
  const override = (r.anchor_override_type_id as string | null) ?? null;
  const anchor = repo().types.find((t) => t.id === (override ?? p.typeId));
  const preset = repo().presets.get(anchor?.anchorPresetId ?? "");
  const l2 = preset?.l2 ?? {};
  const [a1 = "", a2 = ""] = p.adjacentTypeIds;
  return {
    resultId: String(r.id),
    surveyId: s.id,
    type: typeBrief(p.typeId),
    typeSecond: p.secondTypeId
      ? { id: p.secondTypeId, nameKo: typeBrief(p.secondTypeId).nameKo }
      : null,
    isBoundary: p.isBoundary,
    adjacentTypes: [typeBrief(a1), typeBrief(a2)],
    confidence: p.confidence,
    flags: p.flags,
    axes: p.axes.map((x) => ({
      key: x.key,
      mu: x.mu,
      sigmaDisplay: x.sigmaDisplay,
      state: x.state,
    })),
    notice: p.notice,
    seasonAdjusted: false,
    anchorOverrideTypeId: override,
    rating: (r.rating as number | null) ?? null,
    guide: {
      pairingName: repo().pairings.get(l2["type.pairing_id"] ?? "") ?? "",
      paletteHex: repo().palettes.get(l2["color.palette_id"] ?? "") ?? [],
      radiusFamily: l2["shape.radius_family"] ?? "",
    },
    similarSites: await shownSites(
      tx,
      (r.similar_site_ids as string[] | null) ?? [],
      p.axes.map((x) => x.mu),
      p.axes.map((x) => x.sigmaDisplay),
    ),
    taxonomyVersion: s.taxonomy_version,
    shareId: null,
  };
}

export async function anchorOverride(
  tx: Tx,
  id: string,
  anonId: string | null,
  typeId: string | null,
): Promise<ResultView> {
  const v = await resultView(tx, id, anonId);
  if (typeId !== null && !v.adjacentTypes.some((t) => t.id === typeId))
    throw new ApiError("VALIDATION_FAILED", "type not allowed", {
      issues: [{ path: "typeId", code: "not_adjacent" }],
    });
  await q(tx, "update diagnosis_results set anchor_override_type_id = $2 where session_id = $1", [
    id,
    typeId,
  ]);
  return resultView(tx, id, anonId);
}

export async function rate(tx: Tx, id: string, anonId: string | null, score: number) {
  const v = await resultView(tx, id, anonId);
  await q(tx, "update diagnosis_results set rating = $2 where session_id = $1", [id, score]);
  const s = await ownedSession(tx, id, anonId);
  await serverEvent(tx, {
    name: "result_rating",
    anonId: s.anon_id,
    tv: s.taxonomy_version,
    props: { result_id: v.resultId, score },
  });
  // R-36: score ≤ 2면 2·3순위 2개
  return { suggestedTypes: score <= RATING.suggestMax ? v.adjacentTypes : [] };
}
const RATING = { suggestMax: 2 } as const;

export async function deleteSurvey(tx: Tx, id: string, anonId: string | null): Promise<void> {
  const s = await ownedSession(tx, id, anonId, true);
  await q(tx, "delete from diagnosis_sessions where id = $1", [s.id]);
}

export const ABANDON_MIN = SESSION.abandonMin;
