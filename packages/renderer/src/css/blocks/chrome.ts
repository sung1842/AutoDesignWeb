// blocks/nav·footer.css(CM-02 3층): C08 variant 배치·C10 variant 배치. 컴포넌트 층(components/navbar·footer) 위에 얹는다. ASM-048.
export const CHROME_CSS = `/* TasteFit blocks/nav·footer.css */
.tf-navbar__inner > .tf-wordmark { min-width: calc(var(--tf-space-10) + var(--tf-space-1)); }
@media (min-width: 48rem) {
  .tf-navbar--center .tf-navbar__inner { flex-direction: column; justify-content: center; gap: var(--tf-space-2); padding-block: var(--tf-space-3); }
}
.tf-footer__links { display: flex; flex-wrap: wrap; gap: var(--tf-space-2) var(--tf-space-5); }
.tf-footer__col { display: flex; flex-direction: column; gap: var(--tf-space-4); min-width: 0; }
.tf-footer__tagline { color: var(--tf-color-fg-muted); }
.tf-footer--big-type .tf-footer__inner { gap: var(--tf-space-10); }
.tf-footer--big-type .tf-wordmark--big-type { border-top: var(--tf-border-width-thin) solid var(--tf-color-border); padding-top: var(--tf-space-6); }
@media (min-width: 48rem) {
  .tf-footer--columns .tf-footer__inner { grid-template-columns: repeat(3, 1fr); }
  .tf-footer--columns .tf-footer__col { grid-column: auto; }
  .tf-footer--big-type .tf-footer__inner { grid-template-columns: 1fr 1fr; }
  .tf-footer--big-type .tf-wordmark--big-type { grid-column: 1 / -1; }
}
`;
