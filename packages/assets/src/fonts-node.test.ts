import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { materializeFonts } from "./fonts-node.js";

const faces = [
  {
    family: "tf-kr-test-serif",
    file: "assets/fonts/t-serif-600-x.woff2",
    script: "hangul",
    classification: "serif",
    weight: 600,
  },
  {
    family: "tf-kr-test-sans",
    file: "assets/fonts/t-sans-400-x.woff2",
    script: "hangul",
    classification: "sans_neo_grotesque",
    weight: 400,
  },
];
const chars = " ABCabc0123가나다한결";
const sha = (p: string): string => createHash("sha256").update(readFileSync(p)).digest("hex");

describe("페이지 서브셋 woff2(3.7.5, ASM-051)", () => {
  it("계획대로 woff2를 만들고, 같은 입력 → 같은 바이트, 다시 부르면 캐시", () => {
    const a = mkdtempSync(join(tmpdir(), "tf-font-"));
    const b = mkdtempSync(join(tmpdir(), "tf-font-"));
    try {
      const ra = materializeFonts({ faces, chars }, a);
      materializeFonts({ faces, chars }, b);
      expect(ra.map((x) => x.file)).toEqual(faces.map((f) => f.file));
      for (const f of faces) {
        const buf = readFileSync(join(a, f.file));
        expect(buf.subarray(0, 4).toString("latin1")).toBe("wOF2");
        expect(sha(join(a, f.file))).toBe(sha(join(b, f.file)));
      }
      expect(ra.every((x) => x.bytes > 0)).toBe(true);
      expect(materializeFonts({ faces, chars }, a).every((x) => x.source === "cached")).toBe(true);
    } finally {
      rmSync(a, { recursive: true, force: true });
      rmSync(b, { recursive: true, force: true });
    }
  });
});
