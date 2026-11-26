"""기능정의서 캡처 생성: 목업을 PC·태블릿·모바일 폭으로 열어 화면별 이미지를 docs/guide/img에 저장한다.
사용: python3 scripts/capture_guide.py   (docs를 임시 서버로 띄우고 크롬으로 촬영)"""
import io, subprocess, sys, time, pathlib
from playwright.sync_api import sync_playwright
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'docs' / 'guide' / 'img'
PORT = 8765
DEVICES = {'pc': (1440, 900), 'tab': (900, 1100), 'mo': (390, 844)}

# (파일명, 해시, 촬영 전 클릭할 선택자 목록)
JOBS = [
    ('members-pending',        'members?r=admin&t=pending', []),
    ('members-pending-sel',    'members?r=admin&t=pending', ['[data-sel="m1"]', '[data-sel="m2"]']),
    ('members-ok',             'members?r=admin&t=ok', []),
    ('members-out',            'members?r=admin&t=out', []),
    ('members-withdraw-modal', 'members?r=admin&t=ok', ['[data-act="withdraw"]']),
]

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '-d', str(ROOT / 'docs')], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1)
    try:
        with sync_playwright() as p:
            b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
            for dev, (w, h) in DEVICES.items():
                ctx = b.new_context(viewport={'width': w, 'height': h})
                page = ctx.new_page()
                for name, hash_, clicks in JOBS:
                    page.goto(f'http://localhost:{PORT}/mockup/index.html#/{hash_}')
                    page.reload()
                    page.wait_for_selector('.header')
                    for sel in clicks:
                        page.locator(sel).first.click()
                    page.wait_for_timeout(150)
                    png = page.screenshot()
                    Image.open(io.BytesIO(png)).convert('RGB').save(OUT / f'{name}-{dev}.webp', 'WEBP', quality=82)
                    print('saved', f'{name}-{dev}.webp')
                ctx.close()
            b.close()
    finally:
        srv.terminate()

main()
