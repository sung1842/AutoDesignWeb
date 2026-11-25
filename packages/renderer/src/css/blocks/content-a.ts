// blocks 층 공용 배치(head·cols·rule-list·bento·split) + value·feature·showcase·stats·process(CM-02 3층).
// 값은 var(--tf-*)·단위 없는 수·허용 목록만. 모바일 1열(3.11.3), stats.row 2×2. ASM-045.
export const LAYOUT_CSS = `/* TasteFit blocks/layout.css */
.tf-section__head { margin-bottom: var(--tf-space-10); }
.tf-cols { display: grid; grid-template-columns: 1fr; gap: var(--tf-space-8) var(--tf-layout-base-gutter); }
.tf-rule-list { display: grid; grid-template-columns: 1fr; column-gap: var(--tf-layout-base-gutter); }
.tf-rule-list > * { border-top: var(--tf-border-width-thin) solid var(--tf-color-border); padding-block: var(--tf-space-5); }
.tf-bento { display: grid; grid-template-columns: 1fr; gap: var(--tf-layout-base-gutter); }
.tf-bento__cell { background: var(--tf-color-surface); border-radius: var(--tf-radius-lg); padding: var(--tf-space-6); }
.tf-section[data-bg="surface"] .tf-bento__cell { background: var(--tf-color-bg); }
.tf-split { display: grid; grid-template-columns: 1fr; gap: var(--tf-space-10) var(--tf-layout-base-gutter); align-items: start; }
.tf-split__main, .tf-split__aside { min-width: 0; }
@media (min-width: 48rem) {
  .tf-section__head { margin-bottom: var(--tf-space-12); }
  .tf-cols { grid-template-columns: 1fr 1fr; column-gap: var(--tf-layout-md-gutter); }
  .tf-rule-list { grid-template-columns: 1fr 1fr; column-gap: var(--tf-layout-md-gutter); }
  .tf-bento { grid-template-columns: 1fr 1fr; }
  .tf-split { grid-template-columns: 1fr 1fr; column-gap: var(--tf-layout-md-gutter); }
}
@media (min-width: 64rem) {
  .tf-cols { grid-template-columns: none; grid-auto-flow: column; grid-auto-columns: 1fr; column-gap: var(--tf-layout-lg-gutter); }
  .tf-bento { grid-template-columns: repeat(3, 1fr); column-gap: var(--tf-layout-lg-gutter); }
  .tf-bento__cell:first-child { grid-column: span 2; grid-row: span 2; }
  .tf-split { grid-template-columns: repeat(var(--tf-layout-lg-columns), 1fr); column-gap: var(--tf-layout-lg-gutter); }
  .tf-split__main { grid-column: 1 / span 5; }
  .tf-split__aside { grid-column: 7 / -1; }
}
`;

export const CONTENT_A_CSS = `/* TasteFit blocks/value·feature·showcase·stats·process.css */
.tf-value__item, .tf-process__item, .tf-feature__item { display: flex; flex-direction: column; gap: var(--tf-space-3); }
.tf-value__item-text { display: flex; flex-direction: column; gap: var(--tf-space-3); }
.tf-value__index, .tf-process__index { color: var(--tf-color-accent); }
.tf-value__item-body, .tf-process__item-body, .tf-feature__item-body { color: var(--tf-color-fg-muted); }
.tf-icon-slot { display: inline-block; width: var(--tf-space-8); height: var(--tf-space-8); color: var(--tf-color-accent); }
.tf-feature__rows { display: flex; flex-direction: column; gap: var(--tf-space-16); }
.tf-feature__row { display: grid; grid-template-columns: 1fr; gap: var(--tf-space-8) var(--tf-layout-base-gutter); align-items: center; }
.tf-feature__text { display: flex; flex-direction: column; gap: var(--tf-space-3); min-width: 0; }
.tf-feature__media--wide { margin-bottom: var(--tf-space-12); }
.tf-showcase__figure { display: flex; flex-direction: column; gap: var(--tf-space-4); }
.tf-showcase__figure--framed { background: var(--tf-color-surface); border-radius: var(--tf-radius-lg); padding: var(--tf-space-4); align-items: center; text-align: center; }
.tf-showcase__media { width: 100%; }
.tf-showcase__caption { color: var(--tf-color-fg-muted); }
.tf-stats__list { display: grid; grid-template-columns: 1fr 1fr; gap: var(--tf-space-8) var(--tf-layout-base-gutter); }
.tf-stats__item { display: flex; flex-direction: column; gap: var(--tf-space-1); min-width: 0; }
.tf-stats__item-body { color: var(--tf-color-fg-muted); }
.tf-process__list--vertical { display: flex; flex-direction: column; }
.tf-process__list--vertical > .tf-process__item {
  display: grid;
  grid-template-columns: var(--tf-space-12) 1fr;
  column-gap: var(--tf-space-4);
  padding-block: var(--tf-space-6);
  border-top: var(--tf-border-width-thin) solid var(--tf-color-border);
}
.tf-process__list--vertical .tf-process__index { grid-row: span 2; }
@media (min-width: 48rem) {
  .tf-feature__row { grid-template-columns: 1fr 1fr; column-gap: var(--tf-layout-md-gutter); }
  .tf-feature__row--reverse > .tf-feature__text { grid-column: 2; }
  .tf-showcase__figure--framed { padding: var(--tf-space-10); }
}
@media (min-width: 64rem) {
  .tf-feature__row { grid-template-columns: repeat(var(--tf-layout-lg-columns), 1fr); column-gap: var(--tf-layout-lg-gutter); }
  .tf-feature__row > .tf-feature__text { grid-column: 1 / span 5; }
  .tf-feature__row > .tf-feature__media { grid-column: 7 / -1; }
  .tf-feature__row--reverse > .tf-feature__text { grid-column: 8 / -1; }
  .tf-stats__list--row { grid-template-columns: none; grid-auto-flow: column; grid-auto-columns: 1fr; }
}
`;
