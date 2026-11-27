// M5 수용 테스트(11): 편집 텍스트 남용 판정(G-13)·신고/권리 요청 오탐 방지(08장 8.9, AC-08-41b·41d).
// 시안은 Mock `ok` 생성으로 만들고(파이프 헬퍼), 편집 저장은 POST /api/mockups/:id/versions(06장 6.4). 계약: ASSUMPTIONS ASM-118.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { openPipe, Jar, type Pipe, type Row } from "../_support/pipe.js";
import { ROOT } from "../_support/sh.js";

const HIGH = (
  JSON.parse(readFileSync(join(ROOT, "fixtures/brands/high-risk.json"), "utf8")) as {
    blocked: { name: string }[];
  }
).blocked.map((b) => b.name);
/** 08장 피싱 문구 필터 목록(원문에서 읽는다). */
function phishingTerms(): string[] {
  const dir = join(ROOT, "docs/spec/FINAL");
  const f = readdirSync(dir).find((x) => x.startsWith("08_"));
  const line =
    readFileSync(join(dir, String(f)), "utf8")
      .split("\n")
      .find((l) => l.includes("**피싱 문구 필터**")) ?? "";
  const m = /\(R-13\): `([^`]+)`/.exec(line);
  return (m?.[1] ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
const PHISHING = phishingTerms();

let P: Pipe;
let owner: Jar;
let mockupId = "";
let resultId = "";
type VersionView = { id: string; editState: Record<string, unknown> & { ops?: unknown[] } };
const err = (b: Row) => b.error as { code?: string; details?: { failed?: string[] } } | undefined;

beforeAll(async () => {
  P = await openPipe("tastefit_m5abuse");
  const j = await P.job("ok");
  owner = j.jar;
  const m = await P.rows("select id from mockups where job_id = $1 order by variant limit 1", [
    j.jobId,
  ]);
  mockupId = String(m[0]?.id ?? "");
  const r = await P.rows(
    "select p.result_id from generation_jobs g join projects p on p.id = g.project_id where g.id = $1",
    [j.jobId],
  );
  resultId = String(r[0]?.result_id ?? "");
});
afterAll(async () => {
  await P?.close();
});

/** 현재 버전 + hero.headline 텍스트 op 1개를 붙인 EditState. */
async function editWith(text: string): Promise<{ baseVersionId: string; editState: unknown }> {
  const g = await P.call(owner, "GET", `/api/mockups/${mockupId}`);
  expect(g.status, JSON.stringify(g.body)).toBe(200);
  const cur = g.body.currentVersion as VersionView;
  const ops = [...(cur.editState.ops ?? [])];
  const texts = { ...((cur.editState.texts as Record<string, string> | undefined) ?? {}) };
  const before = texts["slots.hero.headline"] ?? "";
  texts["slots.hero.headline"] = text;
  ops.push({
    opId: randomUUID(),
    kind: "text",
    path: "slots.hero.headline",
    before,
    after: text,
    ts: new Date().toISOString(),
  });
  return { baseVersionId: cur.id, editState: { ...cur.editState, texts, ops } };
}
const save = async (text: string) =>
  P.call(
    owner,
    "POST",
    `/api/mockups/${mockupId}/versions`,
    { ...(await editWith(text)), trigger: "manual" },
    { "idempotency-key": `k_${randomUUID()}` },
  );

describe("편집 텍스트 남용 판정(AC-08-41b)", () => {
  it("AC-08-41b 텍스트 슬롯 1개를 고위험 브랜드명 20종 / 피싱 문구 11종으로 바꿔 저장 → 100% 422 EDIT_GATE_FAILED, failed ∋ GATE_FAILED:G-13", async () => {
    expect(mockupId).not.toBe("");
    expect(HIGH).toHaveLength(20);
    expect(PHISHING).toHaveLength(11);
    const missed: string[] = [];
    for (const t of [...HIGH, ...PHISHING.map((p) => `지금 ${p} 하세요`)]) {
      const r = await save(t);
      const e = err(r.body);
      if (
        r.status !== 422 ||
        e?.code !== "EDIT_GATE_FAILED" ||
        !e.details?.failed?.includes("GATE_FAILED:G-13")
      )
        missed.push(`${t} → ${r.status} ${JSON.stringify(e)}`);
    }
    expect(missed).toEqual([]);
  });
  it("AC-08-41b 게이트를 통과하지 않은 버전으로 공유 생성 → 409 VERSION_GATE_NOT_PASSED", async () => {
    const ok = await save("매일 아침 갓 구운 빵");
    expect(ok.status, JSON.stringify(ok.body)).toBe(201);
    expect(ok.body.gateStatus).toBe("pending");
    const s = await P.call(owner, "POST", "/api/share", {
      targetType: "mockup",
      targetId: mockupId,
      versionId: ok.body.versionId,
    });
    expect([s.status, err(s.body)?.code]).toEqual([409, "VERSION_GATE_NOT_PASSED"]);
  });
});

describe("신고·권리 요청 오탐 방지(AC-08-41d)", () => {
  const BODY = "이 페이지가 비밀번호와 OTP 입력을 요구해요";
  it("AC-08-41d 본문에 비밀번호·OTP가 든 권리 요청 → 201 접수", async () => {
    const anon = new Jar();
    const r = await P.call(anon, "POST", "/api/rights-requests", {
      type: "abuse_report",
      domain: null,
      targetUrl: "https://example.com/p/abc",
      requesterEmail: "reporter@example.com",
      requesterRole: "other",
      details: BODY,
      turnstileToken: "local-ok",
    });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    expect(typeof r.body.requestId).toBe("string");
  });
  it("AC-08-41d 본문에 비밀번호·OTP가 든 공유 신고 → 202 접수", async () => {
    const s = await P.call(owner, "POST", "/api/share", {
      targetType: "result",
      targetId: resultId,
    });
    expect([201, 200], JSON.stringify(s.body)).toContain(s.status);
    const anon = new Jar();
    const r = await P.call(anon, "POST", `/api/share/${String(s.body.shareId)}/report`, {
      reason: "phishing",
      details: BODY,
      turnstileToken: "local-ok",
    });
    expect(r.status, JSON.stringify(r.body)).toBe(202);
  });
});
