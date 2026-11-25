// node 전용: 폰트 계획(@tastefit/renderer fontPlan)대로 페이지 서브셋 woff2를 만든다(03장 3.7.5, ASM-051).
// fontTools(python3)로 서브셋한다. temp(B6 파일 없음)는 시스템 Noto CJK KR 대체(09장 9.2 B6).
// 순수 패키지 진입점(index)에서 내보내지 않는다(isomorphic 유지) → `@tastefit/assets/fonts-node`.
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export interface FaceIn {
  family: string;
  file: string;
  script: string;
  classification: string;
  weight: number;
  sources?: string[];
}
export interface FaceOut {
  file: string;
  bytes: number;
  source: string;
}

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "../py/subset_fonts.py");

/** outDir 아래 face.file 경로에 woff2를 만든다(이미 있으면 그대로). */
export function materializeFonts(
  plan: { faces: FaceIn[]; chars: string },
  outDir: string,
): FaceOut[] {
  if (plan.faces.length === 0) return [];
  const r = spawnSync("python3", ["-I", SCRIPT], {
    input: JSON.stringify({ outDir, chars: plan.chars, faces: plan.faces }),
    encoding: "utf8",
    maxBuffer: 16 << 20,
  });
  if (r.status !== 0) throw new Error(`폰트 서브셋 실패: ${r.stderr.slice(-400)}`);
  return JSON.parse(r.stdout) as FaceOut[];
}
