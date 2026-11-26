"use client";
// S03 결과(01장 1.5.2): ① 유형 헤더 ② 안내(서버 notice) ④ 5축 양극 막대 + 표 ⑤ 가이드 ⑥ 닮은 사이트 3곳 + 비제휴 고지 ⑦ 공감 평가 ⑨ CTA ⑩ 삭제.
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AXIS_POLES, KO, t, type CopyKey } from "../../../../copy/ko";

interface TypeBrief {
  id: string;
  nameKo: string;
  descriptionKo: string;
  keywordsKo?: string[];
}
interface ResultView {
  resultId: string;
  type: TypeBrief;
  typeSecond: { id: string; nameKo: string } | null;
  adjacentTypes: [TypeBrief, TypeBrief];
  confidence: "high" | "medium" | "low";
  axes: {
    key: string;
    mu: number;
    sigmaDisplay: number;
    state: "open" | "confirmed" | "insensitive";
  }[];
  notice: "low_signal" | "conflict" | "low_consistency" | "boundary" | null;
  anchorOverrideTypeId: string | null;
  rating: number | null;
  guide: { pairingName: string; paletteHex: string[]; radiusFamily: string };
  similarSites: {
    title: string;
    blurb: string;
    url: string;
    domain: string;
    matchAxes: string[];
  }[];
}
/** 02장 2.13.2 표시 구간 μ ± 1.645·σ_display, 1.5.2.1 표시값 round(μ×100). */
const BAND_Z = 1.645;
const NOTICE: Record<NonNullable<ResultView["notice"]>, CopyKey> = {
  low_signal: "result.notice.lowSignal",
  conflict: "result.notice.conflict",
  low_consistency: "result.notice.lowConsistency",
  boundary: "result.notice.boundary",
};
const pct = (v: number): number => Math.round(Math.min(1, Math.max(0, v)) * 100);

