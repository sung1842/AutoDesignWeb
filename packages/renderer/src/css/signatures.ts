// 시그니처 층(04장 CM-02 층 순서의 마지막, 03장 3.2.4·04장 4.14). ASM-069.
// 문서 루트 [data-signature="SIG-xx"] + 적용 블록 [data-sig] 조합으로만 켜진다(apply_to = 적용 블록).
// 값은 var(--tf-*)와 단위 없는 수만(CM-02). 자간(SIG-09)은 역할 단계에 따라 달라 생성 CSS(signature.ts)에 둔다.

/** 시그니처 장식 상수(사양 상수 표: 4.14 그레인 α 0.03–0.06의 중간값, 마키 1회전 = slow × 배수). */
export const SIG_CSS_SPEC = { grainAlpha: 0.05, marqueeSlowMultiple: 40 } as const;

export const SIGNATURE_CSS = `/* signatures.css (03장 3.2.4 · 04장 4.14) */
.tf-section, .tf-footer { --tf-sig-bg: var(--tf-color-bg); }
.tf-section[data-bg="surface"] { --tf-sig-bg: var(--tf-color-surface); }
.tf-section[data-bg="inverse"] { --tf-sig-bg: var(--tf-color-surface-inverse); }

/* SIG-01 얇은 괘선: 섹션 상단 rule + 항목 구분선 */
[data-signature="SIG-01"] [data-sig] > .tf-container {
  border-top: var(--tf-border-width-thin) solid var(--tf-color-border);
  padding-top: var(--tf-space-6);
}
[data-signature="SIG-01"] [data-sig] .tf-card {
  box-shadow: none;
  border: none;
  border-top: var(--tf-border-width-thin) solid var(--tf-color-border);
  border-radius: 0;
}

/* SIG-02 섹션 넘버링(01/02) */
[data-signature="SIG-02"] main { counter-reset: tf-sig-section; }
[data-signature="SIG-02"] .tf-section[data-sig] { counter-increment: tf-sig-section; }
[data-signature="SIG-02"] .tf-section[data-sig] .tf-section__title:not(.tf-visually-hidden)::before {
  content: counter(tf-sig-section, decimal-leading-zero);
  display: block;
  margin-bottom: var(--tf-space-2);
  font-family: var(--tf-font-mono, var(--tf-font-heading));
  font-size: var(--tf-type-small);
  font-weight: var(--tf-font-weight-body);
  letter-spacing: 0;
  color: var(--tf-color-fg-muted);
}
[data-signature="SIG-02"] .tf-section[data-bg="inverse"][data-sig] .tf-section__title::before { color: var(--tf-color-fg-inverse); }

/* SIG-03 거대 숫자 */
[data-signature="SIG-03"] [data-sig] [data-role="stat.value"],
[data-signature="SIG-03"] [data-sig] [data-role="list.index"] {
  font-size: var(--tf-type-display);
  line-height: var(--tf-type-display-leading);
  letter-spacing: var(--tf-type-display-tracking);
  font-family: var(--tf-font-heading);
  font-weight: var(--tf-font-weight-heading);
}

/* SIG-04 그리드 라인 노출 */
[data-signature="SIG-04"] .tf-section[data-sig] {
  background-image:
    linear-gradient(to right, var(--tf-color-border) var(--tf-border-width-thin), var(--tf-sig-bg) 0),
    linear-gradient(to bottom, var(--tf-color-border) var(--tf-border-width-thin), var(--tf-sig-bg) 0);
  background-size: var(--tf-space-16) var(--tf-space-16);
}

/* SIG-06 마키 띠(aria-hidden). reduced-motion에서는 정지 */
.tf-marquee {
  overflow: hidden;
  border-block: var(--tf-border-width-thin) solid var(--tf-color-border-strong);
  padding-block: var(--tf-space-3);
  background: var(--tf-color-bg);
  color: var(--tf-color-fg);
}
.tf-marquee__track { display: flex; width: max-content; }
.tf-marquee__track > [data-role] {
  flex: none;
  padding-inline-end: var(--tf-space-8);
  font-family: var(--tf-font-heading);
  font-weight: var(--tf-font-weight-heading);
  font-size: var(--tf-type-h3);
  line-height: var(--tf-type-h3-leading);
  letter-spacing: var(--tf-type-h3-tracking);
  white-space: nowrap;
  animation: tf-marquee calc(var(--tf-motion-duration-slow) * ${SIG_CSS_SPEC.marqueeSlowMultiple}) linear infinite;
}
@keyframes tf-marquee { to { transform: translateX(calc(100% * -1)); } }
@media (prefers-reduced-motion: reduce) { .tf-marquee__track > [data-role] { animation: none; } }

/* SIG-07 그레인(페이지 배경 1). 배경색 섹션은 비워 질감이 보이게 한다 */
.tf-grain {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: -1;
  pointer-events: none;
  opacity: ${SIG_CSS_SPEC.grainAlpha};
}
[data-signature="SIG-07"] .tf-section[data-bg="bg"] { background: none; }

/* SIG-08 모노 라벨 */
[data-signature="SIG-08"] [data-sig] [data-role="eyebrow"],
[data-signature="SIG-08"] [data-sig] [data-role="stat.label"],
[data-signature="SIG-08"] [data-sig] [data-role="caption"],
[data-signature="SIG-08"] [data-sig] [data-role="tag.label"] {
  font-family: var(--tf-font-mono, var(--tf-font-body));
}

/* SIG-09 와이드 자간 라벨: 라틴은 대문자(자간은 생성 CSS) */
[data-signature="SIG-09"] [data-sig] [data-script="latin"] { text-transform: uppercase; }

/* SIG-10 사진 듀오톤(흑백 + primary 겹침) */
[data-signature="SIG-10"] [data-sig] .tf-media > img { filter: grayscale(1) contrast(var(--tf-media-contrast)); }
[data-signature="SIG-10"] [data-sig] .tf-media::after {
  content: "";
  position: absolute;
  inset: 0;
  background: var(--tf-color-primary);
  mix-blend-mode: screen;
  pointer-events: none;
}

/* SIG-11 아웃라인 디스플레이(장식 텍스트, aria-hidden. 본 제목은 별도 실텍스트) */
/* 잘라내기는 장식 요소 자신이 한다(섹션은 overflow 그대로 → 실텍스트 잘림 판정 G-05와 분리) */
[data-signature="SIG-11"] [data-sig] { position: relative; }
[data-signature="SIG-11"] [data-sig] > .tf-container { position: relative; }
.tf-sig-outline {
  position: absolute;
  inset: 0;
  overflow: hidden;
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
  padding-inline-end: var(--tf-space-4);
  margin: 0;
  white-space: nowrap;
  pointer-events: none;
  user-select: none;
  font-family: var(--tf-font-heading);
  font-weight: var(--tf-font-weight-heading);
  font-size: var(--tf-type-display);
  line-height: 1;
  letter-spacing: var(--tf-type-display-tracking);
  color: var(--tf-sig-bg);
  -webkit-text-fill-color: var(--tf-sig-bg);
  -webkit-text-stroke: var(--tf-border-width-thin) var(--tf-color-border-strong);
}

/* SIG-12 비대칭 이미지 오프셋 */
@media (min-width: 48rem) {
  [data-signature="SIG-12"] [data-sig] .tf-media {
    overflow: visible;
    box-shadow: var(--tf-space-4) var(--tf-space-4) 0 0 var(--tf-color-border-strong);
    margin-block-start: var(--tf-space-6);
  }
  [data-signature="SIG-12"] [data-sig] .tf-media > img { border-radius: var(--tf-radius-md); }
}
`;
