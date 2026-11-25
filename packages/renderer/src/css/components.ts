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
