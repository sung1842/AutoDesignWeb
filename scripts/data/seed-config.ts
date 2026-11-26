// seed:temp — config/ 묶음 B20·B21·B22·B24(09장 9.2.4). 결정적(난수 미사용), provenance temp.
import { linterExampleFiles } from "./linter-examples.js";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { COLOR_NAMES } from "../../packages/taxonomy/src/color-name.js";
import type { Json, Obj } from "./load.js";
import { type Ctx, type Out, bundle } from "./seed-temp.js";
import { chapter, section, table, unquote } from "./spec-md.js";

const PURPOSES = ["saas", "local_business", "portfolio"] as const;
type Purpose = (typeof PURPOSES)[number];

const graphemes = (s: string): string[] =>
  [...new Intl.Segmenter("ko", { granularity: "grapheme" }).segment(s)].map((x) => x.segment);
export const glen = (s: string): number => graphemes(s).length;

// ---------- B20 copy_templates.json (04장 4.6.2 키 표) ----------
interface Range {
  min: number;
  max: number;
}
/** "8–24" | "≤ 30" → 범위(하한 없으면 1). */
function parseRange(s: string): Range {
  const m = /(\d+)\s*[–-]\s*(\d+)/.exec(s);
  if (m) return { min: Number(m[1]), max: Number(m[2]) };
  const le = /≤\s*(\d+)/.exec(s);
  if (le) return { min: 1, max: Number(le[1]) };
  throw new Error(`4.6.2 길이 해석 실패: ${s}`);
}
/** "3" | "3–4" | "1–2그룹 × 항목 3–4" → 상한 개수(템플릿은 상한만큼 준비, 사용처가 자른다). */
function parseCount(s: string): { min: number; max: number; groups?: Range } {
  const g = /(\d+)[–-](\d+)그룹 × 항목 (\d+)[–-](\d+)/.exec(s);
  if (g)
    return {
      min: Number(g[3]),
      max: Number(g[4]),
      groups: { min: Number(g[1]), max: Number(g[2]) },
    };
  const r = /(\d+)\s*[–-]\s*(\d+)/.exec(s);
  if (r) return { min: Number(r[1]), max: Number(r[2]) };
  return { min: Number(s), max: Number(s) };
}
/** "제목 6–18, 본문 30–90" → {제목: …, 본문: …}. */
function parseFields(s: string): Record<string, Range> {
  const out: Record<string, Range> = {};
  for (const part of s.split(/,\s*/)) {
    const m = /^(\S+)\s+(.+)$/.exec(part.trim());
    if (m?.[1] && m[2]) out[m[1]] = parseRange(m[2]);
  }
  return out;
}

const FIELD_KEY: Record<string, string> = {
  제목: "title",
  본문: "body",
  질문: "q",
  답: "a",
  항목명: "name",
  설명: "desc",
  캡션: "caption",
  인용: "quote",
  값: "value",
  라벨: "label",
};
const FILLER = " 실제 문구로 바꿔 주세요. 이 문장은 자리를 채우는 임시 안내입니다.";

/** `[임시]` 접두 문장을 [min,max] 글자(공백 포함)로 맞춘다. */
export function tempText(base: string, r: Range, prefix = "[임시] "): string {
  let t = `${prefix}${base}`;
  while (glen(t) < r.min) t += FILLER;
  let g = graphemes(t);
  if (g.length > r.max) g = g.slice(0, r.max);
  while (g.length > 0 && /\s/.test(g[g.length - 1] ?? "")) g.pop();
  if (g.length < r.min) g.push(...".".repeat(r.min - g.length));
  return g.join("");
}

/** 4.6.2 주석의 용도별 권장 동사(첫 단어 규칙). */
function ctaVerbs(sec: string): Record<Purpose, string[]> {
  const out = {} as Record<Purpose, string[]>;
  for (const p of PURPOSES) {
    const m = new RegExp(`${p} = \\{([^}]+)\\}`).exec(sec);
    if (!m?.[1]) throw new Error(`4.6.2 권장 동사 없음: ${p}`);
    out[p] = m[1].split(",").map((x) => x.trim());
  }
  return out;
}

