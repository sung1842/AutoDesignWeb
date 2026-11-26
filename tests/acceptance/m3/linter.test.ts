// M3 수용 테스트(1/5): AI 티 린터 규칙·금지 문구 사전·B15 예시(04장 4.6.4·4.13, AC-04-12·26, 09장 9.4.5 ①).
// API 계약·해석은 ASSUMPTIONS ASM-077.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  RULES,
  lintAll,
  matchCliche,
  type LintFinding,
} from "../../../packages/linter/src/index.js";
import { openHarness, type Harness } from "../../../apps/worker/src/render/harness.js";
import { ROOT } from "../_support/sh.js";

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
type Obj = { [k: string]: Json };

/** 04장 4.13.2 표를 FINAL 원문에서 읽는다(규칙 수 = 장 규칙 수, 9.4.5 ①). */
function specRules(): { id: string; stages: string[]; severities: string[] }[] {
  const md = readFileSync(join(ROOT, "docs/spec/FINAL/04_generation.md"), "utf8");
  const start = md.indexOf("### 4.13.2");
  const end = md.indexOf("### 4.13.3");
  const out: { id: string; stages: string[]; severities: string[] }[] = [];
  for (const line of md.slice(start, end).split("\n")) {
    const m = /^\| (AIL-\d{2}) \|/.exec(line);
    if (!m) continue;
    const cells = line.split("|").map((c) => c.trim());
    // | ID | 패턴 | 단계 | 수치 조건 | 심각도 | 대상 | 통과 예 | 실패 예 |
    const stages = cells[3].split(",").map((s) => s.trim());
    const sev = [...new Set(cells[5].match(/error|warn/g) ?? [])].sort();
    out.push({ id: m[1], stages, severities: sev });
  }
  return out;
}

const SPEC_RULES = specRules();
const EX_DIR = join(ROOT, "data/linter/examples");

interface Example {
  file: string;
  ruleId: string;
  expect: "violation" | "clean";
  severity?: "error" | "warn";
  stages: string[];
  skeleton?: boolean;
  provenance: string;
  input: Obj;
}
function examples(ruleId: string): Example[] {
  const dir = join(EX_DIR, ruleId);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => ({ ...(JSON.parse(readFileSync(join(dir, f), "utf8")) as Example), file: f }));
}

let h: Harness;
beforeAll(async () => {
  h = await openHarness();
});
afterAll(async () => {
  await h?.close();
});

/** 예시 1건 판정: html이 있으면 하네스로 D·P 스냅숏을 만든 뒤 전 단계 린트. */
async function judge(fx: Example): Promise<LintFinding[]> {
  const input = fx.input;
  const html = typeof input.html === "string" ? input.html : null;
  const vw = typeof input.vw === "number" ? input.vw : 1280;
  const snapshot = html
    ? await h.lintSnapshot(html, vw, { spec: input.spec ?? undefined })
    : undefined;
  return lintAll({ ...input, snapshot });
}

describe("AC-04-26 · 9.4.5 ① 규칙 메타 = 04장 4.13.2", () => {
  it("규칙 수·ID·단계·심각도가 장 표와 같다", () => {
    expect(SPEC_RULES.length).toBe(24);
    expect(RULES.map((r) => r.id).sort()).toEqual(SPEC_RULES.map((r) => r.id).sort());
    for (const s of SPEC_RULES) {
      const r = RULES.find((x) => x.id === s.id);
      expect(r, s.id).toBeDefined();
      if (!r) continue;
      expect([...r.stage].sort(), `${s.id} stage`).toEqual([...s.stages].sort());
      expect([...new Set(r.severity)].sort(), `${s.id} severity`).toEqual(s.severities);
      expect(r.messageKo.trim().length, `${s.id} messageKo`).toBeGreaterThan(0);
      expect(/[가-힣]/.test(r.messageKo), `${s.id} messageKo 한국어`).toBe(true);
      expect(r.fixHint.trim().length, `${s.id} fixHint`).toBeGreaterThan(0);
      expect(r.appliesTo.length, `${s.id} appliesTo`).toBeGreaterThan(0);
    }
  });

  it("규칙 구현은 1파일 1규칙(packages/linter/rules/AIL-xx.ts)", () => {
    for (const s of SPEC_RULES)
      expect(existsSync(join(ROOT, `packages/linter/rules/${s.id}.ts`)), s.id).toBe(true);
  });
});

