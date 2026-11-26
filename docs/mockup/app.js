/* 방송 아카이브 시안 — 화면 동작.
   스타일 값은 쓰지 않는다(클래스만 사용). 모든 모양은 tokens.css / components.css에서 결정된다. */
(function () {
  "use strict";
  var D = window.MOCK;
  var TODAY = new Date("2026-11-26T00:00:00");
  var CAFE = "https://cafe.naver.com/";

  /* ---------- 유틸 ---------- */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function rx(q) { return q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
  function hl(text, q) {
    var t = esc(text);
    if (!q) return t;
    return t.replace(new RegExp("(" + rx(esc(q)) + ")", "gi"), "<mark>$1</mark>");
  }
  function snip(text, q, len) {
    var i = text.toLowerCase().indexOf(q.toLowerCase());
    if (i < 0) return text.slice(0, len * 2);
    var a = Math.max(0, i - len), b = Math.min(text.length, i + q.length + len);
    return (a > 0 ? "…" : "") + text.slice(a, b) + (b < text.length ? "…" : "");
  }
  function daysSince(d) { return Math.round((TODAY - new Date(d + "T00:00:00")) / 86400000); }
  function hm(sec) { return Math.floor(sec / 3600) + "시간 " + Math.round((sec % 3600) / 60) + "분"; }
  function clock(t) { return t.slice(0, 5) === "00:00" ? t.slice(3) : t; }

  var ICONS = {
    home: "M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z",
    book: "M4 4h12a4 4 0 0 1 4 4v12H8a4 4 0 0 1-4-4z M8 20V8",
    users: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M22 21v-2a4 4 0 0 0-3-3.9 M16 3.1a4 4 0 0 1 0 7.8",
    activity: "M22 12h-4l-3 9L9 3l-3 9H2",
    search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z M21 21l-4.3-4.3",
    link: "M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1 M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1",
    x: "M18 6L6 18 M6 6l12 12",
    check: "M20 6L9 17l-5-5",
    trash: "M3 6h18 M8 6V4h8v2 M6 6l1 14h10l1-14",
    edit: "M12 20h9 M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z",
    out: "M9 21H5V3h4 M16 17l5-5-5-5 M21 12H9",
    back: "M15 18l-6-6 6-6",
    redo: "M3 12a9 9 0 1 0 3-6.7 M3 4v5h5"
  };
  function ic(n) {
    return '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="' + ICONS[n] + '"/></svg>';
  }
  function toast(msg) {
    var old = document.querySelector(".toast");
    if (old) old.remove();
    var el = document.createElement("div");
    el.className = "toast";
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 2200);
  }

  /* ---------- 상태 ---------- */
  var POSTS = [
    { real: true, title: D.post.title, date: D.post.start.slice(0, 10), cat: D.post.category === "talk" ? "토크" : D.post.category,
      dur: D.post.duration, segs: D.segments.length, kws: D.post.keywords.slice(0, 3) },
    { title: "예시 방송 제목 A", date: "2026-11-24", cat: "게임", dur: 30600, segs: 71, kws: ["예시", "키워드", "시안"] },
    { title: "예시 방송 제목 B", date: "2026-11-23", cat: "토크", dur: 21000, segs: 52, kws: ["예시", "키워드", "시안"] },
    { title: "예시 방송 제목 C", date: "2026-11-21", cat: "게임", dur: 36000, segs: 80, kws: ["예시", "키워드", "시안"] },
    { title: "예시 방송 제목 D", date: "2026-11-20", cat: "토크", dur: 27000, segs: 63, kws: ["예시", "키워드", "시안"] }
  ];
  var OWNERS = ["팬A", "팬B", "팬C", "관리자"];
  var S = {
    role: null, me: "팬A", route: "", tab: "login", loginMsg: null, signupDone: false, signupErr: null, grade: null,
    q: "", focus: null, memTab: "pending", idle: 0, sel: {}, modal: null,
    members: [
      { n: "예시닉1", st: "pending", grade: "Y", at: "2026-11-25", seen: "", link: CAFE + "example/101" },
      { n: "예시닉2", st: "pending", grade: "N", at: "2026-11-24", seen: "", link: CAFE + "example/102" },
      { n: "예시닉3", st: "pending", grade: "Y", at: "2026-11-22", seen: "", link: CAFE + "example/103" },
      { n: "예시닉4", st: "ok", grade: "Y", at: "2026-06-01", seen: "2026-11-26" },
      { n: "예시닉5", st: "ok", grade: "Y", at: "2026-06-03", seen: "2026-11-20" },
      { n: "예시닉6", st: "ok", grade: "Y", at: "2026-07-15", seen: "2026-10-12" },
      { n: "예시닉7", st: "ok", grade: "Y", at: "2026-07-20", seen: "2026-09-02" },
      { n: "예시닉8", st: "ok", grade: "Y", at: "2026-08-01", seen: "2026-08-19" },
      { n: "예시닉9", st: "ok", grade: "Y", at: "2026-08-04", seen: "2026-07-30" },
      { n: "예시닉10", st: "out", grade: "Y", at: "2026-06-10", seen: "2026-06-21", done: "2026-11-01" },
      { n: "예시닉11", st: "out", grade: "N", at: "2026-10-30", seen: "", done: "2026-10-31" }
    ],
    glossary: D.glossary.map(function (g, i) {
      return { term: g.term, type: g.type, desc: g.desc, owner: OWNERS[i % OWNERS.length] };
    })
  };

  /* ---------- 접속 ---------- */
  function loginView() {
    var msg = S.loginMsg ? '<div class="notice ' + S.loginMsg.kind + '">' + esc(S.loginMsg.text) + "</div>" : "";
    var tabs = '<div class="tabs">' +
      '<button class="btn btn-sub' + (S.tab === "login" ? " on" : "") + '" data-act="tab" data-v="login">로그인</button>' +
      '<button class="btn btn-sub' + (S.tab === "signup" ? " on" : "") + '" data-act="tab" data-v="signup">가입 신청</button></div>';
    var body;
    if (S.tab === "login") {
      body = '<div class="field"><label for="nick">닉네임</label><input id="nick" class="input" autocomplete="off" placeholder="팬카페 닉네임"></div>' +
        '<div class="field"><label for="pw">비밀번호</label><input id="pw" class="input" type="password" placeholder="카페 공지의 공통 비밀번호"></div>' + msg +
        '<div class="stack"><button class="btn btn-primary block" data-act="login" data-v="user">사용자 로그인</button>' +
        '<button class="btn btn-line block" data-act="login" data-v="admin">관리자 로그인</button></div>' +
        '<p class="sub small">시안 안내: 닉네임에 "대기"를 넣으면 승인 대기 안내, "거절"을 넣으면 거절 안내, 비워 두면 오류 안내가 나옵니다.</p>';
    } else if (S.signupDone) {
      body = '<div class="notice ok"><span class="bold">가입 신청이 접수되었습니다.</span><span>관리자가 확인한 뒤 승인되면 로그인할 수 있습니다. 승인 전에는 접속할 수 없습니다.</span></div>' +
        '<button class="btn btn-sub block" data-act="tab" data-v="login">로그인 화면으로</button>';
    } else {
      body = '<div class="notice warn"><span class="bold">이용 안내</span>' +
        "<span>이 서비스는 팬카페 <b>왕자두 등급 이상</b>부터 이용할 수 있습니다.</span>" +
        "<span>왕자두 등급 이상이 아니면 가입 승인이 거절될 수 있습니다.</span></div>" +
        '<div class="field"><label for="snick">닉네임</label><input id="snick" class="input" autocomplete="off" placeholder="팬카페 닉네임"></div>' +
        '<div class="field"><label>왕자두 등급 이상입니까?</label><div class="cluster">' +
        '<button class="btn btn-sub' + (S.grade === "Y" ? " on" : "") + '" data-act="grade" data-v="Y">예</button>' +
        '<button class="btn btn-sub' + (S.grade === "N" ? " on" : "") + '" data-act="grade" data-v="N">아니오</button></div></div>' +
        '<div class="field"><label for="slink">가장 최근에 작성한 카페 게시물 링크</label><input id="slink" class="input" autocomplete="off" placeholder="https://cafe.naver.com/…"></div>' +
        (S.signupErr ? '<div class="notice danger">' + esc(S.signupErr) + "</div>" : "") +
        '<button class="btn btn-primary block" data-act="signup">가입 신청</button>';
    }
    return '<div class="main"><div class="container narrow"><div class="stack"><div><h1>방송 아카이브</h1>' +
      '<p class="sub">팬 전용 · 방송 다시보기 요약 검색</p></div>' + tabs + '<div class="card">' + body + "</div></div></div></div>";
  }

  /* ---------- 공통 셸 ---------- */
  function navItem(href, icon, label) {
    var on = S.route === href ? " on" : "";
    return '<button class="nav-item' + on + '" data-act="go" data-v="' + href + '">' + ic(icon) + "<span>" + label + "</span></button>";
  }
  function shell(content) {
    var admin = S.role === "admin";
    var items = navItem("home", "home", "홈") + navItem("glossary", "book", "용어집") +
      (admin ? navItem("members", "users", "멤버 관리") + navItem("ops", "activity", "처리 현황") : "");
    var nav = '<nav class="nav"><div class="nav-brand"><h3>방송 아카이브</h3><p class="sub small">팬 전용</p></div>' + items +
      '<div class="nav-foot"><span class="sub small">' + esc(admin ? "관리자" : S.me) + '</span>' +
      '<button class="nav-item" data-act="logout">' + ic("out") + "<span>로그아웃</span></button></div></nav>";
    var demo = '<div class="demo"><span>시안 보기</span>' +
      '<button class="chip' + (admin ? "" : " on") + '" data-act="role" data-v="user">일반 사용자</button>' +
      '<button class="chip' + (admin ? " on" : "") + '" data-act="role" data-v="admin">관리자</button></div>';
    return '<div class="app">' + nav + '<main class="main"><div class="container">' + demo + content + "</div></main></div>";
  }

  /* ---------- 목록 / 검색 ---------- */
  function listView() {
    return '<div class="head"><h1>방송 아카이브</h1></div>' +
      '<div class="search">' + ic("search") + '<input id="q" class="input" autocomplete="off" placeholder="키워드, 요약, 대사로 검색" value="' + esc(S.q) + '"></div>' +
      '<div id="results">' + resultsHtml() + "</div>";
  }
  function resultsHtml() {
    return S.q.trim() ? searchHtml(S.q.trim()) : postsHtml();
  }
  function postsHtml() {
    var head = '<div class="row th"><div class="c-m">날짜</div><div class="c-fill">제목</div><div class="c-s">분류</div><div class="c-s">길이</div><div class="c-s">구간</div></div>';
    var rows = POSTS.map(function (p, i) {
      var tag = p.real ? "" : ' <span class="tag">예시</span>';
      return '<div class="row link" data-act="' + (p.real ? "open" : "toast") + '" data-v="' + i + '">' +
        '<div class="c-m sub">' + p.date + '</div>' +
        '<div class="c-fill"><div class="bold clip">' + esc(p.title) + tag + '</div><div class="cluster">' +
        p.kws.map(function (k) { return '<span class="chip">' + esc(k) + "</span>"; }).join("") + "</div></div>" +
        '<div class="c-s sub">' + esc(p.cat) + '</div><div class="c-s sub">' + Math.round(p.dur / 3600 * 10) / 10 + "시간</div>" +
        '<div class="c-s sub">' + p.segs + "개</div></div>";
    }).join("");
    return '<div class="list">' + head + rows + "</div>";
  }
  function searchHtml(q) {
    var ql = q.toLowerCase(), out = [], postHit = [];
    function has(t) { return t && t.toLowerCase().indexOf(ql) >= 0; }
    if (has(D.post.title)) postHit.push("제목");
    if (has(D.post.summary)) postHit.push("전체 요약");
    if (D.post.keywords.some(has)) postHit.push("방송 키워드");
    D.segments.forEach(function (s, i) {
      var f = [], text = "";
      var qs = s.quotes.filter(function (x) { return has(x.text); });
      if (qs.length) { f.push("대사"); text = qs[0].text; }
      if (has(s.summary)) { f.push("요약"); text = text || s.summary; }
      if (s.keywords.some(has)) { f.push("키워드"); text = text || s.keywords.join(", "); }
      if (has(s.title)) { f.push("구간 제목"); text = text || s.title; }
      if (f.length) out.push({ i: i, s: s, f: f, text: text });
    });
    if (!out.length && !postHit.length) {
      return '<div class="empty">"' + esc(q) + '"에 해당하는 결과가 없습니다.<br>다른 단어로 검색해 보세요.</div>';
    }
    var head = '<p class="sub">구간 ' + out.length + "건" + (postHit.length ? " · 게시물 1건 (" + postHit.join(", ") + " 일치)" : "") + "</p>";
    var rows = out.slice(0, 40).map(function (r) {
      return '<div class="row link" data-act="seg" data-v="' + r.i + '">' +
        '<div class="c-m"><span class="chip">' + clock(r.s.start) + "</span></div>" +
        '<div class="c-fill"><div class="bold">' + hl(r.s.title, q) + '</div><div class="sub">' + hl(snip(r.text, q, 40), q) + "</div></div>" +
        '<div class="c-l cluster">' + r.f.map(function (x) { return '<span class="tag">' + x + "</span>"; }).join("") + "</div></div>";
    }).join("");
    var more = out.length > 40 ? '<p class="sub small">상위 40건만 표시합니다.</p>' : "";
    return '<div class="stack">' + head + '<div class="list"><div class="row th"><div class="c-m">시각</div><div class="c-fill">구간</div><div class="c-l">일치한 항목</div></div>' + rows + "</div>" + more + "</div>";
  }

  /* ---------- 상세 ---------- */
  function postView() {
    var p = D.post, admin = S.role === "admin";
    var kws = p.keywords.map(function (k) { return '<button class="chip" data-act="kw" data-v="' + esc(k) + '">' + esc(k) + "</button>"; }).join("");
    var adminBar = admin ? '<div class="cluster"><button class="btn btn-line" data-act="toast" data-v="x">' + ic("edit") + "게시물 수정</button>" +
      '<button class="btn btn-line danger" data-act="toast" data-v="x">숨김</button></div>' : "";
    var segs = D.segments.map(function (s, i) {
      var q = s.quotes.map(function (x) {
        return '<div class="quote"><span class="sub small">' + clock(x.time) + "</span><br>“" + esc(x.text) + "”</div>";
      }).join("");
      var edit = admin ? '<button class="btn-icon btn" data-act="toast" data-v="x" aria-label="구간 수정">' + ic("edit") + "</button>" : "";
      return '<div class="card' + (S.focus === i ? " on" : "") + '" id="seg-' + i + '">' +
        '<div class="head"><div class="cluster"><span class="chip">' + clock(s.start) + " ~ " + clock(s.end) + "</span></div>" + edit + "</div>" +
        "<h3>" + esc(s.title) + '</h3><p>' + esc(s.summary) + "</p>" + q +
        '<div class="cluster">' + s.keywords.map(function (k) { return '<button class="chip" data-act="kw" data-v="' + esc(k) + '">' + esc(k) + "</button>"; }).join("") + "</div></div>";
    }).join("");
    return '<div><button class="btn btn-sub" data-act="go" data-v="home">' + ic("back") + "목록</button></div>" +
      '<div class="stack"><h1>' + esc(p.title) + '</h1><div class="cluster sub"><span>' + p.start.slice(0, 16) + " 시작</span><span>· " + hm(p.duration) +
      "</span><span>· 토크</span></div></div>" + adminBar +
      '<div class="cluster"><a class="btn btn-primary" target="_blank" rel="noopener" href="https://chzzk.naver.com/video/' + p.video_no + '">' + ic("link") + "1부 · 치지직에서 보기</a></div>" +
      '<div class="card"><h2>전체 요약</h2><p>' + esc(p.summary) + '</p><div class="cluster">' + kws + "</div></div>" +
      '<div class="head"><h2>구간별 요약</h2><span class="sub">' + D.segments.length + "개 구간</span></div>" + segs;
  }

  /* ---------- 용어집 ---------- */
  function canEdit(g) { return S.role === "admin" || g.owner === S.me; }
  function glossaryView() {
    var admin = S.role === "admin";
    var rows = S.glossary.map(function (g, i) {
      var btns = canEdit(g) ? '<button class="btn btn-icon" data-act="gedit" data-v="' + i + '" aria-label="수정">' + ic("edit") + "</button>" +
        '<button class="btn btn-icon danger" data-act="gdel" data-v="' + i + '" aria-label="삭제">' + ic("trash") + "</button>" : "";
      return '<div class="row"><div class="c-m bold clip">' + esc(g.term) + '</div><div class="c-s"><span class="tag">' + esc(g.type) + "</span></div>" +
        '<div class="c-fill sub">' + esc(g.desc) + '</div><div class="c-m sub">' + esc(g.owner) + '</div><div class="c-b">' + btns + "</div></div>";
    }).join("");
    return '<div class="head"><h1>용어집</h1><div class="cluster">' +
      (admin ? '<button class="btn btn-line" data-act="ghist">수정 이력</button>' : "") +
      '<button class="btn btn-primary" data-act="gadd">용어 추가</button></div></div>' +
      '<div class="notice info"><span>AI가 요약할 때 참고하는 용어입니다. 본인이 등록한 용어만 수정·삭제할 수 있습니다' + (admin ? " (관리자는 전체 가능)" : "") + ".</span></div>" +
      '<div class="list"><div class="row th"><div class="c-m">용어</div><div class="c-s">유형</div><div class="c-fill">설명</div><div class="c-m">등록자</div><div class="c-b"></div></div>' + rows + "</div>";
  }

  /* ---------- 멤버 관리 ---------- */
  function membersView() {
    var m = S.members, cnt = function (st) { return m.filter(function (x) { return x.st === st; }).length; };
    var tabs = [["pending", "승인 대기"], ["ok", "승인됨"], ["out", "거절·탈퇴"]].map(function (t) {
      return '<button class="btn btn-sub' + (S.memTab === t[0] ? " on" : "") + '" data-act="memtab" data-v="' + t[0] + '">' + t[1] + " " + cnt(t[0]) + "</button>";
    }).join("");
    var list = m.filter(function (x) { return x.st === S.memTab; }), tools = "", head, rows;
    if (S.memTab === "pending") {
      head = '<div class="row th"><div class="c-m">닉네임</div><div class="c-s">등급 응답</div><div class="c-fill">최근 게시물 링크</div><div class="c-m">신청일</div><div class="c-b"></div></div>';
      rows = list.map(function (x) {
        return '<div class="row"><div class="c-m bold">' + esc(x.n) + '</div><div class="c-s"><span class="tag ' + (x.grade === "Y" ? "ok" : "warn") + '">' + (x.grade === "Y" ? "예" : "아니오") + "</span></div>" +
          '<div class="c-fill"><a class="sub clip" href="#" data-act="toast" data-v="시안에서는 링크가 열리지 않습니다">' + esc(x.link) + '</a></div><div class="c-m sub">' + x.at + '</div>' +
          '<div class="c-b"><button class="btn btn-icon ok" data-act="approve" data-v="' + esc(x.n) + '" aria-label="승인">' + ic("check") + "</button>" +
          '<button class="btn btn-icon danger" data-act="reject" data-v="' + esc(x.n) + '" aria-label="거절">' + ic("x") + "</button></div></div>";
      }).join("");
    } else if (S.memTab === "ok") {
      list = list.filter(function (x) { return daysSince(x.seen) >= S.idle; }).sort(function (a, b) { return a.seen < b.seen ? -1 : 1; });
      var n = Object.keys(S.sel).filter(function (k) { return S.sel[k]; }).length;
      tools = '<div class="head"><div class="cluster"><span class="sub">미접속 기간</span>' +
        [[0, "전체"], [30, "30일 이상"], [60, "60일 이상"], [90, "90일 이상"]].map(function (o) {
          return '<button class="chip' + (S.idle === o[0] ? " on" : "") + '" data-act="idle" data-v="' + o[0] + '">' + o[1] + "</button>";
        }).join("") + '</div><button class="btn btn-line danger" data-act="bulk"' + (n ? "" : " disabled") + ">선택 " + n + "명 탈퇴</button></div>";
      head = '<div class="row th"><div class="c-xs"></div><div class="c-fill">닉네임</div><div class="c-m">가입일</div><div class="c-m">최근 접속</div><div class="c-s">미접속</div><div class="c-b"></div></div>';
      rows = list.map(function (x) {
        var d = daysSince(x.seen);
        return '<div class="row"><div class="c-xs"><input class="check" type="checkbox" data-act="sel" data-v="' + esc(x.n) + '"' + (S.sel[x.n] ? " checked" : "") + '></div>' +
          '<div class="c-fill bold">' + esc(x.n) + '</div><div class="c-m sub">' + x.at + '</div><div class="c-m sub">' + x.seen + '</div>' +
          '<div class="c-s"><span class="tag ' + (d >= 90 ? "danger" : d >= 30 ? "warn" : "") + '">' + d + "일</span></div>" +
          '<div class="c-b"><button class="btn btn-icon danger" data-act="withdraw" data-v="' + esc(x.n) + '" aria-label="탈퇴 처리">' + ic("trash") + "</button></div></div>";
      }).join("");
    } else {
      head = '<div class="row th"><div class="c-fill">닉네임</div><div class="c-s">상태</div><div class="c-m">처리일</div><div class="c-b"></div></div>';
      rows = list.map(function (x) {
        return '<div class="row"><div class="c-fill bold">' + esc(x.n) + '</div><div class="c-s"><span class="tag">' + (x.done ? "탈퇴" : "거절") + '</span></div>' +
          '<div class="c-m sub">' + (x.done || x.at) + '</div><div class="c-b"><button class="btn btn-icon ok" data-act="approve" data-v="' + esc(x.n) + '" aria-label="다시 승인">' + ic("redo") + "</button></div></div>";
      }).join("");
    }
    if (!list.length) rows = '<div class="empty">해당하는 멤버가 없습니다.</div>';
    return '<div class="head"><h1>멤버 관리</h1></div><div class="tabs">' + tabs + "</div>" + tools +
      '<div class="list">' + head + rows + "</div>" +
      (S.memTab === "ok" ? '<p class="sub small">최근 접속은 하루에 한 번 기록됩니다. 탈퇴 처리된 멤버는 로그인할 수 없고, 다시 가입 신청할 수 있습니다. 작성한 용어는 남습니다.</p>' : "");
  }

  /* ---------- 처리 현황 ---------- */
  function opsView() {
    var stats = '<div class="grid">' +
      '<div class="card"><span class="sub">성인 방송용 로그인</span><h2>정상</h2><span class="sub small">마지막 확인: 오늘 (예시 값)</span></div>' +
      '<div class="card"><span class="sub">이번 달 처리 비용</span><h2>12,400원</h2><progress max="30000" value="12400"></progress><span class="sub small">월 상한 30,000원 (예시 값)</span></div>' +
      '<div class="card"><span class="sub">처리 대기</span><h2>2건</h2><span class="sub small">예시 값</span></div></div>';
    var data = [
      ["완료", "ok", D.post.title, 1, "2026-11-26", true],
      ["처리 중", "info", "예시 게시물 A", 1, "-", false],
      ["대기", "", "예시 게시물 B (방송 3개 자동 묶음)", 3, "-", false],
      ["실패", "danger", "예시 게시물 C", 1, "2026-11-25", false],
      ["완료", "ok", "예시 게시물 D", 2, "2026-11-24", false]
    ];
    var rows = data.map(function (r) {
      var btns = r[0] === "실패" ? '<button class="btn btn-icon" data-act="toast" data-v="재처리를 요청했습니다 (시안)" aria-label="재처리">' + ic("redo") + "</button>" : "";
      if (r[3] > 1) btns += '<button class="btn btn-icon" data-act="toast" data-v="묶음 분리 화면 (시안)" aria-label="분리">' + ic("edit") + "</button>";
      return '<div class="row"><div class="c-fill bold clip">' + esc(r[2]) + '</div><div class="c-s"><span class="tag ' + r[1] + '">' + r[0] + '</span></div>' +
        '<div class="c-s sub">' + r[3] + '개</div><div class="c-m sub">' + r[4] + '</div><div class="c-b">' + btns + "</div></div>";
    }).join("");
    return '<div class="head"><h1>처리 현황</h1></div>' + stats +
      '<div class="list"><div class="row th"><div class="c-fill">게시물</div><div class="c-s">상태</div><div class="c-s">방송 수</div><div class="c-m">처리일</div><div class="c-b"></div></div>' + rows + "</div>";
  }

  /* ---------- 모달 ---------- */
  function modalHtml() {
    var m = S.modal;
    if (!m) return "";
    var inner = "";
    if (m.t === "gform") {
      var g = m.i == null ? { term: "", type: "기타", desc: "" } : S.glossary[m.i];
      inner = "<h2>" + (m.i == null ? "용어 추가" : "용어 수정") + "</h2>" +
        '<div class="field"><label for="g-term">용어 (최대 30자)</label><input id="g-term" class="input" maxlength="30" value="' + esc(g.term) + '"></div>' +
        '<div class="field"><label>유형</label><div class="cluster">' + ["닉네임", "밈", "인물", "게임용어", "기타"].map(function (t) {
          return '<button class="chip' + (m.type === t || (!m.type && g.type === t) ? " on" : "") + '" data-act="gtype" data-v="' + t + '">' + t + "</button>";
        }).join("") + "</div></div>" +
        '<div class="field"><label for="g-desc">설명 (최대 200자)</label><textarea id="g-desc" class="textarea" maxlength="200">' + esc(g.desc) + "</textarea></div>" +
        '<div class="cluster"><button class="btn btn-primary" data-act="gsave">저장</button><button class="btn btn-sub" data-act="close">취소</button></div>';
    } else if (m.t === "confirm") {
      inner = "<h2>" + esc(m.title) + '</h2><p class="sub">' + esc(m.text) + '</p><div class="cluster"><button class="btn btn-primary" data-act="ok">확인</button><button class="btn btn-sub" data-act="close">취소</button></div>';
    } else if (m.t === "hist") {
      inner = "<h2>용어집 수정 이력</h2>" + [["오늘 10:12", "팬B", "‘신입방이’ 설명 수정"], ["어제 21:40", "팬C", "‘형우’ 용어 추가"], ["11-24 18:03", "팬A", "‘고빨’ 삭제"]].map(function (h) {
        return '<div class="row"><div class="c-m sub">' + h[0] + '</div><div class="c-fill">' + h[2] + '<div class="sub small">' + h[1] + '</div></div><div class="c-b"><button class="btn btn-icon" data-act="toast" data-v="되돌렸습니다 (시안)" aria-label="되돌리기">' + ic("redo") + "</button></div></div>";
      }).join("") + '<button class="btn btn-sub" data-act="close">닫기</button>';
    }
    return '<div class="modal-bg" data-act="bg"><div class="modal">' + inner + "</div></div>";
  }

  /* ---------- 라우팅 / 렌더 ---------- */
  function render() {
    var root = document.getElementById("root");
    if (!S.role) { root.innerHTML = loginView(); return; }
    var map = { home: listView, post: postView, glossary: glossaryView, members: membersView, ops: opsView };
    var r = S.route || "home";
    if ((r === "members" || r === "ops") && S.role !== "admin") r = "home";
    S.route = r;
    root.innerHTML = shell(map[r]()) + modalHtml();
    if (r === "post" && S.focus != null) {
      var el = document.getElementById("seg-" + S.focus);
      if (el) el.scrollIntoView({ block: "center" });
    } else { window.scrollTo(0, 0); }
  }
  function go(r) { S.route = r; render(); }

  /* ---------- 동작 ---------- */
  function setMember(n, st, extra) {
    S.members.forEach(function (x) { if (x.n === n) { x.st = st; if (extra) Object.keys(extra).forEach(function (k) { x[k] = extra[k]; }); } });
  }
  var acts = {
    tab: function (v) { S.tab = v; S.loginMsg = null; S.signupDone = false; S.signupErr = null; render(); },
    grade: function (v) { S.grade = v; render(); },
    login: function (v) {
      var n = (document.getElementById("nick").value || "").trim();
      if (!n) { S.loginMsg = { kind: "danger", text: "닉네임 또는 비밀번호를 확인해 주세요." }; return render(); }
      if (n.indexOf("대기") >= 0) { S.loginMsg = { kind: "warn", text: "승인 대기 중입니다. 관리자가 확인한 뒤 승인되면 로그인할 수 있습니다." }; return render(); }
      if (n.indexOf("거절") >= 0) { S.loginMsg = { kind: "danger", text: "가입 승인이 거절되었습니다. 이용 안내를 확인한 뒤 다시 가입 신청해 주세요." }; return render(); }
      S.role = v === "admin" ? "admin" : "user"; S.me = v === "admin" ? "관리자" : n; S.loginMsg = null; S.route = "home"; render();
    },
    signup: function () {
      var n = (document.getElementById("snick").value || "").trim(), l = (document.getElementById("slink").value || "").trim();
      if (!n) S.signupErr = "닉네임을 입력해 주세요.";
      else if (!S.grade) S.signupErr = "왕자두 등급 이상 여부를 선택해 주세요.";
      else if (l.indexOf(CAFE) !== 0) S.signupErr = "카페 게시물 링크(https://cafe.naver.com/…)를 입력해 주세요.";
      else { S.signupErr = null; S.signupDone = true; }
      render();
    },
    logout: function () { S.role = null; S.route = ""; S.tab = "login"; render(); },
    role: function (v) { S.role = v; S.me = v === "admin" ? "관리자" : "팬A"; render(); },
    go: function (v) { S.focus = null; go(v); },
    open: function () { S.focus = null; go("post"); },
    seg: function (v) { S.focus = +v; go("post"); },
    kw: function (v) { S.q = v; S.focus = null; go("home"); },
    toast: function (v) { toast(v && v !== "x" ? v : "시안에서는 동작하지 않습니다. 샘플 1건만 상세를 제공합니다."); },
    gadd: function () { S.modal = { t: "gform", i: null, type: null }; render(); },
    gedit: function (v) { S.modal = { t: "gform", i: +v, type: null }; render(); },
    gtype: function (v) { S.modal.type = v; var t = document.getElementById("g-term").value, d = document.getElementById("g-desc").value; render(); document.getElementById("g-term").value = t; document.getElementById("g-desc").value = d; },
    gsave: function () {
      var t = document.getElementById("g-term").value.trim(), d = document.getElementById("g-desc").value.trim();
      if (!t) return toast("용어를 입력해 주세요.");
      var cur = S.modal.i == null ? null : S.glossary[S.modal.i];
      var type = S.modal.type || (cur ? cur.type : "기타");
      if (cur) { cur.term = t; cur.desc = d; cur.type = type; } else S.glossary.unshift({ term: t, type: type, desc: d, owner: S.me });
      S.modal = null; render();
    },
    gdel: function (v) { S.modal = { t: "confirm", title: "용어를 삭제할까요?", text: "삭제한 용어는 AI 요약 참고에서 빠집니다. 수정 이력에는 남습니다.", ok: function () { S.glossary.splice(+v, 1); } }; render(); },
    ghist: function () { S.modal = { t: "hist" }; render(); },
    memtab: function (v) { S.memTab = v; S.sel = {}; render(); },
    idle: function (v) { S.idle = +v; render(); },
    sel: function (v, el) { S.sel[v] = el.checked; render(); },
    approve: function (v) { setMember(v, "ok", { seen: "2026-11-26", done: "" }); toast(v + " 승인했습니다"); render(); },
    reject: function (v) { setMember(v, "out", { done: "" }); toast(v + " 거절했습니다"); render(); },
    withdraw: function (v) { S.modal = { t: "confirm", title: v + " 님을 탈퇴 처리할까요?", text: "즉시 로그인할 수 없게 됩니다. 다시 가입 신청은 가능하고, 작성한 용어는 남습니다.", ok: function () { setMember(v, "out", { done: "2026-11-26" }); } }; render(); },
    bulk: function () {
      var names = Object.keys(S.sel).filter(function (k) { return S.sel[k]; });
      S.modal = { t: "confirm", title: names.length + "명을 탈퇴 처리할까요?", text: "선택한 멤버는 즉시 로그인할 수 없게 됩니다. 다시 가입 신청은 가능합니다.", ok: function () { names.forEach(function (n) { setMember(n, "out", { done: "2026-11-26" }); }); S.sel = {}; } };
      render();
    },
    ok: function () { if (S.modal && S.modal.ok) S.modal.ok(); S.modal = null; render(); },
    close: function () { S.modal = null; render(); },
    bg: function (v, el, ev) { if (ev.target === el) { S.modal = null; render(); } }
  };
  document.addEventListener("click", function (ev) {
    var el = ev.target.closest("[data-act]");
    if (!el || el.type === "checkbox") return;
    var a = el.getAttribute("data-act");
    if (a === "go" && el.getAttribute("data-v") === "home") S.q = "";
    if (el.tagName === "A") ev.preventDefault();
    if (acts[a]) acts[a](el.getAttribute("data-v"), el, ev);
  });
  document.addEventListener("change", function (ev) {
    var el = ev.target;
    if (el.type === "checkbox" && el.getAttribute("data-act") === "sel") acts.sel(el.getAttribute("data-v"), el);
  });
  document.addEventListener("input", function (ev) {
    if (ev.target.id === "q") {
      S.q = ev.target.value;
      document.getElementById("results").innerHTML = resultsHtml();
    }
  });
  render();
})();