const HEADLINE_KINDS = ["factual", "benefit", "emotive"] as const;
/** 치환 토큰(04장 4.7 폴백: name·description·primary_action 라벨·key_points). */
const TOKEN_BASE: Record<string, string> = {
  // G-10(브랜드명 hero 존재): headline 0번이 헤드라인 예산에 걸려 다른 옵션으로 바뀌어도 hero에 이름이 남게 eyebrow 0번도 {name}(ASM-089)
  "hero.eyebrow": "{name}",
  "hero.headline": "{name}",
  "hero.sub": "{description}",
  "about.body": "{description}",
  "footer.tagline": "{name}",
  "meta.title": "{name}",
  "meta.description": "{description}",
};

function scalarValues(key: string, cnt: number, r: Range, verbs: string[]): Json[] {
  if (key === "cta.primary") return verbs.slice(0, cnt).map((v) => v.slice(0, r.max));
  return Array.from({ length: cnt }, (_, i) => {
    const tok = i === 0 ? TOKEN_BASE[key] : undefined;
    const text = tok ? tempText(tok, { min: 1, max: r.max }, "") : tempText(`문구 ${i + 1}`, r);
    if (key === "hero.headline") return { kind: HEADLINE_KINDS[i] ?? "factual", text };
    return text;
  });
}

function itemValues(
  key: string,
  cnt: number,
  fields: Record<string, Range>,
  groups?: number,
): Json[] {
  const one = (i: number): Obj => {
    const o: Obj = {};
    for (const [label, r] of Object.entries(fields)) {
      const f = FIELD_KEY[label] ?? label;
      if (key === "proof.items" && f === "quote")
        o[f] = tempText(`고객 후기 ${i + 1}`, r, "[예시] ");
      else if (key === "value.items" && f === "body" && i === 0) o[f] = "{key_points.0}";
      else o[f] = tempText(`${label} ${i + 1}`, r);
    }
    if (key === "proof.items") Object.assign(o, { name: "김○○", placeholder: true });
    if (key === "menu.items") Object.assign(o, { price: "[예시] 0,000원", placeholder: true });
    return o;
  };
  if (key === "menu.groups")
    return Array.from({ length: groups ?? 1 }, (_, g) => ({
      title: tempText(`메뉴 묶음 ${g + 1}`, { min: 1, max: 20 }),
      items: Array.from({ length: cnt }, (_, i) => ({
        ...one(i),
        price: "[예시] 0,000원",
        placeholder: true,
      })),
    }));
  return Array.from({ length: cnt }, (_, i) => one(i));
}

export function genCopyTemplates(ctx: Ctx): Out[] {
  const md = chapter(ctx.root, "04_generation.md");
  const sec = section(md, "### 4.6.2");
  const verbs = ctaVerbs(md.slice(md.indexOf("용도별 권장 동사:")));
  const items: Obj[] = [];
  for (const row of table(sec)) {
    const [keyCell = "", cntCell = "", lenCell = "", useCell = ""] = row;
    if (keyCell.includes("contact.")) continue; // LLM·템플릿이 만들지 않는다(컴파일러 08장 8.7.5)
    const keys = keyCell.split(" / ").map((k) => unquote(k.trim()));
    const cnts = cntCell.split(" / ");
    const lens = lenCell.split(" / ");
    const use = useCell.replace(/\(.*\)/, "").trim();
    const purposes: Purpose[] = use === "공통" ? [...PURPOSES] : [use as Purpose];
    if (!purposes.every((p) => PURPOSES.includes(p))) throw new Error(`4.6.2 용도 ${useCell}`);
    keys.forEach((key, k) => {
      const c = parseCount((cnts[k] ?? cnts[0] ?? "").trim());
      const lenStr = (lens[k] ?? lens[0] ?? "").trim();
      const isItems = key.endsWith(".items") || key.endsWith(".groups");
      for (const p of purposes) {
        const base = {
          id: `${p}:${key}`,
          purpose: p,
          key,
          count: { min: c.min, max: c.max },
          ...(c.groups ? { groups: c.groups } : {}),
        };
        if (isItems) {
          const fields = parseFields(lenStr);
          const lengths = Object.fromEntries(
            Object.entries(fields).map(([l, r]) => [FIELD_KEY[l] ?? l, r]),
          );
          // stats는 입력 숫자만 허용 → 템플릿은 비운다(4.6.2 "없으면 키 비움")
          const values = key === "stats.items" ? [] : itemValues(key, c.max, fields, c.groups?.max);
          items.push({ ...base, lengths, values });
        } else {
          const r = parseRange(lenStr);
          items.push({ ...base, length: r, values: scalarValues(key, c.max, r, verbs[p]) });
        }
      }
    });
  }
  return [{ path: "config/copy_templates.json", content: bundle(ctx, "copy-templates", items) }];
}

