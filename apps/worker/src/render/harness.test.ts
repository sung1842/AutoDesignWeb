import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { fallbackMockup, loadDesignData, standardTree } from "@tastefit/design-spec";
import { compilePage } from "@tastefit/renderer";
import { evaluateGates } from "@tastefit/scoring";
import { openHarness, type Harness } from "./harness.js";

const data = loadDesignData(new URL("../../../..", import.meta.url).pathname);
let h: Harness;
beforeAll(async () => {
  h = await openHarness();
});
afterAll(async () => {
  await h?.close();
});
const GATES = ["G-02", "G-03", "G-04", "G-05", "G-06", "G-07"];

describe("렌더 하네스·하드 게이트 4종(M2-09a, ASM-055)", () => {
  it("폴백 시안 3종 × 1280·375: 게이트 통과, 외부 요청 0, 폰트·이미지 로컬 서빙", async () => {
    const bad: string[] = [];
    for (const [t, p, v] of [
      ["T1", "saas", "v_true"],
      ["T5", "local_business", "v_fit"],
      ["T7", "portfolio", "v_bal"],
    ] as const) {
      const { spec, tree } = fallbackMockup(t, p, v, data);
      const { html } = compilePage(spec, tree, data);
      for (const vw of [1280, 375]) {
        const m = await h.measure(html, vw);
        expect(m.externalRequests).toEqual([]);
        expect(m.texts.length).toBeGreaterThan(10);
        for (const g of evaluateGates(m, GATES))
          if (!g.pass) bad.push(`${t}/${p}@${vw} ${g.id} ${g.violations[0] ?? ""}`);
      }
      expect(await h.firstViewFontBytes(html, 1280)).toBeGreaterThan(0);
    }
    expect(bad).toEqual([]);
  });
  it("위반 페이지를 잡는다: 넘침·깨진 이미지·외부 요청·저대비", async () => {
    const html =
      '<!doctype html><html lang="ko"><head><meta charset="utf-8"></head><body style="margin:0;background:#fff">' +
      '<div style="width:2000px;color:#bbb">연한 글씨</div><img src="/assets/images/없음.png" width="10" height="10">' +
      '<img src="https://example.com/x.png" width="10" height="10"></body></html>';
    const m = await h.measure(html, 375);
    const r = Object.fromEntries(evaluateGates(m, GATES).map((g) => [g.id, g.pass]));
    expect(r).toMatchObject({ "G-02": false, "G-04": false, "G-07": false });
    expect(m.externalRequests.length).toBe(1);
  });
  it("AC-04-18a 선구현: 브라우저 번들 compile = Node compile(SHA-256), headlineLines", async () => {
    const sha = (x: string): string => createHash("sha256").update(x).digest("hex");
    const { spec, tree } = standardTree("T6", "portfolio", data);
    const node = compilePage(spec, tree, data).html;
    expect(sha(await h.compileInBrowser(spec, tree, data))).toBe(sha(node));
    const hl = await h.headlineLines(node, 1280);
    expect(hl.find((x) => x.role === "hero.headline")?.lines).toBeGreaterThanOrEqual(1);
  });
  it("parentProbe: sandbox iframe 안 시안은 부모에 닿지 못하고 부모도 문서에 닿지 못한다", async () => {
    const html =
      '<!doctype html><html><body><img src="x" onerror="parent.__xss=1"><script>parent.__xss=1</script></body></html>';
    const r = await h.parentProbe(html);
    expect(r).toEqual({ xss: false, contentDocumentNull: true });
  });
});
