// blocks/media.css(CM-02 3층): 미디어 슬롯 틀·3.10.5 색면 구성 G1~G4(12×12 격자, 직사각형만). ASM-052.
export const MEDIA_BLOCK_CSS = `/* TasteFit blocks/media.css */
.tf-media-slot { width: 100%; min-width: 0; }
.tf-media > img { display: block; }
.tf-shape {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  grid-template-rows: repeat(12, 1fr);
  background: var(--tf-color-surface);
}
.tf-shape__r--1 { background: var(--tf-color-primary); }
.tf-shape__r--2 { background: var(--tf-color-accent); }
.tf-shape__r--3 { background: var(--tf-color-surface-inverse); }
.tf-shape--g1 .tf-shape__r--1 { grid-area: 1 / 1 / 13 / 8; }
.tf-shape--g1 .tf-shape__r--2 { grid-area: 7 / 8 / 13 / 13; }
.tf-shape--g1 .tf-shape__r--3 { grid-area: 1 / 8 / 4 / 13; }
.tf-shape--g2 .tf-shape__r--1 { grid-area: 1 / 1 / 7 / 13; }
.tf-shape--g2 .tf-shape__r--2 { grid-area: 7 / 4 / 13 / 10; }
.tf-shape--g3 .tf-shape__r--1 { grid-area: 3 / 3 / 11 / 13; }
.tf-shape--g3 .tf-shape__r--2 { grid-area: 9 / 1 / 13 / 6; }
.tf-shape--g3 .tf-shape__r--3 { grid-area: 1 / 10 / 3 / 13; }
.tf-shape--g4 .tf-shape__r--1 { grid-area: 1 / 1 / 13 / 5; }
.tf-shape--g4 .tf-shape__r--2 { grid-area: 4 / 5 / 13 / 9; }
.tf-shape--g4 .tf-shape__r--3 { grid-area: 7 / 9 / 13 / 13; }
`;