// ---------- B20 axis_hints.json (04장 4.11 repair: 방향 2종 × 5축) ----------
const AXIS_HINT: Record<string, [string, string]> = {
  expression: [
    "asymmetric variant 또는 signature 적용 블록을 늘린다",
    "대칭 variant로 바꾸고 signature 적용 블록을 줄인다",
  ],
  temperature: [
    "따뜻한 톤 팔레트 역할과 warm 톤 이미지를 우선한다",
    "차가운 톤 팔레트 역할과 cool 톤 이미지를 우선한다",
  ],
  shape: ["모서리 반경 토큰이 큰 variant를 고른다", "모서리 반경 토큰이 작은 variant를 고른다"],
  density: [
    "섹션당 항목 수를 늘리거나 pad=-1 섹션을 늘린다",
    "섹션 수를 줄이거나 pad=+1 섹션을 늘린다",
  ],
  depth: ["그림자·겹침이 있는 variant를 늘린다", "평면 variant로 바꾸고 그림자를 줄인다"],
};

export function genAxisHints(ctx: Ctx): Out[] {
  const items: Obj[] = [];
  for (const [axis, [up, down]] of Object.entries(AXIS_HINT)) {
    items.push({ id: `${axis}:up`, axis, direction: "up", hint: `[임시] ${up}` });
    items.push({ id: `${axis}:down`, axis, direction: "down", hint: `[임시] ${down}` });
  }
  return [{ path: "config/axis_hints.json", content: bundle(ctx, "copy-templates", items) }];
}

// ---------- B21 high_risk_brands.json (08장 8.9.2, 공개적으로 알려진 기관·기업명) ----------
type Cat =
  | "bank"
  | "card"
  | "securities"
  | "insurance"
  | "payment"
  | "crypto"
  | "telecom"
  | "portal"
  | "commerce"
  | "delivery"
  | "logistics"
  | "government"
  | "public";
