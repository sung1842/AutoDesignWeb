"""페이지 서브셋 woff2 생성(03장 3.7.5, ASM-051). 입력: stdin JSON {outDir, chars, faces:[{family, file, script, classification, weight, sources:[]}]}.
temp(B6 files 없음): 시스템 Noto Sans/Serif CJK KR(serif 분류) · DejaVu Sans Mono(mono)로 대체(09장 9.2 B6).
결정론: 타임스탬프 재계산 없음, 이름 표를 CSS family(subsetFamily)로 바꿔 렌더 측정이 지정 서체로 보이게 한다.
출력: stdout JSON [{file, bytes, source}]. 이미 있는 파일은 다시 만들지 않는다(같은 이름 = 같은 글자 집합)."""
import json, os, subprocess, sys

try:
    import brotli  # noqa: F401  woff2 압축에 필요
except ImportError:
    sys.stderr.write("brotli 없음: pip install --break-system-packages brotli (PROGRESS 실행 환경 사실 참고)\n")
    sys.exit(3)
from fontTools import subset
from fontTools.ttLib import TTFont

STYLES = {
    "sans": [(100, "Thin"), (300, "Light"), (350, "DemiLight"), (400, "Regular"), (500, "Medium"), (700, "Bold"), (900, "Black")],
    "serif": [(200, "ExtraLight"), (300, "Light"), (400, "Regular"), (500, "Medium"), (600, "SemiBold"), (700, "Bold"), (900, "Black")],
    "mono": [(400, "Book"), (700, "Bold")],
}
FAMILY = {"sans": "Noto Sans CJK KR", "serif": "Noto Serif CJK KR", "mono": "DejaVu Sans Mono"}


def pick_style(kind, w):
    opts = STYLES[kind]
    exact = [s for (x, s) in opts if x == w]
    if exact:
        return exact[0]
    # CSS 폰트 매칭: 500 초과 요청은 더 굵은 쪽 우선, 이하는 더 가는 쪽 우선
    heavier = [(x, s) for (x, s) in opts if x > w]
    lighter = [(x, s) for (x, s) in reversed(opts) if x < w]
    seq = (heavier + lighter) if w > 500 else (lighter + heavier)
    return seq[0][1]


def resolve(face):
    for src in face.get("sources") or []:
        if os.path.exists(src):
            return src, 0, "registry"
    kind = "mono" if face["classification"] == "mono" else ("serif" if face["classification"] == "serif" else "sans")
    style = pick_style(kind, int(face["weight"]))
    q = f"{FAMILY[kind]}:style={style}"
    out = subprocess.run(["fc-match", "-f", "%{file}|%{index}", q], capture_output=True, text=True, check=True).stdout
    path, idx = out.split("|")
    return path, int(idx or 0), f"temp:{FAMILY[kind]} {style}"


def build(face, chars, out_path):
    src, idx, how = resolve(face)
    opts = subset.Options()
    opts.flavor = "woff2"
    opts.layout_features = ["*"]
    opts.name_IDs = ["*"]
    opts.name_languages = ["*"]
    opts.notdef_outline = True
    opts.recalc_timestamp = False
    opts.font_number = idx
    font = subset.load_font(src, opts, dontLoadGlyphNames=True)
    s = subset.Subsetter(opts)
    s.populate(text=chars)
    s.subset(font)
    name = font["name"]
    fam = face["family"]
    for rec in list(name.names):
        if rec.nameID in (1, 4, 6, 16, 21):
            name.removeNames(nameID=rec.nameID)
    for nid, val in ((1, fam), (4, fam), (6, fam.replace(" ", "-")), (16, fam)):
        name.setName(val, nid, 3, 1, 0x409)
        name.setName(val, nid, 1, 0, 0)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    tmp = out_path + ".tmp"
    subset.save_font(font, tmp, opts)
    os.replace(tmp, out_path)
    return how


def main():
    req = json.load(sys.stdin)
    res = []
    for f in req["faces"]:
        out = os.path.join(req["outDir"], f["file"])
        how = "cached"
        if not os.path.exists(out):
            how = build(f, req["chars"], out)
        res.append({"file": f["file"], "bytes": os.path.getsize(out), "source": how})
    json.dump(res, sys.stdout)


if __name__ == "__main__":
    main()
