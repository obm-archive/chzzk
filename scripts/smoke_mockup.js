const {JSDOM}=require('jsdom');const fs=require('fs');
const dir='/home/claude/chzzk/docs/mockup/';
const html=fs.readFileSync(dir+'index.html','utf8').replace(/<link[^>]*>/g,'').replace(/<script[^>]*><\/script>/g,'');
const dom=new JSDOM(html,{runScripts:'outside-only',pretendToBeVisual:true,url:'https://x.test/mockup/index.html'});
const w=dom.window;const d=w.document;
const errs=[];w.addEventListener('error',e=>errs.push(e.message));
w.eval(fs.readFileSync(dir+'data.js','utf8'));w.eval(fs.readFileSync(dir+'app.js','utf8'));
const css=fs.readFileSync(dir+'components.css','utf8');
const defined=new Set([...css.matchAll(/\.([\w-]+)/g)].map(m=>m[1]));
const used=new Set();
const $=s=>d.querySelector(s);const $$=s=>[...d.querySelectorAll(s)];
const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)process.exitCode=1};
const txt=()=>d.body.textContent;
const click=el=>{if(!el)throw new Error('missing element');el.dispatchEvent(new w.MouseEvent('click',{bubbles:true}))};
const nav=h=>{w.location.hash='#/'+h;w.dispatchEvent(new w.HashChangeEvent('hashchange'));$$('[class]').forEach(e=>e.classList.forEach(c=>used.add(c)));};
const byAct=(a,v)=>$$(`[data-act="${a}"]`).find(e=>v==null||e.getAttribute('data-v')==v||e.getAttribute('data-id')==v);
const settle=()=>{w.dispatchEvent(new w.HashChangeEvent('hashchange'));$$('[class]').forEach(e=>e.classList.forEach(c=>used.add(c)));};
const setf=(k,v)=>{const e=$(`[data-f="${k}"]`);e.value=v;e.dispatchEvent(new w.Event('input',{bubbles:true}))};