const BRANDS: [Cat, string, string[]][] = [
  ["bank", "국민은행", ["KB국민은행", "kookmin bank", "kbstar"]],
  ["bank", "신한은행", ["shinhan bank"]],
  ["bank", "우리은행", ["woori bank"]],
  ["bank", "하나은행", ["KEB하나은행", "hana bank"]],
  ["bank", "농협은행", ["NH농협은행", "NH농협"]],
  ["bank", "기업은행", ["IBK기업은행", "IBK"]],
  ["bank", "SC제일은행", ["제일은행", "standard chartered"]],
  ["bank", "씨티은행", ["한국씨티은행", "citibank"]],
  ["bank", "카카오뱅크", ["kakaobank"]],
  ["bank", "케이뱅크", ["kbank"]],
  ["bank", "토스뱅크", ["tossbank"]],
  ["bank", "수협은행", ["Sh수협은행"]],
  ["bank", "부산은행", ["BNK부산은행"]],
  ["bank", "대구은행", ["iM뱅크", "DGB대구은행"]],
  ["bank", "새마을금고", ["MG새마을금고"]],
  ["bank", "우체국예금", ["우체국은행"]],
  ["bank", "산업은행", ["KDB산업은행"]],
  ["card", "신한카드", ["shinhan card"]],
  ["card", "삼성카드", ["samsung card"]],
  ["card", "현대카드", ["hyundai card"]],
  ["card", "KB국민카드", ["국민카드"]],
  ["card", "롯데카드", ["lotte card"]],
  ["card", "하나카드", ["hana card"]],
  ["card", "우리카드", ["woori card"]],
  ["card", "BC카드", ["비씨카드"]],
  ["securities", "미래에셋증권", ["미래에셋"]],
  ["securities", "삼성증권", ["samsung securities"]],
  ["securities", "NH투자증권", ["나무증권"]],
  ["securities", "한국투자증권", ["한투"]],
  ["securities", "키움증권", ["kiwoom"]],
  ["securities", "KB증권", ["kb securities"]],
  ["securities", "토스증권", ["toss securities"]],
  ["insurance", "삼성생명", ["samsung life"]],
  ["insurance", "삼성화재", ["samsung fire"]],
  ["insurance", "한화생명", ["hanwha life"]],
  ["insurance", "교보생명", ["kyobo life"]],
  ["insurance", "현대해상", ["hyundai marine"]],
  ["insurance", "DB손해보험", ["DB손보"]],
  ["insurance", "KB손해보험", ["KB손보"]],
  ["payment", "카카오페이", ["kakaopay"]],
  ["payment", "네이버페이", ["naverpay", "N페이"]],
  ["payment", "토스", ["toss", "비바리퍼블리카"]],
  ["payment", "페이코", ["payco"]],
  ["payment", "삼성페이", ["samsung pay"]],
  ["payment", "PASS", ["패스 인증"]],
  ["crypto", "업비트", ["upbit", "두나무"]],
  ["crypto", "빗썸", ["bithumb"]],
  ["crypto", "코인원", ["coinone"]],
  ["crypto", "코빗", ["korbit"]],
  ["telecom", "SK텔레콤", ["sk telecom", "T world"]],
  ["telecom", "KT", ["케이티", "olleh"]],
  ["telecom", "LG유플러스", ["LGU+", "유플러스"]],
  ["portal", "네이버", ["naver"]],
  ["portal", "카카오", ["kakao", "카카오톡", "kakaotalk"]],
  ["portal", "다음", ["daum"]],
  ["portal", "구글", ["google"]],
  ["portal", "애플", ["icloud"]],
  ["portal", "마이크로소프트", ["microsoft", "outlook"]],
  ["commerce", "쿠팡", ["coupang"]],
  ["commerce", "11번가", ["11st"]],
  ["commerce", "G마켓", ["gmarket", "지마켓"]],
  ["commerce", "옥션", ["auction"]],
  ["commerce", "SSG닷컴", ["쓱닷컴", "ssg"]],
  ["commerce", "무신사", ["musinsa"]],
  ["commerce", "당근마켓", ["당근", "daangn"]],
  ["delivery", "배달의민족", ["배민", "baemin"]],
  ["delivery", "요기요", ["yogiyo"]],
  ["delivery", "쿠팡이츠", ["coupang eats"]],
  ["logistics", "우체국택배", ["우체국", "인터넷우체국", "epost"]],
  ["logistics", "CJ대한통운", ["대한통운", "cj logistics"]],
  ["logistics", "한진택배", ["한진", "hanjin"]],
  ["logistics", "롯데택배", ["롯데글로벌로지스"]],
  ["logistics", "로젠택배", ["로젠", "logen"]],
  ["government", "국세청", ["홈택스", "hometax"]],
  ["government", "경찰청", ["사이버수사대", "police"]],
  ["government", "검찰청", ["대검찰청", "중앙지검"]],
  ["government", "법원", ["대법원", "전자소송"]],
  ["government", "정부24", ["gov24", "민원24"]],
  ["government", "금융감독원", ["금감원", "fss"]],
  ["government", "금융위원회", ["금융위"]],
  ["government", "행정안전부", ["행안부"]],
  ["government", "관세청", ["유니패스", "unipass"]],
  ["public", "국민건강보험공단", ["건강보험공단", "건보공단", "nhis"]],
  ["public", "국민연금공단", ["국민연금"]],
  ["public", "근로복지공단", ["comwel"]],
  ["public", "한국전력공사", ["한전", "kepco"]],
  ["public", "건강보험심사평가원", ["심평원", "hira"]],
];

