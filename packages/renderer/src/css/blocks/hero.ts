// blocks/hero.css(04장 CM-02 3층). 값은 var(--tf-*)·단위 없는 수·허용 목록만. ASM-044.
// 모바일(<48rem): 1열, 텍스트 → 이미지(3.11.3). 48~63.99rem: split·offset 6/6(2열). ≥64rem: 12열, 텍스트 칸 = text_cols.lg.
export const HERO_CSS = `/* TasteFit blocks/hero.css */
.tf-hero__grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--tf-space-10) var(--tf-layout-base-gutter);
  align-items: center;
}
.tf-hero__text { display: flex; flex-direction: column; align-items: flex-start; gap: var(--tf-space-5); min-width: 0; }
.tf-hero__eyebrow { color: var(--tf-color-fg-muted); }
.tf-hero__sub { color: var(--tf-color-fg-muted); }
.tf-hero__actions { display: flex; flex-wrap: wrap; gap: var(--tf-space-3); padding-top: var(--tf-space-3); }
.tf-hero__media { min-width: 0; }
.tf-hero__media--secondary { display: none; }
.tf-hero--centered .tf-hero__text { align-items: center; text-align: center; margin-inline: auto; }
.tf-hero--centered .tf-hero__actions { justify-content: center; }
.tf-hero--full-bleed-image { padding-block: 0; }
.tf-hero--full-bleed-image > .tf-container { max-width: none; padding-inline: 0; }
.tf-hero__stage { display: grid; grid-template-columns: 1fr; align-items: end; }
.tf-hero__stage > * { grid-area: 1 / 1; }
.tf-hero__media--bleed .tf-media { aspect-ratio: 4 / 5; border-radius: 0; }
.tf-hero__media--bleed .tf-media::after {
  content: "";
  position: absolute;
  inset: 0;
  background: var(--tf-color-overlay);
}
.tf-hero__overlay {
  position: relative;
  padding: var(--tf-space-8) var(--tf-layout-base-margin);
  color: var(--tf-color-fg-inverse);
  --tf-color-focus: var(--tf-color-focus-inverse);
  --tf-color-fg-muted: var(--tf-color-fg-inverse);
}
/* 이미지·색면 위 텍스트는 surface-inverse 판 위에 둔다: fg-inverse 대 surface-inverse ≥ 4.5(3.1.3 하드)로 G-02 보장(ASM-055) */
.tf-hero__overlay .tf-hero__text { background: var(--tf-color-surface-inverse); padding: var(--tf-space-6); }
.tf-hero__overlay .tf-hero__eyebrow,
.tf-hero__overlay .tf-hero__sub { color: var(--tf-color-fg-inverse); }
@media (min-width: 48rem) {
  .tf-hero__grid { gap: var(--tf-space-12) var(--tf-layout-md-gutter); }
  .tf-hero--split .tf-hero__grid,
  .tf-hero--offset .tf-hero__grid { grid-template-columns: 1fr 1fr; }
  .tf-hero__media--bleed .tf-media { aspect-ratio: 16 / 9; }
  .tf-hero__overlay { padding: var(--tf-space-12) var(--tf-layout-md-margin); }
}
@media (min-width: 64rem) {
  .tf-hero__grid {
    grid-template-columns: repeat(var(--tf-layout-lg-columns), 1fr);
    column-gap: var(--tf-layout-lg-gutter);
  }
  .tf-hero--split .tf-hero__grid,
  .tf-hero--offset .tf-hero__grid { grid-template-columns: repeat(var(--tf-layout-lg-columns), 1fr); }
  .tf-hero--split .tf-hero__text { grid-column: 1 / span 6; }
  .tf-hero--split .tf-hero__media { grid-column: 8 / -1; }
  .tf-hero--type-only .tf-hero__text { grid-column: 1 / span 10; }
  .tf-hero--left-aligned .tf-hero__text { grid-column: 1 / span 8; }
  .tf-hero--left-aligned .tf-hero__media { grid-column: 10 / -1; align-self: end; }
  .tf-hero--offset .tf-hero__text { grid-column: 1 / span 6; grid-row: 1 / span 2; }
  .tf-hero--offset .tf-hero__media { grid-column: 8 / span 4; grid-row: 1; }
  .tf-hero--offset .tf-hero__media--secondary { display: block; grid-column: 7 / span 2; grid-row: 2; }
  .tf-hero--centered .tf-hero__text { grid-column: 3 / span 8; }
  .tf-hero--centered .tf-hero__media { grid-column: 1 / -1; }
  .tf-hero__overlay { width: calc(100% * 7 / 12); padding: var(--tf-space-16) var(--tf-layout-lg-margin); }
}
`;
