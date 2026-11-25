import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { join } from "node:path";
import { loadDesignData, standardTree } from "../../../../packages/design-spec/src/index.js";
import { compileForEdit } from "../../../../packages/renderer/src/index.js";
import { handlePreview, issuePreviewUrl, previewFrame, signPreview } from "./preview.js";

const data = loadDesignData(join(import.meta.dirname, "../../../.."));
const WEB = "http://127.0.0.1:3000";
const PREVIEW = "http://localhost:3100";
const SECRET = "s".repeat(32);
const deps = {
  env: {
    WEB_ORIGIN: WEB,
    PREVIEW_ORIGIN: PREVIEW,
    PREVIEW_SIGNING_SECRET: SECRET,
    APP_ENV: "local",
  },
  now: () => 1_800_000_000_000,
  loadCandidate: async (id: string) => {
    if (id !== "cand-1") return null;
    const { spec, tree } = standardTree("T3", "portfolio", data);
    return { ownerId: "u1", spec, tree };
  },
  data,
};
const nowSec = 1_800_000_000;

describe("미리보기 격리(6.11.4, M2-11, ASM-059)", () => {
  it("서명 = HMAC(kind|id|vp|exp), 유효 → 200·헤더 바이트 일치·스크립트 0·외부 URL 0", async () => {
    const exp = nowSec + 600;
    const sig = createHmac("sha256", SECRET).update(`candidate|cand-1|1280|${exp}`).digest("hex");
    expect(signPreview(SECRET, "candidate", "cand-1", 1280, exp)).toBe(sig);
    const res = await handlePreview(
      new Request(`${PREVIEW}/render/candidate/cand-1?vp=1280&exp=${exp}&sig=${sig}`),
      deps,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-security-policy")).toBe(
      `default-src 'none'; style-src 'unsafe-inline'; img-src ${PREVIEW} data:; font-src ${PREVIEW}; base-uri 'none'; form-action 'none'; frame-ancestors ${WEB}; sandbox`,
    );
    const body = await res.text();
    expect(body).not.toMatch(/<script|\son\w+=|javascript:/i);
    expect(body.match(/https?:\/\/[^\s"'<>)]+/g)?.filter((u) => !/w3\.org/.test(u)) ?? []).toEqual(
      [],
    );
  });
  it("틀린 서명·만료·15분 초과 exp → 403, 남의 후보 발급 → 404, 발급 exp ≤ 15분", async () => {
    const r = (q: string) =>
      handlePreview(new Request(`${PREVIEW}/render/candidate/cand-1?${q}`), deps);
    expect((await r(`vp=1280&exp=${nowSec + 600}&sig=${"0".repeat(64)}`)).status).toBe(403);
    expect(
      (
        await r(
          `vp=1280&exp=${nowSec - 1}&sig=${signPreview(SECRET, "candidate", "cand-1", 1280, nowSec - 1)}`,
        )
      ).status,
    ).toBe(403);
    const far = nowSec + 16 * 60;
    expect(
      (await r(`vp=1280&exp=${far}&sig=${signPreview(SECRET, "candidate", "cand-1", 1280, far)}`))
        .status,
    ).toBe(403);
    expect(
      (await issuePreviewUrl({ userId: "u2", kind: "candidate", id: "cand-1", vp: 1280 }, deps))
        .status,
    ).toBe(404);
    const ok = await issuePreviewUrl(
      { userId: "u1", kind: "candidate", id: "cand-1", vp: 1280 },
      deps,
    );
    expect(ok.status).toBe(200);
    expect(Number(new URL(ok.url!).searchParams.get("exp")) - nowSec).toBeLessThanOrEqual(15 * 60);
  });
  it("iframe 속성, 편집 srcdoc 첫 요소 CSP meta, 브랜드명 이스케이프", () => {
    expect(previewFrame({ kind: "display", src: `${PREVIEW}/render/candidate/c?vp=1280` })).toMatch(
      /\ssandbox=""/,
    );
    expect(previewFrame({ kind: "measure", srcdoc: "<p>x</p>" })).toMatch(
      /\ssandbox="allow-same-origin"/,
    );
    const { spec, tree } = standardTree("T5", "saas", data, {
      brandName: `<img src=x onerror="parent.__xss=1">`,
    });
    const { html } = compileForEdit(spec.tokens, tree, 1280, { webOrigin: WEB, spec, data });
    expect(/<head[^>]*>\s*(<[^>]+>)/i.exec(html)?.[1]).toBe(
      `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src ${WEB} data:; font-src ${WEB}; base-uri 'none'; form-action 'none'">`,
    );
    expect(html).not.toContain("<img src=x");
  });
});
