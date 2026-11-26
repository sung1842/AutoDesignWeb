"use client";
// S05 첫 동의(08장 8.7.4 B): C1·C2 필수 체크 → POST /api/consents → next. 거부 = 취소하고 로그아웃.
import { useRouter } from "next/navigation";
import { useState } from "react";
import { KO } from "../../../copy/ko";
import { logoutAction } from "../../login/actions";

/** 08장 8.7.4 C 현재 문서 버전(서버 CURRENT_DOC_VERSIONS와 같은 값, ASM-104 ③). */
const DOC_VERSION = "2026-11-16";
const safeNext = (n: string): string => (n.startsWith("/") && !n.startsWith("//") ? n : "/me");

export function Consent({ next }: { next: string }) {
  const router = useRouter();
  const [c1, setC1] = useState(false);
  const [c2, setC2] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const start = async () => {
    setBusy(true);
    const r = await fetch("/api/consents", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        items: ["age_14", "terms", "privacy_notice"].map((docType) => ({
          docType,
          docVersion: DOC_VERSION,
          agreed: true,
        })),
      }),
    });
    setBusy(false);
    if (r.status === 204) router.replace(safeNext(next));
    else setErr(String(r.status));
  };
  return (
    <main className="svc-wrap">
      <h1 className="svc-display">{KO["consent.title"]}</h1>
      <p>
        <label className="svc-check">
          <input type="checkbox" name="c1" checked={c1} onChange={(e) => setC1(e.target.checked)} />{" "}
          {KO["consent.c1"]}
        </label>
      </p>
      {!c1 ? <p className="svc-muted">{KO["consent.under14"]}</p> : null}
      <p>
        <label className="svc-check">
          <input type="checkbox" name="c2" checked={c2} onChange={(e) => setC2(e.target.checked)} />{" "}
          {KO["consent.c2"]}{" "}
          <a href="/terms" target="_blank" rel="noreferrer">
            ↗
          </a>
        </label>
      </p>
      <section className="svc-card" data-testid="n1">
        {KO["consent.n1"]}
      </section>
      <p>
        <button
          className="svc-btn svc-btn--primary"
          type="button"
          disabled={!c1 || !c2 || busy}
          onClick={() => void start()}
        >
          {KO["consent.start"]}
        </button>{" "}
        <button
          className="svc-btn svc-btn--text"
          type="button"
          onClick={() => void logoutAction().then(() => router.replace("/"))}
        >
          {KO["consent.cancel"]}
        </button>
      </p>
      {err ? <p role="alert">{err}</p> : null}
    </main>
  );
}
