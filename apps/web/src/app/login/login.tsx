"use client";
// S04 로그인(01장 1.5.3): Google 버튼, 이메일 매직링크(Turnstile 통과 후 활성), 전송 후 60초 재전송 쿨다운.
import { useEffect, useState } from "react";
import { KO, t } from "../../copy/ko";
import { sendMagicLink } from "./actions";

/** 1.5.3 재전송 쿨다운(초). */
const COOLDOWN_S = 60;

export function Login(p: { next: string; error: string | null; localTurnstile: boolean }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [left, setLeft] = useState(0);
  const [err, setErr] = useState<string | null>(
    p.error === "CLIENT_LINK_EXPIRED" ? KO["login.expired"] : null,
  );
  const token = p.localTurnstile ? "local-ok" : "";
  useEffect(() => {
    if (left <= 0) return;
    const id = setTimeout(() => setLeft(left - 1), 1000);
    return () => clearTimeout(id);
  }, [left]);
  const send = async () => {
    setErr(null);
    const r = await sendMagicLink(email, p.next, token);
    if (r.ok) {
      setSent(true);
      setLeft(COOLDOWN_S);
    } else setErr(r.code);
  };
  return (
    <main className="svc-wrap">
      <h1 className="svc-display">{KO["login.title"]}</h1>
      <p className="svc-muted">{KO["login.sub"]}</p>
      <p>
        <button className="svc-btn" type="button" aria-disabled="true" data-testid="google">
          {KO["login.google"]}
        </button>
      </p>
      <p className="svc-muted">{KO["login.or"]}</p>
      {sent ? (
        <section aria-live="polite">
          <p data-testid="sent">{t("login.sent", { email })}</p>
          <button className="svc-btn" type="button" disabled={left > 0} onClick={() => void send()}>
            {left > 0 ? t("login.resendIn", { s: left }) : KO["login.resend"]}
          </button>{" "}
          <button className="svc-btn svc-btn--text" type="button" onClick={() => setSent(false)}>
            {KO["login.reenter"]}
          </button>
        </section>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <label>
            {KO["login.email"]}{" "}
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>{" "}
          <button className="svc-btn svc-btn--primary" type="submit" disabled={!token || !email}>
            {KO["login.send"]}
          </button>
        </form>
      )}
      {err ? <p role="alert">{err}</p> : null}
    </main>
  );
}
