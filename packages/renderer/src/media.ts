// 미디어 슬롯(03장 3.10, 04장 CM-06·09). photo-led·type-led → 이미지 팩 <img>(로컬 경로, width·height),
// shape-graphic 또는 자산 없음 → 색면 구성 G1~G4(3.10.5). 순수(4.9.1). ASM-052.
import { fnv64 } from "./fonts.js";
import { el, type Html } from "./html.js";

export interface ImageLike {
  id: string;
  path: string;
  width: number;
  height: number;
  focalPoint: [number, number];
  altKo: string;
}
export interface SlotImage {
  tag: string;
  ratio: string;
  asset_id: string;
  alt: string;
  focal: [number, number];
}
export interface MediaCtx {
  mode: string; // l2 media.mode
  seed: string; // spec_id(3.10.5 sha256(job_seed‖slot) 대신, ASM-052)
  find: (id: string) => ImageLike | undefined;
}

/** 이미지 팩 파일 → 서빙 경로(외부 요청 0). data/images/<rel> → /assets/images/<rel>. */
export const IMAGE_URL_PREFIX = "/assets/images/";
export const imageUrl = (path: string): string =>
  IMAGE_URL_PREFIX + path.replace(/^data\/images\//, "");

/** 초점 양자화(10% 단위): data-fx·data-fy → focalCss가 object-position으로 옮긴다(style 속성 금지 CM-03). */
const q10 = (v: number): number => Math.min(100, Math.max(0, Math.round(v * 10) * 10));

function ratioWH(ratio: string, w: number): [number, number] {
  const [a, b] = ratio.split(":").map(Number);
  const r = a && b ? b / a : 1;
  return [w, Math.round(w * r)];
}

/** 3.10.5 색면 구성 G1~G4: 직사각형 2~3개(primary·accent·surface-inverse), 원·블롭·그라디언트 없음. */
export function shapeGraphic(
  seed: string,
  slotId: string,
  ratio: string,
  label: string | null,
): Html {
  const g = (Number.parseInt(fnv64(`${seed}|${slotId}`).slice(-4), 16) % 4) + 1;
  const n = g === 2 ? 2 : 3;
  return el(
    "div",
    {
      class: `tf-media tf-media--${ratio.replace(":", "-")} tf-shape tf-shape--g${g}`,
      role: label ? "img" : null,
      "aria-label": label ? `${label} 이미지 자리` : null,
      "aria-hidden": label ? null : "true",
      "data-shape-graphic": `G${g}`,
    },
    ...Array.from({ length: n }, (_, i) =>
      el("span", { class: `tf-shape__r tf-shape__r--${i + 1}` }),
    ),
  );
}

export interface MediaOpts {
  eager?: boolean;
}

export function mediaHtml(
  m: MediaCtx | undefined,
  slotId: string,
  img: SlotImage,
  o: MediaOpts = {},
): Html {
  const ratio = img.ratio.replace(":", "-");
  const entry = m && m.mode !== "shape-graphic" ? m.find(img.asset_id) : undefined;
  const label = img.alt || null;
  if (!entry) {
    const inner = shapeGraphic(m?.seed ?? "", slotId, img.ratio, label);
    return el(
      "div",
      { class: "tf-media-slot", "data-media-slot": img.tag, "data-slot-id": slotId },
      inner,
    );
  }
  const [w, h] = ratioWH(img.ratio, entry.width);
  const [fx, fy] = img.focal ?? entry.focalPoint;
  return el(
    "div",
    {
      class: `tf-media tf-media--${ratio}`,
      "data-slot-id": slotId,
      "data-media-slot": img.tag,
      "data-asset-id": img.asset_id,
    },
    el("img", {
      src: imageUrl(entry.path),
      alt: img.alt,
      width: w,
      height: h,
      loading: o.eager ? "eager" : "lazy",
      fetchpriority: o.eager ? "high" : null,
      decoding: "async",
      "data-fx": q10(fx),
      "data-fy": q10(fy),
    }),
  );
}

/** 초점 규칙(생성 CSS, 소스 층 밖): 11 × 11 값. */
export function focalCss(): string {
  const v = Array.from({ length: 11 }, (_, i) => i * 10);
  return (
    "/* TasteFit focal.css */\n.tf-media > img { --tf-focal-x: 50%; --tf-focal-y: 50%; }\n" +
    v.map((x) => `.tf-media > img[data-fx="${x}"] { --tf-focal-x: ${x}%; }`).join("\n") +
    "\n" +
    v.map((y) => `.tf-media > img[data-fy="${y}"] { --tf-focal-y: ${y}%; }`).join("\n") +
    "\n"
  );
}
