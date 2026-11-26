"use client";
// S07(01장 1.6): GenerationView 폴링(pollAfterMs, ETag), 단계 4단(서버 progressPct만), 경과 시간, 취소 시트.
// S08(1.7): 노출 시안 카드(변형 라벨·설명·AI 생성 배지·기본 구성 배지), 부분 성공·폴백·템플릿 문구 안내.
import { useEffect, useRef, useState } from "react";
import type { GenerationView } from "@tastefit/api-contract";
import { KO, t, type CopyKey } from "../../../copy/ko";

const VARIANTS = ["v_true", "v_fit", "v_bal"] as const;
const STEPS: { phases: string[]; key: CopyKey }[] = [
  { phases: ["compiling"], key: "gen.phase.compiling" },
  { phases: ["generating"], key: "gen.phase.generating" },
  { phases: ["rendering", "scoring", "repairing", "fallback"], key: "gen.phase.rendering" },
  { phases: ["selecting"], key: "gen.phase.selecting" },
];
const ORDER = [
  "queued",
  "compiling",
  "generating",
  "rendering",
  "scoring",
  "repairing",
  "fallback",
  "selecting",
  "done",
];
const TERMINAL = new Set(["succeeded", "partial", "fallback", "failed", "canceled"]);
/** 1.6.4 시간 경과 규칙(R-25). */
const SLOW_S = 90;
const mmss = (s: number): string =>
  `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export function Gen({ jobId }: { jobId: string }) {
  const [v, setV] = useState<GenerationView | null>(null);
  const [err, setErr] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [sheet, setSheet] = useState<string | null>(null);
  const etag = useRef<string | null>(null);
  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      const r = await fetch(`/api/generations/${jobId}`, {
        headers: etag.current ? { "if-none-match": etag.current } : {},
      });
      let next: GenerationView | null = null;
      if (r.status === 200) {
        etag.current = r.headers.get("etag");
        next = (await r.json()) as GenerationView;
        setV(next);
      } else if (r.status !== 304) setErr(r.status);
      if (!stop && r.status !== 404 && r.status !== 401) {
        const after = next ? next.pollAfterMs : 1000;
        if (after !== null) timer = setTimeout(() => void poll(), after);
      }
    };
    void poll();
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      stop = true;
      if (timer) clearTimeout(timer);
      clearInterval(tick);
    };
  }, [jobId]);
  if (err === 404 || err === 401) return <main className="svc-wrap">{String(err)}</main>;
  if (!v) return <main className="svc-wrap" aria-busy="true" />;
  const done = TERMINAL.has(v.status);
  const at = ORDER.indexOf(v.phase);
  const elapsed = (now - Date.parse(v.queuedAt)) / 1000;
  const started = v.startedAt ? (now - Date.parse(v.startedAt)) / 1000 : 0;
  const real = v.mockups.filter((m) => !m.isFallback).length;
  const cancel = async () => {
    const me = (await (await fetch("/api/me")).json()) as {
      quota?: { refundableCancelsLeft: number };
    };
    const msg =
      real > 0
        ? KO["gen.cancel.used"]
        : (me.quota?.refundableCancelsLeft ?? 0) > 0
          ? KO["gen.cancel.refund"]
          : KO["gen.cancel.noRefund"];
    setSheet(msg);
  };
  const confirmCancel = async () => {
    setSheet(null);
    await fetch(`/api/generations/${jobId}/cancel`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
  };
  return (
    <main className="svc-wrap">
      <header className="svc-header">
        <h1 className="svc-display">{done ? KO["gen.phase.done"] : KO["gen.title"]}</h1>
        {!done ? <span data-testid="elapsed">{mmss(elapsed)}</span> : null}
        {!done ? (
          <button className="svc-btn svc-btn--text" type="button" onClick={() => void cancel()}>
            {KO["gen.cancel"]}
          </button>
        ) : null}
      </header>
      {!done ? (
        <section aria-live="polite" data-testid="steps">
          {v.status === "queued" ? (
            <p>
              {KO["gen.phase.queued"]}{" "}
              {v.queuePosition !== null
                ? v.queuePosition <= 1
                  ? KO["gen.queue.next"]
                  : t("gen.queue.ahead", { n: v.queuePosition - 1 })
                : null}
            </p>
          ) : (
            <ol>
              {STEPS.map((s) => {
                const idx = Math.max(...s.phases.map((x) => ORDER.indexOf(x)));
                const cur = s.phases.includes(v.phase);
                const label =
                  cur && v.phase === "repairing"
                    ? KO["gen.phase.repairing"]
                    : cur && v.phase === "fallback"
                      ? KO["gen.phase.fallback"]
                      : KO[s.key];
                return (
                  <li
                    key={s.key}
                    aria-current={cur ? "step" : undefined}
                    className={!cur && idx > at ? "svc-muted" : undefined}
                  >
                    {idx < at && !cur ? "✓ " : ""}
                    {cur ? <strong>{label}</strong> : label}
                  </li>
                );
              })}
            </ol>
          )}
          <div
            className="svc-progress"
            role="progressbar"
            aria-valuenow={v.progressPct}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <span style={{ width: `${v.progressPct}%` }} />
          </div>
          {started >= SLOW_S ? <p className="svc-muted">{KO["gen.slow"]}</p> : null}
        </section>
      ) : null}
      {sheet ? (
        <section role="dialog" aria-modal="true" className="svc-card">
          <p>{sheet}</p>
          <button
            className="svc-btn svc-btn--primary"
            type="button"
            onClick={() => void confirmCancel()}
          >
            {KO["gen.cancel"]}
          </button>{" "}
          <button className="svc-btn svc-btn--text" type="button" onClick={() => setSheet(null)}>
            ✕
          </button>
        </section>
      ) : null}
      {done && v.status === "failed" ? (
        <section role="alert" data-testid="failed">
          <p>{KO["gen.failed"]}</p>
          <a className="svc-btn" href="/me">
            {KO["gen.retry"]}
          </a>
        </section>
      ) : null}
      {done && v.status === "fallback" ? <p role="note">{KO["drafts.fallback"]}</p> : null}
      {done && v.status !== "fallback" && real > 0 && real < 3 ? (
        <p role="note">{KO["drafts.partial"]}</p>
      ) : null}
      {done && v.copySource === "template" ? <p role="note">{KO["drafts.templateCopy"]}</p> : null}
      <section className="svc-grid" data-testid="cards">
        {VARIANTS.map((variant) => {
          const m = v.mockups.find((x) => x.variant === variant);
          return (
            <article
              key={variant}
              className="svc-card"
              data-variant={variant}
              data-ready={m ? "true" : "false"}
            >
              <h2>{KO[`variant.${variant}.label`]}</h2>
              <p className="svc-muted">{t(`variant.${variant}.desc`, { purpose: "" })}</p>
              {m ? (
                <>
                  <span className="svc-badge" aria-label="AI로 생성된 시안">
                    {KO["drafts.aiBadge"]}
                  </span>
                  {m.isFallback ? (
                    <span className="svc-badge">{KO["drafts.fallbackBadge"]}</span>
                  ) : null}
                  {m.useSampleContent ? (
                    <span className="svc-badge">{KO["drafts.sample"]}</span>
                  ) : null}
                  {m.screenshotUrl ? (
                    <img src={m.screenshotUrl} alt={KO[`variant.${variant}.label`]} />
                  ) : null}
                </>
              ) : (
                <div className="svc-stage" aria-hidden="true" />
              )}
            </article>
          );
        })}
      </section>
    </main>
  );
}
