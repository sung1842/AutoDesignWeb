"use client";
// S02 진단(01장 1.4): 동시 공개(R1)·서버 순서(R2)·라벨 중립(R3)·크기 동일(R4)·기기 자산(R5)·중립 배경(R6)·고정 제목(R7).
// 서버 응답이 권위(06장 6.2.2). 화면 식별자는 ASSUMPTIONS ASM-100.
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { KO, t } from "../../../copy/ko";

interface Question {
  seq: number;
  itemKey: string;
  kind: "pick4" | "ab";
  items: string[];
  allowNone: boolean;
  allowCantTell: boolean;
}
interface View {
  id: string;
  status: "in_progress" | "completed";
  stage: 1 | 2;
  answered: number;
  question: Question | null;
  canUndo: boolean;
  state: { mu?: number[] };
}
interface Asset {
  url: string;
  w: number;
  h: number;
}
interface Item {
  id: string;
  altText: string | null;
  assets: { desktop: Asset; mobile?: Asset } | null;
}
type Layout = "grid2x2" | "list1" | "pair" | "toggle" | "pager";

/** 01장 1.4.3 크기 규칙(m = 좌우 여백, 간격 24, 폭 하한 480, 1열 최대 800, 2열 최대 588). */
const SIZE = {
  mDesktop: 32,
  mTablet: 48,
  gap: 24,
  wMin: 480,
  w1Max: 800,
  w2Max: 588,
  mobileMax: 768,
  tabletMax: 1024,
} as const;
/** 1.4.4 선택 후 전환 300ms, 1.4.2 R1 디코드 대기 5초, 1.4.8 계속하기 활성 800ms, 1.4.1 조기 종료 안내 1.5초. */
const TIMING = { selectMs: 300, decodeMs: 5000, continueMs: 800, earlyEndMs: 1500 } as const;
const STAGE1 = 8;

function viewportClass(w: number): "mobile" | "tablet" | "desktop" {
  return w < SIZE.mobileMax ? "mobile" : w < SIZE.tabletMax ? "tablet" : "desktop";
}
function decideLayout(kind: Question["kind"], vw: number): { layout: Layout; width: number } {
  const cls = viewportClass(vw);
  if (cls === "mobile") return { layout: kind === "ab" ? "toggle" : "pager", width: vw - 32 };
  const m = cls === "tablet" ? SIZE.mTablet : SIZE.mDesktop;
  const w2t = Math.min((vw - 2 * m - SIZE.gap) / 2, SIZE.w2Max);
  const w1 = Math.min(vw - 2 * m, SIZE.w1Max);
  if (kind === "ab")
    return w2t >= SIZE.wMin ? { layout: "pair", width: w2t } : { layout: "toggle", width: w1 };
  return w2t >= SIZE.wMin ? { layout: "grid2x2", width: w2t } : { layout: "list1", width: w1 };
}

