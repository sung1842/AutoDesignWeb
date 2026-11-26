// B15 린터 예시(09장 9.2.4, 04장 4.13.2·AC-04-26). 규칙마다 양성 2·음성 2, provenance temp(ASM-021·ASM-083).
// 입력 형식은 ASM-077 ④: input.html·vw가 있으면 하네스 lintSnapshot으로 렌더(D·P), 나머지는 lintAll에 그대로.
type J = null | boolean | number | string | J[] | { [k: string]: J };
interface Ex {
  expect: "violation" | "clean";
  severity?: "error" | "warn";
  stages: string[];
  noteKo: string;
  input: { [k: string]: J };
}

const page = (body: string, css = ""): string =>
  `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>*{margin:0;box-sizing:border-box}body{font-family:serif;color:#222;background:#fff}${css}</style></head><body>${body}</body></html>`;
const sec = (inner: string): string => `<section>${inner}</section>`;
const oklch = (l: number, c: number, h: number): J => ({
  colorSpace: "oklch",
  components: [l, c, h],
  alpha: 1,
});
const grad = (a: number[], b: number[]): J => ({
  hero: {
    $type: "gradient",
    $value: [
      { color: oklch(a[0] ?? 0, a[1] ?? 0, a[2] ?? 0), position: 0 },
      { color: oklch(b[0] ?? 0, b[1] ?? 0, b[2] ?? 0), position: 1 },
    ],
  },
});
const fonts = (h: string, b: string): J => ({
  heading: { $type: "fontFamily", $value: [h, "serif"] },
  body: { $type: "fontFamily", $value: [b, "sans-serif"] },
});
const copyText = (text: string): J => ({ copy: { text, placeholder: false } });
const list = (...xs: string[]): J => ({ list: xs.map(copyText) });
const s = (id: string, variant: string, bg: string, pad: number, slots: J = {}): J => ({
  id,
  block: variant.split(".")[0] ?? "",
  variant,
  bg,
  pad,
  slots,
});
const tree = (...sections: J[]): J => ({ sections });
const iconCard = (t: string, b: string, w = 280): string =>
  `<div style="width:${w}px"><svg width="24" height="24" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" fill="none"><circle cx="12" cy="12" r="9"/></svg><h3>${t}</h3><p>${b}</p></div>`;
const row = (cards: string): string => `<div style="display:flex;gap:16px">${cards}</div>`;
const svg = (attrs: string): string =>
  `<svg ${attrs} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 12h16"/></svg>`;
const BRAND: J = { name: "한결로스터리", keywords: ["핸드드립", "원두 정기배송"] };
const TOK17: J = {
  color: {
    fg: { $type: "color", $value: { hex: "#222222" } },
    bg: { $type: "color", $value: { hex: "#FFFFFF" } },
  },
  radius: { md: { $type: "dimension", $value: { value: 4, unit: "px" } } },
  space: {
    "2": { $type: "dimension", $value: { value: 8, unit: "px" } },
    "4": { $type: "dimension", $value: { value: 16, unit: "px" } },
  },
};

