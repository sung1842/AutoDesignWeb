// components/*.css(03장 3.5, 04장 CM-02 3층). 값은 var(--tf-*)만. state는 3.5.3 파생 규칙.
// 크기(px)는 space 토큰 합으로 만든다(36 = 8+1, 44 = 10+1, 52 = 12+1 단계, ASM-041).
const TRANSITION = `transition-property: background-color, border-color, color, box-shadow, transform;
  transition-duration: var(--tf-motion-duration-fast);
  transition-timing-function: var(--tf-motion-easing-standard);`;

export const BUTTON_CSS = `/* C01 Button */
.tf-button {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--tf-space-2);
  min-height: calc(var(--tf-space-10) + var(--tf-space-1));
  padding-inline: var(--tf-space-5);
  border: var(--tf-border-width-thin) solid var(--tf-color-primary);
  border-radius: var(--tf-radius-md);
  font-family: var(--tf-font-body);
  font-weight: var(--tf-font-weight-emphasis);
  font-size: var(--tf-type-small);
  white-space: nowrap;
  text-decoration: none;
  cursor: pointer;
  ${TRANSITION}
}
.tf-button--sm { min-height: calc(var(--tf-space-8) + var(--tf-space-1)); padding-inline: var(--tf-space-3); }
.tf-button--lg { min-height: calc(var(--tf-space-12) + var(--tf-space-1)); padding-inline: var(--tf-space-6); }
.tf-button--primary { background: var(--tf-color-primary); color: var(--tf-color-on-primary); }
.tf-button--primary:hover { background: var(--tf-color-primary-hover); }
.tf-button--secondary { background: var(--tf-color-bg); color: var(--tf-color-fg); border-color: var(--tf-color-border-strong); }
.tf-button--secondary:hover { background: var(--tf-color-surface); border-color: var(--tf-color-border-strong); }
.tf-button--ghost { background: none; color: var(--tf-color-fg); border-color: currentColor; border-style: none; }
.tf-button--ghost::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: currentColor;
  opacity: 0;
  ${TRANSITION}
}
.tf-button--ghost:hover::before { opacity: 0.06; }
.tf-button:active { background: var(--tf-color-primary-active); color: var(--tf-color-on-primary); }
.tf-button:focus-visible {
  outline: var(--tf-border-width-thick) solid var(--tf-color-focus);
  outline-offset: var(--tf-border-width-thick);
}
.tf-button:disabled, .tf-button[aria-disabled="true"] {
  opacity: var(--tf-opacity-disabled);
  cursor: not-allowed;
}
.tf-button__icon { width: var(--tf-space-5); height: var(--tf-space-5); flex: none; }
`;

export const TEXT_LINK_CSS = `/* C02 TextLink */
.tf-text-link {
  color: inherit;
  text-decoration-line: underline;
  text-decoration-thickness: var(--tf-border-width-thin);
  text-underline-offset: var(--tf-space-1);
  ${TRANSITION}
}
.tf-text-link--standalone {
  display: inline-flex;
  align-items: center;
  gap: var(--tf-space-1);
  font-weight: var(--tf-font-weight-emphasis);
  text-decoration-line: none;
}
.tf-text-link:hover { text-decoration-line: underline; text-decoration-thickness: var(--tf-border-width-thick); }
.tf-text-link:active { color: var(--tf-color-fg-muted); }
.tf-text-link:focus-visible {
  outline: var(--tf-border-width-thick) solid var(--tf-color-focus);
  outline-offset: var(--tf-border-width-thick);
}
.tf-text-link__icon { width: var(--tf-space-4); height: var(--tf-space-4); flex: none; }
`;

const FOCUS = `outline: var(--tf-border-width-thick) solid var(--tf-color-focus);
  outline-offset: var(--tf-border-width-thick);`;

export const TAG_CSS = `/* C03 Tag */
.tf-tag {
  display: inline-flex;
  align-items: center;
  min-height: calc(var(--tf-space-6) + var(--tf-space-1));
  padding-inline: var(--tf-space-3);
  border-radius: var(--tf-radius-full);
  font-size: var(--tf-type-caption);
  font-weight: var(--tf-font-weight-emphasis);
  white-space: nowrap;
}
.tf-tag--sm { min-height: var(--tf-space-6); padding-inline: var(--tf-space-2); }
.tf-tag--outline { border: var(--tf-border-width-thin) solid var(--tf-color-border-strong); color: var(--tf-color-fg); }
.tf-tag--subtle { background: var(--tf-color-surface); color: var(--tf-color-fg); }
`;

