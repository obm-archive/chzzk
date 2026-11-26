/* 시안 화면 스크립트. 서비스 이름과 화면 구성은 이 파일 맨 위 상수에서만 정의한다. */
(function () {
  'use strict';

  var SERVICE = '치지직로그';
  var TODAY = '2026-11-26';
  var PAGE_SIZE = 10;
  var MOCK_PW = '1234'; // 목업 전용 공통 비밀번호(실서비스는 서버 설정값)
  var CATEGORY = { talk: '토크' };
  var M = window.MOCK;
  var TERM_TYPES = ['닉네임', '밈·유행어', '인물', '게임 용어', '기타'];
  var DETAIL_NO = M.post.video_no;

  var MENU = [
    { key: 'home', label: '홈', icon: 'home', to: 'home' },
    { key: 'search', label: '검색', icon: 'search', to: 'search' },
    { key: 'glossary', label: '용어집', icon: 'book', to: 'glossary' },
    { key: 'me', label: '내 정보', icon: 'user', to: 'me' }
  ];
  var ADMIN_MENU = [
    { key: 'members', label: '멤버 관리', icon: 'users', to: 'members' },
    { key: 'ops', label: '처리 현황', icon: 'pulse', to: 'ops' }
  ];
  var ICONS = {
    home: 'M3 11l9-8 9 8M5 10v10h14V10',
    search: 'M11 4a7 7 0 100 14 7 7 0 000-14zM21 21l-5-5',
    book: 'M4 4h12a4 4 0 014 4v12H8a4 4 0 01-4-4V4z',
    user: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0',
    users: 'M9 12a4 4 0 100-8 4 4 0 000 8zM2 21a7 7 0 0114 0M17 5a4 4 0 010 7M18 14a7 7 0 014 7',
    pulse: 'M3 12h4l3-8 4 16 3-8h4',
    menu: 'M4 6h16M4 12h16M4 18h16'
  };

  var SCREENS = [
    { no: 1, name: '접속', items: [
      ['로그인', 'login'], ['가입 신청', 'login?tab=signup'], ['가입 신청 완료', 'login?tab=signup&s=done'],
      ['승인 대기', 'login?s=pending'], ['승인 거절', 'login?s=rejected'], ['로그인 실패', 'login?s=error']] },
    { no: 2, name: '홈(갤러리)', items: [['사용자', 'home?r=user'], ['카테고리 선택', 'home?r=user&cat=talk'], ['관리자', 'home?r=admin']] },
    { no: 3, name: '검색', items: [
      ['기본', 'search?r=user'], ['검색 결과', 'search?r=user&q=캠핑장'], ['결과 없음', 'search?r=user&q=없는검색어'],
      ['기간·카테고리', 'search?r=user&from=2026-11-20&to=2026-11-26&cat=talk']] },
    { no: 4, name: '방송 상세', items: [['요약 완료 · 사용자', 'post?r=user'], ['요약 완료 · 관리자', 'post?r=admin']] },
    { no: 5, name: '용어집', items: [['사용자', 'glossary?r=user'], ['관리자', 'glossary?r=admin']] },
    { no: 6, name: '내 정보', items: [['사용자', 'me?r=user'], ['관리자', 'me?r=admin']] },
    { no: 7, name: '멤버 관리', items: [['가입 대기', 'members?r=admin&t=pending'], ['승인됨', 'members?r=admin&t=ok'], ['탈퇴·거절', 'members?r=admin&t=out']] },
    { no: 8, name: '처리 현황', items: [['관리자', 'ops?r=admin']] }
  ];

  var LINKED = [
    { label: '1부', no: DETAIL_NO, dur: M.post.duration },
    { label: '2부', no: 16365999, dur: 5400 }
  ];

  var state = {
    form: { nick: '', pw: '', grade: '', link: '', q: '', from: '', to: '', cat: '', tname: '', ttype: '닉네임', tdesc: '' },
    err: '', modal: null, menu: false, sel: {}, idle: 0, toastTimer: null,
    gloss: M.glossary.map(function (g, i) {
      return { id: i + 1, term: g.term, type: g.type, desc: g.desc, author: i % 3 === 0 ? '나' : '회원' + (10 + i) };
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
      { no: 16372880, title: '대기 중인 방송 예시', at: '2026-11-26 21:30:05', st: '대기', cls: '', hidden: false },
      { no: 16372104, title: '처리중인 방송 예시', at: '2026-11-26 19:00:12', st: '처리중', cls: 'is-info', hidden: false },
      { no: 16358201, title: '실패한 방송 예시', at: '2026-11-23 20:10:40', st: '실패', cls: 'is-danger', hidden: false },
      { no: 16365315, title: M.post.title, at: M.post.start, st: '완료', cls: '', hidden: false },
      { no: 16301177, title: '숨김 처리한 방송 예시', at: '2026-11-10 20:00:00', st: '완료', cls: '', hidden: true }
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
  function catLabel(c) { return CATEGORY[c] || c; }
  function icon(name) {
    return '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="' + ICONS[name] + '"/></svg>';
  }
  function btn(label, act, extra, kind) {
    return '<button class="btn ' + (kind || 'btn-secondary') + '" data-act="' + act + '" ' + (extra || '') + '>' + esc(label) + '</button>';
  }
  function rbtn(label, act, id, kind) {
    return '<button class="btn ' + (kind || 'btn-secondary') + ' m-grow" data-act="' + act + '" data-id="' + id + '">' + esc(label) + '</button>';
  }
  function line(inner) { return '<div class="line">' + inner + '</div>'; }
  function ml(label) { return '<span class="m-label">' + esc(label) + '</span>'; }
  function pageOf(list, q) {
    var n = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    var p = Math.min(Math.max(parseInt(q.p || '1', 10) || 1, 1), n);
    return { items: list.slice((p - 1) * PAGE_SIZE, p * PAGE_SIZE), p: p, n: n, total: list.length };
  }
  function pager(pg, base) {
    var h = '<div class="inline pager"><button class="pager-btn" data-go="' + esc(base) + '&p=' + (pg.p - 1) + '"' + (pg.p < 2 ? ' disabled' : '') + '>‹</button>';
    for (var i = 1; i <= pg.n; i++) h += '<button class="pager-btn' + (i === pg.p ? ' on' : '') + '" data-go="' + esc(base) + '&p=' + i + '">' + i + '</button>';
    return h + '<button class="pager-btn" data-go="' + esc(base) + '&p=' + (pg.p + 1) + '"' + (pg.p >= pg.n ? ' disabled' : '') + '>›</button></div>';
  }
  function toolbar(total, picked, action) {
    return '<div class="inline"><span class="small sub grow nowrap">전체 ' + total + '건' + (picked === null ? '' : ' / 선택 ' + picked + '건') + '</span>' + (action || '') + '</div>';
  }
  function selCount(prefix, ids) {
    return ids.filter(function (id) { return state.sel[prefix + id]; }).length;
  }
  function chips(list) {
    return list.map(function (k) { return '<span class="chip">' + esc(k) + '</span>'; }).join('');
  }
  function val(k) { return esc(state.form[k]); }
  function tabs(items, cur) {
    return '<div class="tabs">' + items.map(function (x) {
      return '<button class="tab' + (cur === x[0] ? ' on' : '') + '" data-go="' + esc(x[2]) + '">' + esc(x[1]) + '</button>';
    }).join('') + '</div>';
  }
  function categories() {
    var seen = [];
    M.posts.forEach(function (p) { if (seen.indexOf(p.cat) < 0) seen.push(p.cat); });
    return seen;
  }

  /* ── 공통 틀: 헤더 · 왼쪽 메뉴 · 하단 바 ── */
  function menuItems(cls, cur, r) {
    function link(it) {
      return '<button class="' + cls + (cur === it.key ? ' on' : '') + '" data-go="' + it.to + '?r=' + r + (it.key === 'members' ? '&t=pending' : '') + '">' + icon(it.icon) + esc(it.label) + '</button>';
    }
    var h = MENU.map(link).join('');
    if (r === 'admin') h += '<div class="lnb-title">관리</div>' + ADMIN_MENU.map(link).join('');
    return h;
  }
  function side(cur, r) {
    return menuItems('lnb-link', cur, r) + '<span class="grow"></span><button class="lnb-link" data-go="">화면 목록</button>';
  }
  function profile(r) {
    var nick = state.form.nick || (r === 'admin' ? '관리자' : '회원');
    return nick + ' · ' + (r === 'admin' ? '관리자' : '멤버');
  }
  function shell(cur, r, body) {
    var h = '<header class="header"><button class="menu-btn" data-act="menu-open">' + icon('menu') + '</button>' +
      '<button class="logo" data-go="home?r=' + r + '">' + esc(SERVICE) + '</button><span class="grow"></span>' +
      '<span class="small sub c-hide">' + esc(profile(r)) + '</span><button class="btn btn-secondary" data-go="login">로그아웃</button></header>';
    h += '<div class="body"><nav class="nav lnb">' + side(cur, r) + '</nav><main class="main stack">' + body + '</main></div>';
    h += '<nav class="tabbar">' + MENU.map(function (it) {
      return '<button class="tabbar-item' + (cur === it.key ? ' on' : '') + '" data-go="' + it.to + '?r=' + r + '">' + icon(it.icon) + esc(it.label) + '</button>';
    }).join('') + '</nav>';
    if (state.menu) h += '<div class="modal-bg" data-act="menu-close"></div><nav class="nav drawer">' + side(cur, r) + '</nav>';
    return h;
  }

  /* ── 갤러리 카드 ── */
  function card(p, line, seg) {
    var thumb = p.thumb ? '<img class="g-img" src="' + esc(p.thumb) + '" alt="">' : '';
    return '<button class="g-card" data-go="post?r=' + (parse().q.r || 'user') + '&no=' + p.no + (seg !== undefined ? '&seg=' + seg : '') + '">' +
      '<div class="cap g-thumb">' + thumb + '</div><div class="g-body"><div class="inline fill"><span class="chip">' + esc(catLabel(p.cat)) + '</span>' + (line ? '<span class="xsmall sub end">' + esc(line) + '</span>' : '') + '</div>' +
      '<div class="g-title">' + esc(p.title) + '</div><div class="inline"><span class="xsmall mute nowrap">' + esc(p.date.slice(0, 10)) + '</span><span class="xsmall mute nowrap">' + dur(p.dur) + '</span></div>' +
      '</div></button>';
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
    return '<main class="main stack"><h1 class="title">화면 목록</h1>' +
      '<div class="list"><div class="row row-head"><span class="c-xs">번호</span><span class="c-m">화면</span><span class="c-fill">상태 · 역할</span></div>' +
      rows + '</div></main>';
  }

  /* ── 화면: 접속 ── */
  function vLogin(q) {
    var signup = q.tab === 'signup';
    var h = '<main class="auth"><div class="auth-box"><h1 class="title">' + esc(SERVICE) + '</h1>';
    h += tabs([['login', '로그인', 'login'], ['signup', '가입 신청', 'login?tab=signup']], signup ? 'signup' : 'login');
    if (signup && q.s === 'done') {
      h += '<div class="notice is-info">가입 신청이 접수되었습니다. 승인되면 로그인할 수 있습니다.</div>' +
        '<button class="btn btn-primary fill" data-go="login">로그인으로 이동</button></div></main>';
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
    return h + '</div></main>';
  }

  /* ── 화면: 홈(갤러리) ── */
  function vHome(q) {
    var r = q.r || 'user';
    var cat = q.cat || '';
    var h = '<h1 class="title">방송</h1><div class="inline"><button class="chip' + (!cat ? ' on' : '') + '" data-go="home?r=' + r + '">전체</button>' +
      categories().map(function (c) {
        return '<button class="chip' + (cat === c ? ' on' : '') + '" data-go="home?r=' + r + '&cat=' + encodeURIComponent(c) + '">' + esc(catLabel(c)) + '</button>';
      }).join('') + '</div>';
    var pg = pageOf(M.posts.filter(function (p) { return !cat || p.cat === cat; }), q);
    h += toolbar(pg.total, null);
    h += '<div class="gallery">' + pg.items.map(function (p) { return card(p, ''); }).join('') + '</div>';
    h += pager(pg, 'home?r=' + r + (cat ? '&cat=' + encodeURIComponent(cat) : ''));
    return shell('home', r, h);
  }

  /* ── 화면: 검색 ── */
  function matches(k) {
    k = k.toLowerCase();
    var out = [];
    M.segments.forEach(function (s, i) {
      var t = [s.title, s.summary, s.keywords.join(' '), s.quotes.map(function (x) { return x.text; }).join(' ')].join(' ').toLowerCase();
      if (t.indexOf(k) >= 0) out.push(i);
    });
    return out;
  }
  function vSearch(q) {
    var r = q.r || 'user';
    ['q', 'from', 'to', 'cat'].forEach(function (k) { if (q[k] !== undefined) state.form[k] = q[k]; });
    var f = state.form;
    var searched = !!(q.q || q.from || q.to || q.cat);
    var h = '<h1 class="title">검색</h1><div class="card stack">' +
      '<div class="inline"><div class="field grow"><label class="label">시작일</label><input class="input" type="date" data-f="from" value="' + val('from') + '"></div>' +
      '<div class="field grow"><label class="label">종료일</label><input class="input" type="date" data-f="to" value="' + val('to') + '"></div>' +
      '<div class="field grow"><label class="label">카테고리</label><select class="input" data-f="cat"><option value="">전체</option>' +
      categories().map(function (c) { return '<option value="' + esc(c) + '"' + (f.cat === c ? ' selected' : '') + '>' + esc(catLabel(c)) + '</option>'; }).join('') +
      '</select></div></div>' +
      '<div class="field"><label class="label">키워드</label><input class="input" data-f="q" value="' + val('q') + '" placeholder="이 얘기 언제 했더라?"></div>' +
      '<div class="inline">' + btn('검색', 'search', '', 'btn-primary') + '</div></div>';
    if (searched) {
      var hits = [];
      M.posts.forEach(function (p) {
        if (q.cat && p.cat !== q.cat) return;
        var d = p.date.slice(0, 10);
        if (q.from && d < q.from) return;
        if (q.to && d > q.to) return;
        var segs = [];
        if (q.q) {
          segs = p.no === DETAIL_NO ? matches(q.q) : [];
          if (!segs.length && p.title.toLowerCase().indexOf(q.q.toLowerCase()) < 0) return;
        }
        hits.push({ p: p, segs: segs });
      });
      var pg = pageOf(hits, q);
      h += toolbar(pg.total, null);
      if (!hits.length) h += '<div class="notice">검색 결과가 없습니다. 다른 조건으로 검색해 보세요.</div>';
      else h += '<div class="gallery">' + pg.items.map(function (x) {
        return card(x.p, x.segs.length ? '일치 구간 ' + x.segs.length + '건' : '', x.segs.length ? x.segs[0] : undefined);
      }).join('') + '</div>' + pager(pg, 'search?' + ['r=' + r].concat(['q', 'from', 'to', 'cat'].filter(function (k) { return q[k]; }).map(function (k) { return k + '=' + encodeURIComponent(q[k]); })).join('&'));
    }
    return shell('search', r, h);
  }

  /* ── 화면: 방송 상세 ── */
  function vPost(q) {
    var r = q.r || 'user';
    var no = q.no ? parseInt(q.no, 10) : DETAIL_NO;
    var p = M.posts.filter(function (x) { return x.no === no; })[0] || M.posts[0];
    var focus = q.seg === undefined ? -2 : parseInt(q.seg, 10);
    var h = '<div class="inline"><button class="link" data-go="home?r=' + r + '">← 방송 목록</button><span class="grow"></span>' +
      (r === 'admin' ? btn('숨김', 'post-hide') + btn('재처리', 'post-redo') : '') + '</div>';
    h += '<h1 class="title">' + esc(p.title) + '</h1>';
    h += '<div class="inline"><span class="chip">' + esc(catLabel(p.cat)) + '</span><span class="small sub">' + esc(p.date.slice(0, 16)) + ' · ' + dur(p.dur) + '</span></div>';
    h += '<div class="media md-col"><div class="cap">' + (p.thumb ? '<img class="g-img" src="' + esc(p.thumb) + '" alt="">' : '') + '</div>' +
      '<div class="card stack"><div class="h2">전체 요약</div><p>' + esc(M.post.summary) + '</p><div class="inline">' + chips(M.post.keywords) + '</div></div></div>';
    h += '<div class="h2">연결된 방송</div><div class="list">' + LINKED.map(function (x) {
      return '<div class="row">' + line('<span class="c-s bold">' + esc(x.label) + '</span><span class="c-fill sub">' + dur(x.dur) +
        '</span><span class="c-m"><a class="link" href="https://chzzk.naver.com/video/' + x.no + '" target="_blank" rel="noopener">치지직에서 보기</a></span>') + '</div>';
    }).join('') + '</div>';
    h += '<div class="h2">구간별 요약</div>';
    M.segments.forEach(function (s, i) {
      h += '<div class="card media' + (focus === i ? ' hit' : '') + '"><div class="cap">' +
        '<button class="cap-time" data-act="seek" data-v="' + esc(s.start) + '">' + esc(s.start) + ' – ' + esc(s.end) + '</button></div><div class="stack">' +
        '<div class="bold">' + esc(s.title) + '</div><p class="small sub">' + esc(s.summary) + '</p>' +
        s.quotes.map(function (x) {
          return '<div class="quote"><button class="link" data-act="seek" data-v="' + esc(x.time) + '">' + esc(x.time) + '</button> ' + esc(x.text) + '</div>';
        }).join('') +
        '<div class="inline">' + chips(s.keywords) + '</div></div></div>';
    });
    return shell('', r, h);
  }

  /* ── 화면: 내 정보 ── */
  function vMe(q) {
    var r = q.r || 'user';
    var h = '<h1 class="title">내 정보</h1><div class="card stack">' +
      '<div class="field"><span class="label">닉네임</span><span>' + esc(state.form.nick || (r === 'admin' ? '관리자' : '회원')) + '</span></div>' +
      '<div class="field"><span class="label">권한</span><span>' + (r === 'admin' ? '관리자' : '멤버') + '</span></div>' +
      '<div class="field"><span class="label">최근 접속</span><span>' + TODAY + '</span></div></div>' +
      '<div class="inline"><button class="btn btn-secondary" data-go="login">로그아웃</button></div>';
    return shell('me', r, h);
  }

  /* ── 화면: 용어집 ── */
  function canEditTerm(g, admin) { return admin || g.author === '나'; }
  function vGlossary(q) {
    var r = q.r || 'user';
    var admin = r === 'admin';
    var pg = pageOf(state.gloss, q);
    var ids = pg.items.filter(function (g) { return canEditTerm(g, admin); }).map(function (g) { return g.id; });
    var picked = Object.keys(state.sel).filter(function (k) { return k.charAt(0) === 'g' && state.sel[k]; }).length;
    var h = '<div class="inline"><h1 class="title grow">용어집</h1></div>';
    h += toolbar(pg.total, picked, btn('용어추가', 'term-add', '', 'btn-primary') + btn('선택삭제', 'gdel-bulk', picked ? '' : 'disabled', 'btn-secondary is-danger'));
    h += '<div class="list"><div class="row row-head"><span class="c-xs"><label class="check"><input type="checkbox" data-act="gsel-all"></label></span><span class="c-s">용어</span><span class="c-s">분류</span><span class="c-fill">설명</span>' +
      '<span class="c-s c-hide">작성자</span><span class="c-act">관리</span></div>';
    pg.items.forEach(function (g) {
      var acts = '';
      var can = canEditTerm(g, admin);
      if (can) acts += rbtn('수정', 'term-edit', g.id) + rbtn('삭제', 'term-del', g.id, 'btn-secondary is-danger');
      var box = can ? '<label class="check"><input type="checkbox" data-sel="g' + g.id + '"' + (state.sel['g' + g.id] ? ' checked' : '') + '></label>' : '';
      h += '<div class="row">' + line('<span class="c-xs">' + box + '</span><span class="c-s bold">' + esc(g.term) + '</span><span class="c-s m-end"><span class="chip">' + esc(g.type) + '</span></span>') +
        '<span class="c-fill">' + esc(g.desc) + '</span><span class="c-s c-hide">' + esc(g.author) + '</span><span class="c-act">' + acts + '</span></div>';
    });
    return shell('glossary', r, h + '</div>' + pager(pg, 'glossary?r=' + r));
  }
  function vMembers(q) {
    var t = q.t || 'pending';
    var tabs_ = [['pending', '가입 대기'], ['ok', '승인됨'], ['out', '탈퇴·거절']];
    var h = '<h1 class="title">멤버 관리</h1>' + tabs(tabs_.map(function (x) { return [x[0], x[1], 'members?r=admin&t=' + x[0]]; }), t);
    var list = state.members.filter(function (m) { return m.st === t; });
    if (t === 'ok') {
      h += '<div class="inline">' + [[0, '전체'], [30, '30일 이상 미접속'], [60, '60일 이상 미접속'], [90, '90일 이상 미접속']].map(function (x) {
        return '<button class="chip' + (state.idle === x[0] ? ' on' : '') + '" data-act="idle" data-v="' + x[0] + '">' + x[1] + '</button>';
      }).join('') + '</div>';
      list = list.filter(function (m) { return daysAgo(m.seen) >= state.idle; });
    }
    var pg = pageOf(list, q);
    var picked = Object.keys(state.sel).filter(function (k) { return k.charAt(0) === 'm' && state.sel[k]; }).length;
    var off = picked ? '' : 'disabled';
    h += t === 'ok' ? toolbar(pg.total, picked, btn('선택탈퇴', 'withdraw-bulk', off, 'btn-secondary is-danger')) :
      t === 'pending' ? toolbar(pg.total, picked, btn('선택승인', 'm-approve-bulk', off, 'btn-primary') + btn('선택거절', 'm-reject-bulk', off, 'btn-secondary is-danger')) : toolbar(pg.total, null);
    var head = '';
    if (t === 'pending') head = '<span class="c-xs"><label class="check"><input type="checkbox" data-act="sel-all"></label></span><span class="c-fill">닉네임</span><span class="c-s">가입일</span><span class="c-s">등급 답변</span><span class="c-s">최근 게시물</span><span class="c-act">관리</span>';
    if (t === 'ok') head = '<span class="c-xs"><label class="check"><input type="checkbox" data-act="sel-all"></label></span><span class="c-fill">닉네임</span><span class="c-s">가입일</span><span class="c-m">최근 접속</span><span class="c-act">관리</span>';
    if (t === 'out') head = '<span class="c-fill">닉네임</span><span class="c-s">상태</span><span class="c-s">일자</span>';
    h += '<div class="list"><div class="row row-head">' + head + '</div>';
    if (!list.length) h += '<div class="row mute">해당하는 멤버가 없습니다.</div>';
    pg.items.forEach(function (m) {
      var nick = '<span class="c-fill bold">' + esc(m.nick) + '</span>';
      var row = '';
      if (t === 'pending') {
        row = line('<span class="c-xs"><label class="check"><input type="checkbox" data-sel="m' + m.id + '"' + (state.sel['m' + m.id] ? ' checked' : '') + '></label></span>' + nick + '<span class="c-s m-end">' + esc(m.joined) + '</span>') +
          line(ml('등급 답변') + '<span class="c-s m-end">' + esc(m.grade) + '</span>') +
          line(ml('최근 게시물') + '<span class="c-s m-end"><button class="link" data-act="seek" data-v="링크">링크</button></span>') +
          '<span class="c-act">' + rbtn('승인', 'm-approve', m.id, 'btn-primary') + rbtn('거절', 'm-reject', m.id, 'btn-secondary is-danger') + '</span>';
      }
      if (t === 'ok') {
        row = line('<span class="c-xs"><label class="check"><input type="checkbox" data-sel="m' + m.id + '"' + (state.sel['m' + m.id] ? ' checked' : '') + '></label></span>' + nick + '<span class="c-s m-end">' + esc(m.joined) + '</span>') +
          line(ml('최근 접속') + '<span class="c-m nowrap m-end">' + esc(m.seen) + ' <span class="mute">(' + daysAgo(m.seen) + '일 전)</span></span>') +
          '<span class="c-act">' + rbtn('탈퇴', 'withdraw', m.id, 'btn-secondary is-danger') + '</span>';
      }
      if (t === 'out') {
        row = line(nick + '<span class="c-s m-end"><span class="chip">' + esc(m.why) + '</span></span>') + '<span class="c-s">' + esc(m.seen || m.joined) + '</span>';
      }
      h += '<div class="row">' + row + '</div>';
    });
    return shell('members', 'admin', h + '</div>' + pager(pg, 'members?r=admin&t=' + t));
  }
  function vOps(q) {
    var t = q.t || 'all';
    var h = '<h1 class="title">처리 현황</h1><div class="notice is-warn">네이버 인증 정보가 곧 만료됩니다. 갱신해 주세요.</div>';
    h += tabs([['all', '전체', 'ops?r=admin&t=all'], ['todo', '처리필요', 'ops?r=admin&t=todo'], ['hidden', '숨김', 'ops?r=admin&t=hidden']], t);
    var list = state.ops.filter(function (o) {
      if (t === 'hidden') return o.hidden;
      if (o.hidden) return false;
      return t === 'all' || o.st !== '완료';
    });
    var pg = pageOf(list, q);
    h += toolbar(pg.total, null);
    h += '<div class="list"><div class="row row-head"><span class="c-s">방송 번호</span><span class="c-s">상태</span><span class="c-fill">제목</span><span class="c-m c-hide">시작</span><span class="c-act">관리</span></div>';
    if (!list.length) h += '<div class="row mute">해당하는 방송이 없습니다.</div>';
    pg.items.forEach(function (o) {
      var act = '';
      if (o.hidden) act = rbtn('숨김해제', 'ops-unhide', o.no);
      else if (o.st === '완료' || o.st === '실패') act = rbtn('재처리', 'post-redo', o.no);
      h += '<div class="row">' + line('<span class="c-s">' + o.no + '</span><span class="c-s m-end"><span class="chip ' + o.cls + '">' + o.st + '</span></span>') +
        '<span class="c-fill">' + esc(o.title) + '</span><span class="c-m c-hide">' + esc(o.at.slice(0, 16)) + '</span>' +
        '<span class="c-act">' + act + '</span></div>';
    });
    return shell('ops', 'admin', h + '</div>' + pager(pg, 'ops?r=admin&t=' + t));
  }

  /* ── 모달 ── */
  function vModal() {
    var m = state.modal;
    if (!m) return '';
    var body = '';
    if (m.kind === 'term') {
      body = '<div class="h2">' + (m.id ? '용어 수정' : '용어 추가') + '</div>' +
        '<div class="field"><label class="label">용어 (30자 이내)</label><input class="input" maxlength="30" data-f="tname" value="' + val('tname') + '"></div>' +
        '<div class="field"><label class="label">분류</label><select class="input" data-f="ttype">' + TERM_TYPES.map(function (x) { return '<option' + (state.form.ttype === x ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join('') + '</select></div>' +
        '<div class="field"><label class="label">설명 (200자 이내)</label><textarea class="textarea" maxlength="200" data-f="tdesc">' + val('tdesc') + '</textarea></div>' +
        (state.err ? '<div class="notice is-danger">' + esc(state.err) + '</div>' : '') +
        '<div class="inline">' + btn('취소', 'modal-close') + '<span class="grow"></span>' + btn('저장', 'term-save', '', 'btn-primary') + '</div>';
    }
    if (m.kind === 'confirm') {
      body = '<div class="h2">' + esc(m.title) + '</div><p>' + esc(m.text) + '</p><div class="inline">' + btn('취소', 'modal-close') + '<span class="grow"></span>' + btn(m.yes, 'confirm-yes', '', 'btn-secondary is-danger') + '</div>';
    }
    return '<div class="modal-bg"><div class="modal stack">' + body + '</div></div>';
  }

  /* ── 그리기 ── */
  function render() {
    var p = parse();
    var map = { '': vIndex, login: vLogin, home: vHome, search: vSearch, me: vMe, post: vPost, glossary: vGlossary, members: vMembers, ops: vOps };
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
  function selectedIds(prefix) {
    return Object.keys(state.sel).filter(function (k) { return k.charAt(0) === prefix && state.sel[k]; }).map(function (k) { return +k.slice(1); });
  }

  var ACT = {
    grade: function (el) { state.form.grade = el.getAttribute('data-v'); render(); },
    'login-user': function () { tryLogin('home?r=user'); },
    'login-admin': function () { tryLogin('home?r=admin'); },
    signup: function () {
      var f = state.form;
      if (!f.nick || !f.pw || !f.grade || !f.link) { state.err = '모든 항목을 입력해 주세요.'; render(); return; }
      if (f.pw !== MOCK_PW) { state.err = '비밀번호가 올바르지 않습니다.'; render(); return; }
      var dup = state.members.some(function (m) { return m.nick === f.nick && (m.st === 'pending' || m.st === 'ok'); });
      if (dup) { state.err = '이미 사용 중인 닉네임입니다.'; render(); return; }
      state.err = '';
      go('login?tab=signup&s=done');
    },
    search: function () {
      var f = state.form, p = ['r=' + (parse().q.r || 'user')];
      ['q', 'from', 'to', 'cat'].forEach(function (k) { if (f[k]) p.push(k + '=' + encodeURIComponent(f[k])); });
      go('search?' + p.join('&'));
    },
    'menu-open': function () { state.menu = true; render(); },
    'menu-close': function () { state.menu = false; render(); },
    seek: function (el) { toast(el.getAttribute('data-v') + ' 시점으로 이동'); },
    'post-hide': function () { toast('숨김 처리했습니다'); },
    'post-redo': function () { toast('재처리를 요청했습니다'); },
    'ops-unhide': function (el) {
      var no = +el.getAttribute('data-id');
      state.ops.forEach(function (o) { if (o.no === no) o.hidden = false; });
      render(); toast('숨김을 해제했습니다');
    },
    'term-add': function () { state.form.tname = ''; state.form.ttype = TERM_TYPES[0]; state.form.tdesc = ''; state.err = ''; state.modal = { kind: 'term', id: 0 }; render(); },
    'term-edit': function (el) {
      var g = findG(el.getAttribute('data-id'));
      state.form.tname = g.term; state.form.ttype = g.type; state.form.tdesc = g.desc; state.err = '';
      state.modal = { kind: 'term', id: g.id }; render();
    },
    'term-save': function () {
      var f = state.form;
      if (!f.tname.trim() || !f.tdesc.trim()) { state.err = '용어와 설명을 입력해 주세요.'; render(); return; }
      if (state.modal.id) {
        var g = findG(state.modal.id);
        g.term = f.tname.trim(); g.type = f.ttype; g.desc = f.tdesc.trim();
      } else {
        state.gloss.unshift({ id: Date.now(), term: f.tname.trim(), type: f.ttype, desc: f.tdesc.trim(), author: '나' });
      }
      state.modal = null; state.err = ''; render(); toast('저장했습니다');
    },
    'term-del': function (el) {
      var id = +el.getAttribute('data-id');
      state.gloss = state.gloss.filter(function (g) { return g.id !== id; });
      render(); toast('삭제했습니다');
    },
    'modal-close': function () { state.modal = null; state.err = ''; render(); },
    'm-approve': function (el) { setMember(el.getAttribute('data-id'), 'ok'); render(); toast('승인했습니다'); },
    'm-approve-bulk': function () { selectedIds('m').forEach(function (id) { setMember(id, 'ok'); }); state.sel = {}; render(); toast('선택한 멤버를 승인했습니다'); },
    'm-reject-bulk': function () { selectedIds('m').forEach(function (id) { setMember(id, 'out', '거절'); }); state.sel = {}; render(); toast('선택한 멤버를 거절했습니다'); },
    'm-reject': function (el) { setMember(el.getAttribute('data-id'), 'out', '거절'); render(); toast('거절했습니다'); },
    withdraw: function (el) { state.modal = { kind: 'confirm', what: 'member', title: '탈퇴 처리', yes: '탈퇴', ids: [+el.getAttribute('data-id')], text: '선택한 1명을 탈퇴 처리합니다. 탈퇴한 멤버는 다시 가입 신청할 수 있습니다.' }; render(); },
    'withdraw-bulk': function () {
      var ids = selectedIds('m');
      state.modal = { kind: 'confirm', what: 'member', title: '탈퇴 처리', yes: '탈퇴', ids: ids, text: '선택한 ' + ids.length + '명을 탈퇴 처리합니다. 탈퇴한 멤버는 다시 가입 신청할 수 있습니다.' }; render();
    },
    'gdel-bulk': function () {
      var ids = selectedIds('g');
      state.modal = { kind: 'confirm', what: 'term', title: '용어 삭제', yes: '삭제', ids: ids, text: '선택한 ' + ids.length + '건을 삭제합니다.' }; render();
    },
    'confirm-yes': function () {
      var m = state.modal;
      if (m.what === 'member') m.ids.forEach(function (id) { setMember(id, 'out', '탈퇴'); });
      else state.gloss = state.gloss.filter(function (g) { return m.ids.indexOf(g.id) < 0; });
      state.sel = {}; state.modal = null; render(); toast(m.what === 'member' ? '탈퇴 처리했습니다' : '삭제했습니다');
    },
    idle: function (el) { state.idle = +el.getAttribute('data-v'); state.sel = {}; render(); },
    'sel-all': function (el) {
      var on = el.checked, q = parse().q;
      var tb = q.t || 'pending';
      var rows = state.members.filter(function (m) { return m.st === tb && (tb !== 'ok' || daysAgo(m.seen) >= state.idle); });
      pageOf(rows, q).items.forEach(function (m) { state.sel['m' + m.id] = on; });
      render();
    },
    'gsel-all': function (el) {
      var on = el.checked, q = parse().q, admin = q.r === 'admin';
      pageOf(state.gloss, q).items.forEach(function (g) { if (canEditTerm(g, admin)) state.sel['g' + g.id] = on; });
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
    var an = t.getAttribute && t.getAttribute('data-act');
    if (an === 'sel-all' || an === 'gsel-all') { ACT[an](t); return; }
    if (t.getAttribute && t.getAttribute('data-sel')) { state.sel[t.getAttribute('data-sel')] = t.checked; render(); }
  });
  document.addEventListener('input', function (e) {
    var k = e.target.getAttribute && e.target.getAttribute('data-f');
    if (k) state.form[k] = e.target.value;
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.getAttribute && e.target.getAttribute('data-f') === 'q') ACT.search();
  });
  window.addEventListener('hashchange', function () { state.menu = false; state.err = ''; state.modal = null; state.sel = {}; render(); });
  render();
})();
