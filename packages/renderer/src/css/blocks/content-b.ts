// blocks/proof·pricing·faq·cta·menu.css(CM-02 3층). 값은 var(--tf-*)·단위 없는 수·허용 목록만. ASM-046.
export const CONTENT_B_CSS = `/* TasteFit blocks/proof·pricing·faq·cta·menu.css */
.tf-proof__wrap { display: flex; flex-direction: column; align-items: center; text-align: center; }
.tf-proof__item { display: flex; flex-direction: column; gap: var(--tf-space-5); }
.tf-proof__item--large { align-items: center; max-width: calc(var(--tf-layout-container) * 2 / 3); }
.tf-proof__by { display: flex; align-items: center; gap: var(--tf-space-3); color: var(--tf-color-fg-muted); }
.tf-proof__card { height: 100%; }
.tf-pricing__list { align-items: stretch; }
.tf-pricing__plan { display: flex; flex-direction: column; gap: var(--tf-space-4); }
.tf-pricing__plan--featured { border-color: var(--tf-color-primary); order: -1; }
.tf-pricing__single { display: flex; flex-direction: column; align-items: center; text-align: center; }
.tf-pricing__single .tf-pricing__list { width: 100%; max-width: calc(var(--tf-layout-container) / 3); }
.tf-faq__narrow, .tf-menu__narrow { max-width: calc(var(--tf-layout-container) * 2 / 3); }
.tf-cta__inner { display: flex; flex-direction: column; gap: var(--tf-space-8); align-items: flex-start; }
.tf-section[data-bg="inverse"] .tf-button--primary { background: var(--tf-color-bg); color: var(--tf-color-fg); border-color: var(--tf-color-bg); }
.tf-cta--band .tf-cta__inner { align-items: center; text-align: center; }
.tf-menu__list { display: flex; flex-direction: column; gap: var(--tf-space-5); }
.tf-menu__item { display: flex; flex-direction: column; gap: var(--tf-space-1); min-width: 0; }
.tf-menu__line { display: flex; align-items: baseline; gap: var(--tf-space-3); }
.tf-menu__name { min-width: 0; }
.tf-menu__dots { flex: 1; border-bottom: var(--tf-border-width-thin) dotted var(--tf-color-border-strong); }
.tf-menu__item:not(.tf-menu__item--leader) .tf-menu__line { justify-content: space-between; }
.tf-menu__desc { color: var(--tf-color-fg-muted); }
.tf-menu__list--cards { display: grid; grid-template-columns: 1fr 1fr; gap: var(--tf-layout-base-gutter); }
.tf-menu__list--cards > .tf-menu__item { background: var(--tf-color-surface); border-radius: var(--tf-radius-md); padding: var(--tf-space-4); }
.tf-section[data-bg="surface"] .tf-menu__list--cards > .tf-menu__item { background: var(--tf-color-bg); }
.tf-menu__list--cards .tf-menu__line { flex-direction: column; align-items: flex-start; gap: var(--tf-space-1); }
@media (min-width: 48rem) {
  .tf-pricing__plan--featured { order: 0; }
  .tf-menu__list--columns { display: grid; grid-template-columns: 1fr 1fr; gap: var(--tf-space-5) var(--tf-layout-md-gutter); }
  .tf-menu__list--cards { grid-template-columns: repeat(3, 1fr); column-gap: var(--tf-layout-md-gutter); }
}
@media (min-width: 64rem) {
  .tf-menu__list--cards { grid-template-columns: repeat(4, 1fr); column-gap: var(--tf-layout-lg-gutter); }
  .tf-menu__list--columns { column-gap: var(--tf-layout-lg-gutter); }
}
`;