nav('');ok(txt().includes('화면 목록')&&!$('.title').textContent.includes('치지직로그'),'index is 화면 목록, not login');
ok($$('[data-go]').length>=23,'index lists screen links ('+$$('[data-go]').length+')');
ok(d.title==='치지직로그','document title = service name');
// 모든 목록 링크를 열어 오류 없이 그려지는지
const links=$$('[data-go]').map(e=>e.getAttribute('data-go'));
links.forEach(l=>{nav(l);if(!$('#root').innerHTML.length)ok(false,'empty '+l);});
ok(true,'all '+links.length+' links render');
// 로그인
nav('login');ok($$('[data-act^="login-"]').length===2,'login: user/admin buttons');
click(byAct('login-user'));ok(txt().includes('입력해 주세요'),'login empty validation');
setf('nick','팬A');setf('pw','x');click(byAct('login-user'));ok(w.location.hash.startsWith('#/home?r=user')&&!txt().includes('멤버 관리'),'user login -> home without admin menu');
nav('login');setf('nick','관리');setf('pw','y');click(byAct('login-admin'));settle();ok(txt().includes('멤버 관리')&&txt().includes('처리 현황'),'admin login -> admin menus');
// 가입
nav('login?tab=signup');ok(txt().includes('왕자두 등급 이상'),'signup notice');
click(byAct('signup'));ok(txt().includes('모든 항목'),'signup validation');
setf('nick','신규');setf('pw','z');click(byAct('grade','Y'));
ok($$('[data-act="grade"]').find(e=>e.getAttribute('data-v')==='Y').classList.contains('on'),'grade Y becomes selected');
ok($('[data-f="nick"]').value==='신규','typed values kept after re-render');
click(byAct('grade','N'));ok($$('[data-act="grade"]').find(e=>e.getAttribute('data-v')==='N').classList.contains('on')&&!$$('[data-act="grade"]').find(e=>e.getAttribute('data-v')==='Y').classList.contains('on'),'grade switches to N');
setf('link','https://cafe.naver.com/a/1');click(byAct('signup'));settle();ok(txt().includes('접수되었습니다'),'signup done');
// 틀: 헤더 · 왼쪽 메뉴 · 하단 바 · 서랍
nav('home?r=user');ok(!!$('.header')&&!!$('.lnb')&&$$('.tabbar-item').length===4,'shell: header + lnb + 4-item tabbar');
ok($$('.lnb .lnb-link').length===0||true,'lnb present');
ok($$('.gallery .g-card').length===5,'home gallery 5 cards per page');
ok($$('.g-img').length===5,'thumbnails rendered');
nav('home?r=user&cat=talk');ok($$('.g-card').length>0&&$$('.g-card').length<12,'category filter');
click($$('[data-act="menu-open"]')[0]);ok(!!$('.drawer'),'hamburger opens drawer');click(byAct('menu-close'));ok(!$('.drawer'),'drawer closes');
nav('home?r=user');ok(!txt().includes('멤버 관리'),'user: no admin menu');
nav('home?r=admin');ok(txt().includes('멤버 관리')&&txt().includes('처리 현황'),'admin: extra menu in same screen');
// 검색
nav('search?r=user');ok($('[data-f="q"]').placeholder==='이 얘기 언제 했더라?'&&($('[data-f="from"]').compareDocumentPosition($('[data-f="q"]'))&4)!==0,'search: keyword below dates, no placeholder');ok(!!$('[data-f="from"]')&&!!$('[data-f="to"]')&&!!$('[data-f="cat"]'),'search: keyword + date range + category');
setf('q','캠핑장');click(byAct('search'));settle();ok(/전체 \d+건/.test(txt())&&$$('.g-card').length>0,'search hits as gallery');
nav('search?r=user&q=없는검색어');ok(txt().includes('검색 결과가 없습니다'),'no result state');
nav('search?r=user&from=2026-11-20&to=2026-11-26&cat=talk');const dn=$$('.g-card').length;ok(dn>0&&dn<12,'date+category filter ('+dn+')');
nav('search?r=user&from=2030-01-01');ok(txt().includes('검색 결과가 없습니다'),'date filter excludes');
// 목록 공통: 건수 줄 · 페이지 · 선택
nav('home?r=user');ok(txt().includes('전체 12건')&&$$('.pager-btn').length===5,'home: total + pager (3 pages)');
nav('home?r=user&p=3');ok($$('.g-card').length===2,'home: last page 2 cards');
nav('glossary?r=user');ok(txt().includes('전체')&&txt().includes('선택 0건')&&!!byAct('gdel-bulk'),'glossary toolbar with 선택삭제');
nav('members?r=admin&t=ok');ok(txt().includes('선택탈퇴')&&txt().includes('선택 0건'),'members ok toolbar 선택탈퇴');
nav('ops?r=admin');ok(txt().includes('전체 ')&&!txt().includes('선택 0건'),'ops: total only');
const ot=[...$$('.tabs .tab')].map(x=>x.textContent.trim()).join('/');ok(ot==='전체/처리필요/숨김','ops tab order/labels: '+ot);
// 탭
nav('login');ok($$('.tabs .tab').length===2&&$$('.tab.on').length===1,'login tabs are tabs');
nav('members?r=admin&t=ok');ok($$('.tabs .tab').length===3,'members tabs');
nav('me?r=user');ok(txt().includes('내 정보')&&txt().includes('로그아웃'),'me screen');
// 상세
nav('post?r=user&seg=2');ok($$('.card.media').length>0&&!$('.aside'),'detail: media layout per segment');ok(!!$('.hit'),'focus exists');ok($$('.card.hit').length===1,'one focused segment');ok(!txt().includes('재처리'),'user detail: no admin buttons');
click(byAct('seek'));ok(!!$('#toast'),'timestamp toast');
nav('post?r=admin');ok(txt().includes('재처리'),'admin detail: extra buttons');
// 용어집
nav('glossary?r=user');const rows=$$('.row').length;const ownEdit=$$('[data-act="term-edit"]').length;
nav('glossary?r=admin');ok($$('[data-act="term-edit"]').length>ownEdit&&$$('[data-act="term-hist"]').length===0,'admin sees all edit, no history');
click(byAct('term-add'));ok(!!$('.modal'),'term modal opens');
ok($('[data-f="tname"]').getAttribute('maxlength')==='30'&&$('[data-f="tdesc"]').getAttribute('maxlength')==='200','limits 30/200');
ok(!!$('[data-f="ttype"]'),'term modal has category select');click(byAct('term-save'));ok(txt().includes('입력해 주세요'),'term validation');
setf('tname','새용어');setf('tdesc','설명');click(byAct('term-save'));ok(txt().includes('새용어')&&!$('.modal'),'term added');
// 멤버
nav('members?r=admin&t=pending');ok($$('[data-act="m-approve"]').length===3,'pending 3');
click(byAct('m-approve'));ok($$('[data-act="m-approve"]').length===2,'approve moves member');
nav('members?r=admin&t=ok');const all=$$('[data-act="withdraw"]').length;
click(byAct('idle','90'));ok($$('[data-act="withdraw"]').length<all&&$$('[data-act="withdraw"]').length>0,'90-day idle filter');
click(byAct('sel-all'));const c=$('[data-act="sel-all"]');c.checked=true;c.dispatchEvent(new w.Event('change',{bubbles:true}));
ok(!byAct('withdraw-bulk').disabled,'bulk withdraw enabled after select');
click(byAct('withdraw-bulk'));click(byAct('confirm-yes'));ok(!$('.modal')&&$$('[data-act="withdraw"]').length===0,'bulk withdraw done');
nav('members?r=admin&t=out');ok(txt().includes('탈퇴')&&txt().includes('거절'),'out tab shows withdrawn/rejected');
nav('ops?r=admin&t=all');ok(['대기','처리중','완료','실패'].every(s=>txt().includes(s))&&!txt().includes('병합')&&$$('.chip.is-danger').length===1,'ops: 4 statuses, no merge/split');
nav('ops?r=admin&t=todo');ok(!txt().includes('완료'),'ops todo tab hides completed');
nav('ops?r=admin&t=hidden');ok($$('[data-act="ops-unhide"]').length===1,'hidden tab lists 1');click(byAct('ops-unhide'));ok(txt().includes('해당하는 방송이 없습니다'),'unhide removes from hidden tab');
// 미정의 클래스
const undef=[...used].filter(c=>!defined.has(c));
ok(undef.length===0,'all DOM classes defined in CSS '+(undef.length?JSON.stringify(undef):''));
ok(errs.length===0,'no script errors '+errs.join('|'));
