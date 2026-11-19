#!/usr/bin/env python3
"""docs/spec/v2/*.md 의 제목(##, ###, ####)을 파일:줄 범위로 색인한다.
결과: docs/spec/SECTION_INDEX.md. 장을 고친 뒤 다시 실행한다."""
import glob, os, re
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out = ["# 절 색인 (자동 생성: python3 tools/spec_index.py)", "",
       "형식: 파일 제목 아래 `시작-끝 절 제목`. 필요한 절만 `sed -n '시작,끝p' 파일` 로 읽는다.", ""]
for path in sorted(glob.glob(os.path.join(root, "docs/spec/v2/*.md"))):
    lines = open(path, encoding="utf-8").read().split("\n")
    heads = [(i + 1, len(m.group(1)), m.group(2).strip())
             for i, l in enumerate(lines) if (m := re.match(r"^(#{2,3})\s+(.*)", l))]
    rel = os.path.relpath(path, root)
    out.append(f"## {rel} ({len(lines)}줄)")
    for k, (ln, lvl, title) in enumerate(heads):
        end = len(lines)
        for ln2, lvl2, _ in heads[k + 1:]:
            if lvl2 <= lvl:
                end = ln2 - 1
                break
        out.append(f"{'  ' * (lvl - 2)}- {ln}-{end} {title[:60]}")
    out.append("")
open(os.path.join(root, "docs/spec/SECTION_INDEX.md"), "w", encoding="utf-8").write("\n".join(out))
print("ok", len(out), "lines")
