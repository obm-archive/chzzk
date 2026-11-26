(function () {
  'use strict';
  var G = window.GUIDE;
  var app = document.getElementById('app');
  var state = { menu: false };

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function label(id) {
    for (var i = 0; i < G.groups.length; i++) for (var j = 0; j < G.groups[i].pages.length; j++) if (G.groups[i].pages[j][0] === id) return G.groups[i].pages[j][1];
    return '';
  }
  function cur() { return (location.hash.replace(/^#\/?/, '') || 'members'); }

  function nav(id) {
    var h = '';
    G.groups.forEach(function (g) {
      h += '<div class="lnb-title">' + esc(g.name) + '</div>';
      g.pages.forEach(function (p) {
        h += '<button class="lnb-link' + (p[0] === id ? ' on' : '') + '" data-go="' + p[0] + '">' + esc(p[1]) + '</button>';
      });
    });
    return h;
  }
  function table(head, rows, widths) {
    var h = '<div class="list"><div class="row row-head">' + head.map(function (t, i) { return '<span class="' + widths[i] + '">' + esc(t) + '</span>'; }).join('') + '</div>';
    rows.forEach(function (r) {
      h += '<div class="row">' + r.map(function (t, i) { return '<span class="' + widths[i] + (i === 0 ? ' bold' : '') + '">' + esc(t) + '</span>'; }).join('') + '</div>';
    });
    return h + '</div>';
  }
  function section(title, body) { return '<section class="stack"><h2 class="h2">' + esc(title) + '</h2>' + body + '</section>'; }

  function page(id) {
    var p = G.pages[id], h = '<h1 class="title">' + esc(label(id)) + '</h1>';
    if (!p) return h + '<div class="notice">이 화면의 기능정의서는 아직 작성하지 않았습니다.</div>';
    h += '<div class="inline"><a class="link small" href="../mockup/#/' + esc(p.mock) + '">목업에서 이 화면 보기</a></div>';
    h += section('소개', '<p>' + esc(p.intro.purpose) + '</p>' + table(['항목', '내용'], p.intro.rows, ['c-m', 'c-fill']));
    h += section('기능별 소개', p.features.map(function (f) {
      return '<div class="stack"><h3 class="bold">' + esc(f.title) + '</h3><p class="small sub">' + esc(f.desc) + '</p>' + table(['항목', '설명'], f.rows, ['c-m', 'c-fill']) + '</div>';
    }).join(''));
    h += section('예외 상황 케이스', p.cases.map(function (c) {
      return '<div class="stack"><h3 class="bold">' + esc(c.group) + '</h3>' + table(['상황', '동작'], c.rows, ['c-m', 'c-fill']) + '</div>';
    }).join(''));
    h += section('연결 데이터', '<p>' + esc(p.data.links) + '</p>' + table(['데이터 항목', '설명', '입력·변경하는 곳'], p.data.rows, ['c-m', 'c-fill', 'c-m']));
    h += section('정해지지 않은 사항', '<div class="notice is-warn">' + p.open.map(function (t) { return '<div>· ' + esc(t) + '</div>'; }).join('') + '</div>');
    return h;
  }

  function render() {
    var id = cur();
    var h = '<header class="header"><button class="menu-btn" data-act="menu" aria-label="메뉴">☰</button><span class="logo">' + esc(G.title) + '</span></header>';
    h += '<div class="body"><nav class="nav lnb">' + nav(id) + '</nav><main class="main stack">' + page(id) + '</main></div>';
    if (state.menu) h += '<div class="modal-bg" data-act="menu"></div><nav class="nav drawer">' + nav(id) + '</nav>';
    app.innerHTML = h;
    document.title = label(id) + ' | ' + G.title;
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest('[data-act="menu"]');
    if (a) { state.menu = !state.menu; render(); return; }
    var n = e.target.closest('[data-go]');
    if (n) { state.menu = false; location.hash = '#/' + n.getAttribute('data-go'); }
  });
  window.addEventListener('hashchange', function () { state.menu = false; render(); window.scrollTo(0, 0); });
  render();
})();
