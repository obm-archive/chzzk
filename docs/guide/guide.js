(function () {
  'use strict';
  var G = window.GUIDE;
  var app = document.getElementById('app');
  var state = { dev: 'pc', menu: false, sOpen: false, modal: null };
  var TABS = [['overview', '개요'], ['spec', '기능정의'], ['cases', '예외상황'], ['data', '데이터']];
  var DEV = [['pc', 'PC'], ['tab', '태블릿'], ['mo', '모바일']];
  var lastPage = '';

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function label(id) {
    for (var i = 0; i < G.groups.length; i++) for (var j = 0; j < G.groups[i].pages.length; j++) if (G.groups[i].pages[j][0] === id) return G.groups[i].pages[j][1];
    return '';
  }
  function route() {
    var p = location.hash.replace(/^#\/?/, '').split('/');
    return { id: p[0] || 'intro', tab: p[1] || 'overview', sub: p[2] || '' };
  }
  function tabLabel(k) { return TABS.filter(function (t) { return t[0] === k; })[0][1]; }

  /* 블록 */
  function table(b) {
    var h = '<div class="list"><div class="row row-head">' + b.head.map(function (t, i) { return '<span class="' + b.w[i] + '">' + esc(t) + '</span>'; }).join('') + '</div>';
    b.rows.forEach(function (r) {
      h += '<div class="row">' + r.map(function (t, i) { return '<span class="' + b.w[i] + (i === 0 ? ' bold' : '') + '">' + esc(t) + '</span>'; }).join('') + '</div>';
    });
    return h + '</div>';
  }
  function pagesList() {
    var h = '<div class="list"><div class="row row-head"><span class="c-m">화면</span><span class="c-fill">설명</span></div>';
    G.groups.forEach(function (g) {
      g.pages.forEach(function (p) {
        if (!p[2]) return;
        h += '<div class="row"><span class="c-m"><button class="link bold" data-go="' + p[0] + '">' + esc(p[1]) + '</button></span><span class="c-fill">' + esc(p[2]) + '</span></div>';
      });
    });
    return h + '</div>';
  }
  function block(b) {
    if (b.t === 'p') return '<p>' + esc(b.text) + '</p>';
    if (b.t === 'h3') return '<h3 class="bold">' + esc(b.text) + '</h3>';
    if (b.t === 'table') return table(b);
    if (b.t === 'pages') return pagesList();
    return '';
  }
  function plain(b) {
    if (b.t === 'p' || b.t === 'h3') return [b.text];
    if (b.t === 'table') return b.head.concat([].concat.apply([], b.rows));
    return [];
  }
  function texts(blocks) { return [].concat.apply([], blocks.map(plain)); }

  /* 화면 구성 */
  function chips(items, cur, base) {
    return items.map(function (it) {
      return '<button class="chip' + (it.id === cur ? ' on' : '') + '" data-go="' + base + '/' + it.id + '">' + esc(it.label) + '</button>';
    }).join('');
  }
  function devSwitch() {
    return '<span class="inline">' + DEV.map(function (d) {
      return '<button class="btn btn-secondary' + (state.dev === d[0] ? ' on' : '') + '" data-dev="' + d[0] + '">' + d[1] + '</button>';
    }).join('') + '</span>';
  }
  function ui(img) {
    return '<div class="ui-frame"><img class="ui-img ui-' + state.dev + '" src="img/' + img + '-' + state.dev + '.webp" alt="' + esc(img) + '"></div>';
  }

  function introView() {
    var h = '<h1 class="title">' + esc(G.title) + '</h1>';
    G.intro.forEach(function (s) { h += '<section class="card stack"><h2 class="h2">' + esc(s.title) + '</h2>' + s.blocks.map(block).join('') + '</section>'; });
    return h;
  }
  function pageView(r) {
    var p = G.pages[r.id], h = '<h1 class="title">' + esc(label(r.id)) + '</h1>';
    if (!p) return h + '<div class="notice">이 화면의 기능정의는 아직 작성하지 않았습니다.</div>';
    var tab = TABS.some(function (t) { return t[0] === r.tab; }) ? r.tab : 'overview';
    h += '<div class="inline"><a class="link small" href="../mockup/#/' + esc(p.mock) + '">목업에서 이 화면 보기</a></div>';
    h += '<div class="stick"><div class="tabs">' + TABS.map(function (t) {
      return '<button class="tab' + (t[0] === tab ? ' on' : '') + '" data-go="' + r.id + '/' + t[0] + '">' + t[1] + '</button>';
    }).join('') + '</div></div>';

    var items = tab === 'spec' ? p.spec : tab === 'cases' ? p.cases : null, cur = null, img, blocks, title;
    if (items) {
      cur = items.filter(function (i) { return i.id === r.sub; })[0] || items[0];
      img = cur.img; blocks = cur.blocks; title = cur.label;
    } else if (tab === 'overview') { img = p.overview.img; blocks = p.overview.blocks; title = '개요'; }
    else { blocks = p.data.blocks; title = '데이터'; }

    if (tab !== 'data') {
      h += '<div class="inline">' + (items ? chips(items, cur.id, r.id + '/' + tab) : '') + '<span class="grow"></span>' + devSwitch() + '</div>';
      h += '<div class="pane md-col">' + ui(img) + '<section class="card stack"><h2 class="h2">' + esc(title) + '</h2>' + blocks.map(block).join('') + '</section></div>';
    } else {
      h += '<section class="card stack"><h2 class="h2">' + esc(title) + '</h2>' + blocks.map(block).join('') + '</section>';
    }
    return h;
  }

  /* 메뉴 */
  function nav(id) {
    var h = '';
    G.groups.forEach(function (g) {
      h += '<div class="lnb-title">' + esc(g.name) + '</div>';
      g.pages.forEach(function (p) {
        h += '<button class="lnb-link' + (p[0] === id ? ' on' : '') + (p[0] === 'intro' || G.pages[p[0]] ? '' : ' mute') + '" data-go="' + p[0] + '">' + esc(p[1]) + '</button>';
      });
    });
    return h;
  }

  /* 검색 */
  function units() {
    var u = [];
    G.intro.forEach(function (s) { u.push({ go: 'intro', where: '소개 · ' + s.title, texts: [s.title].concat(texts(s.blocks)) }); });
    Object.keys(G.pages).forEach(function (id) {
      var p = G.pages[id], L = label(id);
      u.push({ go: id + '/overview', where: L + ' · 개요', texts: texts(p.overview.blocks) });
      p.spec.forEach(function (s) { u.push({ go: id + '/spec/' + s.id, where: L + ' · 기능정의 · ' + s.label, texts: [s.label].concat(texts(s.blocks)) }); });
      p.cases.forEach(function (s) { u.push({ go: id + '/cases/' + s.id, where: L + ' · 예외상황 · ' + s.label, texts: [s.label].concat(texts(s.blocks)) }); });
      u.push({ go: id + '/data', where: L + ' · 데이터', texts: texts(p.data.blocks) });
    });
    return u;
  }
  function snippet(t, words) {
    var lo = t.toLowerCase(), at = lo.indexOf(words[0]), from = Math.max(0, at - 20), s = t.slice(from, from + 90), h = esc(s);
    words.forEach(function (w) { h = h.replace(new RegExp(esc(w).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), function (m) { return '<span class="bold">' + m + '</span>'; }); });
    return (from > 0 ? '…' : '') + h + (from + 90 < t.length ? '…' : '');
  }
  function runSearch(q) {
    q = q.trim();
    if (!q) return;
    var words = q.toLowerCase().split(/\s+/).filter(Boolean), out = [];
    units().forEach(function (u) {
      var all = u.texts.join(' ').toLowerCase();
      if (!words.every(function (w) { return all.indexOf(w) >= 0; })) return;
      var hit = u.texts.filter(function (t) { return t.toLowerCase().indexOf(words[0]) >= 0; })[0] || u.texts[0];
      out.push({ go: u.go, where: u.where, snip: snippet(hit, words) });
    });
    state.modal = { q: q, list: out };
    render();
  }
  function modal() {
    if (!state.modal) return '';
    var m = state.modal, h = '<div class="modal-bg" data-act="bg"><div class="modal stack"><div class="inline"><h2 class="h2 grow">검색 결과</h2><button class="btn btn-secondary" data-act="close">닫기</button></div>' +
      '<div class="small sub">"' + esc(m.q) + '" 전체 ' + m.list.length + '건</div>';
    if (!m.list.length) h += '<div class="notice">검색 결과가 없습니다. 다른 키워드로 검색해 보세요.</div>';
    else {
      h += '<div class="list">';
      m.list.forEach(function (r) { h += '<button class="row fill" data-go="' + r.go + '"><span class="c-fill"><span class="bold">' + esc(r.where) + '</span><br><span class="sub">' + r.snip + '</span></span></button>'; });
      h += '</div>';
    }
    return h + '</div></div>';
  }

  /* 렌더 */
  function header() {
    if (state.sOpen) return '<header class="header"><span class="grow"><input class="input" id="q" placeholder="키워드 검색" autocomplete="off"></span><button class="btn btn-secondary" data-act="search">검색</button><button class="btn btn-secondary" data-act="sclose">닫기</button></header>';
    return '<header class="header"><button class="menu-btn" data-act="menu" aria-label="메뉴">☰</button><button class="logo" data-go="intro">' + esc(G.title) + '</button><span class="grow"></span>' +
      '<span class="search"><input class="input" id="q" placeholder="키워드 검색" autocomplete="off"><button class="btn btn-secondary" data-act="search">검색</button></span>' +
      '<button class="btn btn-secondary search-btn" data-act="sopen">검색</button></header>';
  }
  function render() {
    var r = route(), q = document.getElementById('q'), keep = q ? q.value : '';
    app.innerHTML = header() + '<div class="body"><nav class="nav lnb">' + nav(r.id) + '</nav><main class="main stack">' + (r.id === 'intro' ? introView() : pageView(r)) + '</main></div>' +
      (state.menu ? '<div class="modal-bg" data-act="menu"></div><nav class="nav drawer">' + nav(r.id) + '</nav>' : '') + modal();
    var nq = document.getElementById('q');
    if (nq) { nq.value = keep; if (state.sOpen) nq.focus(); }
    document.title = (r.id === 'intro' ? '소개' : label(r.id)) + ' | ' + G.title;
    if (r.id !== lastPage) { lastPage = r.id; try { window.scrollTo(0, 0); } catch (e) { /* noop */ } }
  }

  document.addEventListener('click', function (e) {
    var a = e.target.closest('[data-act]');
    if (a) {
      var k = a.getAttribute('data-act');
      if (k === 'bg') { if (e.target === a) { state.modal = null; render(); } return; }
      if (k === 'close') { state.modal = null; render(); return; }
      if (k === 'menu') { state.menu = !state.menu; render(); return; }
      if (k === 'sopen') { state.sOpen = true; render(); return; }
      if (k === 'sclose') { state.sOpen = false; render(); return; }
      if (k === 'search') { runSearch(document.getElementById('q').value); return; }
    }
    var d = e.target.closest('[data-dev]');
    if (d) { state.dev = d.getAttribute('data-dev'); render(); return; }
    var n = e.target.closest('[data-go]');
    if (n) { state.menu = false; state.modal = null; state.sOpen = false; location.hash = '#/' + n.getAttribute('data-go'); }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.id === 'q') runSearch(e.target.value);
    if (e.key === 'Escape' && state.modal) { state.modal = null; render(); }
  });
  window.addEventListener('hashchange', function () { render(); });
  render();
})();
