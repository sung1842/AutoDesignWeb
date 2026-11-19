import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createGateway, normalizeJson, requestHash } from "./gateway.js";

function fixture(dir: string, output: unknown, sha?: string): void {
  const pv = "gen_copy@v1";
  const input = { b: 2, a: [1, { d: 4, c: 3 }] };
  const h = requestHash("gen_copy", pv, input);
  mkdirSync(join(dir, "gen_copy"), { recursive: true });
  const outputSha256 = sha ?? createHash("sha256").update(normalizeJson(output)).digest("hex");
  writeFileSync(
    join(dir, "gen_copy", `${h}.json`),
    JSON.stringify({ requestHash: h, role: "gen_copy", promptVersion: pv, output, outputSha256 }),
  );
}

describe("llm gateway", () => {
  it("정규화 JSON은 키 순서·공백과 무관하다", () => {
    expect(normalizeJson({ b: 1, a: { d: [1, 2], c: null } })).toBe(
      '{"a":{"c":null,"d":[1,2]},"b":1}',
    );
  });

  it("replay: 녹화가 있으면 output을 그대로 돌려준다(입력 키 순서 무관)", async () => {
    const d = mkdtempSync(join(tmpdir(), "tf-llm-"));
    fixture(d, { headline: "x" });
    const gw = createGateway({ LLM_MODE: "replay" }, { fixturesDir: d });
    const r = await gw.invoke({
      role: "gen_copy",
      promptVersion: 1,
      input: { a: [1, { c: 3, d: 4 }], b: 2 },
    });
    expect(r.output).toEqual({ headline: "x" });
    expect(r.source).toBe("replay");
  });

  it("replay: output을 손으로 고치면 E_REPLAY_TAMPERED", async () => {
    const d = mkdtempSync(join(tmpdir(), "tf-llm-"));
    fixture(d, { headline: "x" }, "0".repeat(64));
    const gw = createGateway({ LLM_MODE: "replay" }, { fixturesDir: d });
    await expect(
      gw.invoke({ role: "gen_copy", promptVersion: 1, input: { b: 2, a: [1, { d: 4, c: 3 }] } }),
    ).rejects.toMatchObject({ code: "E_REPLAY_TAMPERED" });
  });

  it("replay: 프롬프트 버전이 바뀌면 E_REPLAY_MISS", async () => {
    const d = mkdtempSync(join(tmpdir(), "tf-llm-"));
    fixture(d, { headline: "x" });
    const gw = createGateway({ LLM_MODE: "replay" }, { fixturesDir: d });
    await expect(
      gw.invoke({ role: "gen_copy", promptVersion: 2, input: { b: 2, a: [1, { d: 4, c: 3 }] } }),
    ).rejects.toMatchObject({ code: "E_REPLAY_MISS" });
  });

  it("알 수 없는 역할·모드는 오류", async () => {
    await expect(
      createGateway({ LLM_MODE: "replay" }).invoke({ role: "x", promptVersion: 1, input: {} }),
    ).rejects.toMatchObject({ code: "E_LLM_ROLE" });
    expect(() => createGateway({ LLM_MODE: "fake" })).toThrow(/E_LLM_MODE/);
  });

  it("기본 모드는 mock", () => {
    expect(createGateway({}).mode).toBe("mock");
  });
});
