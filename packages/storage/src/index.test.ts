import { describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createFsStorage, verifyFsSignature } from "./index.js";

const mk = () =>
  createFsStorage({
    root: mkdtempSync(join(tmpdir(), "tf-st-")),
    webOrigin: "http://localhost:3000/",
    secret: "s".repeat(32),
    now: () => 1_000_000,
  });

describe("fs StoragePort", () => {
  it("put 멱등·get·list·remove", async () => {
    const s = mk();
    const b = Buffer.from("hello");
    expect((await s.put("survey-assets", "v/a.webp", b)).written).toBe(true);
    expect((await s.put("survey-assets", "v/a.webp", b)).written).toBe(false);
    expect((await s.put("survey-assets", "v/a.webp", Buffer.from("x"))).written).toBe(true);
    expect((await s.get("survey-assets", "v/a.webp"))?.toString()).toBe("x");
    expect(await s.list("survey-assets", "v/")).toEqual(["v/a.webp"]);
    await s.remove("survey-assets", "v/a.webp");
    expect(await s.get("survey-assets", "v/a.webp")).toBeNull();
  });
  it("경로 이탈 거부", async () => {
    const s = mk();
    await expect(s.put("survey-assets", "../x", Buffer.from(""))).rejects.toThrow();
    await expect(s.put("../b", "x", Buffer.from(""))).rejects.toThrow();
  });
  it("publicUrl은 public 버킷만, signedUrl 서명 검증", async () => {
    const s = mk();
    expect(s.publicUrl("survey-assets", "v/a.webp")).toBe(
      "http://localhost:3000/api/_storage/public/survey-assets/v/a.webp",
    );
    expect(() => s.publicUrl("exports", "a.zip")).toThrow();
    const u = new URL(await s.signedUrl("exports", "a.zip", 60));
    const exp = Number(u.searchParams.get("exp"));
    const sig = u.searchParams.get("sig") ?? "";
    expect(verifyFsSignature("s".repeat(32), "exports", "a.zip", exp, sig, 1000)).toBe(true);
    expect(verifyFsSignature("s".repeat(32), "exports", "b.zip", exp, sig, 1000)).toBe(false);
    expect(verifyFsSignature("s".repeat(32), "exports", "a.zip", exp, sig, exp + 1)).toBe(false);
  });
});
