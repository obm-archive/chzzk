/* 시안 화면 스크립트. 서비스 이름과 화면 구성은 이 파일 맨 위 상수에서만 정의한다. */
(function () {
  'use strict';

  var SERVICE = '치지직로그';
  var TODAY = '2026-11-26';
  var CATEGORY = { talk: '토크' };
  var M = window.MOCK;

  var SCREENS = [
    { no: 1, name: '접속', items: [
      ['로그인', 'login'], ['가입 신청', 'login?tab=signup'], ['가입 신청 완료', 'login?tab=signup&s=done'],
      ['승인 대기', 'login?s=pending'], ['승인 거절', 'login?s=rejected'], ['로그인 실패', 'login?s=error']] },
    { no: 2, name: '홈(검색)', items: [
      ['사용자', 'home?r=user'], ['검색 결과', 'home?r=user&q=캠핑장'], ['결과 없음', 'home?r=user&q=없는검색어'], ['관리자', 'home?r=admin']] },
    { no: 3, name: '방송 상세', items: [['사용자', 'post?r=user'], ['관리자', 'post?r=admin']] },
    { no: 4, name: '용어집', items: [['사용자', 'glossary?r=user'], ['관리자', 'glossary?r=admin']] },
    { no: 5, name: '멤버 관리', items: [['가입 대기', 'members?r=admin&t=pending'], ['승인됨', 'members?r=admin&t=ok'], ['탈퇴·거절', 'members?r=admin&t=out']] },
    { no: 6, name: '처리 현황', items: [['관리자', 'ops?r=admin']] }
  ];

  var state = {
    form: { nick: '', pw: '', grade: '', link: '', q: '', tname: '', tdesc: '' },
    err: '', modal: null, sel: {}, idle: 0, toastTimer: null,
    gloss: M.glossary.map(function (g, i) {
      return { id: i + 1, term: g.term, type: g.type, desc: g.desc, author: i % 3 === 0 ? '나' : '회원' + (10 + i),
        hist: [{ at: '2026-11-25', who: i % 3 === 0 ? '나' : '회원' + (10 + i), desc: g.desc }] };
    }),
    members: [
      { id: 1, nick: '신청자01', st: 'pending', joined: '2026-11-25', seen: '', grade: '예', link: '게시물 보기' },
      { id: 2, nick: '신청자02', st: 'pending', joined: '2026-11-24', seen: '', grade: '아니오', link: '게시물 보기' },
      { id: 3, nick: '신청자03', st: 'pending', joined: '2026-11-22', seen: '', grade: '예', link: '게시물 보기' },
      { id: 4, nick: '회원01', st: 'ok', joined: '2026-10-01', seen: '2026-11-26' },
      { id: 5, nick: '회원02', st: 'ok', joined: '2026-10-02', seen: '2026-11-20' },
      { id: 6, nick: '회원03', st: 'ok', joined: '2026-10-03', seen: '2026-10-20' },
      { id: 7, nick: '회원04', st: 'ok', joined: '2026-09-15', seen: '2026-09-18' },
      { id: 8, nick: '회원05', st: 'ok', joined: '2026-08-10', seen: '2026-08-30' },
      { id: 9, nick: '회원06', st: 'ok', joined: '2026-07-01', seen: '2026-07-04' },
      { id: 10, nick: '회원07', st: 'out', joined: '2026-06-01', seen: '2026-06-30', why: '탈퇴' },
      { id: 11, nick: '신청자00', st: 'out', joined: '2026-11-01', seen: '', why: '거절' }
    ],
    ops: [
      { no: 16365315, title: M.post.title, at: M.post.start, st: '완료', cls: '', pct: 100 },
      { no: 16372104, title: '처리 중인 방송 예시', at: '2026-11-26 19:00:12', st: '처리 중', cls: 'is-info', pct: 60 },
      { no: 16358201, title: '실패한 방송 예시', at: '2026-11-23 20:10:40', st: '실패', cls: 'is-danger', pct: 0 }
    ]
  };

  /* ── 공통 도우미 ── */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function parse() {
    var raw = (location.hash || '#/').slice(2);
    var parts = raw.split('?');
    var q = {};
    (parts[1] || '').split('&').forEach(function (kv) {
      if (!kv) return;
      var p = kv.split('=');
      q[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || '');
    });
    return { path: parts[0] || '', q: q };
  }
  function go(to) { location.hash = '#/' + to; }
  function dur(sec) { return Math.floor(sec / 3600) + '시간 ' + Math.floor((sec % 3600) / 60) + '분'; }
  function daysAgo(d) { return Math.floor((Date.parse(TODAY) - Date.parse(d)) / 86400000); }
  function btn(label, act, extra, kind) {
    return '<button class="btn ' + (kind || 'btn-secondary') + '" data-act="' + act + '" ' + (extra || '') + '>' + esc(label) + '</button>';
  }
  function chips(list) {
    return list.map(function (k) { return '<span class="chip">' + esc(k) + '</span>'; }).join('');
  }
  function val(k) { return esc(state.form[k]); }

  /* ── 상단 메뉴 ── */
  function nav(cur, r) {
    var items = [['home', '홈'], ['glossary', '용어집']];
    if (r === 'admin') items.push(['members', '멤버 관리'], ['ops', '처리 현황']);
    var html = '<button class="nav-brand" data-go="home?r=' + r + '">' + esc(SERVICE) + '</button>';
    items.forEach(function (it) {
      var q = it[0] === 'members' ? '&t=pending' : '';
      html += '<button class="nav-link' + (cur === it[0] ? ' on' : '') + '" data-go="' + it[0] + '?r=' + r + q + '">' + it[1] + '</button>';
    });
    html += '<span class="grow"></span>';
    html += '<button class="nav-link" data-go="">화면 목록</button>';
    html += '<button class="nav-link" data-go="login">로그아웃</button>';
    return '<nav class="nav">' + html + '</nav>';
  }
  function shell(cur, r, body) {
    return nav(cur, r) + '<main class="page stack">' + body + '</main>';
  }

  /* ── 화면: 화면 목록 ── */
  function vIndex() {
    var rows = SCREENS.map(function (s) {
      var links = s.items.map(function (it) {
        return '<button class="link" data-go="' + esc(it[1]) + '">' + esc(it[0]) + '</button>';
      }).join('');
      return '<div class="row"><span class="c-xs">' + s.no + '</span><span class="c-m bold">' + esc(s.name) +
        '</span><span class="c-fill inline">' + links + '</span></div>';
    }).join('');
    return '<main class="page stack"><h1 class="title">화면 목록</h1>' +
      '<div class="list"><div class="row row-head"><span class="c-xs">번호</span><span class="c-m">화면</span><span class="c-fill">상태 · 역할</span></div>' +
      rows + '</div></main>';
  }

  /* ── 화면: 접속 ── */
  function vLogin(q) {
    var signup = q.tab === 'signup';
    var h = '<main class="form-box stack"><h1 class="title">' + esc(SERVICE) + '</h1>';
    h += '<div class="inline"><button class="btn btn-secondary' + (!signup ? ' on' : '') + '" data-go="login">로그인</button>' +
      '<button class="btn btn-secondary' + (signup ? ' on' : '') + '" data-go="login?tab=signup">가입 신청</button></div>';
    if (signup && q.s === 'done') {
      h += '<div class="notice is-info">가입 신청이 접수되었습니다. 승인되면 로그인할 수 있습니다.</div>' +
        '<button class="btn btn-primary fill" data-go="login">로그인으로 이동</button></main>';
      return h;
    }
    if (q.s === 'pending') h += '<div class="notice is-warn">가입 승인 대기 중입니다. 승인 후 이용할 수 있습니다.</div>';
    if (q.s === 'rejected') h += '<div class="notice is-danger">가입이 거절되었습니다. 내용을 확인한 뒤 다시 신청할 수 있습니다.</div>';
    if (q.s === 'error') h += '<div class="notice is-danger">닉네임 또는 비밀번호가 올바르지 않습니다.</div>';
    if (state.err) h += '<div class="notice is-danger">' + esc(state.err) + '</div>';
    if (signup) {
      h += '<div class="notice is-info">이 서비스는 카페 회원 중 왕자두 등급 이상부터 이용할 수 있습니다. 등급이 미달이면 가입 승인이 거절될 수 있습니다.</div>';
    }
    h += '<div class="field"><label class="label">닉네임</label><input class="input" data-f="nick" value="' + val('nick') + '" placeholder="카페 닉네임"></div>';
    h += '<div class="field"><label class="label">비밀번호</label><input class="input" type="password" data-f="pw" value="' + val('pw') + '" placeholder="공통 비밀번호"></div>';
    if (signup) {
      h += '<div class="field"><span class="label">왕자두 등급 이상입니까?</span><div class="inline">' +
        '<button class="btn btn-secondary' + (state.form.grade === 'Y' ? ' on' : '') + '" data-act="grade" data-v="Y">예</button>' +
        '<button class="btn btn-secondary' + (state.form.grade === 'N' ? ' on' : '') + '" data-act="grade" data-v="N">아니오</button></div></div>';
      h += '<div class="field"><label class="label">가장 최근에 작성한 카페 게시물 링크</label><input class="input" data-f="link" value="' + val('link') + '" placeholder="https://cafe.naver.com/…"></div>';
      h += btn('가입 신청', 'signup', '', 'btn-primary fill');
    } else {
      h += '<div class="inline">' + btn('사용자 로그인', 'login-user', '', 'btn-primary grow') + btn('관리자 로그인', 'login-admin', '', 'btn-secondary grow') + '</div>';
    }
    return h + '</main>';
  }

  /* ── 화면: 홈(검색) ── */
  function matches(q) {
    var k = q.toLowerCase();
    var out = [];
    var head = [M.post.title, M.post.summary, M.post.keywords.join(' ')].join(' ').toLowerCase();
    if (head.indexOf(k) >= 0) out.push({ seg: -1, time: '방송 전체', title: M.post.title });
    M.segments.forEach(function (s, i) {
      var t = [s.title, s.summary, s.keywords.join(' '), s.quotes.map(function (x) { return x.text; }).join(' ')].join(' ').toLowerCase();
      if (t.indexOf(k) >= 0) out.push({ seg: i, time: s.start, title: s.title });
    });
    return out;
  }
  function vHome(q) {
    var r = q.r || 'user';
    var kw = q.q || '';
    var h = '<h1 class="title">방송 검색</h1><div class="inline"><input class="input grow" data-f="q" value="' + esc(kw || state.form.q) +
      '" placeholder="이 얘기 언제 했더라? (예: 캠핑장)">' + btn('검색', 'search', '', 'btn-primary') + '</div>';
    if (kw) {
      var hits = matches(kw);
      h += '<div class="small sub">“' + esc(kw) + '” 검색 결과 ' + hits.length + '건</div>';
      if (!hits.length) {
        h += '<div class="notice">검색 결과가 없습니다. 다른 단어로 검색해 보세요.</div>';
      } else {
        h += '<div class="list"><div class="row row-head"><span class="c-m">시간</span><span class="c-fill">구간</span></div>' +
          hits.map(function (x) {
            return '<div class="row row-link" data-go="post?r=' + r + '&seg=' + x.seg + '"><span class="c-m">' + esc(x.time) +
              '</span><span class="c-fill clip">' + esc(x.title) + '</span></div>';
          }).join('') + '</div>';
      }
      return shell('home', r, h);
    }
    h += '<div class="h2">최근 방송</div><div class="list"><div class="row row-head"><span class="c-m">날짜</span><span class="c-fill">제목</span>' +
      '<span class="c-s c-hide">분류</span><span class="c-m c-hide">길이</span>' + (r === 'admin' ? '<span class="c-b"></span>' : '') + '</div>' +
      '<div class="row row-link" data-go="post?r=' + r + '"><span class="c-m">' + esc(M.post.start.slice(0, 10)) + '</span><span class="c-fill clip">' + esc(M.post.title) +
      '</span><span class="c-s c-hide">' + esc(CATEGORY[M.post.category] || M.post.category) + '</span><span class="c-m c-hide">' + dur(M.post.duration) + '</span>' +
      (r === 'admin' ? '<span class="c-b">' + btn('숨김', 'post-hide', 'data-stop="1"') + '</span>' : '') + '</div></div>';
    return shell('home', r, h);
  }

  /* ── 화면: 방송 상세 ── */
  function vPost(q) {
    var r = q.r || 'user';
    var focus = q.seg === undefined ? -2 : parseInt(q.seg, 10);
    var h = '<div><button class="link" data-go="home?r=' + r + '">← 홈</button></div>';
    h += '<h1 class="title">' + esc(M.post.title) + '</h1>';
    h += '<div class="small sub">' + esc(M.post.start.slice(0, 16)) + ' · ' + dur(M.post.duration) + ' · ' + esc(CATEGORY[M.post.category] || M.post.category) + '</div>';
    if (r === 'admin') h += '<div class="inline">' + btn('숨김', 'post-hide') + btn('재처리', 'post-redo') + '</div>';
    h += '<div class="card stack"><div class="h2">전체 요약</div><p>' + esc(M.post.summary) + '</p><div class="inline">' + chips(M.post.keywords) + '</div></div>';
    h += '<div class="h2">구간별 요약</div>';
    M.segments.forEach(function (s, i) {
      h += '<div class="card stack' + (focus === i ? ' hit' : '') + '">' +
        '<div class="inline"><button class="link" data-act="seek" data-v="' + esc(s.start) + '">' + esc(s.start) + ' – ' + esc(s.end) + '</button></div>' +
        '<div class="bold">' + esc(s.title) + '</div><p class="small sub">' + esc(s.summary) + '</p>' +
        '<div class="inline">' + chips(s.keywords) + '</div>' +
        s.quotes.map(function (x) {
          return '<div class="quote"><button class="link" data-act="seek" data-v="' + esc(x.time) + '">' + esc(x.time) + '</button> ' + esc(x.text) + '</div>';
        }).join('') + '</div>';
    });
    return shell('', r, h);
  }

  /* ── 화면: 용어집 ── */
  function vGlossary(q) {
    var r = q.r || 'user';
    var admin = r === 'admin';
    var h = '<div class="inline"><h1 class="title grow">용어집</h1>' + btn('용어 추가', 'term-add', '', 'btn-primary') + '</div>';
    h += '<div class="list"><div class="row row-head"><span class="c-m">용어</span><span class="c-s">분류</span><span class="c-fill">설명</span>' +
      '<span class="c-s c-hide">작성자</span><span class="c-l"></span></div>';
    state.gloss.forEach(function (g) {
      var own = g.author === '나';
      var acts = '';
      if (own || admin) acts += btn('수정', 'term-edit', 'data-id="' + g.id + '"') + btn('삭제', 'term-del', 'data-id="' + g.id + '"');
      if (admin) acts += btn('이력', 'term-hist', 'data-id="' + g.id + '"');
      h += '<div class="row"><span class="c-m bold clip">' + esc(g.term) + '</span><span class="c-s"><span class="chip">' + esc(g.type) +
        '</span></span><span class="c-fill clip">' + esc(g.desc) + '</span><span class="c-s c-hide">' + esc(g.author) +
        '</span><span class="c-l inline">' + acts + '</span></div>';
    });
    return shell('glossary', r, h + '</div>');
  }

  /* ── 화면: 멤버 관리 ── */
  function vMembers(q) {
    var t = q.t || 'pending';
    var tabs = [['pending', '가입 대기'], ['ok', '승인됨'], ['out', '탈퇴·거절']];
    var h = '<h1 class="title">멤버 관리</h1><div class="inline">' + tabs.map(function (x) {
      return '<button class="btn btn-secondary' + (t === x[0] ? ' on' : '') + '" data-go="members?r=admin&t=' + x[0] + '">' + x[1] + '</button>';
    }).join('') + '</div>';
    var list = state.members.filter(function (m) { return m.st === t; });
    if (t === 'ok') {
      h += '<div class="inline">' + [[0, '전체'], [30, '30일 이상 미접속'], [60, '60일 이상 미접속'], [90, '90일 이상 미접속']].map(function (x) {
        return '<button class="chip' + (state.idle === x[0] ? ' on' : '') + '" data-act="idle" data-v="' + x[0] + '">' + x[1] + '</button>';
      }).join('') + '</div>';
      list = list.filter(function (m) { return daysAgo(m.seen) >= state.idle; });
    }
    var picked = list.filter(function (m) { return state.sel[m.id]; }).length;
    if (t === 'ok') h += '<div class="inline"><span class="small sub grow">' + list.length + '명 · 선택 ' + picked + '명</span>' + btn('선택 탈퇴', 'withdraw-bulk', picked ? '' : 'disabled', 'btn-secondary is-danger') + '</div>';
    h += '<div class="list"><div class="row row-head">' + (t === 'ok' ? '<span class="c-xs"><label class="check"><input type="checkbox" data-act="sel-all"></label></span>' : '') +
      '<span class="c-m">닉네임</span><span class="c-s">가입일</span>' +
      (t === 'ok' ? '<span class="c-m">최근 접속</span>' : '') +
      (t === 'pending' ? '<span class="c-s">등급 답변</span><span class="c-fill">최근 게시물</span>' : '<span class="c-fill"></span>') +
      '<span class="c-l"></span></div>';
    if (!list.length) h += '<div class="row mute">해당하는 멤버가 없습니다.</div>';
    list.forEach(function (m) {
      var acts = '';
      if (m.st === 'pending') acts = btn('승인', 'm-approve', 'data-id="' + m.id + '"', 'btn-primary') + btn('거절', 'm-reject', 'data-id="' + m.id + '"');
      if (m.st === 'ok') acts = btn('탈퇴', 'withdraw', 'data-id="' + m.id + '"', 'btn-secondary is-danger');
      if (m.st === 'out') acts = '<span class="chip">' + esc(m.why) + '</span>';
      h += '<div class="row">' + (t === 'ok' ? '<span class="c-xs"><label class="check"><input type="checkbox" data-sel="' + m.id + '"' + (state.sel[m.id] ? ' checked' : '') + '></label></span>' : '') +
        '<span class="c-m bold clip">' + esc(m.nick) + '</span><span class="c-s">' + esc(m.joined.slice(5)) + '</span>' +
        (t === 'ok' ? '<span class="c-m">' + esc(m.seen) + ' <span class="mute">(' + daysAgo(m.seen) + '일 전)</span></span>' : '') +
        (t === 'pending' ? '<span class="c-s">' + esc(m.grade) + '</span><span class="c-fill"><button class="link" data-act="seek" data-v="게시물">' + esc(m.link) + '</button></span>' : '<span class="c-fill"></span>') +
        '<span class="c-l inline">' + acts + '</span></div>';
    });
    return shell('members', 'admin', h + '</div>');
  }

  /* ── 화면: 처리 현황 ── */
  function vOps() {
    var h = '<h1 class="title">처리 현황</h1><div class="notice is-warn">네이버 인증 쿠키 만료가 가까워졌습니다. 성인 방송 수집 전에 갱신해 주세요.</div>';
    h += '<div class="list"><div class="row row-head"><span class="c-m">방송 번호</span><span class="c-fill">제목</span><span class="c-m c-hide">시작</span><span class="c-m">상태</span><span class="c-l"></span></div>';
    state.ops.forEach(function (o) {
      h += '<div class="row"><span class="c-m">' + o.no + '</span><span class="c-fill clip">' + esc(o.title) + '</span><span class="c-m c-hide">' + esc(o.at.slice(5, 16)) + '</span><span class="c-m">' +
        (o.st === '처리 중' ? '<progress class="progress" value="' + o.pct + '" max="100"></progress>' : '<span class="chip ' + o.cls + '">' + o.st + '</span>') +
        '</span><span class="c-l inline">' + btn('재처리', 'post-redo') + btn('병합·분할', 'post-split') + '</span></div>';
    });
    return shell('ops', 'admin', h + '</div>');
  }

  /* ── 모달 ── */
  function vModal() {
    var m = state.modal;
    if (!m) return '';
    var body = '';
    if (m.kind === 'term') {
      body = '<div class="h2">' + (m.id ? '용어 수정' : '용어 추가') + '</div>' +
        '<div class="field"><label class="label">용어 (30자 이내)</label><input class="input" maxlength="30" data-f="tname" value="' + val('tname') + '"></div>' +
        '<div class="field"><label class="label">설명 (200자 이내)</label><textarea class="textarea" maxlength="200" data-f="tdesc">' + val('tdesc') + '</textarea></div>' +
        (state.err ? '<div class="notice is-danger">' + esc(state.err) + '</div>' : '') +
        '<div class="inline">' + btn('취소', 'modal-close') + '<span class="grow"></span>' + btn('저장', 'term-save', '', 'btn-primary') + '</div>';
    }
    if (m.kind === 'confirm') {
      body = '<div class="h2">탈퇴 처리</div><p>' + esc(m.text) + '</p><div class="inline">' + btn('취소', 'modal-close') + '<span class="grow"></span>' + btn('탈퇴', 'confirm-yes', '', 'btn-secondary is-danger') + '</div>';
    }
    if (m.kind === 'hist') {
      var g = state.gloss.filter(function (x) { return x.id === m.id; })[0];
      body = '<div class="h2">' + esc(g.term) + ' 변경 이력</div><div class="list">' + g.hist.slice().reverse().map(function (x, i) {
        return '<div class="row"><span class="c-m">' + esc(x.at) + '</span><span class="c-fill clip">' + esc(x.who) + ' · ' + esc(x.desc) + '</span>' +
          (i > 0 ? '<span class="c-b">' + btn('되돌리기', 'term-revert', 'data-id="' + g.id + '" data-v="' + (g.hist.length - 1 - i) + '"') + '</span>' : '') + '</div>';
      }).join('') + '</div><div class="inline"><span class="grow"></span>' + btn('닫기', 'modal-close') + '</div>';
    }
    return '<div class="modal-bg"><div class="modal stack">' + body + '</div></div>';
  }

  /* ── 그리기 ── */
  function render() {
    var p = parse();
    var map = { '': vIndex, login: vLogin, home: vHome, post: vPost, glossary: vGlossary, members: vMembers, ops: vOps };
    var fn = map[p.path] || vIndex;
    document.title = SERVICE;
    document.getElementById('root').innerHTML = fn(p.q) + vModal();
  }
  function toast(text) {
    var old = document.getElementById('toast');
    if (old) old.remove();
    var el = document.createElement('div');
    el.className = 'toast';
    el.id = 'toast';
    el.textContent = text;
    document.body.appendChild(el);
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(function () { el.remove(); }, 2000);
  }
  function findG(id) { return state.gloss.filter(function (g) { return g.id === +id; })[0]; }
  function setMember(id, st, why) {
    state.members.forEach(function (m) { if (m.id === +id) { m.st = st; if (why) m.why = why; } });
  }
  function selectedIds() {
    return Object.keys(state.sel).filter(function (k) { return state.sel[k]; }).map(Number);
  }

  var ACT = {
    grade: function (el) { state.form.grade = el.getAttribute('data-v'); render(); },
    'login-user': function () { tryLogin('home?r=user'); },
    'login-admin': function () { tryLogin('home?r=admin'); },
    signup: function () {
      var f = state.form;
      if (!f.nick || !f.pw || !f.grade || !f.link) { state.err = '모든 항목을 입력해 주세요.'; render(); return; }
      state.err = '';
      go('login?tab=signup&s=done');
    },
    search: function () { go('home?r=' + (parse().q.r || 'user') + '&q=' + encodeURIComponent(state.form.q)); },
    seek: function (el) { toast(el.getAttribute('data-v') + ' 시점으로 이동'); },
    'post-hide': function () { toast('숨김 처리했습니다'); },
    'post-redo': function () { toast('재처리를 요청했습니다'); },
    'post-split': function () { toast('병합·분할 화면으로 이동'); },
    'term-add': function () { state.form.tname = ''; state.form.tdesc = ''; state.err = ''; state.modal = { kind: 'term', id: 0 }; render(); },
    'term-edit': function (el) {
      var g = findG(el.getAttribute('data-id'));
      state.form.tname = g.term; state.form.tdesc = g.desc; state.err = '';
      state.modal = { kind: 'term', id: g.id }; render();
    },
    'term-save': function () {
      var f = state.form;
      if (!f.tname.trim() || !f.tdesc.trim()) { state.err = '용어와 설명을 입력해 주세요.'; render(); return; }
      if (state.modal.id) {
        var g = findG(state.modal.id);
        g.term = f.tname.trim(); g.desc = f.tdesc.trim();
        g.hist.push({ at: TODAY, who: '나', desc: g.desc });
      } else {
        state.gloss.unshift({ id: Date.now(), term: f.tname.trim(), type: '기타', desc: f.tdesc.trim(), author: '나', hist: [{ at: TODAY, who: '나', desc: f.tdesc.trim() }] });
      }
      state.modal = null; state.err = ''; render(); toast('저장했습니다');
    },
    'term-del': function (el) {
      var id = +el.getAttribute('data-id');
      state.gloss = state.gloss.filter(function (g) { return g.id !== id; });
      render(); toast('삭제했습니다');
    },
    'term-hist': function (el) { state.modal = { kind: 'hist', id: +el.getAttribute('data-id') }; render(); },
    'term-revert': function (el) {
      var g = findG(el.getAttribute('data-id'));
      var h = g.hist[+el.getAttribute('data-v')];
      g.desc = h.desc; g.hist.push({ at: TODAY, who: '관리자', desc: h.desc });
      state.modal = null; render(); toast('되돌렸습니다');
    },
    'modal-close': function () { state.modal = null; state.err = ''; render(); },
    'm-approve': function (el) { setMember(el.getAttribute('data-id'), 'ok'); render(); toast('승인했습니다'); },
    'm-reject': function (el) { setMember(el.getAttribute('data-id'), 'out', '거절'); render(); toast('거절했습니다'); },
    withdraw: function (el) { state.modal = { kind: 'confirm', ids: [+el.getAttribute('data-id')], text: '선택한 1명을 탈퇴 처리합니다. 탈퇴한 멤버는 다시 가입 신청할 수 있습니다.' }; render(); },
    'withdraw-bulk': function () {
      var ids = selectedIds();
      state.modal = { kind: 'confirm', ids: ids, text: '선택한 ' + ids.length + '명을 탈퇴 처리합니다. 탈퇴한 멤버는 다시 가입 신청할 수 있습니다.' }; render();
    },
    'confirm-yes': function () {
      state.modal.ids.forEach(function (id) { setMember(id, 'out', '탈퇴'); });
      state.sel = {}; state.modal = null; render(); toast('탈퇴 처리했습니다');
    },
    idle: function (el) { state.idle = +el.getAttribute('data-v'); state.sel = {}; render(); },
    'sel-all': function (el) {
      var on = el.checked;
      state.members.forEach(function (m) { if (m.st === 'ok' && daysAgo(m.seen) >= state.idle) state.sel[m.id] = on; });
      render();
    }
  };
  function tryLogin(to) {
    if (!state.form.nick || !state.form.pw) { state.err = '닉네임과 비밀번호를 입력해 주세요.'; render(); return; }
    state.err = '';
    go(to);
  }

  document.addEventListener('click', function (e) {
    var a = e.target.closest('[data-act]');
    if (a && a.tagName !== 'INPUT' && ACT[a.getAttribute('data-act')]) { ACT[a.getAttribute('data-act')](a); return; }
    var n = e.target.closest('[data-go]');
    if (n && !e.target.closest('[data-act]')) { go(n.getAttribute('data-go')); }
  });
  document.addEventListener('change', function (e) {
    var t = e.target;
    if (t.getAttribute && t.getAttribute('data-act') === 'sel-all') { ACT['sel-all'](t); return; }
    if (t.getAttribute && t.getAttribute('data-sel')) { state.sel[t.getAttribute('data-sel')] = t.checked; render(); }
  });
  document.addEventListener('input', function (e) {
    var k = e.target.getAttribute && e.target.getAttribute('data-f');
    if (k) state.form[k] = e.target.value;
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.getAttribute && e.target.getAttribute('data-f') === 'q') ACT.search();
  });
  window.addEventListener('hashchange', function () { state.err = ''; state.modal = null; state.sel = {}; render(); });
  render();
})();