export function genHighRiskBrands(ctx: Ctx): Out[] {
  const items: Obj[] = BRANDS.map(([category, canonical, aliases], i) => ({
    id: `hrb-${String(i + 1).padStart(3, "0")}`,
    canonical,
    aliases,
    category,
    domains: [], // 09장 9.2.4 B21: temp에서는 도메인 판정 건너뜀
    provenance: "temp",
  }));
  return [
    { path: "config/high_risk_brands.json", content: bundle(ctx, "high-risk-brands", items) },
  ];
}

// ---------- B22 prohibited_categories.json (08장 8.9.2 금지 업종, S-24) ----------
const PROHIBITED: Record<string, string[]> = {
  gambling: [
    "도박",
    "카지노",
    "바카라",
    "토토",
    "슬롯머신",
    "베팅",
    "배팅",
    "홀덤",
    "사설토토",
    "파워볼",
    "경마예상",
    "먹튀",
  ],
  adult: [
    "성인용품",
    "성인방송",
    "조건만남",
    "유흥업소",
    "키스방",
    "안마방",
    "립카페",
    "성인채팅",
    "음란물",
    "야동",
  ],
  illegal_loan: [
    "대포통장",
    "작업대출",
    "급전대출",
    "무직자대출",
    "신불자대출",
    "일수대출",
    "개인돈",
    "당일대출",
    "카드깡",
    "휴대폰깡",
    "소액결제현금화",
  ],
  drugs: [
    "마약",
    "대마초",
    "필로폰",
    "엑스터시",
    "케타민",
    "코카인",
    "졸피뎀판매",
    "LSD",
    "아이스작대기",
    "떨액상",
    "브액상",
  ],
  weapons: [
    "총기판매",
    "실탄",
    "사제총",
    "폭발물",
    "석궁판매",
    "가스총판매",
    "도검판매",
    "전기충격기판매",
    "화약판매",
    "모의총포개조",
  ],
  counterfeit: [
    "짝퉁",
    "레플리카",
    "이미테이션",
    "가품",
    "미러급",
    "SA급",
    "정품급",
    "위조상품",
    "명품복제",
    "1:1제작",
  ],
};

export function genProhibited(ctx: Ctx): Out[] {
  const items: Obj[] = Object.entries(PROHIBITED).map(([id, keywords]) => ({
    id,
    keywords,
    provenance: "temp",
  }));
  return [
    {
      path: "config/prohibited_categories.json",
      content: bundle(ctx, "prohibited-categories", items),
    },
  ];
}

