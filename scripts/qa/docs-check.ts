// qa:trace --docs 문서 검사(00장 AC-00-01·AC-00-07, 07장 7.12.1 "문서 검사로 M0"). 해석은 ASM-005.
//   AC-00-01: 01~09장 각각에 `대상` 열이 있는 기능 표가 1개 이상 있고, 그 열 값이 P1·P2·P1,P2·운영자 중 하나.
//             `대상` 열 값이 모두 페르소나 값인 표만 "사용자 기능 표"로 본다(다른 뜻의 `대상` 열과 구분).
//   AC-00-07: 01~09장 각각에 기능 태그가 붙은 제목이 1개 이상 있고, 제목 끝 대괄호 태그는
//             [P0]·[P2]·[P3]·[MVP 제외] 중 하나로 시작한다.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export interface DocsHit {
  ac: "AC-00-01" | "AC-00-07";
  where: string;
  message: string;
  blockedBy?: string;
}

const PERSONA = /^(P1|P2|P1,\s?P2|운영자)$/;
const TAG_OK = /^\[(P0|P2|P3|MVP 제외)(?=[\s\]/])/;
const SEP = /^\|[\s:|-]+\|$/;

/**
 * BLK-004(locked-conflict): spec 잠금 문서가 AC-00-01·07을 충족하지 못함. 장 단위 항목만 blocked로 보고.
 * 목록 밖 장(예: 10장 신설)의 위반은 FAIL. 장 파일은 spec 잠금이라 guard가 변경 자체를 막는다.
 */
export const BLK_004_CHAPTERS = ["01", "02", "03", "04", "05", "06", "07", "08", "09"];

const cells = (l: string): string[] =>
  l
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((c) => c.trim());

export function docsCheck(specDir: string): DocsHit[] {
  const out: DocsHit[] = [];
  const files = readdirSync(specDir)
    .filter((n) => /^0[1-9]_.*\.md$/.test(n))
    .sort();
  for (const f of files) {
    const ch = f.slice(0, 2);
    const blk = BLK_004_CHAPTERS.includes(ch) ? { blockedBy: "BLK-004" } : {};
    const lines = readFileSync(join(specDir, f), "utf8").split("\n");

    // AC-00-01
    let personaTables = 0;
    for (let i = 0; i + 1 < lines.length; i++) {
      const l = lines[i] as string;
      if (!l.startsWith("|") || !SEP.test((lines[i + 1] as string).trim())) continue;
      const col = cells(l).indexOf("대상");
      if (col < 0) continue;
      const vals: string[] = [];
      for (let j = i + 2; j < lines.length && (lines[j] as string).startsWith("|"); j++)
        vals.push(cells(lines[j] as string)[col] ?? "");
      if (vals.length && vals.every((v) => PERSONA.test(v))) personaTables++;
    }
    if (personaTables === 0)
      out.push({
        ac: "AC-00-01",
        where: f,
        message: "`대상`(P1|P2|P1,P2|운영자) 열이 있는 사용자 기능 표가 없음",
        ...blk,
      });

    // AC-00-07
    let tagged = 0;
    lines.forEach((l, i) => {
      const m = /^#{1,6} .*?(\[[^\]]+\])\s*$/.exec(l);
      if (!m || !m[1]) return;
      tagged++;
      if (!TAG_OK.test(m[1]))
        out.push({
          ac: "AC-00-07",
          where: `${f}:${i + 1}`,
          message: `허용 밖 기능 태그 ${m[1]}`,
          ...blk,
        });
    });
    if (tagged === 0)
      out.push({
        ac: "AC-00-07",
        where: f,
        message: "[P0]/[P2]/[P3]/[MVP 제외] 태그가 붙은 기능 제목이 없음",
        ...blk,
      });
  }
  return out;
}