const FIELD = `width: 100%;
  min-height: calc(var(--tf-space-10) + var(--tf-space-1));
  padding: var(--tf-space-2) var(--tf-space-3);
  border: var(--tf-border-input);
  border-radius: var(--tf-radius-sm);
  background: var(--tf-color-bg);
  color: var(--tf-color-fg);
  font-family: var(--tf-font-body);
  font-size: var(--tf-type-body);`;

export const FIELD_CSS = `/* C04 Input · C05 Textarea · C06 Select (공통 필드) */
.tf-field { display: grid; gap: var(--tf-space-2); }
.tf-field__label { font-size: var(--tf-type-small); font-weight: var(--tf-font-weight-emphasis); }
.tf-field__help { font-size: var(--tf-type-caption); color: var(--tf-color-fg-muted); }
.tf-input, .tf-textarea, .tf-select {
  ${FIELD}
  ${TRANSITION}
}
.tf-input--lg { min-height: calc(var(--tf-space-12) + var(--tf-space-1)); }
.tf-textarea { resize: vertical; line-height: var(--tf-type-leading-body); }
.tf-select-wrap { position: relative; }
.tf-select { appearance: none; padding-inline-end: var(--tf-space-10); }
.tf-select-wrap__icon {
  position: absolute;
  inset-inline-end: var(--tf-space-3);
  top: 0;
  bottom: 0;
  margin-block: auto;
  width: var(--tf-space-5);
  height: var(--tf-space-5);
  pointer-events: none;
}
.tf-input:hover, .tf-textarea:hover, .tf-select:hover { border-color: var(--tf-color-fg); }
.tf-input:focus-visible, .tf-textarea:focus-visible, .tf-select:focus-visible { ${FOCUS} }
.tf-input:disabled, .tf-textarea:disabled, .tf-select:disabled {
  opacity: var(--tf-opacity-disabled);
  cursor: not-allowed;
}
.tf-input[aria-invalid="true"], .tf-textarea[aria-invalid="true"], .tf-select[aria-invalid="true"] {
  border-color: var(--tf-color-danger);
}
.tf-field--error .tf-field__help { color: var(--tf-color-danger); }
`;

export const CHECKBOX_CSS = `/* C07 Checkbox */
.tf-checkbox { display: inline-flex; align-items: flex-start; gap: var(--tf-space-2); cursor: pointer; }
.tf-checkbox__box {
  appearance: none;
  flex: none;
  width: var(--tf-space-5);
  height: var(--tf-space-5);
  border: var(--tf-border-input);
  border-radius: var(--tf-radius-sm);
  background: var(--tf-color-bg);
  display: grid;
  place-content: center;
  cursor: pointer;
  ${TRANSITION}
}
.tf-checkbox__box:hover { border-color: var(--tf-color-fg); }
.tf-checkbox__box:checked { background: var(--tf-color-primary); border-color: var(--tf-color-primary); }
.tf-checkbox__box:focus-visible { ${FOCUS} }
.tf-checkbox__box:disabled { opacity: var(--tf-opacity-disabled); cursor: not-allowed; }
.tf-checkbox__box[aria-invalid="true"] { border-color: var(--tf-color-danger); }
.tf-checkbox__mark { color: var(--tf-color-on-primary); width: var(--tf-space-4); height: var(--tf-space-4); }
`;

