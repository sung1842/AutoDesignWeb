// pnpm eval:extractor:selfcheck [--json <path>] — 05장 5.9 추출기 자기검증(프리셋 앵커 왕복 + 토큰 수준, ASM-080 ⑤).
// 앵커 렌더 = fallbackMockup(typeId, goodPurposes[0], v_true) + compilePage, 1280. 종료 코드 0 = 토큰 수준 기준 통과.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fallbackMockup, loadDesignData } from "../../packages/design-spec/src/index.js";
import { compilePage } from "../../packages/renderer/src/index.js";
import { deltaE2000, oklabToCielab } from "../../packages/scoring/src/index.js";
import { openHarness } from "../../apps/worker/src/render/harness.js";

const ROOT = join(import.meta.dirname, "../..");
/** 5.9 토큰 수준 통과 기준(사양 상수): radius ±1px, 주 배경·accent ΔE2000 < 5, 본문 font-family 일치. */
const TOKEN_SPEC = { radiusPx: 1, deltaE2000: 5 } as const;

type Obj = { [k: string]: unknown };
const get = (o: unknown, ...p: string[]): unknown =>
  p.reduce<unknown>((x, k) => (typeof x === "object" && x !== null ? (x as Obj)[k] : undefined), o);
const lab = (lch: number[]): [number, number, number] => {
  const r = ((lch[2] ?? 0) * Math.PI) / 180;
  return oklabToCielab([lch[0] ?? 0, (lch[1] ?? 0) * Math.cos(r), (lch[1] ?? 0) * Math.sin(r)]);
};
/** computed 색(oklch(…)·rgb(…)) → CIELAB(OKLab 경유). 투명은 null. */
function rgbLab(s: string): [number, number, number] | null {
  const o = /oklch\(([^)]*)\)/.exec(s);
  if (o) {
    const [L, C, H, A] = (o[1] ?? "")
      .split(/[\s/]+/)
      .filter(Boolean)
      .map(Number);
    if (A === 0) return null;
    return lab([L ?? 0, C ?? 0, H ?? 0]);
  }
  const m = /rgba?\(([^)]*)\)/.exec(s);
  if (!m) return null;
  if ((m[1] ?? "").split(/[\s,/]+/).filter(Boolean)[3] === "0") return null;
  const [r, g, b] = (m[1] ?? "").split(/[\s,/]+/).map(Number);
  const lin = (v: number): number => {
    const x = v / 255;
    return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  const [R, G, B] = [lin(r ?? 0), lin(g ?? 0), lin(b ?? 0)];
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const mm = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const ss = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return oklabToCielab([
    0.2104542553 * l + 0.793617785 * mm - 0.0040720468 * ss,
    1.9779984951 * l - 2.428592205 * mm + 0.4505937099 * ss,
    0.0259040371 * l + 0.7827717662 * mm - 0.808675766 * ss,
  ]);
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const jsonAt = args.indexOf("--json");
  const out = jsonAt >= 0 ? args[jsonAt + 1] : undefined;
  const data = loadDesignData(ROOT);
  const types = JSON.parse(readFileSync(join(ROOT, "data/taxonomy/types.json"), "utf8")) as {
    items: { id: string; goodPurposes: string[] }[];
  };
  const reg = JSON.parse(readFileSync(join(ROOT, "data/fonts/registry.json"), "utf8")) as {
    items: { subsetFamily: string; family: string }[];
  };
  const famOf = new Map(
    reg.items.map((f) => [f.subsetFamily.toLowerCase(), f.family.toLowerCase()]),
  );
  const h = await openHarness();
  const presets: Obj[] = [];
  let fail = 0;
  try {
    for (const p of [...data.presets].sort((a, b) => a.typeId.localeCompare(b.typeId))) {
      const purpose = types.items.find((t) => t.id === p.typeId)?.goodPurposes[0] ?? "saas";
      const { spec, tree } = fallbackMockup(p.typeId, purpose, "v_true", data);
      const { html } = compilePage(spec, tree, data);
      const measured = await h.extractL1(html, 1280);
      const f = await h.features(html, 1280);
      const radii = ["sm", "md", "lg", "full"]
        .map((k) => get(spec, "tokens", "radius", k, "$value", "value"))
        .filter((x): x is number => typeof x === "number");
      const page = await h.withPage(html, 1280, (pg) =>
        pg.evaluate(() => {
          // 주 배경 = body·html·body 첫 자식 중 처음 불투명한 배경
          // tsx keepNames가 이름 붙은 함수에 __name을 넣으므로 이 안에서는 이름 있는 함수를 만들지 않는다
          const bodyBg =
            [document.body, document.documentElement, document.body.firstElementChild]
              .map((e) => (e ? getComputedStyle(e).backgroundColor : ""))
              .find((c) => c && !/rgba\([^)]*,\s*0\)|transparent|\/\s*0\)/.test(c)) ?? "";
          // 요소별 radius(pill·원형 상한에 걸린 값은 제외, 05장 F01 정의와 같은 상한)
          const radii = [...document.querySelectorAll("body *")].flatMap((el) => {
            const cs = getComputedStyle(el);
            const r = parseFloat(cs.borderTopLeftRadius) || 0;
            const b = el.getBoundingClientRect();
            return r > 0 && r < Math.min(b.width, b.height) / 2 ? [r] : [];
          });
          const all = [...document.querySelectorAll("body *")].flatMap((el) => {
            const cs = getComputedStyle(el);
            return [cs.color, cs.backgroundColor, cs.borderTopColor];
          });
          return { bodyBg, radii: [...new Set(radii)], colors: [...new Set(all)] };
        }),
      );
      const radiusErrPx = Math.max(
        0,
        ...page.radii.map((r) => Math.min(...radii.map((x) => Math.abs(x - r)))),
      );
      const tokLab = (k: string): [number, number, number] | null => {
        const c = get(spec, "tokens", "color", k, "$value", "components");
        return Array.isArray(c) ? lab(c as number[]) : null;
      };
      const bgTok = tokLab("bg");
      const bgPage = rgbLab(page.bodyBg);
      const bgDeltaE = bgTok && bgPage ? deltaE2000(bgTok, bgPage) : Number.POSITIVE_INFINITY;
      const acTok = tokLab("accent");
      const pageLabs = page.colors.map(rgbLab).filter((x): x is [number, number, number] => !!x);
      // accent 토큰이 없는 단색 팔레트는 대조 대상이 없다(accentToken: false, 차이 0으로 기록)
      const accentDeltaE = acTok
        ? Math.min(Number.POSITIVE_INFINITY, ...pageLabs.map((x) => deltaE2000(acTok, x)))
        : 0;
      const bodyTok = get(spec, "tokens", "font", "body", "$value");
      const tokFam =
        Array.isArray(bodyTok) && typeof bodyTok[0] === "string" ? bodyTok[0].toLowerCase() : "";
      const measuredFam = (f.F26.body_family ?? "").toLowerCase();
      const bodyFontMatch =
        measuredFam !== "" &&
        (measuredFam === tokFam ||
          measuredFam === famOf.get(tokFam) ||
          famOf.get(measuredFam) === famOf.get(tokFam));
      const ok =
        radiusErrPx <= TOKEN_SPEC.radiusPx &&
        bgDeltaE < TOKEN_SPEC.deltaE2000 &&
        accentDeltaE < TOKEN_SPEC.deltaE2000 &&
        bodyFontMatch;
      if (!ok) fail++;
      presets.push({
        typeId: p.typeId,
        intended: p.l1,
        measured,
        radiusErrPx,
        bgDeltaE,
        accentDeltaE,
        accentToken: acTok !== null,
        bodyFontMatch,
        ok,
      });
      process.stdout.write(
        `${p.typeId} radius±${radiusErrPx.toFixed(2)} bgΔE ${bgDeltaE.toFixed(2)} accentΔE ${accentDeltaE.toFixed(2)} font ${bodyFontMatch ? "ok" : `${measuredFam}≠${tokFam}`}\n`,
      );
    }
  } finally {
    await h.close();
  }
  if (out) {
    mkdirSync(dirname(join(ROOT, out)), { recursive: true });
    writeFileSync(join(ROOT, out), `${JSON.stringify({ presets }, null, 2)}\n`);
  }
  process.stdout.write(`eval:extractor:selfcheck: 토큰 수준 실패 ${fail}/${presets.length}\n`);
  return fail === 0 ? 0 : 1;
}
process.exitCode = await main();