describe("AC-04-26 · 9.4.5 ① B15 예시: 규칙마다 양성 ≥2·음성 ≥2, 오탐·미탐 0", () => {
  for (const s of SPEC_RULES) {
    it(`${s.id} 예시 판정`, async () => {
      const ex = examples(s.id);
      const pos = ex.filter((e) => e.expect === "violation");
      const neg = ex.filter((e) => e.expect === "clean");
      expect(pos.length, `${s.id} 양성`).toBeGreaterThanOrEqual(2);
      expect(neg.length, `${s.id} 음성`).toBeGreaterThanOrEqual(2);
      for (const e of ex) {
        expect(e.ruleId, e.file).toBe(s.id);
        expect(e.skeleton === true, `${s.id}/${e.file} 골격 남음`).toBe(false);
        expect(["temp", "human"]).toContain(e.provenance);
        for (const st of e.stages) expect(s.stages, `${s.id}/${e.file} stage ${st}`).toContain(st);
        const hits = (await judge(e)).filter((f) => f.rule === s.id);
        if (e.expect === "violation") {
          expect(hits.length, `${s.id}/${e.file} 미탐`).toBeGreaterThan(0);
          if (e.severity)
            expect(
              hits.map((x) => x.severity),
              `${s.id}/${e.file} 심각도`,
            ).toContain(e.severity);
        } else {
          expect(hits, `${s.id}/${e.file} 오탐`).toEqual([]);
        }
      }
    }, 120_000);
  }
});

/** 04장 4.6.4 사전 항목(장 원문 표기) → 양성 문장(활용형 포함). */
const POS_KO: Record<string, string> = {
  혁신적인: "혁신적으로 일하는 팀",
  "혁신을 선도": "혁신을 선도하는 기업",
  차세대: "차세대 결제 플랫폼",
  "새로운 차원": "새로운 차원의 커피",
  "한 단계 업그레이드": "작업 흐름을 한 단계 업그레이드했습니다",
  "한 차원 높은": "한 차원 높은 서비스",
  "모든 것을 한 곳에": "필요한 모든 것을 한 곳에서",
  "올인원 솔루션": "올인원 솔루션으로 관리하세요",
  "최고의 솔루션": "최고의 솔루션을 만나보세요",
  "완벽한 솔루션": "완벽한 솔루션입니다",
  원활한: "원활하게 연결됩니다",
  손쉽게: "손쉬운 예약",
  "간편하게 한 번에": "간편하게 한 번에 끝내세요",
  획기적인: "획기적으로 줄인 비용",
  "게임 체인저": "업계의 게임 체인저",
  "판도를 바꾸": "시장의 판도를 바꿉니다",
  "미래를 여는": "미래를 열어갑니다",
  "~의 미래": "결제의 미래",
  "비즈니스를 한 단계": "비즈니스를 한 단계 끌어올리세요",
  "비즈니스를 성장시키": "비즈니스를 성장시켜 드립니다",
  "잠재력을 깨우": "잠재력을 깨워 보세요",
  "잠재력을 극대화": "잠재력을 극대화하는 도구",
  "무한한 가능성": "무한한 가능성이 열립니다",
  "가능성을 현실로": "가능성을 현실로 만듭니다",
  "경험을 재정의": "쇼핑 경험을 재정의합니다",
  "새롭게 정의": "일하는 방식을 새롭게 정의했습니다",
  "스마트한 선택": "스마트한 선택, 지금",
  "똑똑한 선택": "똑똑한 선택이 됩니다",
  "최적의 경험": "최적의 경험을 제공합니다",
  "최상의 경험": "최상의 경험을 약속합니다",
  "특별한 경험을 선사": "특별한 경험을 선사합니다",
  "감동을 선사": "감동을 선사하는 공간",
  "여정을 함께": "당신의 여정을 함께합니다",
  "함께 만들어가는": "함께 만들어갑니다",
  "지금 바로 경험해 보세요": "지금 바로 경험해보세요",
  "더 나은 내일": "더 나은 내일을 위해",
  "끊김 없는": "끊김 없이 이어집니다",
  "강력한 기능": "강력한 기능들을 담았습니다",
  "직관적인 인터페이스": "직관적인   인터페이스로",
  놀라운: "놀랍도록 빠른 배송",
  압도적인: "압도적으로 빠른 출고",
  "차별화된 가치": "차별화된 가치를 전합니다",
  "고객 중심의": "고객 중심의 서비스",
  "신뢰할 수 있는 파트너": "신뢰할 수 있는 파트너가 되겠습니다",
  "업계 최고": "업계 최고 수준",
  "단 하나의": "세상에 단 하나의 원두",
  "마법 같은": "마법 같은 순간",
  "당신만을 위한": "당신만을 위한 맞춤 원두",
};
const POS_EN: Record<string, string> = {
  unlock: "Unlocking new markets",
  unleash: "Unleashed creativity",
  elevate: "Elevating everyday coffee",
  empower: "Empowering small teams",
  "seamless(ly)": "Seamlessly connected",
  revolutionize: "Revolutionizing payments",
  revolutionary: "A REVOLUTIONARY approach",
  "cutting-edge": "Cutting-edge tools",
  "next-gen(eration)": "Next-generation analytics",
  "game-chang(er|ing)": "A game-changing app",
  supercharge: "Supercharged workflows",
  "transform your": "Transform your mornings",
  "to the next level": "Take it to the next level",
  "all-in-one": "All-in-one platform",
  "effortless(ly)": "Effortlessly simple",
  "harness the power": "Harness the power of data",
  "built for the future": "Built for the future",
  reimagine: "Reimagined banking",
  redefine: "Redefining hospitality",
  "world-class": "World-class support",
  "best-in-class": "Best-in-class security",
  "state-of-the-art": "State-of-the-art kitchen",
  "innovative solution": "An innovative solution for you",
  streamline: "Streamlined checkout",
  leverage: "Leveraging AI",
  "the future of": "The future of work",
  "say goodbye to": "Say goodbye to spreadsheets",
  "look no further": "Look no further",
};
/** 오탐 방지 음성 20(AC-04-12 예 "혁신학교", "놀이터" 포함). */
const NEG = [
  "혁신학교",
  "놀이터",
  "세대 차이",
  "경험담 모음",
  "차원이 다른 맛",
  "손으로 쓴 편지",
  "원두 고르기",
  "매장 위치 보기",
  "성수동 로스터리",
  "함께 걷는 골목",
  "합격 가능성",
  "선도 차량",
  "최고 기온 12도",
  "스마트폰 수리",
  "파트너 모집",
  "하나의 원두로 내린 커피",
  "마법사 학교",
  "elevator pitch",
  "streamer guide",
  "seamstress studio",
];