export const NAVBAR_CSS = `/* C08 NavBar · C09 Drawer */
.tf-navbar {
  position: relative;
  z-index: var(--tf-z-sticky);
  background: var(--tf-color-bg);
  border-bottom: var(--tf-border-width-thin) solid var(--tf-color-border);
}
.tf-navbar__inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--tf-space-6);
  min-height: calc(var(--tf-space-12) + var(--tf-space-2));
}
@media (min-width: 48rem) { .tf-navbar__inner { min-height: var(--tf-space-16); } }
.tf-navbar--center .tf-navbar__inner { justify-content: center; }
.tf-navbar--sticky { position: sticky; top: 0; box-shadow: var(--tf-shadow-level-3); }
.tf-navbar__links { display: none; gap: var(--tf-space-6); align-items: center; }
@media (min-width: 48rem) {
  .tf-navbar--split .tf-navbar__links, .tf-navbar--center .tf-navbar__links { display: flex; }
  .tf-navbar--split .tf-drawer, .tf-navbar--center .tf-drawer { display: none; }
}
.tf-navbar__link { color: inherit; text-decoration: none; font-size: var(--tf-type-small); white-space: nowrap; }
.tf-navbar__link:hover, .tf-navbar__link[aria-current="true"] {
  text-decoration-line: underline;
  text-decoration-thickness: var(--tf-border-width-thick);
  text-underline-offset: var(--tf-space-2);
}
.tf-navbar__link:focus-visible { ${FOCUS} }
.tf-drawer > summary {
  list-style: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: calc(var(--tf-space-10) + var(--tf-space-1));
  height: calc(var(--tf-space-10) + var(--tf-space-1));
  cursor: pointer;
}
.tf-drawer > summary::-webkit-details-marker { display: none; }
.tf-drawer > summary:focus-visible { ${FOCUS} }
.tf-drawer__panel {
  position: fixed;
  top: 0;
  bottom: 0;
  inset-inline-end: 0;
  z-index: var(--tf-z-drawer);
  width: min(calc(var(--tf-space-40) * 2 + var(--tf-space-10)), 100%);
  padding: var(--tf-space-6);
  background: var(--tf-color-bg);
  box-shadow: var(--tf-shadow-level-3);
  display: grid;
  align-content: start;
  gap: var(--tf-space-4);
}
.tf-drawer[open]::before {
  content: "";
  position: fixed;
  inset: 0;
  z-index: var(--tf-z-drawer);
  background: var(--tf-color-neutral-950);
  opacity: 0.4;
}
.tf-drawer__link { color: inherit; text-decoration: none; font-size: var(--tf-type-lead); }
.tf-drawer__link:focus-visible { ${FOCUS} }
`;

export const FOOTER_CSS = `/* C10 Footer */
.tf-footer { padding-block: var(--tf-space-16); border-top: var(--tf-border-width-thin) solid var(--tf-color-border); }
.tf-footer__inner { display: grid; gap: var(--tf-space-8); }
.tf-footer--columns .tf-footer__inner { grid-template-columns: 1fr; }
@media (min-width: 48rem) {
  .tf-footer--columns .tf-footer__inner { grid-template-columns: repeat(var(--tf-layout-md-columns), 1fr); }
  .tf-footer--columns .tf-footer__col { grid-column: span calc(var(--tf-layout-md-columns) / 2); }
}
.tf-footer__biz { font-size: var(--tf-type-caption); color: var(--tf-color-fg-muted); display: flex; flex-wrap: wrap; gap: var(--tf-space-1) var(--tf-space-4); }
.tf-footer__link { color: inherit; font-size: var(--tf-type-small); }
.tf-footer__link:hover { text-decoration-thickness: var(--tf-border-width-thick); }
.tf-footer__link:focus-visible { ${FOCUS} }
`;

export const CARD_CSS = `/* C11 Card (링크 카드 hover = depth.style별 1종, 3.5.3) */
.tf-card {
  position: relative;
  display: grid;
  gap: var(--tf-space-4);
  padding: var(--tf-space-card);
  border: var(--tf-border-card);
  border-radius: var(--tf-radius-lg);
  background: var(--tf-color-bg);
  box-shadow: var(--tf-shadow-level-1);
  color: inherit;
  text-decoration: none;
  ${TRANSITION}
}
.tf-card--media-top { padding: 0; overflow: hidden; }
.tf-card--media-top .tf-card__body { padding: var(--tf-space-card); display: grid; gap: var(--tf-space-3); }
.tf-card--media-left { grid-template-columns: 1fr; }
@media (min-width: 48rem) { .tf-card--media-left { grid-template-columns: 1fr 1fr; align-items: center; } }
a.tf-card:focus-visible { ${FOCUS} }
[data-depth="flat"] a.tf-card:hover { border-color: var(--tf-color-border-strong); }
[data-depth="subtle"] a.tf-card:hover, [data-depth="layered"] a.tf-card:hover, [data-depth="glass"] a.tf-card:hover {
  box-shadow: var(--tf-shadow-level-2);
}
[data-depth="brutal-offset"] a.tf-card:hover {
  transform: translate(calc(-1 * var(--tf-border-width-thick)), calc(-1 * var(--tf-border-width-thick)));
  box-shadow: var(--tf-shadow-level-3);
}
`;