export function Survey({ id }: { id: string }) {
  const router = useRouter();
  const [view, setView] = useState<View | null>(null);
  const [items, setItems] = useState<Map<string, Item>>(new Map());
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState<Set<string>>(new Set());
  const [chosen, setChosen] = useState<string | null>(null);
  const [cur, setCur] = useState(0);
  const [seen, setSeen] = useState<Set<number>>(new Set([0]));
  const [transition, setTransition] = useState<"none" | "stage" | "early">("none");
  const [canContinue, setCanContinue] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [backed, setBacked] = useState(false);
  const shownAt = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [vw, setVw] = useState(1280);

  const q = view?.question ?? null;
  const lay = useMemo(() => (q ? decideLayout(q.kind, vw) : null), [q, vw]);
  const device = viewportClass(vw) === "mobile" ? "mobile" : "desktop";

  useEffect(() => {
    setVw(window.innerWidth);
    void (async () => {
      const [cr, ir] = await Promise.all([
        fetch("/api/surveys/current"),
        fetch("/api/survey-items"),
      ]);
      if (ir.ok) {
        const v = (await ir.json()) as { items: Item[] };
        setItems(new Map(v.items.map((x) => [x.id, x])));
      }
      if (cr.ok) {
        const v = (await cr.json()) as View;
        if (v.id === id) return setView(v);
      }
      router.replace(`/d/${id}/result`);
    })();
  }, [id, router]);

  // R1 동시 공개: 모든 이미지 decode 뒤 한 번에(5초 넘으면 대체 텍스트로)
  useEffect(() => {
    if (!q) return;
    setReady(false);
    setChosen(null);
    setCur(0);
    setSeen(new Set([0]));
    setFailed(new Set());
    setVw(window.innerWidth);
    let live = true;
    const bad = new Set<string>();
    const loads = q.items.map((iid) => {
      const a = items.get(iid)?.assets;
      const src = a ? (device === "mobile" ? (a.mobile ?? a.desktop) : a.desktop).url : null;
      if (!src) {
        bad.add(iid);
        return Promise.resolve();
      }
      const img = new Image();
      img.src = src;
      return img.decode().catch(() => {
        bad.add(iid);
      });
    });
    const timeout = new Promise<void>((r) => setTimeout(r, TIMING.decodeMs));
    void Promise.race([Promise.all(loads).then(() => undefined), timeout]).then(() => {
      if (!live) return;
      setFailed(bad);
      setReady(true);
      shownAt.current = performance.now();
    });
    return () => {
      live = false;
    };
  }, [q, items, device]);

  const submit = useCallback(
    async (answer: "option" | "none_of_these" | "cant_tell", chosenItemId?: string) => {
      if (!view || !q || !lay) return;
      const body = {
        seq: q.seq,
        itemKey: q.itemKey,
        shownItemIds: q.items,
        answer,
        ...(chosenItemId ? { chosenItemId } : {}),
        latencyMs: Math.max(0, Math.round(performance.now() - shownAt.current)),
        clientTs: new Date().toISOString(),
        ux: {
          layoutMode: lay.layout,
          viewportClass: viewportClass(vw),
          cardScale: Math.round((lay.width / (device === "mobile" ? 780 : 1280)) * 100) / 100,
          viewedOptionIds: [...seen].map((i) => q.items[i]).filter(Boolean),
          failedOptionIds: [...failed],
          revised: backed,
        },
      };
      const r = await fetch(`/api/surveys/${view.id}/responses`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (r.status === 409) {
        const c = await fetch("/api/surveys/current");
        if (c.ok) setView((await c.json()) as View);
        return;
      }
      if (!r.ok) return;
      const nv = (await r.json()) as View;
      setBacked(false);
      if (nv.status === "completed") {
        if (nv.answered === STAGE1) {
          setTransition("early");
          setTimeout(() => router.push(`/d/${view.id}/result`), TIMING.earlyEndMs);
          return;
        }
        router.push(`/d/${view.id}/result`);
        return;
      }
      if (view.answered + 1 === STAGE1 && nv.stage === 2) {
        setTransition("stage");
        setCanContinue(false);
        setTimeout(() => setCanContinue(true), TIMING.continueMs);
      }
      setView(nv);
    },
    [view, q, lay, vw, device, seen, failed, backed, router],
  );

  const choose = useCallback(
    (iid: string) => {
      setChosen(iid);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void submit("option", iid), TIMING.selectMs);
    },
    [submit],
  );

  async function undo() {
    if (!view || !q || !view.canUndo) {
      setToast(KO["quiz.back.once"]);
      return;
    }
    const r = await fetch(`/api/surveys/${view.id}/undo`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fromSeq: q.seq }),
    });
    if (r.status === 409) return setToast(KO["quiz.back.409"]);
    if (r.ok) {
      setBacked(true);
      setTransition("none");
      setView((await r.json()) as View);
    }
  }

  // 키보드 단축키 1~4 / A·B(1.4.10)
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (!q || !ready || transition !== "none") return;
      const k = e.key.toUpperCase();
      const idx = q.kind === "ab" ? ["A", "B"].indexOf(k) : ["1", "2", "3", "4"].indexOf(k);
      const iid = q.items[idx];
      if (idx >= 0 && iid && (lay?.layout !== "toggle" || seen.size === 2)) choose(iid);
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [q, ready, transition, lay, seen, choose]);

  if (!view) return <main className="svc-stage" aria-busy="true" />;
  if (transition === "early")
    return (
      <main className="svc-stage">
        <p className="svc-q-title">{KO["quiz.earlyEnd"]}</p>
      </main>
    );
  if (transition === "stage")
    return (
      <main className="svc-stage">
        <h1 className="svc-q-title">{KO["quiz.transition.title"]}</h1>
        <div className="svc-center">
          <button
            className="svc-btn svc-btn--primary"
            disabled={!canContinue}
            onClick={() => setTransition("none")}
          >
            {KO["quiz.transition.cta"]}
          </button>
        </div>
      </main>
    );
  if (!q || !lay) return <main className="svc-stage" aria-busy="true" />;

  const answered = view.answered;
  const stage = answered < STAGE1 ? 1 : 2;
  const label = (i: number) => (q.kind === "ab" ? (i === 0 ? "A" : "B") : String(i + 1));
  const asset = (iid: string) => {
    const a = items.get(iid)?.assets;
    return a ? (device === "mobile" ? (a.mobile ?? a.desktop) : a.desktop) : null;
  };
  const ratio = device === "mobile" ? "1 / 2" : "16 / 10";
  const card = (iid: string, i: number, onClick?: () => void, h?: string) => {
    const a = asset(iid);
    // 페이저·토글은 카드 자체가 버튼이 아니다(선택은 하단 바 버튼, 1.4.3)
    const Tag = onClick ? "button" : "div";
    return (
      <Tag
        key={iid}
        className="svc-card"
        {...(onClick
          ? {
              "aria-label": q.kind === "ab" ? label(i) : `선택지 ${i + 1}`,
              "aria-pressed": chosen === iid,
              onClick,
            }
          : {})}
        data-dim={chosen !== null && chosen !== iid}
        style={{ width: lay.width, aspectRatio: h ? undefined : ratio, height: h }}
      >
        <span className="svc-card__num" aria-hidden="true">
          {label(i)}
        </span>
        {ready && a && !failed.has(iid) ? (
          // 사전 렌더 자극물(R1 디코드 완료 후 공개). R5 자산을 그대로 쓰므로 이미지 최적화 경로를 거치지 않는다
          <img
            src={a.url}
            alt={items.get(iid)?.altText?.replace("{n}", label(i)) ?? ""}
            width={a.w}
            height={a.h}
          />
        ) : ready ? (
          <span className="svc-card__alt">{items.get(iid)?.altText?.replace("{n}", label(i))}</span>
        ) : null}
      </Tag>
    );
  };
  const cardH = "calc(100dvh - 276px - env(safe-area-inset-bottom))";
  const progress = (
    <div
      className="svc-progress"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={16}
      aria-valuenow={answered}
      aria-valuetext={t("quiz.progress.aria", { n: answered })}
    >
      <span style={{ width: `${(answered / 16) * 100}%` }} />
    </div>
  );

  return (
    <main>
      <header className="svc-header">
        <button className="svc-btn svc-btn--text" onClick={() => router.push("/")}>
          {KO["quiz.exit"]}
        </button>
        {answered > 0 || backed ? (
          <button
            className="svc-btn svc-btn--text"
            aria-disabled={!view.canUndo}
            title={view.canUndo ? undefined : KO["quiz.back.once"]}
            onClick={() => void undo()}
          >
            {KO["quiz.back"]}
          </button>
        ) : null}
        {progress}
        <span>
          {stage === 1
            ? t("quiz.progress.stage1", { n: Math.min(STAGE1, answered + 1) })
            : t("quiz.progress.stage2", { n: answered - STAGE1 + 1 })}
        </span>
      </header>
      <section
        className="svc-stage"
        data-testid="question"
        data-seq={q.seq}
        data-kind={q.kind}
        data-layout={lay.layout}
        data-items={q.items.join(",")}
        aria-busy={!ready}
      >
        <h1 className="svc-q-title">
          {q.kind === "ab" ? KO["quiz.title.stage2"] : KO["quiz.title.stage1"]}
        </h1>
        {answered === 0 ? <p className="svc-center svc-muted">{KO["quiz.meta"]}</p> : null}
        {lay.layout === "grid2x2" || lay.layout === "list1" || lay.layout === "pair" ? (
          <div
            className="svc-grid"
            style={{
              gridTemplateColumns:
                lay.layout === "list1" ? `${lay.width}px` : `repeat(2, ${lay.width}px)`,
            }}
          >
            {q.items.map((iid, i) => card(iid, i, ready ? () => choose(iid) : undefined))}
          </div>
        ) : (
          <div className="svc-center">
            {q.items[cur] ? card(q.items[cur], cur, undefined, cardH) : null}
          </div>
        )}
        <div
          className="svc-center"
          style={{ paddingBottom: lay.layout === "pager" || lay.layout === "toggle" ? 140 : 0 }}
        >
          {q.allowNone ? (
            <button
              className="svc-btn svc-btn--text"
              disabled={!ready}
              onClick={() => void submit("none_of_these")}
            >
              {KO["quiz.none"]}
            </button>
          ) : null}
          {q.allowCantTell ? (
            <button
              className="svc-btn svc-btn--text"
              disabled={!ready || (lay.layout === "toggle" && seen.size < 2)}
              onClick={() => void submit("cant_tell")}
            >
              {KO["quiz.cantTell"]}
            </button>
          ) : null}
        </div>
        {lay.layout === "pager" ? (
          <div className="svc-bottombar">
            <div className="svc-thumbs">
              {q.items.map((iid, i) => (
                <button
                  key={iid}
                  aria-label={`카드 ${i + 1} 보기`}
                  aria-current={cur === i}
                  onClick={() => {
                    setCur(i);
                    setSeen((s) => new Set([...s, i]));
                  }}
                >
                  {i + 1}
                </button>
              ))}
              <span>
                {cur + 1} / {q.items.length}
              </span>
            </div>
            <button
              className="svc-btn svc-btn--primary"
              style={{ width: "100%" }}
              disabled={!ready}
              onClick={() => q.items[cur] && choose(q.items[cur])}
            >
              {KO["quiz.pick"]}
            </button>
          </div>
        ) : null}
        {lay.layout === "toggle" ? (
          <div className="svc-bottombar">
            <div className="svc-thumbs">
              {["A", "B"].map((s, i) => (
                <button
                  key={s}
                  aria-current={cur === i}
                  onClick={() => {
                    setCur(i);
                    setSeen((x) => new Set([...x, i]));
                  }}
                >
                  {s}
                </button>
              ))}
              {seen.size < 2 ? <span className="svc-muted">{KO["quiz.seeB"]}</span> : null}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {(["quiz.pickA", "quiz.pickB"] as const).map((k, i) => (
                <button
                  key={k}
                  className="svc-btn svc-btn--primary"
                  style={{ flex: 1 }}
                  disabled={!ready || seen.size < 2}
                  onClick={() => q.items[i] && choose(q.items[i])}
                >
                  {KO[k]}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </section>
      {toast ? (
        <div role="status" className="svc-bottombar" onAnimationEnd={() => setToast(null)}>
          {toast}
        </div>
      ) : null}
    </main>
  );
}
