#!/usr/bin/env python3
"""리뷰 패킷용: <base>..HEAD 사이 docs/spec/v2 변경 줄을 SECTION_INDEX의 가장 깊은 절로 묶어 출력.
사용: python3 tools/changed_sections.py <base-commit>
"""
import re, subprocess, sys

base = sys.argv[1]
idx = open('docs/spec/SECTION_INDEX.md', encoding='utf-8').read().split('\n')
secs = {}  # file -> [(start,end,depth,title)]
cur = None
for line in idx:
    m = re.match(r'## (docs/spec/v2/\S+)', line)
    if m:
        cur = m.group(1); secs[cur] = []; continue
    m = re.match(r'(\s*)- (\d+)-(\d+) (.*)', line)
    if m and cur:
        secs[cur].append((int(m.group(2)), int(m.group(3)), len(m.group(1)), m.group(4)))

diff = subprocess.run(['git', 'diff', '-U0', f'{base}..HEAD', '--', 'docs/spec/v2'],
                      capture_output=True, text=True).stdout
hits = {}
f = None
for line in diff.split('\n'):
    if line.startswith('+++ b/'):
        f = line[6:]; continue
    m = re.match(r'@@ -\S+ \+(\d+)(?:,(\d+))? @@', line)
    if m and f in secs:
        a = int(m.group(1)); n = int(m.group(2) or 1)
        for ln in range(a, a + max(n, 1)):
            cand = [s for s in secs[f] if s[0] <= ln <= s[1]]
            if cand:
                s = max(cand, key=lambda x: (x[2], x[0]))
                hits.setdefault(f, set()).add(s)
for f in sorted(hits):
    items = sorted(hits[f])
    print(f"- **{f.split('/')[-1]}**: " + '; '.join(f"{t} ({a}-{b})" for a, b, _, t in items))