export const LINTER_EXAMPLES: Record<string, [Ex, Ex, Ex, Ex]> = {
  "AIL-01": [
    {
      expect: "violation",
      stages: ["D"],
      noteKo: "보라→하늘 그라디언트 히어로",
      input: {
        html: page(
          sec('<div style="height:200px;background:linear-gradient(90deg,#7c3aed,#0284c7)"></div>'),
        ),
      },
    },
    {
      expect: "violation",
      stages: ["S"],
      noteKo: "토큰 그라디언트 h 290·230",
      input: { spec: { tokens: { gradient: grad([0.55, 0.2, 290], [0.6, 0.15, 230]) } } },
    },
    {
      expect: "clean",
      stages: ["D"],
      noteKo: "같은 hue 계열 2-stop",
      input: {
        html: page(
          sec('<div style="height:200px;background:linear-gradient(90deg,#f97316,#fb923c)"></div>'),
        ),
      },
    },
    {
      expect: "clean",
      stages: ["S"],
      noteKo: "토큰 그라디언트 h 30→45",
      input: { spec: { tokens: { gradient: grad([0.7, 0.12, 30], [0.75, 0.12, 45]) } } },
    },
  ],
  "AIL-02": [
    {
      expect: "violation",
      stages: ["D"],
      noteKo: "히어로 제목 그라디언트 텍스트",
      input: {
        html: page(
          sec(
            '<h1 style="background:linear-gradient(90deg,#f43f5e,#8b5cf6);-webkit-background-clip:text;background-clip:text;color:transparent">원두 이야기</h1>',
          ),
        ),
      },
    },
    {
      expect: "violation",
      stages: ["D"],
      noteKo: "강조 span 그라디언트 텍스트",
      input: {
        html: page(
          sec(
            '<p>매일 <span style="background-image:linear-gradient(#22c55e,#06b6d4);-webkit-background-clip:text;background-clip:text;color:transparent">볶는</span> 원두</p>',
          ),
        ),
      },
    },
    {
      expect: "clean",
      stages: ["D"],
      noteKo: "단색 헤드라인",
      input: { html: page(sec('<h1 style="color:#1e1a16">원두 이야기</h1>')) },
    },
    {
      expect: "clean",
      stages: ["D"],
      noteKo: "그라디언트 배경 위 단색 글자(clip 없음)",
      input: {
        html: page(
          sec(
            '<div style="background:linear-gradient(#fde68a,#fcd34d);padding:16px"><h2>계절 원두</h2></div>',
          ),
        ),
      },
    },
  ],
  "AIL-03": [
    {
      expect: "violation",
      stages: ["D"],
      noteKo: "전부 Pretendard",
      input: {
        html: page(
          sec("<h1>성수동 로스터리</h1><p>매일 아침 볶습니다</p>"),
          "body{font-family:Pretendard,sans-serif}",
        ),
      },
    },
    {
      expect: "violation",
      stages: ["S"],
      noteKo: "토큰 헤딩·본문 모두 Inter",
      input: { spec: { tokens: { font: fonts("Inter", "Inter") } } },
    },
    {
      expect: "clean",
      stages: ["D"],
      noteKo: "명조 헤드라인 + Pretendard 본문",
      input: {
        html: page(
          sec("<h1>성수동 로스터리</h1><p>매일 아침 볶습니다</p>"),
          "body{font-family:Pretendard,sans-serif}h1{font-family:'Nanum Myeongjo',serif}",
        ),
      },
    },
    {
      expect: "clean",
      stages: ["S"],
      noteKo: "토큰 명조 + Pretendard",
      input: { spec: { tokens: { font: fonts("Nanum Myeongjo", "Pretendard") } } },
    },
  ],
  "AIL-04": [
    {
      expect: "violation",
      stages: ["T", "C"],
      noteKo: "중앙 hero + ✨ New pill 배지",
      input: {
        tree: tree(s("hero", "hero.centered", "bg", 1, { eyebrow: copyText("✨ New") })),
        copy: [{ role: "hero.eyebrow", text: "✨ New", style: "pill" }],
      },
    },
    {
      expect: "violation",
      stages: ["T", "C"],
      noteKo: "pill 프리셋 + 중앙 hero + 신규 출시",
      input: {
        spec: { l2: { "shape.radius_family": "pill" } },
        tree: tree(s("hero", "hero.centered", "bg", 1)),
        copy: [{ role: "hero.eyebrow", text: "신규 출시" }],
      },
    },
    {
      expect: "clean",
      stages: ["T", "C"],
      noteKo: "좌측 정렬 hero + 지역 eyebrow",
      input: {
        tree: tree(s("hero", "hero.left-aligned", "bg", 1)),
        copy: [{ role: "hero.eyebrow", text: "성수동 로스터리", style: "pill" }],
      },
    },
    {
      expect: "clean",
      stages: ["T", "C"],
      noteKo: "중앙 hero + pill이지만 배지 문구 아님",
      input: {
        tree: tree(s("hero", "hero.centered", "bg", 1)),
        copy: [{ role: "hero.eyebrow", text: "성수동 로스터리", style: "pill" }],
      },
    },
  ],
  "AIL-05": [
    {
      expect: "violation",
      severity: "error",
      stages: ["T"],
      noteKo: "아이콘 카드 3열이 두 섹션에 반복",
      input: {
        tree: tree(
          s("v1", "value.icon-grid", "bg", 0, { items: list("원두", "로스팅", "배송") }),
          s("p1", "proof.cards", "surface", 1),
          s("v2", "value.icon-grid", "bg", 0, { items: list("구독", "선물", "매장") }),
        ),
      },
    },
    {
      expect: "violation",
      severity: "warn",
      stages: ["D"],
      noteKo: "한 섹션 아이콘 카드 3열(1회 warn)",
      input: {
        html: page(
          sec(
            row(
              iconCard("원두", "매일 볶음") +
                iconCard("배송", "다음 날 도착") +
                iconCard("구독", "주 1회"),
            ),
          ),
        ),
      },
    },
    {
      expect: "clean",
      stages: ["D"],
      noteKo: "번호형 리스트 01/02/03",
      input: {
        html: page(
          sec("<ol><li><b>01</b> 원두</li><li><b>02</b> 로스팅</li><li><b>03</b> 배송</li></ol>"),
        ),
      },
    },
    {
      expect: "clean",
      stages: ["T"],
      noteKo: "value.numbered 3항목",
      input: {
        tree: tree(s("v1", "value.numbered", "bg", 0, { items: list("원두", "로스팅", "배송") })),
      },
    },
  ],
  "AIL-06": [
    {
      expect: "violation",
      stages: ["D"],
      noteKo: "모든 카드 radius 14 + blur 30 그림자",
      input: {
        html: page(
          sec(
            '<div class="card">원두</div><div class="card">배송</div><div class="card">구독</div>',
          ),
          ".card{width:240px;padding:16px;border-radius:14px;box-shadow:0 10px 30px rgba(0,0,0,.1)}",
        ),
      },
    },
    {
      expect: "violation",
      stages: ["S"],
      noteKo: "subtle-shadow + radius 14 + blur 24 α 0.1",
      input: {
        spec: {
          type_id: "T1",
          l2: { "depth.style": "subtle-shadow", "depth.shadow_level": "2" },
          tokens: {
            radius: { md: { $type: "dimension", $value: { value: 14, unit: "px" } } },
            shadow: {
              "level-2": {
                $type: "shadow",
                $value: [{ blur: { value: 24, unit: "px" }, color: { alpha: 0.1 } }],
              },
            },
          },
        },
      },
    },
    {
      expect: "clean",
      stages: ["D"],
      noteKo: "soft radius + hairline 테두리",
      input: {
        html: page(
          sec('<div class="card">원두</div><div class="card">배송</div>'),
          ".card{width:240px;padding:16px;border-radius:4px;border:1px solid #ddd}",
        ),
      },
    },
    {
      expect: "clean",
      stages: ["S"],
      noteKo: "flat 프리셋",
      input: { spec: { l2: { "depth.style": "flat", "depth.shadow_level": "0" }, tokens: {} } },
    },
  ],
  "AIL-07": [
    {
      expect: "violation",
      severity: "error",
      stages: ["T"],
      noteKo: "모든 섹션 pad 0",
      input: {
        tree: tree(
          s("hero", "hero.split", "bg", 0),
          s("v", "value.numbered", "surface", 0),
          s("p", "proof.cards", "bg", 0),
          s("c", "cta.big-type", "inverse", 0),
        ),
      },
    },
    {
      expect: "violation",
      severity: "error",
      stages: ["T"],
      noteKo: "인접 같은 variant",
      input: {
        tree: tree(
          s("hero", "hero.split", "bg", 1),
          s("s1", "story.split", "surface", 0),
          s("s2", "story.split", "bg", 0),
        ),
      },
    },
    {
      expect: "clean",
      stages: ["T"],
      noteKo: "pad +1 섹션 1개, inverse 1개",
      input: {
        tree: tree(
          s("hero", "hero.split", "bg", 1),
          s("v", "value.numbered", "surface", 0),
          s("p", "proof.cards", "bg", 0),
          s("c", "cta.big-type", "inverse", 0),
        ),
      },
    },
    {
      expect: "clean",
      stages: ["T"],
      noteKo: "5섹션 리듬 다양",
      input: {
        tree: tree(
          s("hero", "hero.type-only", "bg", 1),
          s("m", "menu.leader", "surface", 0),
          s("g", "gallery.grid", "bg", 0),
          s("st", "story.split", "inverse", -1),
          s("l", "location.info-map", "bg", 0),
        ),
      },
    },
  ],
  "AIL-08": [
    {
      expect: "violation",
      stages: ["D"],
      noteKo: "히어로 뒤 보라 블러 원",
      input: {
        html: page(
          sec(
            '<div aria-hidden="true" style="position:absolute;top:0;left:0;width:300px;height:300px;border-radius:50%;background:#8b5cf6;filter:blur(60px)"></div><h1 style="position:relative">원두</h1>',
          ),
        ),
      },
    },
    {
      expect: "violation",
      stages: ["D"],
      noteKo: "뷰포트 23% radial-gradient 블롭",
      input: {
        html: page(
          sec(
            '<div aria-hidden="true" style="position:absolute;top:0;left:0;width:600px;height:400px;background:radial-gradient(circle,#f0abfc 0%,transparent 70%)"></div><h1 style="position:relative">원두</h1>',
          ),
        ),
      },
    },
    {
      expect: "clean",
      stages: ["D"],
      noteKo: "장식 없음",
      input: { html: page(sec("<h1>원두</h1><p>매일 볶습니다</p>")) },
    },
    {
      expect: "clean",
      stages: ["D"],
      noteKo: "작은 그림자 장식(blur 4px)",
      input: {
        html: page(
          sec(
            '<div aria-hidden="true" style="position:absolute;top:20px;left:20px;width:40px;height:40px;background:#ddd;filter:blur(4px)"></div><h1>원두</h1>',
          ),
        ),
      },
    },
  ],
  "AIL-09": [
    {
      expect: "violation",
      stages: ["P"],
      noteKo: "흰 단색 위 반투명 카드",
      input: {
        html: page(
          sec(
            '<div style="margin:40px;width:300px;height:160px;background:rgba(255,255,255,.5);backdrop-filter:blur(12px)">카드</div>',
          ),
        ),
      },
    },
    {
      expect: "violation",
      stages: ["S"],
      noteKo: "glass 장식 ∧ depth.style flat",
      input: { spec: { l2: { "depth.style": "flat" }, decor: { max: 2, effects: ["glass"] } } },
    },
    {
      expect: "clean",
      stages: ["P"],
      noteKo: "줄무늬 배경 위 글래스 내비",
      input: {
        html: page(
          '<section style="background:repeating-linear-gradient(90deg,#111 0 8px,#eee 8px 16px);padding:40px"><nav style="width:300px;height:80px;background:rgba(255,255,255,.3);backdrop-filter:blur(8px)">메뉴</nav></section>',
        ),
      },
    },
    {
      expect: "clean",
      stages: ["S"],
      noteKo: "depth.style glass + glass 장식",
      input: { spec: { l2: { "depth.style": "glass" }, decor: { max: 2, effects: ["glass"] } } },
    },
  ],
  "AIL-10": [
    {
      expect: "violation",
      severity: "error",
      stages: ["C"],
      noteKo: "헤딩 이모지",
      input: { copy: [{ role: "heading", text: "🚀 빠른 시작" }] },
    },
    {
      expect: "violation",
      severity: "error",
      stages: ["D"],
      noteKo: "버튼 이모지",
      input: { html: page(sec("<button>✨ 원두 고르기</button>")) },
    },
    {
      expect: "clean",
      stages: ["C"],
      noteKo: "이모지 없음",
      input: {
        copy: [
          { role: "heading", text: "빠른 시작" },
          { role: "body", text: "주 1회 배송합니다." },
        ],
      },
    },
    {
      expect: "clean",
      stages: ["D"],
      noteKo: "인라인 SVG 아이콘",
      input: { html: page(sec(`<button>${svg('stroke-width="1.5"')} 원두 고르기</button>`)) },
    },
  ],
  "AIL-11": [
    {
      expect: "violation",
      stages: ["D"],
      noteKo: "형광 초록 글로우 버튼",
      input: { html: page(sec('<button style="box-shadow:0 0 20px #39ff14">시작</button>')) },
    },
    {
      expect: "violation",
      stages: ["D"],
      noteKo: "자홍 텍스트 글로우",
      input: { html: page(sec('<h1 style="text-shadow:0 0 16px #ff00ff">원두</h1>')) },
    },
    {
      expect: "clean",
      stages: ["D"],
      noteKo: "brutal-offset 그림자",
      input: { html: page(sec('<button style="box-shadow:6px 6px 0 #000">시작</button>')) },
    },
    {
      expect: "clean",
      stages: ["D"],
      noteKo: "무채색 흐린 그림자",
      input: {
        html: page(sec('<button style="box-shadow:0 0 20px rgba(0,0,0,.2)">시작</button>')),
      },
    },
  ],
  "AIL-12": [
    {
      expect: "violation",
      stages: ["T"],
      noteKo: "텍스트 한 줄씩인 4칸",
      input: {
        tree: tree(
          s("v", "value.bento", "bg", 0, {
            items: list("좋은 원두", "정성 로스팅", "빠른 배송", "친절한 상담"),
          }),
        ),
      },
    },
    {
      expect: "violation",
      stages: ["T"],
      noteKo: "3칸 벤토",
      input: {
        tree: tree(s("v", "value.bento", "bg", 0, { items: list("원두 12종", "“매일”", "배송") })),
      },
    },
    {
      expect: "clean",
      stages: ["T"],
      noteKo: "사진·수치·인용이 섞인 5칸",
      input: {
        tree: tree(
          s("v", "value.bento", "bg", 0, {
            media: { image: { asset_id: "img_tmp_cafe_01" } },
            items: list("연 1,200잔", "“매일 볶습니다”", "원두 12종", "2019년 개업"),
          }),
        ),
      },
    },
    {
      expect: "clean",
      stages: ["T"],
      noteKo: "벤토 아님",
      input: {
        tree: tree(s("v", "value.numbered", "bg", 0, { items: list("원두", "로스팅", "배송") })),
      },
    },
  ],
  "AIL-13": [
    {
      expect: "violation",
      stages: ["C"],
      noteKo: "혁신적인·선사",
      input: { copy: [{ role: "hero.headline", text: "혁신적인 커피 경험을 선사합니다" }] },
    },
    {
      expect: "violation",
      stages: ["C"],
      noteKo: "영어 unlock",
      input: { copy: [{ role: "hero.sub", text: "Unlock your mornings with us" }] },
    },
    {
      expect: "clean",
      stages: ["C"],
      noteKo: "구체적 문장",
      input: { copy: [{ role: "hero.headline", text: "성수동에서 매일 아침 볶는 원두" }] },
    },
    {
      expect: "clean",
      stages: ["C"],
      noteKo: "구체적 CTA",
      input: {
        copy: [
          { role: "button", text: "원두 고르기" },
          { role: "button", text: "매장 위치 보기" },
        ],
      },
    },
  ],
  "AIL-14": [
    {
      expect: "violation",
      severity: "error",
      stages: ["C"],
      noteKo: "hero에 브랜드명·키워드 0",
      input: {
        brand: BRAND,
        copy: [
          { role: "hero.headline", text: "당신의 일상을 바꾸는 커피" },
          { role: "hero.sub", text: "매일이 특별해집니다." },
        ],
      },
    },
    {
      expect: "violation",
      severity: "warn",
      stages: ["C"],
      noteKo: "고유 정보 없는 문장 4/5",
      input: {
        brand: BRAND,
        copy: [
          { role: "hero.headline", text: "한결로스터리 원두" },
          {
            role: "body",
            text: "좋은 하루를 시작하세요. 향이 좋습니다. 마음이 편해집니다. 함께해요.",
          },
        ],
      },
    },
    {
      expect: "clean",
      stages: ["C"],
      noteKo: "브랜드명·키워드·숫자 포함",
      input: {
        brand: BRAND,
        copy: [
          { role: "hero.headline", text: "한결로스터리, 핸드드립 원두 정기배송" },
          { role: "body", text: "성수동 매장에서 매주 2회 볶습니다." },
        ],
      },
    },
    {
      expect: "clean",
      stages: ["C"],
      noteKo: "모든 문장에 고유 정보",
      input: {
        brand: BRAND,
        copy: [
          { role: "hero.headline", text: "핸드드립 원두를 집에서" },
          { role: "body", text: "원두 정기배송은 2주마다 갑니다. 한결로스터리가 직접 볶습니다." },
        ],
      },
    },
  ],
  "AIL-15": [
    {
      expect: "violation",
      stages: ["C"],
      noteKo: "자세히 보기 ×4",
      input: { copy: ["a", "b", "c", "d"].map(() => ({ role: "button", text: "자세히 보기" })) },
    },
    {
      expect: "violation",
      stages: ["C"],
      noteKo: "Learn more ×2 + 더 알아보기",
      input: {
        copy: [
          { role: "button", text: "Learn more" },
          { role: "button", text: "Learn more" },
          { role: "button", text: "더 알아보기" },
        ],
      },
    },
    {
      expect: "clean",
      stages: ["C"],
      noteKo: "구체적 CTA",
      input: {
        copy: [
          { role: "button", text: "원두 고르기" },
          { role: "button", text: "매장 위치 보기" },
        ],
      },
    },
    {
      expect: "clean",
      stages: ["C"],
      noteKo: "자세히 보기 ×2",
      input: {
        copy: [
          { role: "button", text: "자세히 보기" },
          { role: "button", text: "자세히 보기" },
        ],
      },
    },
  ],
  "AIL-16": [
    {
      expect: "violation",
      stages: ["D"],
      noteKo: "--radius 0.625rem",
      input: {
        html: page(
          sec("<button>시작</button>"),
          ":root{--radius:0.625rem}button{border-radius:var(--radius)}",
        ),
      },
    },
    {
      expect: "violation",
      stages: ["D"],
      noteKo: "indigo-500 버튼",
      input: { html: page(sec('<button style="background:#6366f1;color:#fff">시작</button>')) },
    },
    {
      expect: "clean",
      stages: ["D"],
      noteKo: "서비스 토큰 radius",
      input: {
        html: page(
          sec("<button>시작</button>"),
          ":root{--radius:3px}button{border-radius:var(--radius)}",
        ),
      },
    },
    {
      expect: "clean",
      stages: ["D"],
      noteKo: "토큰 색 버튼 + 고유 그림자",
      input: {
        html: page(
          sec(
            '<button style="background:#29231e;color:#f4f1ec;box-shadow:0 2px 0 #000">시작</button>',
          ),
        ),
      },
    },
  ],
  "AIL-17": [
    {
      expect: "violation",
      stages: ["D"],
      noteKo: "padding 13px",
      input: { spec: { tokens: TOK17 }, html: page(sec('<div style="padding:13px">원두</div>')) },
    },
    {
      expect: "violation",
      stages: ["D"],
      noteKo: "토큰 밖 글자색",
      input: { spec: { tokens: TOK17 }, html: page(sec('<p style="color:#ff0000">원두</p>')) },
    },
    {
      expect: "clean",
      stages: ["D"],
      noteKo: "토큰 값만",
      input: {
        spec: { tokens: TOK17 },
        html: page(sec('<div style="padding:16px;border-radius:4px;background:#fff">원두</div>')),
      },
    },
    {
      expect: "clean",
      stages: ["D"],
      noteKo: "margin:auto 중앙 정렬 + 토큰 간격",
      input: {
        spec: { tokens: TOK17 },
        html: page(sec('<div style="width:300px;margin:0 auto;padding:8px">원두</div>')),
      },
    },
  ],
  "AIL-18": [
    {
      expect: "violation",
      severity: "error",
      stages: ["D"],
      noteKo: "Lucide 기본 아이콘 8개",
      input: {
        html: page(
          sec(Array.from({ length: 8 }, () => svg('class="lucide" stroke-width="2"')).join("")),
        ),
      },
    },
    {
      expect: "violation",
      severity: "error",
      stages: ["T"],
      noteKo: "icon.set lucide",
      input: {
        spec: { l2: { "icon.set": "lucide" } },
        tree: tree(s("hero", "hero.split", "bg", 1)),
      },
    },
    {
      expect: "clean",
      stages: ["D"],
      noteKo: "Phosphor 1.5 stroke 3개",
      input: {
        html: page(
          sec(
            `<div data-icon-set="phosphor">${Array.from({ length: 3 }, () => svg('stroke-width="1.5"')).join("")}</div>`,
          ),
        ),
      },
    },
    {
      expect: "clean",
      stages: ["T"],
      noteKo: "phosphor + icon-grid 3항목",
      input: {
        spec: { l2: { "icon.set": "phosphor" } },
        tree: tree(s("v", "value.icon-grid", "bg", 0, { items: list("원두", "로스팅", "배송") })),
      },
    },
  ],
  "AIL-19": [
    {
      expect: "violation",
      stages: ["C"],
      noteKo: "섹션마다 ~해보세요",
      input: {
        copy: [
          { role: "body", text: "원두를 주문해보세요." },
          { role: "body", text: "매장을 예약해 보세요." },
          { role: "body", text: "정기배송을 구독해보세요." },
        ],
      },
    },
    {
      expect: "violation",
      stages: ["C"],
      noteKo: "한 단락에 권유형 3회",
      input: {
        copy: [
          {
            role: "body",
            text: "먼저 시음해 보세요. 그리고 비교해보세요. 마지막으로 선택해 보세요.",
          },
        ],
      },
    },
    {
      expect: "clean",
      stages: ["C"],
      noteKo: "종결 다양",
      input: {
        copy: [
          { role: "body", text: "원두는 매일 볶습니다." },
          { role: "body", text: "주문은 오후 2시까지." },
          { role: "body", text: "매장을 예약해 보세요." },
        ],
      },
    },
    {
      expect: "clean",
      stages: ["C"],
      noteKo: "권유형 2회",
      input: {
        copy: [
          { role: "body", text: "원두를 주문해보세요." },
          { role: "body", text: "매장을 예약해 보세요." },
        ],
      },
    },
  ],
  "AIL-20": [
    {
      expect: "violation",
      stages: ["C"],
      noteKo: "헤드라인 느낌표",
      input: {
        spec: { copy: { tone_id: "T-EDITORIAL", exclaim_max_per_page: 0 } },
        copy: [{ role: "hero.headline", text: "지금 만나보세요!!" }],
      },
    },
    {
      expect: "violation",
      stages: ["C"],
      noteKo: "페이지 느낌표 3 > 1",
      input: {
        spec: { copy: { tone_id: "T-WARM", exclaim_max_per_page: 1 } },
        copy: [
          { role: "hero.headline", text: "아침 원두" },
          { role: "body", text: "향이 좋아요! 맛있어요! 또 와요!" },
        ],
      },
    },
    {
      expect: "clean",
      stages: ["C"],
      noteKo: "느낌표 0",
      input: {
        spec: { copy: { tone_id: "T-EDITORIAL", exclaim_max_per_page: 0 } },
        copy: [
          { role: "hero.headline", text: "아침 원두" },
          { role: "body", text: "매일 볶습니다." },
        ],
      },
    },
    {
      expect: "clean",
      stages: ["C"],
      noteKo: "T-PLAYFUL 헤드라인 느낌표 1",
      input: {
        spec: { copy: { tone_id: "T-PLAYFUL", exclaim_max_per_page: 1 } },
        copy: [{ role: "hero.headline", text: "아침 원두 좋아요!" }],
      },
    },
  ],
  "AIL-21": [
    {
      expect: "violation",
      stages: ["C"],
      noteKo: "입력에 없는 만족도 99.9%",
      input: { brand: BRAND, copy: [{ role: "body", text: "고객 만족도 99.9%" }] },
    },
    {
      expect: "violation",
      stages: ["C"],
      noteKo: "입력에 없는 업계 1위",
      input: { brand: BRAND, copy: [{ role: "hero.sub", text: "성수동 1위 로스터리" }] },
    },
    {
      expect: "clean",
      stages: ["C"],
      noteKo: "입력된 회원 수 사용",
      input: {
        brand: { name: "한결로스터리", description: "정기배송 회원 1,200명" },
        copy: [{ role: "body", text: "정기배송 회원 1,200명이 함께합니다" }],
      },
    },
    {
      expect: "clean",
      stages: ["C"],
      noteKo: "[예시] 접두 수치",
      input: { brand: BRAND, copy: [{ role: "body", text: "[예시] 고객 만족도 98%" }] },
    },
  ],
  "AIL-22": [
    {
      expect: "violation",
      stages: ["C"],
      noteKo: "실명 후기",
      input: { copy: [{ role: "proof.quote", text: "정말 최고예요! — 김지훈 대표" }] },
    },
    {
      expect: "violation",
      stages: ["C"],
      noteKo: "[예시] 후기 + 실명 작성자",
      input: {
        copy: [
          { role: "proof.quote", text: "[예시] 고객 후기가 들어갈 자리" },
          { role: "proof.author", text: "김지훈" },
        ],
      },
    },
    {
      expect: "clean",
      stages: ["C"],
      noteKo: "[예시] 후기 — 김○○",
      input: { copy: [{ role: "proof.quote", text: "[예시] 고객 후기가 들어갈 자리 — 김○○" }] },
    },
    {
      expect: "clean",
      stages: ["C"],
      noteKo: "[예시] 후기 + 박○○",
      input: {
        copy: [
          { role: "proof.quote", text: "[예시] 고객 후기가 들어갈 자리" },
          { role: "proof.author", text: "박○○" },
        ],
      },
    },
  ],
  "AIL-23": [
    {
      expect: "violation",
      stages: ["C"],
      noteKo: "Lorem ipsum",
      input: { copy: [{ role: "body", text: "Lorem ipsum dolor sit amet" }] },
    },
    {
      expect: "violation",
      stages: ["D"],
      noteKo: "Your company 잔여",
      input: { html: page(sec("<p>Your Company 소개</p>")) },
    },
    {
      expect: "clean",
      stages: ["C"],
      noteKo: "[예시] 접두 자리표시",
      input: { copy: [{ role: "body", text: "[예시] 텍스트를 입력하세요" }] },
    },
    {
      expect: "clean",
      stages: ["D"],
      noteKo: "CP-10 예시 이메일",
      input: { html: page(sec("<p>hello@example.com</p><p>02-000-0000</p>")) },
    },
  ],
  "AIL-24": [
    {
      expect: "violation",
      stages: ["D"],
      noteKo: "375px 헤드라인 4줄 이상",
      input: {
        vw: 375,
        html: page(
          sec(
            '<h1 data-role="hero.headline" style="font-size:40px;width:335px">성수동 골목에서 매일 아침 직접 볶은 원두를 집 앞까지 보내 드립니다</h1>',
          ),
        ),
      },
    },
    {
      expect: "violation",
      stages: ["D"],
      noteKo: "마지막 줄 1글자",
      input: {
        vw: 1280,
        html: page(
          sec(
            '<h1 data-role="hero.headline" style="font-size:48px">오늘 아침 볶은 원두입니<br>다</h1>',
          ),
        ),
      },
    },
    {
      expect: "clean",
      stages: ["D"],
      noteKo: "1280 한 줄",
      input: {
        vw: 1280,
        html: page(sec('<h1 data-role="hero.headline" style="font-size:48px">아침 원두</h1>')),
      },
    },
    {
      expect: "clean",
      stages: ["D"],
      noteKo: "375 균형 2줄",
      input: {
        vw: 375,
        html: page(
          sec(
            '<h1 data-role="hero.headline" style="font-size:32px">성수동 아침<br>원두 로스터리</h1>',
          ),
        ),
      },
    },
  ],
};

/** seed:temp B15 출력(ASM-083: 골격을 실제 예시로 교체). */
export function linterExampleFiles(): { path: string; content: string }[] {
  const out: { path: string; content: string }[] = [];
  for (const [ruleId, exs] of Object.entries(LINTER_EXAMPLES)) {
    const names = ["pos-1", "pos-2", "neg-1", "neg-2"];
    exs.forEach((e, i) => {
      const body = {
        ruleId,
        expect: e.expect,
        ...(e.severity ? { severity: e.severity } : {}),
        stages: e.stages,
        noteKo: e.noteKo,
        provenance: "temp",
        page: null,
        tokens: null,
        input: e.input,
      };
      out.push({
        path: `data/linter/examples/${ruleId}/${names[i]}.json`,
        content: `${JSON.stringify(body, null, 2)}\n`,
      });
    });
  }
  return out;
}
