// 시그니처 DOM 도우미(03장 3.2.4, 04장 4.14, AC-04-30). 순수·isomorphic. ASM-069.
// - 문서 루트 data-signature, 적용 블록(spec.signature.apply_to) data-sig="on"
// - 요소가 필요한 시그니처만 마크업을 넣는다: SIG-06 마키 띠, SIG-07 그레인, SIG-11 아웃라인 장식 텍스트
// - SIG-09 자간은 역할 단계에 따라 달라 여기서 생성한다(값은 var(--tf-type-*) × 단위 없는 수, CM-02)
import { STEP_TOKEN, TEXT_ROLE_SPEC, type TextRole } from "./css/text-roles.js";
import { el, raw, type Html } from "./html.js";

export interface SignatureLike {
  id: string;
  intensity: 1 | 2;
  apply_to: string[];
}

/** 3.2.4 SIG-09 자간: 라틴 대문자 +0.08em, 한글 +0.02em(03장 우선, 4.14 규칙 1). */
export const SIG09_TRACKING = { latin: 0.08, hangul: 0.02 } as const;
/** SIG-09 대상 라벨 역할(eyebrow·nav 링크, 3.2.4). */
export const SIG09_ROLES: readonly string[] = ["eyebrow", "nav.link"];

/** 라틴 문자 라벨인지(대문자 변환·넓은 자간 대상). 한글이 하나라도 있으면 아니다. */
export function isLatinLabel(text: string): boolean {
  return /[A-Za-z]/.test(text) && /^[\x20-\x7E’·]+$/.test(text);
}

/** SIG-09 대상 역할이면서 라틴 문자면 data-script="latin". 그 밖은 null(속성 없음). */
export function scriptAttr(role: string, text: string): string | null {
  return SIG09_ROLES.includes(role) && isLatinLabel(text) ? "latin" : null;
}

export function sigApplies(sig: SignatureLike | undefined, block: string): boolean {
  return !!sig && sig.apply_to.includes(block);
}

/** SIG-06 마키 띠. 장식이라 aria-hidden, 텍스트는 같은 문구 2벌(끊김 없는 반복). */
export function marqueeHtml(text: string): Html {
  const item = `${text} · ${text} · ${text} · `;
  return el(
    "div",
    { class: "tf-marquee", "aria-hidden": "true", "data-sig-el": "SIG-06" },
    el(
      "div",
      { class: "tf-marquee__track" },
      el("span", { "data-role": "eyebrow" }, item),
      el("span", { "data-role": "eyebrow" }, item),
    ),
  );
}

/** SIG-07 그레인 타일(인라인 SVG 노이즈, 외부 요청 없음). */
export function grainHtml(): Html {
  return raw(
    `<svg class="tf-grain" aria-hidden="true" focusable="false" data-sig-el="SIG-07" xmlns="http://www.w3.org/2000/svg">` +
      `<filter id="tf-grain-f"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" stitchTiles="stitch"/>` +
      `<feColorMatrix type="saturate" values="0"/></filter>` +
      `<rect width="100%" height="100%" filter="url(#tf-grain-f)"/></svg>`,
  );
}

/** SIG-11 아웃라인 장식 텍스트(aria-hidden, 1줄). */
export function outlineHtml(text: string): Html {
  return el(
    "p",
    {
      class: "tf-sig-outline",
      "aria-hidden": "true",
      "data-sig-el": "SIG-11",
      "data-role": "footer.wordmark",
    },
    text,
  );
}

/** SIG-09 생성 CSS. 역할의 데스크톱 단계 토큰 × 자간 비율. */
export function signatureRoleCss(
  roles: readonly TextRole[],
  opts: { smallPx?: number } = {},
): string {
  const out: string[] = ["/* signatures.css · SIG-09 tracking (generated) */"];
  for (const id of SIG09_ROLES) {
    const r = roles.find((x) => x.id === id);
    if (!r) continue;
    let step = r.stepDesktop;
    if (
      id === "nav.link" &&
      opts.smallPx !== undefined &&
      opts.smallPx < TEXT_ROLE_SPEC.navLinkMinPx
    )
      step = "t-body";
    const k = STEP_TOKEN[step];
    if (!k) continue;
    const sel = `[data-signature="SIG-09"] [data-sig] [data-role="${id}"]`;
    out.push(`${sel} { letter-spacing: calc(var(--tf-type-${k}) * ${SIG09_TRACKING.hangul}); }`);
    out.push(
      `${sel}[data-script="latin"] { letter-spacing: calc(var(--tf-type-${k}) * ${SIG09_TRACKING.latin}); }`,
    );
  }
  return `${out.join("\n")}\n`;
}
