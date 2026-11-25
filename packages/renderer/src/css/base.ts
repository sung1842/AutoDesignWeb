// base.css(04장 CM-02 2층): 리셋·문서 타이포·접근성 공통 규칙. 값은 var(--tf-*)만(CM-02).
// 글자 크기·행간·자간의 역할별 값은 텍스트 역할(B25) 층에서 붙는다(M2-05b).
export const BASE_CSS = `/* TasteFit base.css */
*, *::before, *::after { box-sizing: border-box; }
* { margin: 0; padding: 0; }
html { -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }
body {
  background: var(--tf-color-bg);
  color: var(--tf-color-fg);
  font-family: var(--tf-font-body);
  font-weight: var(--tf-font-weight-body);
  font-size: var(--tf-type-body);
  line-height: var(--tf-type-leading-body);
  word-break: keep-all;
  overflow-wrap: anywhere;
  text-wrap: pretty;
}
h1, h2, h3, h4 {
  font-family: var(--tf-font-heading);
  font-weight: var(--tf-font-weight-heading);
  text-wrap: balance;
}
h1 { font-size: var(--tf-type-h1); }
h2 { font-size: var(--tf-type-h2); }
h3 { font-size: var(--tf-type-h3); }
h4 { font-size: var(--tf-type-h4); }
p, li, dd { text-wrap: pretty; }
strong, b { font-weight: var(--tf-font-weight-emphasis); }
img, svg, picture { display: block; max-width: 100%; height: auto; }
svg[data-icon-set] { stroke: currentColor; fill: none; }
a { color: inherit; text-underline-offset: var(--tf-space-1); }
ul, ol { list-style: none; }
button { font: inherit; color: inherit; }
:focus-visible {
  outline: var(--tf-border-width-thick) solid var(--tf-color-focus);
  outline-offset: var(--tf-border-width-thick);
}
.tf-skip-link {
  position: absolute;
  left: var(--tf-space-4);
  top: var(--tf-space-4);
  z-index: var(--tf-z-overlay);
  padding: var(--tf-space-2) var(--tf-space-4);
  background: var(--tf-color-primary);
  color: var(--tf-color-on-primary);
  transform: translateY(calc(-1 * var(--tf-space-24)));
}
.tf-skip-link:focus-visible { transform: none; }
.tf-container {
  width: 100%;
  max-width: var(--tf-layout-container);
  margin-inline: auto;
  padding-inline: var(--tf-layout-base-margin);
}
@media (min-width: 48rem) { .tf-container { padding-inline: var(--tf-layout-md-margin); } }
@media (min-width: 64rem) { .tf-container { padding-inline: var(--tf-layout-lg-margin); } }
.tf-section {
  padding-block: var(--tf-space-section-y-mobile);
}
@media (min-width: 48rem) { .tf-section { padding-block: var(--tf-space-section-y); } }
.tf-section[data-bg="surface"] { background: var(--tf-color-surface); }
.tf-section[data-bg="inverse"] {
  background: var(--tf-color-surface-inverse);
  color: var(--tf-color-fg-inverse);
  --tf-color-focus: var(--tf-color-focus-inverse);
}
.tf-visually-hidden {
  position: absolute;
  width: var(--tf-border-width-thin);
  height: var(--tf-border-width-thin);
  overflow: hidden;
  clip-path: inset(100%);
  white-space: nowrap;
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0s;
    animation-iteration-count: 1;
    transition-duration: 0s;
    scroll-behavior: auto;
  }
}
`;
