// blocks/highlight·gallery·location·story·about·service·contact.css(CM-02 3층). ASM-047.
// 모바일: gallery·highlight.trio 2열(feature는 대 1 + 소 2×2), 나머지 1열(3.11.3).
export const CONTENT_C_CSS = `/* TasteFit blocks/highlight·gallery·location·story·about·service·contact.css */
.tf-measure { max-width: calc(var(--tf-layout-container) / 2); }
.tf-prose { display: flex; flex-direction: column; gap: var(--tf-space-5); }
.tf-prose > .tf-section__head { margin-bottom: 0; }
.tf-rule-list--single { grid-template-columns: 1fr; }
.tf-rule-top > * { border-top: var(--tf-border-width-thin) solid var(--tf-color-border-strong); padding-top: var(--tf-space-5); }
.tf-highlight__item, .tf-highlight__text, .tf-service__item, .tf-highlight__list > li { display: flex; flex-direction: column; gap: var(--tf-space-3); min-width: 0; }
.tf-highlight__item-body, .tf-service__item-body, .tf-story__body, .tf-about__body, .tf-contact__body { color: var(--tf-color-fg-muted); }
.tf-highlight__list:not(.tf-rule-top) { grid-template-columns: 1fr 1fr; }
.tf-gallery__grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--tf-layout-base-gutter); }
.tf-gallery__cell { display: flex; flex-direction: column; gap: var(--tf-space-2); min-width: 0; }
.tf-gallery__caption { color: var(--tf-color-fg-muted); }
.tf-gallery__grid--feature > .tf-gallery__cell:first-child { grid-column: 1 / -1; }
.tf-gallery__grid--masonry { align-items: start; }
.tf-location__info { display: flex; flex-direction: column; }
.tf-location__row { display: grid; grid-template-columns: var(--tf-space-24) 1fr; gap: var(--tf-space-4); padding-block: var(--tf-space-4); border-top: var(--tf-border-width-thin) solid var(--tf-color-border); }
.tf-location__row > dt { color: var(--tf-color-fg-muted); }
.tf-contact__form { display: flex; flex-direction: column; gap: var(--tf-space-5); align-items: stretch; }
.tf-contact__form > .tf-button { align-self: flex-start; }
.tf-contact__info { font-weight: var(--tf-font-weight-emphasis); }
@media (min-width: 48rem) {
  .tf-highlight__list:not(.tf-rule-top) { grid-template-columns: none; grid-auto-flow: column; grid-auto-columns: 1fr; }
  .tf-gallery__grid { grid-template-columns: repeat(3, 1fr); column-gap: var(--tf-layout-md-gutter); }
  .tf-gallery__grid--feature { grid-template-columns: repeat(4, 1fr); }
  .tf-gallery__grid--feature > .tf-gallery__cell:first-child { grid-column: span 2; grid-row: span 2; }
}
@media (min-width: 64rem) {
  .tf-gallery__grid { column-gap: var(--tf-layout-lg-gutter); }
}
`;