export const MEDIA_CSS = `/* C12 MediaFrame · C13 Avatar */
.tf-media { position: relative; overflow: hidden; border-radius: var(--tf-radius-md); background: var(--tf-color-surface); }
.tf-media--1-1 { aspect-ratio: 1 / 1; }
.tf-media--4-5 { aspect-ratio: 4 / 5; }
.tf-media--3-2 { aspect-ratio: 3 / 2; }
.tf-media--16-9 { aspect-ratio: 16 / 9; }
.tf-media--21-9 { aspect-ratio: 21 / 9; }
.tf-media > img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: var(--tf-focal-x) var(--tf-focal-y);
  filter: grayscale(var(--tf-media-grayscale)) contrast(var(--tf-media-contrast)) sepia(var(--tf-media-sepia)) saturate(var(--tf-media-saturate));
}
.tf-media--placeholder { border: var(--tf-border-width-thin) dashed var(--tf-color-border-strong); }
.tf-avatar {
  display: inline-grid;
  place-content: center;
  width: var(--tf-space-12);
  height: var(--tf-space-12);
  border-radius: var(--tf-radius-full);
  background: var(--tf-color-surface);
  color: var(--tf-color-fg);
  font-family: var(--tf-font-heading);
  font-size: var(--tf-type-small);
  flex: none;
}
.tf-avatar--sm { width: var(--tf-space-8); height: var(--tf-space-8); font-size: var(--tf-type-caption); }
`;

export const DATA_CSS = `/* C14 PriceTag · C15 Stat */
.tf-price { font-variant-numeric: tabular-nums; font-weight: var(--tf-font-weight-emphasis); white-space: nowrap; }
.tf-price__period { font-weight: var(--tf-font-weight-body); color: var(--tf-color-fg-muted); font-size: var(--tf-type-small); }
.tf-stat { display: grid; gap: var(--tf-space-1); }
.tf-stat__value {
  font-family: var(--tf-font-heading);
  font-size: var(--tf-type-h3);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.tf-stat__label { font-size: var(--tf-type-small); }
.tf-stat__note { font-size: var(--tf-type-caption); color: var(--tf-color-fg-muted); }
.tf-price a, .tf-stat a { color: inherit; }
.tf-price a:focus-visible, .tf-stat a:focus-visible { ${FOCUS} }
`;

export const ACCORDION_CSS = `/* C16 Accordion */
.tf-accordion { display: grid; }
.tf-accordion--bordered .tf-accordion__item { border-bottom: var(--tf-border-width-thin) solid var(--tf-color-border); }
.tf-accordion__item > summary {
  list-style: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--tf-space-4);
  padding-block: var(--tf-space-4);
  font-weight: var(--tf-font-weight-emphasis);
  cursor: pointer;
  ${TRANSITION}
}
.tf-accordion__item > summary::-webkit-details-marker { display: none; }
.tf-accordion__item > summary:hover { color: var(--tf-color-fg-muted); }
.tf-accordion__item > summary:focus-visible { ${FOCUS} }
.tf-accordion__icon {
  width: var(--tf-space-5);
  height: var(--tf-space-5);
  flex: none;
  transition: transform var(--tf-motion-duration-fast) var(--tf-motion-easing-standard);
}
.tf-accordion__item[open] .tf-accordion__icon { transform: scaleY(-1); }
.tf-accordion__body { padding-block-end: var(--tf-space-4); color: var(--tf-color-fg-muted); }
`;

export const MISC_CSS = `/* C17 Divider · C18 Wordmark */
.tf-divider--line { border: 0; border-top: var(--tf-border-width-thin) solid var(--tf-color-border); }
.tf-divider--space { border: 0; height: var(--tf-space-16); }
.tf-divider--ornament { border: 0; text-align: center; color: var(--tf-color-fg-muted); font-family: var(--tf-font-heading); }
.tf-wordmark {
  font-family: var(--tf-font-heading);
  font-weight: var(--tf-font-weight-heading);
  font-size: var(--tf-type-lead);
  color: inherit;
  text-decoration: none;
  white-space: nowrap;
}
.tf-wordmark--footer { font-size: var(--tf-type-h3); }
.tf-wordmark--big-type { font-size: var(--tf-type-display); white-space: normal; }
a.tf-wordmark:hover { text-decoration-line: underline; }
a.tf-wordmark:focus-visible { ${FOCUS} }
`;
