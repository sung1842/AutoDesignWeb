"use client";
// S01 시작·이어하기(01장 1.4.9): POST /api/surveys → /d/[id]. 미완료 세션이 있으면 이어하기 배너.
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { KO, t } from "../copy/ko";

interface Current {
  id: string;
  answered: number;
}
const PURPOSES: [string | null, string][] = [
  ["saas", KO["landing.purpose.saas"]],
  ["portfolio", KO["landing.purpose.portfolio"]],
  ["local_business", KO["landing.purpose.local"]],
  [null, KO["landing.purpose.unknown"]],
];

export function StartButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [current, setCurrent] = useState<Current | null>(null);
  const [purpose, setPurpose] = useState<string | null>(null);
  useEffect(() => {
    void fetch("/api/surveys/current").then(async (r) => {
      if (r.ok) setCurrent((await r.json()) as Current);
    });
  }, []);
  async function start(restart: boolean) {
    setBusy(true);
    const r = await fetch("/api/surveys", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        entry: "landing",
        ...(purpose ? { purposeHint: purpose } : {}),
        ...(restart ? { restart: true } : {}),
      }),
    });
    setBusy(false);
    if (r.ok) router.push(`/d/${((await r.json()) as { id: string }).id}`);
  }
  return (
    <div>
      {current && current.answered > 0 ? (
        <div role="status" className="svc-section">
          <p>{t("landing.resume", { n: current.answered })}</p>
          <button
            className="svc-btn svc-btn--primary"
            onClick={() => void start(false)}
            disabled={busy}
          >
            {KO["landing.resume.yes"]}
          </button>{" "}
          <button className="svc-btn" onClick={() => void start(true)} disabled={busy}>
            {KO["landing.resume.restart"]}
          </button>
        </div>
      ) : null}
      <fieldset style={{ border: 0, padding: 0 }}>
        <legend className="svc-muted">{KO["landing.purpose.q"]}</legend>
        {PURPOSES.map(([v, label]) => (
          <button
            key={label}
            className="svc-btn"
            aria-pressed={purpose === v}
            onClick={() => setPurpose(v)}
            style={{ margin: "4px 8px 4px 0" }}
          >
            {label}
          </button>
        ))}
      </fieldset>
      <p>
        <button
          className="svc-btn svc-btn--primary"
          onClick={() => void start(true)}
          disabled={busy}
        >
          {KO["landing.cta"]}
        </button>
      </p>
      <p className="svc-muted">
        {KO["landing.consent"]} <a href="/privacy">개인정보처리방침</a>
      </p>
    </div>
  );
}