// ---------- B24 image_tag_keywords.json (04장 4.9.4 industryTags, 태그 = 03장 3.10.2 ImageTag) ----------
const TAG_KEYWORDS: Record<string, string[]> = {
  "saas.workspace": ["협업", "업무", "생산성", "사무실", "재택"],
  "saas.hands-device": ["앱", "모바일", "결제", "메신저"],
  "saas.architecture": ["플랫폼", "인프라", "클라우드", "보안"],
  "saas.material": ["문서", "데이터", "분석"],
  "saas.meeting-back": ["회의", "팀", "고객관리", "채용"],
  "portfolio.studio": ["디자인", "스튜디오", "작업실", "브랜딩"],
  "portfolio.tools": ["일러스트", "그림", "도구"],
  "portfolio.still-life": ["사진", "제품촬영", "정물"],
  "portfolio.interior": ["인테리어", "공간", "건축"],
  "portfolio.nature": ["풍경", "여행"],
  "local_business.cafe-interior": ["카페", "디저트카페"],
  "local_business.coffee": ["커피", "원두", "로스터리", "음료"],
  "local_business.bakery": ["빵", "베이커리", "케이크", "제과"],
  "local_business.food": ["음식", "한식", "양식", "도시락"],
  "local_business.restaurant-interior": ["식당", "레스토랑", "주점"],
  "local_business.craft": ["공방", "도자기", "가죽", "목공"],
  "local_business.flower": ["꽃", "꽃집", "식물"],
  "local_business.storefront": ["가게", "상점", "매장"],
};

export function genImageTagKeywords(ctx: Ctx): Out[] {
  const items: Obj[] = [];
  for (const [tag, kws] of Object.entries(TAG_KEYWORDS))
    for (const keyword of kws)
      items.push({ id: `ikw-${String(items.length + 1).padStart(3, "0")}`, keyword, tags: [tag] });
  return [
    { path: "config/image_tag_keywords.json", content: bundle(ctx, "image-tag-keywords", items) },
  ];
}

// ---------- 03장 3.13.5 config/color-names.ko.json(사전 원천 = packages/taxonomy COLOR_NAMES, ASM-062) ----------
export function genColorNames(ctx: Ctx): Out[] {
  const items = COLOR_NAMES.map((e) => ({
    id: e.name,
    ...(JSON.parse(JSON.stringify(e)) as Obj),
  })) as Obj[];
  return [{ path: "config/color-names.ko.json", content: bundle(ctx, "color-names", items) }];
}

export const CONFIG_GENERATORS = [
  genColorNames,
  genCopyTemplates,
  genAxisHints,
  genHighRiskBrands,
  genProhibited,
  genImageTagKeywords,
  genNormalizer,
  genLinterExamples,
];

// ---------- B18 data/normalizers/2026-S0.json (05장 5.8.2 스키마, 09장 9.2.4 B18 합성 부트스트랩) ----------
// M1에는 렌더러·추출기가 없어 코퍼스 200 렌더를 만들 수 없다(ASM-020). 분위표는 특징 단위 범위의 등간격 자리표시이고
// `corpus.n = 0`, 전 축 reliable=false로 둔다. M3(추출기) 단위에서 seed:temp가 9.2.4 절차로 다시 만든다.
const FEATURE_RANGE: Record<string, { transform: "identity" | "log1p"; lo: number; hi: number }> = {
  F01: { transform: "identity", lo: 0, hi: 32 },
  F02: { transform: "identity", lo: 0, hi: 1 },
  F04: { transform: "identity", lo: 0, hi: 4 },
  F05: { transform: "identity", lo: 0, hi: 1 },
  F06: { transform: "identity", lo: 0, hi: 48 },
  F07: { transform: "identity", lo: 0, hi: 1 },
  F08: { transform: "identity", lo: 0, hi: 6 },
  F09: { transform: "identity", lo: 0, hi: 1 },
  F10: { transform: "identity", lo: 0, hi: 1 },
  F11: { transform: "log1p", lo: 0, hi: Math.log1p(400) },
  F12: { transform: "identity", lo: 0, hi: 200 },
  F13: { transform: "identity", lo: 0, hi: 12 },
  F14: { transform: "identity", lo: -1, hi: 1 },
  F15: { transform: "identity", lo: -0.05, hi: 0.05 },
  F16: { transform: "identity", lo: 0, hi: 1 },
  F18: { transform: "identity", lo: 1, hi: 8 },
  F19: { transform: "identity", lo: 0, hi: 0.25 },
  F21: { transform: "identity", lo: 1, hi: 8 },
  F22: { transform: "identity", lo: 0, hi: 10 },
  F23: { transform: "identity", lo: 0, hi: 1 },
};
const r6 = (x: number): number => Math.round(x * 1e6) / 1e6;

