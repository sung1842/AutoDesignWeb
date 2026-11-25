// 04장 CM-02 리터럴 검사(ASM-041). tokens.css·theme.css 밖 CSS의 선언 값에서
// 색 리터럴(hex·색 함수·이름 색)과 단위 있는 치수 리터럴을 찾는다.
// 허용 목록: 0, 100%, auto, 1fr, inherit, currentColor (+ var(--*) 참조, 단위 없는 수).
// @media·@supports 등 at-rule 머리(prelude)는 CSS 변수를 쓸 수 없어 검사하지 않는다.

const COLOR_FN = /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix)\s*\(/i;
const HEX = /#[0-9a-f]{3,8}\b/i;
// CSS 이름 색(CSS Color 4) + transparent. currentColor는 허용.
const NAMED = new Set(
  (
    "aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue " +
    "blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk " +
    "crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki " +
    "darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen " +
    "darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue " +
    "dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite " +
    "gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki " +
    "lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan " +
    "lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen " +
    "lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen " +
    "magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen " +
    "mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream " +
    "mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid " +
    "palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum " +
    "powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown " +
    "seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen " +
    "steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow " +
    "yellowgreen transparent"
  ).split(" "),
);
const DIMENSION = /(?<![\w-])(-?(?:\d+\.?\d*|\.\d+))([a-z%]+)/gi;
const ALLOWED_DIM = new Set(["100%", "1fr"]);

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

/** 선언(prop: value) 목록. 블록 안 `{`/`;` 뒤에서 시작해 `;`/`}` 앞에서 끝나는 것만. */
export function declarations(css: string): { prop: string; value: string }[] {
  const out: { prop: string; value: string }[] = [];
  const re = /[{;]\s*(--[\w-]+|[a-z-]+)\s*:\s*([^;{}]+?)\s*(?=[;}])/gi;
  for (const m of stripComments(css).matchAll(re)) {
    out.push({ prop: m[1] ?? "", value: m[2] ?? "" });
  }
  return out;
}

function valueViolations(value: string): string[] {
  const bad: string[] = [];
  // var(--x) 참조(대체값 없음)는 제거. 대체값이 있으면 그 대체값도 검사 대상으로 남는다.
  const v = value.replace(/var\(\s*--[\w-]+\s*\)/g, " ").replace(/var\(\s*--[\w-]+\s*,/g, "(");
  if (HEX.test(v)) bad.push(`색 리터럴 ${HEX.exec(v)?.[0] ?? ""}`);
  if (COLOR_FN.test(v)) bad.push(`색 함수 ${COLOR_FN.exec(v)?.[0] ?? ""}`);
  for (const w of v.replace(/"[^"]*"|'[^']*'/g, " ").match(/(?<![\w-])[a-z]+(?![\w-])/gi) ?? []) {
    if (NAMED.has(w.toLowerCase())) bad.push(`이름 색 ${w}`);
  }
  for (const m of v.matchAll(DIMENSION)) {
    const lit = `${m[1] ?? ""}${(m[2] ?? "").toLowerCase()}`;
    if (Number(m[1]) === 0 || ALLOWED_DIM.has(lit)) continue;
    bad.push(`치수 리터럴 ${lit}`);
  }
  return bad;
}

/** CM-02 위반 목록(`prop: 사유`). 빈 배열이면 통과. `!important`도 CM-03 위반으로 잡는다. */
export function cssLiteralViolations(css: string): string[] {
  const out: string[] = [];
  for (const { prop, value } of declarations(css)) {
    for (const b of valueViolations(value)) out.push(`${prop}: ${b}`);
    if (/!\s*important/i.test(value)) out.push(`${prop}: !important`);
  }
  return out;
}