export function Result({ id }: { id: string }) {
  const router = useRouter();
  const [r, setR] = useState<ResultView | null>(null);
  const [err, setErr] = useState(false);
  const [suggest, setSuggest] = useState<TypeBrief[]>([]);
  useEffect(() => {
    void fetch(`/api/surveys/${id}/result`).then(async (x) => {
      if (x.ok) setR((await x.json()) as ResultView);
      else setErr(true);
    });
  }, [id]);
  if (err) return <main className="svc-wrap">결과를 찾을 수 없어요</main>;
  if (!r) return <main className="svc-wrap" aria-busy="true" />;
  const shown = r.anchorOverrideTypeId
    ? ([r.type, ...r.adjacentTypes].find((x) => x.id === r.anchorOverrideTypeId) ?? r.type)
    : r.type;
  const noticeText = r.notice
    ? t(NOTICE[r.notice], { "1순위": r.type.nameKo, "2순위": r.typeSecond?.nameKo ?? "" })
    : null;
  const showConfidence = r.notice !== "low_signal" && r.notice !== "low_consistency";
  async function rate(score: number) {
    const x = await fetch(`/api/surveys/${id}/rating`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ score }),
    });
    if (x.ok) setSuggest(((await x.json()) as { suggestedTypes: TypeBrief[] }).suggestedTypes);
  }
  async function override(typeId: string | null) {
    const x = await fetch(`/api/surveys/${id}/anchor-override`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ typeId }),
    });
    if (x.ok) setR((await x.json()) as ResultView);
  }
  async function remove() {
    if (!window.confirm("이 결과를 삭제할까요?")) return;
    const x = await fetch(`/api/surveys/${id}`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
    });
    if (x.ok) router.push("/");
  }
  return (
    <main className="svc-wrap">
      <p className="svc-muted">{KO["result.label"]}</p>
      <h1 className="svc-display" style={{ fontSize: 40, margin: "4px 0" }}>
        {shown.nameKo}
      </h1>
      {r.anchorOverrideTypeId ? (
        <p className="svc-muted">직접 고른 유형 · 원래 결과: {r.type.nameKo}</p>
      ) : null}
      <p data-testid="type-description">{shown.descriptionKo}</p>
      <p data-testid="type-keywords">{(shown.keywordsKo ?? []).join(" · ")}</p>
      {noticeText ? <p role="note">{noticeText}</p> : null}
      {showConfidence ? (
        <p className="svc-muted">{KO[`result.confidence.${r.confidence}`]}</p>
      ) : null}
      <p>
        <button className="svc-btn svc-btn--primary" disabled>
          {KO["result.cta"]}
        </button>{" "}
        <button className="svc-btn svc-btn--text" onClick={() => router.push("/")}>
          {KO["result.retest"]}
        </button>
      </p>
      <p className="svc-muted">{KO["result.retestHint"]}</p>

      <section className="svc-section" aria-labelledby="axes-h">
        <h2 id="axes-h">{KO["result.axes.title"]}</h2>
        <div aria-hidden="true">
          {r.axes.map((a) => {
            const [, lo, hi] = AXIS_POLES[a.key] ?? ["", "", ""];
            const open = a.state === "open";
            const l = pct(a.mu - BAND_Z * a.sigmaDisplay);
            const h = pct(a.mu + BAND_Z * a.sigmaDisplay);
            return (
              <div className="svc-axis" key={a.key}>
                <span>{lo}</span>
                <div className="svc-axis__track" data-open={open}>
                  <span className="svc-axis__band" style={{ left: `${l}%`, width: `${h - l}%` }} />
                  <span
                    className="svc-axis__dot"
                    data-open={open}
                    style={{ left: `${pct(a.mu)}%` }}
                  />
                </div>
                <span>{hi}</span>
                <span>{pct(a.mu)}</span>
              </div>
            );
          })}
        </div>
        <table data-testid="axes-table" className="svc-sr">
          <thead>
            <tr>
              <th>축</th>
              <th>왼쪽</th>
              <th>오른쪽</th>
              <th>값</th>
              <th>확실도</th>
            </tr>
          </thead>
          <tbody>
            {r.axes.map((a) => {
              const [name, lo, hi] = AXIS_POLES[a.key] ?? ["", "", ""];
              return (
                <tr key={a.key}>
                  <td>{name}</td>
                  <td>{lo}</td>
                  <td>{hi}</td>
                  <td>{pct(a.mu)}</td>
                  <td>
                    {a.state === "open"
                      ? KO["result.axis.open"]
                      : a.state === "insensitive"
                        ? KO["result.axis.insensitive"]
                        : "확실해요"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="svc-section">
        <h2>{KO["result.guide.title"]}</h2>
        <p>서체: {r.guide.pairingName}</p>
        <p>
          {r.guide.paletteHex.map((hx) => (
            <span className="svc-chip" key={hx}>
              <i style={{ background: hx }} aria-hidden="true" />
              {hx}
            </span>
          ))}
        </p>
        <p>모서리: {r.guide.radiusFamily}</p>
      </section>

      <section className="svc-section" data-testid="similar-sites">
        <h2>{KO["result.sites.title"]}</h2>
        {r.similarSites.length === 0 ? <p>{KO["result.sites.empty"]}</p> : null}
        <ul>
          {r.similarSites.map((s) => (
            <li key={s.domain}>
              <a href={s.url} target="_blank" rel="noopener noreferrer nofollow">
                {s.title}
              </a>{" "}
              <span className="svc-muted">· {s.domain}</span>{" "}
              <span className="svc-muted">
                {s.matchAxes.map((k) => AXIS_POLES[k]?.[0] ?? k).join(" · ")} 비슷
              </span>
            </li>
          ))}
        </ul>
        <p className="svc-notice-small">{KO["result.sites.notice"]}</p>
      </section>

      <section className="svc-section">
        <h2>{KO["result.rating.q"]}</h2>
        <div role="radiogroup" aria-label={KO["result.rating.q"]}>
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} style={{ marginRight: 12 }}>
              <input
                type="radio"
                name="rating"
                defaultChecked={r.rating === n}
                onChange={() => void rate(n)}
              />{" "}
              {n}
            </label>
          ))}
        </div>
        {suggest.length ? (
          <div>
            <p>{KO["result.adjacent.q"]}</p>
            {suggest.map((s) => (
              <button
                key={s.id}
                className="svc-btn"
                onClick={() => void override(s.id)}
                style={{ marginRight: 8 }}
              >
                {s.nameKo}
              </button>
            ))}
            <button className="svc-btn svc-btn--text" onClick={() => setSuggest([])}>
              그대로 둘게요
            </button>
          </div>
        ) : null}
        {r.anchorOverrideTypeId ? (
          <button className="svc-btn svc-btn--text" onClick={() => void override(null)}>
            원래 결과로 되돌리기
          </button>
        ) : null}
      </section>
      <p style={{ textAlign: "right" }}>
        <button className="svc-btn svc-btn--text" onClick={() => void remove()}>
          {KO["result.delete"]}
        </button>
      </p>
    </main>
  );
}