export function genNormalizer(ctx: Ctx): Out[] {
  // 코퍼스로 다시 만든 파일(corpus.n > 0, `seed:temp --corpus`)은 1단계가 덮어쓰지 않는다(ASM-068)
  const cur = join(ctx.root, "data/normalizers/2026-S0.json");
  if (
    existsSync(cur) &&
    ((JSON.parse(readFileSync(cur, "utf8")) as Obj).corpus as Obj | undefined)?.n
  )
    return [];
  const sec = section(chapter(ctx.root, "05_reference_trend.md"), "### 5.5.4");
  const mapping: Obj = {};
  for (const [axisCell = "", comp = ""] of table(sec)) {
    const axis = axisCell.split(" ")[1] ?? "";
    const weights: Record<string, number> = {};
    const sign: Record<string, number> = {};
    for (const part of comp.split(" · ")) {
      const m = /^(\(1−)?(F\d\d)\b.*?\)?\s+([\d.]+)$/.exec(part.trim());
      if (!m?.[2] || !m[3]) throw new Error(`5.5.4 해석 실패: ${part}`);
      weights[m[2]] = Number(m[3]);
      if (m[1]) sign[m[2]] = -1;
    }
    const sum = Object.values(weights).reduce((a, b) => a + b, 0);
    if (Math.abs(sum - 1) > 1e-9) throw new Error(`5.5.4 ${axis} 가중치 합 ${sum}`);
    mapping[axis] = { weights, sign, b0: 0, b1: 1, source: "initial" };
  }
  const used = new Set(
    Object.values(mapping).flatMap((m) => Object.keys((m as Obj).weights as Obj)),
  );
  const features: Obj = {};
  for (const f of [...used].sort()) {
    const fr = FEATURE_RANGE[f];
    if (!fr) throw new Error(`특징 범위 없음: ${f}`);
    features[f] = {
      transform: fr.transform,
      q: Array.from({ length: 101 }, (_, i) => r6(fr.lo + ((fr.hi - fr.lo) * i) / 100)),
      placeholder: true,
    };
  }
  const axes = Object.keys(mapping);
  const body: Obj = {
    version: "2026-S0",
    provenance: "temp",
    extractor_version: "0.0.0-bootstrap",
    font_class_table_version: "1",
    trend_feature_def_version: "1",
    corpus: { n: 0, hash: null, pending: "M3 seed:temp 재생성(09장 9.2.4 B18 코퍼스 200 렌더)" },
    features,
    mapping,
    reliable: Object.fromEntries(axes.map((a) => [a, false])),
    subjective: Object.fromEntries(axes.map((a) => [a, false])),
    inter_rater: "unverified",
  };
  return [{ path: "data/normalizers/2026-S0.json", content: `${JSON.stringify(body, null, 2)}\n` }];
}

// ---------- B15 data/linter/examples/<ruleId>/{pos,neg}-{1,2}.json(09장 9.2.4 B15) ----------
// M1 골격(ASM-021)을 M3-04에서 04장 4.13.2 규칙 정의대로 쓴 실제 예시로 교체했다(ASM-083). 정의는 linter-examples.ts.
export function genLinterExamples(ctx: Ctx): Out[] {
  const sec = section(chapter(ctx.root, "04_generation.md"), "## 4.13");
  const ids = [...sec.matchAll(/^\| (AIL-\d{2}) \|/gm)].map((m) => m[1]);
  const files = linterExampleFiles();
  const have = new Set(files.map((f) => f.path.split("/")[3]));
  if (ids.length !== 24 || ids.some((id) => !have.has(id)))
    throw new Error(`4.13 AIL 규칙 ${ids.length}개와 예시 규칙 ${have.size}개 불일치`);
  return files;
}