interface Dict {
  items: { id: string; text: string }[];
}
const dict = (lang: "ko" | "en"): Dict =>
  JSON.parse(readFileSync(join(ROOT, `data/linter/cliche_${lang}.json`), "utf8")) as Dict;

describe("AC-04-12 금지 문구 사전(4.6.4)", () => {
  it("사전 항목 수 = 장 목록(한국어 48·영어 28), 모든 항목에 양성 픽스처", () => {
    const ko = dict("ko");
    const en = dict("en");
    expect(ko.items.length).toBe(48);
    expect(en.items.length).toBe(28);
    expect(ko.items.map((i) => i.text).sort()).toEqual(Object.keys(POS_KO).sort());
    expect(en.items.map((i) => i.text).sort()).toEqual(Object.keys(POS_EN).sort());
  });

  it("양성: 항목마다 활용형 문장이 그 항목으로 잡힌다", () => {
    for (const [lang, pos] of [
      ["ko", POS_KO],
      ["en", POS_EN],
    ] as const) {
      for (const it2 of dict(lang).items) {
        const sentence = pos[it2.text];
        const hits = matchCliche(sentence).map((x) => x.id);
        expect(hits, `${it2.id} "${sentence}"`).toContain(it2.id);
      }
    }
  });

  it("음성 20: 매칭 0(오탐 0)", () => {
    expect(NEG.length).toBe(20);
    for (const s of NEG) expect(matchCliche(s), s).toEqual([]);
  });

  it("NFC 정규화·공백 축약·대소문자 무시", () => {
    expect(matchCliche("혁신적인 원두".normalize("NFD")).map((x) => x.id)).toContain("ko-01");
    expect(matchCliche("LOOK   NO\tFURTHER").map((x) => x.id)).toContain("en-28");
  });

  it("사용자 원문 슬롯은 warn, LLM 생성 슬롯은 error", () => {
    const user = "혁신적인 원두를 볶습니다";
    const u = matchCliche(user, { slot: "user", userText: user });
    expect(u.length).toBeGreaterThan(0);
    expect(u.every((x) => x.severity === "warn")).toBe(true);
    const l = matchCliche(user, { slot: "llm", userText: user });
    expect(l.length).toBeGreaterThan(0);
    expect(l.every((x) => x.severity === "error")).toBe(true);
    expect(matchCliche(user).every((x) => x.severity === "error")).toBe(true);
  });
});
