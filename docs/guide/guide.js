(function () {
  'use strict';
  var G = window.GUIDE;
  var app = document.getElementById('app');
  var state = { menu: false, q: '' };
  var DEV = [['pc', 'PC'], ['tab', '태블릿'], ['mo', '모바일']];

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function label(id) {
    for (var i = 0; i < G.groups.length; i++) for (var j = 0; j < G.groups[i].pages.length; j++) if (G.groups[i].pages[j][0] === id) return G.groups[i].pages[j][1];
    return '';
  }
  function route() {
    var p = location.hash.replace(/^#\/?/, '').split('/');
    return { id: p[0] || 'members', sec: p[1] || '' };
  }

  /* 블록 → HTML / 검색용 평문 */
  function table(b) {
    var h = '<div class="list"><div class="row row-head">' + b.head.map(function (t, i) { return '<span class="' + b.w[i] + '">' + esc(t) + '</span>'; }).join('') + '</div>';
    b.rows.forEach(function (r) {
      h += '<div class="row">' + r.map(function (t, i) { return '<span class="' + b.w[i] + (i === 0 ? ' bold' : '') + '">' + esc(t) + '</span>'; }).join('') + '</div>';
    });
    return h + '</div>';
  }
  function shots(b) {
    var h = '<div class="stack"><div class="shots">' + DEV.map(function (d) {
      return '<figure class="shot shot-' + d[0] + '"><img class="shot-img" src="img/' + b.name + '-' + d[0] + '.webp" alt="' + esc(b.caption + ' ' + d[1]) + '" loading="lazy"><figcaption class="xsmall mute">' + d[1] + '</figcaption></figure>';
    }).join('') + '</div><p class="small sub">' + esc(b.caption) + '</p></div>';
    return h;
  }
  function block(b) {
    if (b.t === 'p') return '<p>' + esc(b.text) + '</p>';
    if (b.t === 'h3') return '<h3 class="bold">' + esc(b.text) + '</h3>';
    if (b.t === 'table') return table(b);
    if (b.t === 'shots') return shots(b);
    if (b.t === 'notice') return '<div class="notice is-warn">' + b.items.map(function (t) { return '<div>· ' + esc(t) + '</div>'; }).join('') + '</div>';
    return '';
  }
  function plain(b) {
    if (b.t === 'p' || b.t === 'h3') return [b.text];
    if (b.t === 'table') return b.head.concat([].concat.apply([], b.rows));
    if (b.t === 'shots') return [b.caption];
    if (b.t === 'notice') return b.items;
    return [];
  }

  function page(id) {
    var p = G.pages[id], h = '<h1 class="title">' + esc(label(id)) + '</h1>';
    if (!p) return h + '<div class="notice">이 화면의 기능정의서는 아직 작성하지 않았습니다.</div>';
    h += '<div class="inline"><a class="link small" href="../mockup/#/' + esc(p.mock) + '">목업에서 이 화면 보기</a></div>';
    p.sections.forEach(function (s) {
      h += '<section class="card stack sec" id="s-' + s.id + '"><h2 class="h2">' + esc(s.title) + '</h2>' + s.blocks.map(block).join('') + '</section>';
    });
    return h;
  }
  function toc(id) {
    var p = G.pages[id];
    if (!p) return '';
    return '<div class="lnb-title">이 페이지 목차</div>' + p.sections.map(function (s) {
      return '<button class="toc-link" data-sec="' + s.id + '">' + esc(s.title) + '</button>';
    }).join('');
  }
  function nav(id) {
    var h = '';
    G.groups.forEach(function (g) {
      h += '<div class="lnb-title">' + esc(g.name) + '</div>';
      g.pages.forEach(function (p) {
        h += '<button class="lnb-link' + (p[0] === id && !state.q ? ' on' : '') + (G.pages[p[0]] ? '' : ' mute') + '" data-go="' + p[0] + '">' + esc(p[1]) + '</button>';
      });
    });
    return h;
  }

  /* 검색 */
  function search(q) {
    var words = q.toLowerCase().split(/\s+/).filter(Boolean), out = [];
    Object.keys(G.pages).forEach(function (id) {
      G.pages[id].sections.forEach(function (s) {
        var texts = [s.title].concat([].concat.apply([], s.blocks.map(plain)));
        var all = texts.join(' ').toLowerCase();
        if (!words.every(function (w) { return all.indexOf(w) >= 0; })) return;
        var hit = texts.filter(function (t) { return t.toLowerCase().indexOf(words[0]) >= 0; })[0] || s.title;
        out.push({ id: id, sec: s.id, title: s.title, snip: hit });
      });
    });
    return out;
  }
  function mark(text, words) {
    var t = String(text), lo = t.toLowerCase(), at = lo.indexOf(words[0]);
    var from = Math.max(0, at - 20), s = t.slice(from, from + 90);
    var h = esc(s);
    words.forEach(function (w) { h = h.replace(new RegExp(esc(w).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), function (m) { return '<span class="bold">' + m + '</span>'; }); });
    return (from > 0 ? '…' : '') + h + (from + 90 < t.length ? '…' : '');
  }
  function results(q) {
    var words = q.toLowerCase().split(/\s+/).filter(Boolean), list = search(q);
    var h = '<h1 class="title">검색 결과</h1><div class="small sub">"' + esc(q) + '" 전체 ' + list.length + '건</div>';
    if (!list.length) return h + '<div class="notice">검색 결과가 없습니다. 다른 키워드로 검색해 보세요.</div>';
    h += '<div class="list">';
    list.forEach(function (r) {
      h += '<button class="row fill" data-go="' + r.id + '/' + r.sec + '"><span class="c-m bold">' + esc(label(r.id)) + '</span><span class="c-fill"><span class="bold">' + esc(r.title) + '</span><br><span class="sub">' + mark(r.snip, words) + '</span></span></button>';
    });
    return h + '</div>';
  }

  /* 화면 */
  function frame() {
    app.innerHTML = '<header class="header"><button class="menu-btn" data-act="menu" aria-label="메뉴">☰</button><button class="logo" data-go="members">' + esc(G.title) + '</button>' +
      '<span class="search"><input class="input" id="q" type="search" placeholder="키워드 검색" autocomplete="off"></span></header>' +
      '<div class="body"><nav class="nav lnb" id="lnb"></nav><main class="main stack" id="main"></main><aside class="toc" id="toc"></aside></div><div id="drawer"></div>';
  }
  function render(scrollTo) {
    var r = route(), q = state.q.trim();
    document.getElementById('lnb').innerHTML = nav(r.id);
    document.getElementById('main').innerHTML = q ? results(q) : page(r.id);
    document.getElementById('toc').innerHTML = q ? '' : toc(r.id);
    document.getElementById('drawer').innerHTML = state.menu ? '<div class="modal-bg" data-act="menu"></div><nav class="nav drawer">' + nav(r.id) + '</nav>' : '';
    document.title = (q ? '검색' : label(r.id)) + ' | ' + G.title;
    if (scrollTo) { var el = document.getElementById('s-' + scrollTo); if (el && el.scrollIntoView) el.scrollIntoView(); }
    else if (window.scrollTo) { try { window.scrollTo(0, 0); } catch (e) { /* noop */ } }
    watch();
  }
  function watch() {
    if (!window.IntersectionObserver) return;
    var secs = document.querySelectorAll('.sec');
    if (!secs.length) return;
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        document.querySelectorAll('.toc-link').forEach(function (b) { b.classList.toggle('on', 's-' + b.getAttribute('data-sec') === e.target.id); });
      });
    }, { rootMargin: '-20% 0px -70% 0px' });
    secs.forEach(function (s) { io.observe(s); });
  }

  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-act="menu"]')) { state.menu = !state.menu; render(); return; }
    var s = e.target.closest('[data-sec]');
    if (s) { var el = document.getElementById('s-' + s.getAttribute('data-sec')); if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth' }); return; }
    var n = e.target.closest('[data-go]');
    if (n) { state.menu = false; state.q = ''; document.getElementById('q').value = ''; location.hash = '#/' + n.getAttribute('data-go'); }
  });
  document.addEventListener('input', function (e) {
    if (e.target.id === 'q') { state.q = e.target.value; render(); }
  });
  window.addEventListener('hashchange', function () { state.menu = false; render(route().sec); });
  frame();
  render(route().sec);
})();
