"use client";
// S06 브리프(01장 1.5.5): 검증·정규화는 서버와 같은 validateBrand(@tastefit/api-contract). 익명이면 임시본 저장 후 로그인 게이트,
// 로그인 상태면 프로젝트 → 생성(Idempotency-Key = 제출 1회당 UUID) → /g/[jobId].
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ACTIONS_BY_PURPOSE,
  BRAND_LIMITS,
  validateBrand,
  type BrandIssue,
  type Purpose,
} from "@tastefit/api-contract";
import { KO, t, type CopyKey } from "../../copy/ko";

const PURPOSE_LABEL: Record<Purpose, CopyKey> = {
  saas: "landing.purpose.saas",
  portfolio: "landing.purpose.portfolio",
  local_business: "landing.purpose.local",
};
const FIELD: Record<string, CopyKey> = {
  name: "brief.name",
  description: "brief.description",
  primaryAction: "brief.action",
  audience: "brief.audience",
  keyPoints: "brief.keyPoints",
  brandColor: "brief.color",
};
interface Form {
  purpose: Purpose | null;
  name: string;
  description: string;
  primaryAction: string;
  audience: string;
  keyPoints: string;
  brandColor: string;
}
const EMPTY: Form = {
  purpose: null,
  name: "",
  description: "",
  primaryAction: "",
  audience: "",
  keyPoints: "",
  brandColor: "",
};
const toRaw = (f: Form) => ({
  name: f.name,
  description: f.description,
  primaryAction: f.primaryAction as never,
  ...(f.audience.trim() ? { audience: f.audience } : {}),
  ...(f.keyPoints.trim() ? { keyPoints: f.keyPoints.split("\n").filter((x) => x.trim()) } : {}),
  ...(f.brandColor.trim() ? { brandColor: f.brandColor } : {}),
});
function message(i: BrandIssue): string {
  const key = i.path.replace(/^brand\./, "").split(".")[0] ?? "";
  const lim = (BRAND_LIMITS as Record<string, unknown>)[key === "keyPoints" ? "keyPoint" : key] as
    readonly [number, number] | undefined;
  switch (i.code) {
    case "required":
      return t("brief.err.required", { field: KO[FIELD[key] ?? "brief.name"] });
    case "too_short":
      return t("brief.err.short", { min: lim?.[0] ?? 0 });
    case "too_long":
      return t("brief.err.long", { max: lim?.[1] ?? 0 });
    case "url":
      return KO["brief.err.url"];
    case "color":
      return KO["brief.err.color"];
    default:
      return i.code;
  }
}

