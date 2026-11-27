(function () {
  'use strict';
  var G = window.GUIDE;
  var app = document.getElementById('app');
  var ZOOM = [50, 75, 100, 150, 200, 250, 300];
  var state = { zoom: 2, dev: window.matchMedia('(max-width: 768px)').matches ? 'mo' : 'pc', menu: false, sOpen: false, hits: null, cur: -1 };
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
  function flat(v) { return Array.isArray(v) ? v : [v]; }
  function lines(v) {
    return Array.isArray(v) ? v.map(function (t) { return '<div class="li">' + esc(t) + '</div>'; }).join('') : esc(v);
  }
  function table(b) {
    var many = b.head.length > 2;
    return '<div class="defs">' + b.rows.map(function (r) {
      return '<div class="def"><div class="bold">' + esc(r[0]) + '</div>' + r.slice(1).map(function (t, i) {
        return '<div>' + (many ? '<span class="def-l">' + esc(b.head[i + 1]) + '</span>' : '') + lines(t) + '</div>';
      }).join('') + '</div>';
    }).join('') + '</div>';
  }
  function log(b) {
    return '<div class="defs">' + b.rows.map(function (r) {
      return '<div class="def"><div class="def-top"><span class="bold">' + esc(r[0]) + '</span><span class="sub">' + esc(r[1]) + '</span></div><div>' + esc(r[2]) + '</div></div>';
    }).join('') + '</div>';
  }
  function sections(blocks) {
    var out = [], title = '';
    blocks.forEach(function (b) {
      if (b.t === 'h3') { title = '<h3 class="bold">' + esc(b.text) + '</h3>'; return; }
      out.push('<div class="sect">' + title + block(b) + '</div>'); title = '';
    });
    return '<div class="sects">' + out.join('') + '</div>';
  }
  function pagesList() {
    var h = '<div class="defs">';
    G.groups.forEach(function (g) {
      g.pages.forEach(function (p) {
        if (!p[2]) return;
        h += '<div class="def"><div><button class="link bold" data-go="' + p[0] + '">' + esc(p[1]) + '</button></div><div>' + esc(p[2]) + '</div></div>';
      });
    });
    return h + '</div>';
  }
  function block(b) {
    if (b.t === 'p') return '<p>' + esc(b.text) + '</p>';
    if (b.t === 'h3') return '<h3 class="bold">' + esc(b.text) + '</h3>';
    if (b.t === 'table') return table(b);
    if (b.t === 'log') return log(b);
    if (b.t === 'pages') return pagesList();
    return '';
  }
  function plain(b) {
    if (b.t === 'p' || b.t === 'h3') return [b.text];
    if (b.t === 'table') return b.head.concat([].concat.apply([], b.rows.map(function (r) { return [].concat.apply([], r.map(flat)); })));
    if (b.t === 'log') return [].concat.apply([], b.rows);
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
      return '<button class="chip' + (state.dev === d[0] ? ' on' : '') + '" data-dev="' + d[0] + '">' + d[1] + '</button>';
    }).join('') + '</span>';
  }
  function tabsBar(id, cur) {
    return '<div class="tabs tabs-end">' + TABS.map(function (t) {
      return '<button class="tab' + (t[0] === cur ? ' on' : '') + '" data-go="' + id + '/' + t[0] + '">' + t[1] + '</button>';
    }).join('') + '</div>';
  }

  function picture(img, cls) {
    return '<img class="ui-img' + (cls ? ' ' + cls : '') + ' ui-' + state.dev + '" src="img/' + img + '-' + state.dev + '.webp" alt="' + esc(img) + '">';
  }
  function accordion(items, open, base) {
    return items.map(function (it) {
      var on = it.id === open;
      return '<div class="acc"><button class="acc-head' + (on ? ' acc-open' : '') + '" data-go="' + base + '/' + (on ? '_' : it.id) + '"><span class="acc-mark">' + (on ? '−' : '+') + '</span><span class="grow">' + esc(it.label) + '</span></button>' +
        (on ? '<div class="acc-body pad flow">' + picture(it.img, 'ui-inline') + sections(it.blocks) + '</div>' : '') + '</div>';
    }).join('');
  }
  function pane(img, body) {
    return '<div class="pane">' +
      '<div class="panel ui-side"><div class="bar inline"><span class="grow">화면 UI</span>' + devSwitch() + '</div><div class="scroll pad zoom-' + ZOOM[state.zoom] + '">' + picture(img, '') + '</div>' +
      '<div class="foot"><button class="chip" data-zoom="-1"' + (state.zoom === 0 ? ' disabled' : '') + ' aria-label="축소">−</button><span class="zoom-val">' + ZOOM[state.zoom] + '%</span><button class="chip" data-zoom="1"' + (state.zoom === ZOOM.length - 1 ? ' disabled' : '') + ' aria-label="확대">+</button></div></div>' +
      '<div class="panel">' + body + '</div></div>';
  }
  function introView(r) {
    var items = G.intro.map(function (s, i) { return { id: 's' + i, label: s.title, img: 'intro-home', blocks: s.blocks }; });
    var open = r.tab === '_' ? '' : (items.filter(function (i) { return i.id === r.tab; })[0] || items[0]).id;
    return '<div class="doc"><div class="doc-top doc-solo"><h1 class="title">소개</h1></div>' +
      pane('intro-home', '<div class="bar">목차</div><div class="scroll">' + accordion(items, open, 'intro') + '</div>') + '</div>';
  }
  function pageView(r) {
    var p = G.pages[r.id], top = '<div class="doc-top"><h1 class="title">' + esc(label(r.id)) + '</h1>';
    if (!p) return '<div class="doc">' + top + '</div><div class="notice">이 화면의 기능정의는 아직 작성하지 않았습니다.</div></div>';
    var tab = TABS.some(function (t) { return t[0] === r.tab; }) ? r.tab : 'overview';
    var items = tab === 'spec' ? p.spec : tab === 'cases' ? p.cases : null, open = '', img, body;
    if (items) {
      open = r.sub === '_' ? '' : (items.filter(function (i) { return i.id === r.sub; })[0] || items[0]).id;
      img = (items.filter(function (i) { return i.id === open; })[0] || items[0]).img;
      body = '<div class="scroll">' + accordion(items, open, r.id + '/' + tab) + '</div>';
    } else {
      img = p.overview.img;
      body = '<div class="scroll pad flow">' + picture(img, 'ui-inline') + sections(tab === 'overview' ? p.overview.blocks : p.data.blocks) + '</div>';
    }
    return '<div class="doc">' + top + tabsBar(r.id, tab) + '</div>' + pane(img, '<div class="bar">' + tabLabel(tab) + '</div>' + body) + '</div>';
  }

  /* 메뉴 */
  function nav(id) {
    var h = '';
    G.groups.forEach(function (g, i) {
      if (i) h += '<div class="lnb-sep"></div>';
      g.pages.forEach(function (p) {
        h += '<button class="lnb-link' + (p[0] === id ? ' on' : '') + (p[0] === 'intro' || G.pages[p[0]] ? '' : ' mute') + '" data-go="' + p[0] + '">' + esc(p[1]) + '</button>';
      });
    });
    return h;
  }

  /* 검색 */
  function units() {
    var u = [];
    G.intro.forEach(function (s, i) { u.push({ go: 'intro/s' + i, where: '소개 · ' + s.title, texts: [s.title].concat(texts(s.blocks)) }); });
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
  function find(q) {
    var words = q.trim().toLowerCase().split(/\s+/).filter(Boolean), out = [];
    if (!words.length) return out;
    units().forEach(function (u) {
      var all = u.texts.join(' ').toLowerCase();
      if (!words.every(function (w) { return all.indexOf(w) >= 0; })) return;
      var hit = u.texts.filter(function (t) { return t.toLowerCase().indexOf(words[0]) >= 0; })[0] || u.texts[0];
      out.push({ go: u.go, where: u.where, snip: snippet(hit, words) });
    });
    return out;
  }
  function showList(q) {
    var box = document.getElementById('sl');
    if (!box) return;
    if (!q.trim()) { state.hits = null; box.innerHTML = ''; return; }
    var all = find(q); state.hits = all; state.cur = -1;
    if (!state.hits.length) { box.innerHTML = '<div class="search-list"><div class="pad sub">검색 결과가 없습니다.</div></div>'; return; }
    box.innerHTML = '<div class="search-list"><div class="pad sub">검색 결과 전체 ' + all.length + '건</div>' + state.hits.map(function (r, i) {
      return '<button class="row fill found" data-i="' + i + '"><span class="c-fill"><span class="bold">' + esc(r.where) + '</span><br><span class="sub">' + r.snip + '</span></span></button>';
    }).join('') + '</div>';
  }
  function closeList() { state.hits = null; var box = document.getElementById('sl'); if (box) box.innerHTML = ''; }
  function moveCur(d) {
    if (!state.hits || !state.hits.length) return;
    state.cur = (state.cur + d + state.hits.length) % state.hits.length;
    var rows = document.querySelectorAll('#sl .found');
    Array.prototype.forEach.call(rows, function (el, i) { el.classList.toggle('act', i === state.cur); });
    if (rows[state.cur]) rows[state.cur].scrollIntoView({ block: 'nearest' });
  }
  function open(i) {
    var h = state.hits && state.hits[i];
    if (!h) return;
    state.sOpen = false; state.hits = null;
    var q = document.getElementById('q'); if (q) q.value = '';
    if (location.hash === '#/' + h.go) render(); else location.hash = '#/' + h.go;
  }

  /* 렌더 */
  function header() {
    var input = '<input class="input" id="q" placeholder="키워드 검색" autocomplete="off"><span id="sl"></span>';
    if (state.sOpen) return '<header class="header"><span class="search search-open">' + input + '</span><button class="btn btn-secondary" data-act="sclose">닫기</button></header>';
    return '<header class="header"><button class="menu-btn" data-act="menu" aria-label="메뉴">☰</button><button class="logo" data-go="intro">' + esc(G.title) + '</button><span class="grow"></span>' +
      '<span class="search">' + input + '</span><button class="btn btn-secondary search-btn" data-act="sopen">검색</button></header>';
  }
  function render() {
    var r = route(), q = document.getElementById('q'), keep = q ? q.value : '';
    app.innerHTML = '<div class="fixed">' + header() + '<div class="fit"><nav class="nav lnb">' + nav(r.id) + '</nav>' + (r.id === 'intro' ? introView(r) : pageView(r)) + '</div></div>' +
      (state.menu ? '<div class="modal-bg" data-act="menu"></div><nav class="nav drawer">' + nav(r.id) + '</nav>' : '');
    var nq = document.getElementById('q');
    if (nq) { nq.value = keep; if (state.sOpen) nq.focus(); }
    state.hits = null;
    document.title = (r.id === 'intro' ? '소개' : label(r.id)) + ' | ' + G.title;
    if (r.id !== lastPage) { lastPage = r.id; try { window.scrollTo(0, 0); } catch (e) { /* noop */ } }
  }

  document.addEventListener('click', function (e) {
    var it = e.target.closest('#sl [data-i]');
    if (it) { open(+it.getAttribute('data-i')); return; }
    var a = e.target.closest('[data-act]');
    if (a) {
      var k = a.getAttribute('data-act');
      if (k === 'menu') { state.menu = !state.menu; render(); return; }
      if (k === 'sopen') { state.sOpen = true; render(); return; }
      if (k === 'sclose') { state.sOpen = false; render(); return; }
    }
    var z = e.target.closest('[data-zoom]');
    if (z && !z.disabled) { state.zoom = Math.max(0, Math.min(ZOOM.length - 1, state.zoom + (+z.getAttribute('data-zoom')))); render(); return; }
    var d = e.target.closest('[data-dev]');
    if (d) { state.dev = d.getAttribute('data-dev'); render(); return; }
    var n = e.target.closest('[data-go]');
    if (n) { state.menu = false; state.sOpen = false; location.hash = '#/' + n.getAttribute('data-go'); }
  });
  document.addEventListener('mousedown', function (e) { if (state.hits && !e.target.closest('#sl, #q')) closeList(); });
  document.addEventListener('input', function (e) { if (e.target.id === 'q') showList(e.target.value); });
  document.addEventListener('focusin', function (e) { if (e.target.id === 'q' && e.target.value.trim() && !state.hits) showList(e.target.value); });
  document.addEventListener('keydown', function (e) {
    if (e.target.id !== 'q') return;
    if (e.key === 'ArrowDown') { e.preventDefault(); moveCur(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); moveCur(-1); }
    else if (e.key === 'Enter') { if (state.hits) open(state.cur >= 0 ? state.cur : 0); }
    else if (e.key === 'Escape') closeList();
  });
  window.addEventListener('hashchange', function () { render(); });
  render();
})();
