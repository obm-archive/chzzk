"""기능정의서 캡처 생성: 목업을 PC·태블릿·모바일 폭으로 열어 화면별 이미지를 docs/guide/img에 저장한다.
사용: python3 scripts/capture_guide.py   (docs를 임시 서버로 띄우고 크롬으로 촬영)"""
import io, subprocess, sys, time, pathlib
from playwright.sync_api import sync_playwright
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'docs' / 'guide' / 'img'
PORT = 8765
_buf = io.BytesIO(); Image.new('RGB', (16, 9), (224, 224, 224)).save(_buf, 'PNG'); PLACEHOLDER = _buf.getvalue()
DEVICES = {'pc': (1440, 900), 'tab': (900, 1100), 'mo': (390, 844)}

# (파일명, 해시, 촬영 전 클릭할 선택자 목록)
# 토스트(2초)가 사라진 뒤 찍어야 하는 캡처
WAIT = {'members-empty': 2400, 'ops-empty': 2400}

JOBS = [
    ('intro-home',             'home?r=user', []),
    ('members-pending',        'members?r=admin&t=pending', []),
    ('members-pending-sel',    'members?r=admin&t=pending', ['[data-sel="m1"]', '[data-sel="m2"]']),
    ('members-ok',             'members?r=admin&t=ok', []),
    ('members-out',            'members?r=admin&t=out', []),
    ('members-withdraw-modal', 'members?r=admin&t=ok', ['[data-act="withdraw"]']),
    ('members-toast-approve',  'members?r=admin&t=pending', ['[data-act="m-approve"]']),
    ('members-toast-reject',   'members?r=admin&t=pending', ['[data-act="m-reject"]']),
    ('members-toast-withdraw', 'members?r=admin&t=ok', ['[data-act="withdraw"]', '[data-act="confirm-yes"]']),
    ('ops-all',          'ops?r=admin&t=all', []),
    ('ops-done',         'ops?r=admin&t=done', []),
    ('ops-todo',         'ops?r=admin&t=todo', []),
    ('ops-sel',          'ops?r=admin&t=all', ['[data-sel="o16358201"]']),
    ('ops-toast-hide',   'ops?r=admin&t=all', ['[data-act="ops-hide"]']),
    ('ops-toast-show',   'ops?r=admin&t=all', ['[data-act="ops-show"]']),
    ('ops-toast-redo',   'ops?r=admin&t=all', ['[data-act="post-redo"]']),
    ('ops-delete-modal', 'ops?r=admin&t=all', ['[data-act="ops-del"]']),
    ('ops-toast-delete', 'ops?r=admin&t=all', ['[data-act="ops-del"]', '[data-act="confirm-yes"]']),
    ('ops-empty',        'ops?r=admin&t=done', ['[data-act="pub"][data-v="hide"]', '[data-act="ops-show"]']),
    ('members-empty',          'members?r=admin&t=ok', ['[data-act="idle"][data-v="90"]', '[data-act="withdraw"]', '[data-act="confirm-yes"]']),
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
                # 치지직 썸네일 CDN은 외부 요청이라 막히므로 회색 자리표시 이미지로 대체한다
                ctx.route('**/*', lambda route: route.fulfill(status=200, content_type='image/png', body=PLACEHOLDER)
                          if route.request.resource_type == 'image' and 'localhost' not in route.request.url else route.continue_())
                for name, hash_, clicks in JOBS:
                    page.goto(f'http://localhost:{PORT}/mockup/index.html#/{hash_}')
                    page.reload()
                    page.wait_for_selector('.header')
                    for sel in clicks:
                        page.locator(sel).first.click()
                    page.wait_for_timeout(WAIT.get(name, 150))
                    png = page.screenshot()
                    Image.open(io.BytesIO(png)).convert('RGB').save(OUT / f'{name}-{dev}.webp', 'WEBP', quality=82)
                    print('saved', f'{name}-{dev}.webp')
                ctx.close()
            b.close()
    finally:
        srv.terminate()

main()