export function Brief(p: { resultId: string; draftId: string | null; autosubmit: boolean }) {
  const router = useRouter();
  const [f, setF] = useState<Form>(EMPTY);
  const [issues, setIssues] = useState<BrandIssue[]>([]);
  const [server, setServer] = useState<string | null>(null);
  const [masked, setMasked] = useState<string | null>(null);
  const [attest, setAttest] = useState<boolean | null>(null);
  const [me, setMe] = useState<
    | { quota?: { dayLimit: number; dayUsed: number; monthLimit: number; monthUsed: number } }
    | null
    | undefined
  >(undefined);
  const auto = useRef(false);
  const storeKey = `tf_brief_${p.resultId}`;

  useEffect(() => {
    void fetch("/api/me").then(async (r) => setMe(r.ok ? ((await r.json()) as never) : null));
    const restore = async () => {
      if (p.draftId) {
        const r = await fetch(`/api/brief-drafts/${p.draftId}`);
        if (r.ok) {
          const d = (await r.json()) as { purpose: Purpose; brand: Record<string, unknown> };
          const b = d.brand;
          setF({
            purpose: d.purpose,
            name: String(b.name ?? ""),
            description: String(b.description ?? ""),
            primaryAction: String(b.primaryAction ?? ""),
            audience: String(b.audience ?? ""),
            keyPoints: Array.isArray(b.keyPoints) ? (b.keyPoints as string[]).join("\n") : "",
            brandColor: String(b.brandColor ?? ""),
          });
          return;
        }
      }
      try {
        const v = localStorage.getItem(storeKey);
        if (v) setF({ ...EMPTY, ...(JSON.parse(v) as Partial<Form>) });
      } catch {
        // localStorage 사용 불가(사생활 모드 등)면 빈 폼
      }
    };
    void restore();
  }, [p.draftId, storeKey]);
  useEffect(() => {
    const id = setTimeout(() => {
      try {
        localStorage.setItem(storeKey, JSON.stringify(f));
      } catch {
        // 저장 실패는 무시(1.5.5.5 ①은 편의 기능)
      }
    }, 500);
    return () => clearTimeout(id);
  }, [f, storeKey]);

  const submit = async (attested = false) => {
    setServer(null);
    if (!f.purpose) {
      setIssues([{ path: "purpose", code: "required" }]);
      return;
    }
    const v = validateBrand(f.purpose, toRaw(f));
    if (!v.ok) {
      setIssues(v.issues);
      return;
    }
    setIssues([]);
    const body = {
      resultId: p.resultId,
      purpose: f.purpose,
      brand: toRaw(f),
      useSampleContent: false,
    };
    if (!me) {
      const r = await fetch("/api/brief-drafts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = (await r.json()) as { briefDraftId?: string; error?: { code: string } };
      if (!r.ok || !j.briefDraftId) return setServer(j.error?.code ?? String(r.status));
      const back = `/brief?result=${encodeURIComponent(p.resultId)}&draft=${j.briefDraftId}&autosubmit=1`;
      router.push(`/login?next=${encodeURIComponent(back)}`);
      return;
    }
    const pr = await fetch("/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...body,
        ...(p.draftId ? { briefDraftId: p.draftId } : {}),
        ...(attested ? { brandAttested: true } : {}),
      }),
    });
    const pj = (await pr.json()) as {
      projectId?: string;
      maskedFields?: Record<string, number>;
      error?: { code: string; details?: { issues?: BrandIssue[] } };
    };
    if (pr.status === 403 && pj.error?.code === "CONSENT_REQUIRED") {
      router.push(
        `/onboarding/consent?next=${encodeURIComponent(location.pathname + location.search)}`,
      );
      return;
    }
    if (pj.error?.code === "BRAND_ATTESTATION_REQUIRED") return setAttest(false);
    if (pj.error?.code === "BLOCKED_BRAND") return setServer(KO["brief.blocked"]);
    if (pj.error?.details?.issues) return setIssues(pj.error.details.issues);
    if (!pr.ok || !pj.projectId) return setServer(pj.error?.code ?? String(pr.status));
    const mf = Object.entries(pj.maskedFields ?? {});
    if (mf.length)
      setMasked(t("brief.masked", { list: mf.map(([k, n]) => `${k} ${n}`).join(", ") }));
    const gr = await fetch(`/api/projects/${pj.projectId}/generations`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": `g_${crypto.randomUUID()}`,
      },
      body: JSON.stringify({ kind: "initial" }),
    });
    const gj = (await gr.json()) as {
      jobId?: string;
      error?: { code: string; details?: { jobId?: string } };
    };
    if (gr.status === 202 && gj.jobId) {
      try {
        localStorage.removeItem(storeKey);
      } catch {
        // 무시
      }
      router.push(`/g/${gj.jobId}`);
    } else if (gj.error?.code === "JOB_IN_PROGRESS" && gj.error.details?.jobId)
      router.push(`/g/${gj.error.details.jobId}`);
    else setServer(gj.error?.code ?? String(gr.status));
  };
  // 로그인·동의 후 복귀: 복원 + 검증 통과 시 자동 제출 1회(AC-01-02, 추가 클릭 0)
  useEffect(() => {
    if (!p.autosubmit || auto.current || !me || !f.purpose) return;
    auto.current = true;
    void submit();
  });

  const err = (k: string) =>
    issues.filter(
      (i) =>
        i.path === `brand.${k}` ||
        i.path.startsWith(`brand.${k}.`) ||
        (k === "purpose" && i.path === "purpose"),
    );
  const field = (k: keyof Form, label: CopyKey, max: number, multiline = false) => {
    const e = err(k);
    const id = `f-${k}`;
    const Tag = multiline ? "textarea" : "input";
    return (
      <p>
        <label htmlFor={id}>{KO[label]}</label>{" "}
        <Tag
          id={id}
          name={k}
          value={f[k] ?? ""}
          aria-invalid={e.length > 0}
          aria-describedby={e.length ? `${id}-err` : undefined}
          onChange={(ev) => setF({ ...f, [k]: ev.target.value })}
        />{" "}
        <span className="svc-muted">
          {Array.from(f[k] ?? "").length}/{max}
        </span>
        {e.length ? (
          <span id={`${id}-err`} role="alert">
            {message(e[0] as BrandIssue)}
          </span>
        ) : null}
      </p>
    );
  };
  const actions = f.purpose ? Object.entries(ACTIONS_BY_PURPOSE[f.purpose]) : [];
  return (
    <main className="svc-wrap">
      <p role="note">{KO["brief.pii"]}</p>
      <fieldset>
        <legend>{KO["brief.purpose.q"]} *</legend>
        {(Object.keys(PURPOSE_LABEL) as Purpose[]).map((pp) => (
          <button
            key={pp}
            type="button"
            className="svc-btn"
            aria-pressed={f.purpose === pp}
            onClick={() => setF({ ...f, purpose: pp, primaryAction: "" })}
          >
            {KO[PURPOSE_LABEL[pp]]}
          </button>
        ))}
        {err("purpose").length ? <span role="alert">{KO["brief.err.purpose"]}</span> : null}
      </fieldset>
      {field("name", "brief.name", BRAND_LIMITS.name[1])}
      {field("description", "brief.description", BRAND_LIMITS.description[1])}
      <fieldset>
        <legend>{KO["brief.action"]} *</legend>
        {actions.map(([id, label]) => (
          <label key={id}>
            <input
              type="radio"
              name="primaryAction"
              value={id}
              checked={f.primaryAction === id}
              onChange={() => setF({ ...f, primaryAction: id })}
            />{" "}
            {label}{" "}
          </label>
        ))}
      </fieldset>
      <details>
        <summary>{KO["brief.more"]}</summary>
        {field("audience", "brief.audience", BRAND_LIMITS.audience[1])}
        {field("keyPoints", "brief.keyPoints", BRAND_LIMITS.keyPoint[1], true)}
        {field("brandColor", "brief.color", 7)}
      </details>
      {me?.quota ? (
        <p className="svc-muted">
          {t("brief.remaining", {
            d: me.quota.dayLimit - me.quota.dayUsed,
            m: me.quota.monthLimit - me.quota.monthUsed,
          })}
        </p>
      ) : null}
      <p data-testid="ai-notice">{KO["brief.aiNotice"]}</p>
      {issues.length ? <p role="alert">{t("brief.errors", { n: issues.length })}</p> : null}
      {attest !== null ? (
        <p>
          <label>
            <input type="checkbox" checked={attest} onChange={(e) => setAttest(e.target.checked)} />{" "}
            {KO["brief.attest"]}
          </label>
        </p>
      ) : null}
      <p className="svc-bottombar">
        <button
          className="svc-btn svc-btn--primary"
          type="button"
          disabled={me === undefined || attest === false}
          onClick={() => void submit(attest === true)}
        >
          {KO["brief.cta"]}
        </button>
      </p>
      {masked ? <p role="status">{masked}</p> : null}
      {server ? <p role="alert">{server}</p> : null}
    </main>
  );
}
