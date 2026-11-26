"""시안의 디자인 통일성 점검: 기준값(tokens.css) 밖의 원시 값 사용을 찾는다.

규칙
- tokens.css 밖에서는 색(#hex, rgb/hsl), 픽셀 값(예: 12px)을 쓰지 않는다 (@media 분기점은 예외).
- 화면 코드(app.js, index.html)에는 style 속성이나 .style 조작, 색 값을 쓰지 않는다.
- components.css가 쓰는 var(--...)는 모두 tokens.css에 정의되어 있어야 한다.
- components.css 선택자는 클래스 1개(+상태 의사클래스)만: 하위·자식·인접 선택자, !important 금지.
- 같은 선택자를 @media 밖에서 두 번 이상 정의하지 않는다 (중복·겹침 금지).
종료 코드 0이면 예외 없음.
"""
import re
import sys
from pathlib import Path

root = Path(sys.argv[1] if len(sys.argv) > 1 else "docs/mockup")
tokens = (root / "tokens.css").read_text(encoding="utf-8")
defined = set(re.findall(r"(--[\w-]+)\s*:", tokens))
problems = []

css = (root / "components.css").read_text(encoding="utf-8")
for no, line in enumerate(css.splitlines(), 1):
    if "@media" in line:
        continue
    code = re.sub(r"/\*.*?\*/", "", line)
    if re.search(r"#[0-9a-fA-F]{3,8}\b", code) or re.search(r"\b(rgb|rgba|hsl|hsla)\(", code):
        problems.append(f"components.css:{no} 원시 색 값: {line.strip()}")
    if re.search(r"(?<![\w-])\d*\.?\d+px\b", code):
        problems.append(f"components.css:{no} 원시 px 값: {line.strip()}")
used = set(re.findall(r"var\((--[\w-]+)\)", css))
for u in sorted(used - defined):
    problems.append(f"components.css: 정의되지 않은 기준값 {u}")

# 선택자 규칙 (주석 제거 후 규칙 단위로 검사)
flat = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
if "!important" in flat:
    problems.append("components.css: !important 사용")
seen = {}
depth_media = 0
for m in re.finditer(r"(@media[^{]*\{)|([^{}]+)\{[^{}]*\}|(\})", flat):
    if m.group(1):
        depth_media += 1
        continue
    if m.group(3):
        depth_media = max(0, depth_media - 1)
        continue
    for sel in (x.strip() for x in m.group(2).split(",")):
        if not sel or sel == "*":
            continue
        bare = re.sub(r"\([^)]*\)", "", sel)
        if re.search(r"[\s>+~]", bare):
            problems.append(f"components.css: 하위/자식 선택자 {sel}")
        if len(re.findall(r"(?<![\w-])\.[\w-]+", bare)) > 1:
            problems.append(f"components.css: 클래스 결합 선택자 {sel}")
        if depth_media == 0:
            if sel in seen:
                problems.append(f"components.css: 중복 정의 {sel}")
            seen[sel] = True

for name in ("app.js", "index.html"):
    text = (root / name).read_text(encoding="utf-8")
    for no, line in enumerate(text.splitlines(), 1):
        if re.search(r"\bstyle\s*=", line) or re.search(r"\.style\b", line) or "setProperty" in line:
            problems.append(f"{name}:{no} 인라인 스타일: {line.strip()[:80]}")
        if re.search(r"""['"]#[0-9a-fA-F]{3,8}['"]""", line) or re.search(r"\b(rgb|rgba)\(", line):
            problems.append(f"{name}:{no} 원시 색 값: {line.strip()[:80]}")

print(f"기준값 {len(defined)}개 정의, components.css에서 {len(used)}개 사용")
if problems:
    print(f"예외 {len(problems)}건")
    print("\n".join(problems))
    sys.exit(1)
print("예외 0건")
