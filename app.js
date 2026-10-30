/* IMs — Infinity Maths: app ôn luyện cho học sinh. Câu hỏi sinh mới mỗi lần từ bộ sinh của MathBank (đã được giáo viên duyệt, danh sách trong pack.json).
   Giai đoạn 1: luyện từng dạng, làm đề theo chủ đề, ôn lỗi sai, tiến độ.
   0.2: đăng nhập (email/mật khẩu hoặc Google) và lưu tiến độ lên tài khoản qua cloud.js; chưa cấu hình Firebase thì chỉ lưu trên máy.
   0.3: gói học — chưa có gói thì mỗi ngày làm miễn phí FREE câu; quản trị cấp / gia hạn gói ngay trong app (mục Quản trị).
   0.3.1: trang cài app lên màn hình (#/caidat) — link gửi học sinh: https://chudinhcoi-afk.github.io/ims/#/caidat */
const IMS = (()=>{
const VER = '0.3.1';
const G = GENLIB.GEN, LS = 'ims_v1';
const $ = id=> document.getElementById(id);
const esc = s=> String(s == null ? '' : s).replace(/[&<>"]/g, c=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]);
const KN = {TN:'Trắc nghiệm', DS:'Đúng – sai', TLN:'Trả lời ngắn', TL:'Tự luận'}, KS = {TN:'TN', DS:'Đ–S', TLN:'TLN', TL:'TL'};
const C = typeof CLOUD !== 'undefined' ? CLOUD : null, CF = (C && C.config) || {};
const norm = o=> Object.assign({by:{}, wrong:{}, days:{}, grade:12}, o || {});
let LSK = LS, PACK = null, KEYS = [], DB = load(LS), S = null;   // LSK: khoá lưu trên máy (khách: ims_v1; đã đăng nhập: ims_v1_u_<uid>). S: phiên làm bài đang mở
function load(k){ try{ return norm(JSON.parse(localStorage.getItem(k) || '{}')); }catch(e){ return norm(); } }
function saveLocal(){ try{ localStorage.setItem(LSK, JSON.stringify(DB)); }catch(e){} }
function save(){ saveLocal(); if(C && LSK !== LS) C.push(DB); }
const today = ()=> new Date().toISOString().slice(0, 10);
function record(key, ok){
  const r = DB.by[key] || (DB.by[key] = {n:0, ok:0, st:0}); r.n++; if(ok){ r.ok++; r.st++; } else r.st = 0; r.at = Date.now();
  if(!ok) DB.wrong[key] = (DB.wrong[key] || 0) + 1; else if(DB.wrong[key] && r.st >= 3) delete DB.wrong[key];   // đúng 3 lần liên tiếp thì ra khỏi danh sách lỗi sai
  DB.days[today()] = (DB.days[today()] || 0) + 1; save(); }
const pct = key=>{ const r = DB.by[key]; return r && r.n ? Math.round(100*r.ok/r.n) : null; };
const name = g=> String(g.dang).replace(/^(SPT|HSA|TSA|ĐGNL)( 20\d\d)?( \(câu cố định\))?:\s*/, '').replace(/^./, c=> c.toLocaleUpperCase('vi'));
const chName = (gr, ci)=> String(((PPCT[gr] || [])[ci] || {}).ten || 'Chương ' + (ci + 1)).replace(/\s*\(lớp \d+\)$/, '');
const baiName = (gr, ci, bi)=> (((PPCT[gr] || [])[ci] || {}).bai || [])[bi] || '';
const grades = ()=> [...new Set(KEYS.map(k=> G[k].grade))].sort((a, b)=> a - b);
function math(el){ try{ renderMathInElement(el, {delimiters:[{left:'$$', right:'$$', display:true}, {left:'$', right:'$', display:false}], throwOnError:false}); }catch(e){} }
const noDot = s=> String(s || '').trim().replace(/\.+$/, '');

/* ---------- cài app lên màn hình (0.3.1) ----------
   Android/Chrome: giữ sự kiện beforeinstallprompt để nút "Cài IMs" mở hộp cài của máy. iPhone: Apple không cho web tự cài → hướng dẫn Chia sẻ → Thêm vào MH chính.
   Trình duyệt trong Zalo/Facebook/Messenger không cài được → nhắc mở bằng Chrome/Safari. */
let INST = null, INSTALLED = false;
window.addEventListener('beforeinstallprompt', e=>{ e.preventDefault(); INST = e; if(location.hash === '#/caidat') vCai(); });
window.addEventListener('appinstalled', ()=>{ INST = null; INSTALLED = true; if(location.hash === '#/caidat') vCai(); });
const UA = navigator.userAgent || '';
const standalone = ()=> (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
const isIOS = ()=> /iPhone|iPad|iPod/.test(UA) || (/Macintosh/.test(UA) && navigator.maxTouchPoints > 1);
const inApp = ()=> /Zalo|FBAN|FBAV|FB_IAB|Messenger|Instagram|Line\/|TikTok/i.test(UA);
const APP_URL = 'https://chudinhcoi-afk.github.io/ims/';

/* ---------- gói học (0.3) ----------
   Chưa có gói: mỗi ngày làm miễn phí FREE câu (đếm theo DB.days). Có gói còn hạn, hoặc tài khoản quản trị: không giới hạn.
   Lưu ý: khoá ở phía app (đủ cho học sinh phổ thông); muốn chặn tuyệt đối phải sinh câu trên máy chủ. */
const FREE = 10;
const PLANS = {'3m':{label:'Gói 3 tháng', months:3}, '1y':{label:'Gói 1 năm', months:12}, 'thpt':{label:'Gói đến hết kỳ thi THPT', thpt:true}};
const toDate = t=> t ? (t.toDate ? t.toDate() : new Date(t)) : null;
function planUntil(code, from){      // hạn mới của gói, cộng tiếp từ hạn cũ nếu còn
  const P = PLANS[code], d = new Date(from); if(P.months){ d.setMonth(d.getMonth() + P.months); d.setHours(23, 59, 59, 0); return d; }
  const y = d.getMonth() >= 6 ? d.getFullYear() + 1 : d.getFullYear(); return new Date(y, 5, 30, 23, 59, 59);   // 30/6 năm thi
}
const planLabel = pl=> pl ? (pl.label || (PLANS[pl.plan] || {}).label || pl.plan) : '';
function paid(){ if(!C || C.state === 'off' || C.state === 'offline' || C.state === 'loading' || (C.state === 'in' && !C.loaded)) return true; if(C.admin) return true;   // đang tải tài khoản: chưa khoá vội
  const pl = C.plan, u = pl && toDate(pl.until); return !!(pl && pl.plan && pl.plan !== 'free' && u && u > new Date()); }
const freeLeft = ()=> Math.max(0, FREE - (DB.days[today()] || 0));
function canDo(n){ if(paid() || freeLeft() >= n) return true; location.hash = '#/goi'; return false; }

/* ---------- câu hỏi ---------- */
function newItem(key){ const it = practiceGenItem(key); if(!it) return null; const q = it.data;
  if(it.hinhthuc === 'TN'){ q.ords = ['A','B','C','D']; }
  return {key, kind:it.hinhthuc, q, ans:null, done:false, ok:null}; }
function figHtml(q){ if(!q.hinhVe) return ''; try{ return `<div class="fig">${renderHinhVeHtml(q.hinhVe, {hocSinh:true})}</div>`; }catch(e){ return ''; } }
function qHtml(c, idx){
  const q = c.q, k = c.kind, done = c.done; let h = `<div class="qcard"><div>${k === 'DS' ? (q.dannhap || q.cauhoi || '') : (q.cauhoi || '')}</div>${figHtml(q)}`;
  if(k === 'TN') h += `<div class="opts">${['A','B','C','D'].map(L=>{ const cls = done ? (L === q.dapan ? 'isok' : (c.ans === L ? 'isno' : '')) : (c.ans === L ? 'sel' : ''); return `<button class="opt ${cls}" ${done ? 'disabled' : ''} onclick="IMS.pick(${idx},'${L}')"><b>${L}</b><span>${noDot(q[L])}.</span></button>`; }).join('')}</div>`;
  else if(k === 'DS') h += (q.menhde || []).map((m, j)=>{ const a = (c.ans || [])[j], tr = m.dung ? 'Đ' : 'S';
      const cl = v=> done ? (v === tr ? 'isok' : (a === v ? 'isno' : '')) : (a === v ? 'sel' : '');
      return `<div class="ds"><span class="tx"><b>${m.label || 'abcd'[j]})</b> ${m.text}</span><button class="${cl('Đ')}" ${done ? 'disabled' : ''} onclick="IMS.pickDS(${idx},${j},'Đ')">Đ</button><button class="${cl('S')}" ${done ? 'disabled' : ''} onclick="IMS.pickDS(${idx},${j},'S')">S</button></div>`; }).join('');
  else if(k === 'TLN') h += `<input class="ans" inputmode="decimal" placeholder="Nhập đáp số" value="${esc(c.ans || '')}" ${done ? 'disabled' : ''} oninput="IMS.typed(${idx},this.value)">${done ? `<div class="muted" style="text-align:center">Đáp số đúng: <b>${esc(String(q.dapan).replace('.', ','))}</b></div>` : ''}`;
  else if(k === 'TL') h += `<div class="muted" style="margin-top:8px">Câu tự luận: làm ra giấy, rồi bấm <b>Xem lời giải</b> và tự đánh giá.</div>`;
  return h + `</div>`; }
function grade(c){ const q = c.q;
  if(c.kind === 'TN') return c.ans === q.dapan;
  if(c.kind === 'DS') return (q.menhde || []).every((m, j)=> (c.ans || [])[j] === (m.dung ? 'Đ' : 'S'));
  if(c.kind === 'TLN') return !!c.ans && sameShortAnswer(String(c.ans).trim(), String(q.dapan));
  return c.ok; }
const answered = c=> c.kind === 'TN' ? !!c.ans : c.kind === 'DS' ? (c.ans || []).filter(Boolean).length === (c.q.menhde || []).length : c.kind === 'TLN' ? !!String(c.ans || '').trim() : true;

/* ---------- màn hình ---------- */
function setTab(t){ document.querySelectorAll('#tabs a').forEach(a=> a.classList.toggle('on', a.dataset.t === t)); }
function topRight(){ const n = DB.days[today()] || 0, t = !paid() ? `<a class="free" href="#/goi" title="Mỗi ngày làm miễn phí ${FREE} câu">Miễn phí: còn ${freeLeft()}/${FREE}</a>` : n ? `<span>Hôm nay: ${n} câu</span>` : '';
  let a = ''; if(C && C.state !== 'off'){ const u = C.state === 'in' && C.user, nm = u && ((C.profile && C.profile.name) || u.displayName || u.email || '?');
    a = u ? `<a class="acct in" href="#/taikhoan" title="${esc(nm)}">${esc(String(nm).trim().split(/\s+/).pop().charAt(0).toLocaleUpperCase('vi'))}</a>` : `<a class="acct" href="#/taikhoan">Đăng nhập</a>`; }
  $('topRight').innerHTML = t + a; }
function vLuyen(){
  setTab('luyen'); const gs = grades(); if(!gs.includes(DB.grade)) DB.grade = gs.at(-1);
  const ks = KEYS.filter(k=> G[k].grade === DB.grade), cis = [...new Set(ks.map(k=> G[k].ci))].sort((a, b)=> a - b);
  let h = `<h1>Luyện tập theo dạng</h1><div class="chips">${gs.map(g=> `<button class="chip ${g === DB.grade ? 'on' : ''}" onclick="IMS.grade(${g})">Lớp ${g}</button>`).join('')}</div>`;
  if(PACK && PACK.dev) h += `<div class="notice">Bản chạy thử: đang dùng toàn bộ bộ sinh của MathBank. Bản phát hành chỉ có các dạng giáo viên đã duyệt.</div>`;
  h += cis.map(ci=>{ const a = ks.filter(k=> G[k].ci === ci), bis = [...new Set(a.map(k=> G[k].bi))].sort((x, y)=> x - y), tried = a.filter(k=> DB.by[k]).length;
    return `<details class="ch"><summary>${esc(chName(DB.grade, ci))}<span class="n">${tried}/${a.length} dạng</span></summary>` + bis.map(bi=> `<div class="bai">${esc(baiName(DB.grade, ci, bi))}</div>` + a.filter(k=> G[k].bi === bi).map(k=>{ const p = pct(k);
      return `<div class="dang" onclick="IMS.startDang('${k}')"><span class="kind ${G[k].kind || 'TN'}">${KS[G[k].kind || 'TN']}</span><span class="t">${esc(name(G[k]))}</span><span class="pct ${p >= 80 ? 'good' : ''}">${p == null ? '' : p + '%'}</span></div>`; }).join('')).join('') + `</details>`; }).join('');
  $('view').innerHTML = h || '<div class="empty">Chưa có bộ câu hỏi.</div>'; }
function vDe(){
  setTab('de'); const gs = grades(); if(!gs.includes(DB.grade)) DB.grade = gs.at(-1);
  const ks = KEYS.filter(k=> G[k].grade === DB.grade), cis = [...new Set(ks.map(k=> G[k].ci))].sort((a, b)=> a - b), sel = DB.deSel && DB.deSel.g === DB.grade ? DB.deSel.cis : [];
  $('view').innerHTML = `<h1>Làm đề theo chủ đề</h1><div class="chips">${gs.map(g=> `<button class="chip ${g === DB.grade ? 'on' : ''}" onclick="IMS.grade(${g},'de')">Lớp ${g}</button>`).join('')}</div>
    <div class="card"><b>Chọn chương</b>${cis.map(ci=> `<label class="ck"><input type="checkbox" value="${ci}" ${sel.includes(ci) ? 'checked' : ''} class="deci"> ${esc(chName(DB.grade, ci))} <span class="muted">(${ks.filter(k=> G[k].ci === ci).length} dạng)</span></label>`).join('')}</div>
    <div class="card"><b>Số câu</b><div class="chips" style="margin-top:8px">${[10, 20, 30].map(n=> `<button class="chip ${(DB.deN || 10) === n ? 'on' : ''}" onclick="IMS.deN(${n})">${n} câu</button>`).join('')}</div>
    <b>Hình thức</b><div class="chips" style="margin-top:8px">${['TN','DS','TLN'].map(k=> `<button class="chip ${(DB.deK || ['TN','DS','TLN']).includes(k) ? 'on' : ''}" onclick="IMS.deK('${k}')">${KN[k]}</button>`).join('')}</div></div>
    <button class="btn gold" style="width:100%" onclick="IMS.startDe()">Bắt đầu làm đề</button><p class="muted">Mỗi lần làm là một đề mới, số liệu khác. Làm xong bấm Nộp bài để xem điểm và lời giải từng câu.</p>`; }
function vSai(){
  setTab('sai'); const ks = Object.keys(DB.wrong).filter(k=> G[k] && KEYS.includes(k)).sort((a, b)=> DB.wrong[b] - DB.wrong[a]);
  $('view').innerHTML = `<h1>Ôn lỗi sai</h1><p class="muted">Các dạng em từng làm sai. Làm đúng 3 lần liên tiếp thì dạng đó ra khỏi danh sách.</p>` + (ks.length ? `<button class="btn gold" style="width:100%;margin-bottom:12px" onclick="IMS.startSai()">Ôn tất cả (${ks.length} dạng)</button><div class="card" style="padding:0">${ks.map(k=> `<div class="dang" onclick="IMS.startDang('${k}')"><span class="kind ${G[k].kind || 'TN'}">${KS[G[k].kind || 'TN']}</span><span class="t">${esc(name(G[k]))}<br><span class="muted">Lớp ${G[k].grade} · sai ${DB.wrong[k]} lần</span></span></div>`).join('')}</div>` : '<div class="empty">Chưa có lỗi sai nào. Luyện tập thêm nhé!</div>'); }
function vTienDo(){
  setTab('tiendo'); const all = Object.values(DB.by), n = all.reduce((s, r)=> s + r.n, 0), ok = all.reduce((s, r)=> s + r.ok, 0), days = Object.keys(DB.days).sort();
  let streak = 0; for(let d = new Date(); ; d.setDate(d.getDate() - 1)){ const k = d.toISOString().slice(0, 10); if(DB.days[k]) streak++; else if(k !== today()) break; if(streak > 999) break; }
  const gs = grades(); let h = `<h1>Tiến độ</h1><div class="stat"><div><b>${n}</b><span>câu đã làm</span></div><div><b>${n ? Math.round(100*ok/n) : 0}%</b><span>làm đúng</span></div><div><b>${streak}</b><span>ngày liên tiếp</span></div></div>`;
  gs.forEach(g=>{ const ks = KEYS.filter(k=> G[k].grade === g), cis = [...new Set(ks.map(k=> G[k].ci))].sort((a, b)=> a - b);
    h += `<h2>Lớp ${g}</h2>` + cis.map(ci=>{ const a = ks.filter(k=> G[k].ci === ci), done = a.filter(k=> (pct(k) || 0) >= 80).length;
      return `<div class="card" style="padding:10px 14px"><div class="row" style="justify-content:space-between"><span>${esc(chName(g, ci))}</span><span class="muted">${done}/${a.length} dạng thành thạo</span></div><div class="bar"><i style="width:${a.length ? Math.round(100*done/a.length) : 0}%"></i></div></div>`; }).join(''); });
  h += `<p class="muted">Một dạng được tính là thành thạo khi em làm đúng từ 80% số câu trở lên. ${C && C.state === 'in' && C.user ? `Tiến độ được lưu vào tài khoản ${esc(C.user.email || '')}.` : C && C.state !== 'off' ? `Dữ liệu đang lưu trên máy này. <a href="#/taikhoan">Đăng nhập</a> để không mất tiến độ khi đổi máy.` : 'Dữ liệu lưu trên máy này.'}</p>${standalone() ? '' : `<a class="btn sec" href="#/caidat" style="display:block;text-align:center;margin:8px 0">📲 Cài IMs lên màn hình</a>`}<p class="muted">IMs ${VER} · gói câu hỏi ${PACK && PACK.at ? new Date(PACK.at).toLocaleDateString('vi-VN') : ''} · ${KEYS.length} dạng</p>`;
  $('view').innerHTML = h; }
/* ---------- phiên làm bài ---------- */
const goLam = ()=>{ if(location.hash === '#/lam') vLam(); else location.hash = '#/lam'; };
const backOf = d=> (location.hash && !/^#\/(lam|ketqua|xem)/.test(location.hash)) ? location.hash : d;
function startDang(key){ if(!canDo(1)) return; S = {mode:'dang', keys:[key], items:[newItem(key)], i:0, back:backOf('#/luyen')}; goLam(); }
function startSai(){ const ks = Object.keys(DB.wrong).filter(k=> G[k] && KEYS.includes(k)); if(!ks.length || !canDo(1)) return; S = {mode:'sai', keys:ks, items:[newItem(ks[0])], i:0, back:'#/sai', qi:0}; goLam(); }
function startDe(){
  const cis = [...document.querySelectorAll('.deci:checked')].map(x=> +x.value), kinds = DB.deK || ['TN','DS','TLN'], n = DB.deN || 10;
  if(!cis.length){ alert('Hãy chọn ít nhất một chương.'); return; } DB.deSel = {g:DB.grade, cis}; save();
  if(!paid() && freeLeft() < n){ if(freeLeft() > 0) alert(`Hôm nay em còn ${freeLeft()} câu miễn phí, chưa đủ cho đề ${n} câu. Hãy chọn đề ngắn hơn hoặc mua gói học.`); else location.hash = '#/goi'; return; }
  let ks = KEYS.filter(k=> G[k].grade === DB.grade && cis.includes(G[k].ci) && kinds.includes(G[k].kind || 'TN')); if(!ks.length){ alert('Các chương đã chọn chưa có dạng thuộc hình thức này.'); return; }
  ks = ks.sort(()=> Math.random() - 0.5); const pick = []; for(let i = 0; i < n; i++) pick.push(ks[i % ks.length]);
  const R = {TN:0, DS:1, TLN:2}; pick.sort((a, b)=> R[G[a].kind || 'TN'] - R[G[b].kind || 'TN']);
  const items = pick.map(newItem).filter(Boolean); S = {mode:'de', items, i:0, back:'#/de', t0:Date.now()}; goLam(); }
function vLam(){
  if(!S){ location.hash = '#/luyen'; return; } const c = S.items[S.i]; if(!c){ $('view').innerHTML = '<div class="empty">Không sinh được câu hỏi.</div>'; return; }
  const de = S.mode === 'de', g = G[c.key];
  let h = `<div class="qhead"><a class="back" href="${S.back}">‹</a><span>${de ? `Câu ${S.i + 1}/${S.items.length}` : esc(name(g))}</span><span style="margin-left:auto" class="kind ${c.kind}">${KN[c.kind]}</span></div>${qHtml(c, S.i)}`;
  if(de){ h += `<div class="row"><button class="btn sec" ${S.i ? '' : 'disabled'} onclick="IMS.go(-1)">‹ Câu trước</button>${S.i < S.items.length - 1 ? `<button class="btn" onclick="IMS.go(1)">Câu sau ›</button>` : `<button class="btn gold" onclick="IMS.submit()">Nộp bài</button>`}</div><p class="muted" style="text-align:center">Đã làm ${S.items.filter(answered).length}/${S.items.length} câu</p>`; }
  else if(!c.done){ h += c.kind === 'TL' ? `<button class="btn" style="width:100%" onclick="IMS.check()">Xem lời giải</button>` : `<button class="btn" style="width:100%" ${answered(c) ? '' : 'disabled'} id="chk" onclick="IMS.check()">Kiểm tra</button>`; }
  else { h += c.kind === 'TL' && c.ok == null ? `<div class="lg"><b>Lời giải.</b> ${c.q.loigiai || ''}</div><div class="row" style="margin-top:10px"><button class="btn" onclick="IMS.self(true)">Em làm đúng</button><button class="btn sec" onclick="IMS.self(false)">Chưa đúng</button></div>`
      : `<div class="fb ${c.ok ? 'ok' : 'no'}">${c.ok ? '✓ Chính xác!' : '✗ Chưa đúng — xem lời giải bên dưới.'}</div><div class="lg"><b>Lời giải.</b> ${c.q.loigiai || ''}</div><div class="row" style="margin-top:12px">${S.mode === 'sai' ? `<button class="btn" onclick="IMS.nextSai()">Câu tiếp ›</button>` : `<button class="btn" onclick="IMS.again()">Câu khác cùng dạng ›</button>`}</div>`; }
  $('view').innerHTML = h; math($('view')); window.scrollTo(0, 0); }
function vKetQua(){
  if(!S || !S.res){ location.hash = '#/de'; return; } const r = S.res, mins = Math.max(1, Math.round((S.t1 - S.t0)/60000));
  let h = `<div class="qhead"><a class="back" href="#/de">‹</a><span>Kết quả</span></div><div class="score">${r.ok}/${r.n}</div><p class="muted" style="text-align:center">Đúng ${Math.round(100*r.ok/r.n)}% · ${mins} phút</p><div class="card" style="padding:4px 14px">`;
  h += S.items.map((c, i)=> `<div class="rv" onclick="IMS.review(${i})"><span class="mk ${c.ok ? 'ok' : 'no'}">${c.ok ? '✓' : '✗'}</span><span style="flex:1">Câu ${i + 1}. ${esc(name(G[c.key]))}</span><span class="muted">›</span></div>`).join('');
  h += `</div><div class="row"><button class="btn gold" onclick="IMS.startDe2()">Làm đề mới</button><button class="btn sec" onclick="location.hash='#/sai'">Ôn lỗi sai</button></div>`;
  $('view').innerHTML = h; }
function vXem(){ if(!S || !S.res){ location.hash = '#/de'; return; } const i = S.rv || 0, c = S.items[i];
  $('view').innerHTML = `<div class="qhead"><a class="back" href="#/ketqua">‹</a><span>Câu ${i + 1}/${S.items.length}</span></div>${qHtml(c, i)}<div class="fb ${c.ok ? 'ok' : 'no'}">${c.ok ? '✓ Đúng' : '✗ Sai'}</div><div class="lg"><b>Lời giải.</b> ${c.q.loigiai || ''}</div><div class="row" style="margin-top:12px"><button class="btn sec" ${i ? '' : 'disabled'} onclick="IMS.review(${i - 1})">‹ Câu trước</button><button class="btn sec" ${i < S.items.length - 1 ? '' : 'disabled'} onclick="IMS.review(${i + 1})">Câu sau ›</button></div>`;
  math($('view')); window.scrollTo(0, 0); }
/* ---------- trang cài đặt (0.3.1) ---------- */
function vCai(){
  setTab(''); let h = `<div class="qhead"><a class="back" href="#/luyen">‹</a><span>Cài IMs lên màn hình</span></div>`;
  const step = (n, t)=> `<div class="step"><b>${n}</b><span>${t}</span></div>`;
  if(standalone() || INSTALLED) h += `<div class="fb ok">✓ IMs đã được cài trên máy này. Từ nay em mở IMs bằng biểu tượng <b>∞ IMs</b> trên màn hình.</div><a class="btn" style="display:block;text-align:center" href="#/luyen">Vào luyện tập ›</a>`;
  else if(inApp()) h += `<div class="card"><b>Em đang mở IMs trong ${/Zalo/i.test(UA) ? 'Zalo' : 'ứng dụng nhắn tin'}</b><p class="muted" style="margin:6px 0 0">Trình duyệt trong Zalo/Facebook không cài được ứng dụng. Hãy mở IMs bằng ${isIOS() ? 'Safari' : 'Chrome'}:</p></div>`
      + step(1, `Bấm nút <b>⋯</b> (hoặc <b>⋮</b>) ở góc trên bên phải, chọn <b>Mở bằng trình duyệt</b> / <b>Mở trong ${isIOS() ? 'Safari' : 'Chrome'}</b>.`)
      + step(2, `Hoặc bấm nút dưới đây để chép link, rồi dán vào ${isIOS() ? 'Safari' : 'Chrome'}.`)
      + `<button class="btn gold" style="width:100%" onclick="IMS.copyLink()">Chép link cài đặt</button><div class="copy" id="cpMsg">${APP_URL}#/caidat</div>`;
  else if(isIOS()) h += `<div class="card"><b>Cài trên iPhone / iPad (2 bước)</b><p class="muted" style="margin:6px 0 0">Mở trang này bằng <b>Safari</b> rồi làm như sau:</p></div>`
      + step(1, `Bấm nút <b>Chia sẻ</b> <span class="ic">⬆︎</span> ở thanh dưới cùng của Safari (iPad: góc trên bên phải).`)
      + step(2, `Kéo xuống, chọn <b>Thêm vào MH chính</b> (Add to Home Screen) → bấm <b>Thêm</b>.`)
      + `<p class="muted">Xong rồi, trên màn hình có biểu tượng <b>∞ IMs</b>. Mở IMs từ biểu tượng đó để dùng như một ứng dụng, luyện được cả khi mất mạng.</p>`;
  else if(INST) h += `<div class="card"><b>Cài IMs như một ứng dụng</b><p class="muted" style="margin:6px 0 0">Có biểu tượng trên màn hình, mở nhanh, toàn màn hình, luyện được cả khi mất mạng. Không cần vào CH Play.</p></div>`
      + `<button class="btn gold big" style="width:100%" onclick="IMS.install()">📲 Cài IMs lên màn hình</button><p class="muted" style="text-align:center">Máy sẽ hỏi lại một lần — bấm <b>Cài đặt</b>.</p>`;
  else h += `<div class="card"><b>Cài IMs lên màn hình</b><p class="muted" style="margin:6px 0 0">Nếu không thấy nút cài, em làm thủ công:</p></div>`
      + step(1, `Mở trang này bằng <b>Chrome</b> (Android) hoặc Chrome/Edge (máy tính).`)
      + step(2, `Bấm nút <b>⋮</b> ở góc trên bên phải → chọn <b>Thêm vào màn hình chính</b> / <b>Cài đặt ứng dụng</b>. Trên máy tính: bấm biểu tượng cài đặt ở cuối thanh địa chỉ.`)
      + `<p class="muted">Nếu máy đã cài IMs rồi thì nút cài sẽ không hiện — em tìm biểu tượng <b>∞ IMs</b> trên màn hình.</p>`;
  $('view').innerHTML = h; }
async function install(){ if(!INST){ vCai(); return; } INST.prompt(); try{ const r = await INST.userChoice; if(r && r.outcome === 'accepted') INSTALLED = true; }catch(e){} INST = null; vCai(); }
async function copyLink(){ const u = APP_URL + '#/caidat'; try{ await navigator.clipboard.writeText(u); $('cpMsg').innerHTML = '✓ Đã chép link. Mở ' + (isIOS() ? 'Safari' : 'Chrome') + ', dán vào thanh địa chỉ.'; }catch(e){ $('cpMsg').textContent = u; } }

/* ---------- gói học, quản trị (0.3) ---------- */
function vGoi(){
  setTab(''); const pl = C && C.plan, u = pl && toDate(pl.until), signed = C && C.state === 'in' && C.user;
  let h = `<div class="qhead"><a class="back" href="#/luyen">‹</a><span>Gói học</span></div>`;
  if(paid()) h += `<div class="fb ok">${C && C.admin ? 'Tài khoản quản trị: không giới hạn số câu.' : `Em đang dùng ${esc(planLabel(pl))}${u ? ' đến hết ngày ' + u.toLocaleDateString('vi-VN') : ''}. Luyện không giới hạn!`}</div>`;
  else h += `<div class="card"><b>${freeLeft() ? `Hôm nay em còn ${freeLeft()}/${FREE} câu miễn phí` : `Em đã dùng hết ${FREE} câu miễn phí hôm nay`}</b><p class="muted" style="margin:6px 0 0">Mỗi ngày IMs tặng ${FREE} câu để luyện thử mọi dạng. Mua gói học để luyện không giới hạn, làm đề đủ ${30} câu, ôn hết lỗi sai.</p>${u && u <= new Date() ? `<p class="muted">${esc(planLabel(pl))} của em đã hết hạn ngày ${u.toLocaleDateString('vi-VN')}.</p>` : ''}</div>`;
  const now = new Date();
  h += `<h2>Các gói học</h2>` + Object.entries(PLANS).map(([k, P])=> `<div class="card plan"><b>${P.label}</b><span class="muted">${P.months ? 'Luyện không giới hạn trong ' + (P.months === 12 ? '1 năm' : P.months + ' tháng') : 'Luyện không giới hạn đến hết ngày ' + planUntil(k, now).toLocaleDateString('vi-VN') + ' (sau kỳ thi tốt nghiệp THPT)'}</span></div>`).join('');
  h += `<div class="card"><b>Cách mua</b><p class="muted" style="margin:6px 0 0">Liên hệ thầy/cô phụ trách IMs, báo <b>email tài khoản</b> của em và gói muốn mua. Sau khi thanh toán, gói được kích hoạt ngay trên tài khoản — mở lại mục này là thấy.</p>${signed ? `<div class="copy">Email tài khoản: <b>${esc(C.user.email || '')}</b></div>` : `<a class="btn gold" style="display:block;text-align:center;margin-top:10px" href="#/taikhoan">Đăng nhập / tạo tài khoản để mua gói</a>`}</div>`;
  if(signed) h += `<button class="btn sec" style="width:100%" onclick="IMS.refreshPlan()">Kiểm tra lại gói của em</button>`;
  $('view').innerHTML = h; }
let QT = {q:'', found:null, list:null, msg:'', busy:false};
function vQT(){
  setTab(''); if(!C || !C.admin){ location.hash = '#/taikhoan'; return; }
  let h = `<div class="qhead"><a class="back" href="#/taikhoan">‹</a><span>Quản trị gói học</span></div>`;
  h += `<div class="card"><b>Tìm học sinh</b><p class="muted" style="margin:4px 0 8px">Nhập email tài khoản (hoặc mã UID). Học sinh phải đăng nhập và lưu hồ sơ ít nhất một lần.</p><div class="row"><input id="qtQ" class="inp" type="email" placeholder="email@gmail.com" value="${esc(QT.q)}" autocapitalize="off" style="flex:1"><button class="btn" ${QT.busy ? 'disabled' : ''} onclick="IMS.qtFind()">Tìm</button></div>${QT.msg ? `<div class="fb ${/^✓/.test(QT.msg) ? 'ok' : 'no'}" style="margin-top:8px">${esc(QT.msg)}</div>` : ''}</div>`;
  (QT.found || []).forEach((f, i)=>{ const u = f.plan && toDate(f.plan.until), on = u && u > new Date() && f.plan.plan !== 'free';
    h += `<div class="card"><b>${esc(f.name || '(chưa có tên)')}</b> <span class="muted">· Lớp ${esc(f.grade || '?')}${f.school ? ' · ' + esc(f.school) : ''}</span><div class="muted">${esc(f.email || '')}</div>
      <div style="margin:8px 0">Gói hiện tại: ${f.plan ? `<b>${esc(planLabel(f.plan))}</b> · ${on ? 'còn hạn đến ' : 'đã hết hạn '}${u ? u.toLocaleDateString('vi-VN') : ''}` : '<b>chưa có</b>'}</div>
      <input id="qtNote${i}" class="inp" type="text" placeholder="Ghi chú (ví dụ: đã chuyển khoản 31/10)" style="margin-bottom:8px">
      <div class="chips">${Object.entries(PLANS).map(([k, P])=> `<button class="chip" ${QT.busy ? 'disabled' : ''} onclick="IMS.qtGrant(${i},'${k}')">${on ? 'Gia hạn' : 'Cấp'} ${P.label.replace('Gói ', '')}</button>`).join('')}${f.plan && on ? `<button class="chip" ${QT.busy ? 'disabled' : ''} onclick="IMS.qtRevoke(${i})">Thu hồi</button>` : ''}</div></div>`; });
  h += `<h2>Danh sách gói đã cấp</h2>` + (QT.list == null ? `<button class="btn sec" style="width:100%" onclick="IMS.qtList()">Tải danh sách</button>` : QT.list.length ? `<div class="card" style="padding:4px 14px">${QT.list.map(o=>{ const u = toDate(o.until), on = u && u > new Date() && o.plan !== 'free', soon = on && (u - new Date()) < 14*864e5;
      return `<div class="rv"><span class="mk ${on ? 'ok' : 'no'}">${on ? '✓' : '✗'}</span><span style="flex:1">${esc((o.user && o.user.name) || o.uid)}<br><span class="muted">${esc((o.user && o.user.email) || '')} · ${esc(planLabel(o))}</span></span><span class="muted" style="text-align:right">${u ? u.toLocaleDateString('vi-VN') : ''}${soon ? '<br><b style="color:#b3261e">sắp hết hạn</b>' : ''}</span></div>`; }).join('')}</div>` : '<div class="empty">Chưa cấp gói nào.</div>');
  $('view').innerHTML = h; }
async function qtFind(){ QT.q = val('qtQ'); QT.msg = ''; QT.found = null; if(!QT.q){ QT.msg = 'Hãy nhập email.'; return vQT(); }
  QT.busy = true; vQT();
  try{ const r = await C.findUsers(QT.q); QT.found = await Promise.all(r.map(async u=> ({...u, plan: await C.planOf(u.uid)}))); if(!QT.found.length) QT.msg = 'Không tìm thấy tài khoản có email này. Nhắc học sinh đăng nhập IMs và bấm Lưu hồ sơ trước.'; }
  catch(e){ QT.msg = C.msg(e); }
  QT.busy = false; vQT(); }
async function qtGrant(i, code){ const f = QT.found[i], P = PLANS[code], cur = f.plan && toDate(f.plan.until), base = cur && cur > new Date() && f.plan.plan !== 'free' ? cur : new Date(), until = planUntil(code, base), note = val('qtNote' + i);
  if(!confirm(`${f.name || f.email}\n${P.label} — hạn đến hết ngày ${until.toLocaleDateString('vi-VN')}${note ? '\nGhi chú: ' + note : ''}\n\nXác nhận cấp gói?`)) return;
  QT.busy = true; vQT();
  try{ await C.setPlan(f.uid, code, P.label, until, note); f.plan = await C.planOf(f.uid); QT.msg = `✓ Đã cấp ${P.label} cho ${f.name || f.email} đến ${until.toLocaleDateString('vi-VN')}.`; QT.list = null; }
  catch(e){ QT.msg = C.msg(e); }
  QT.busy = false; vQT(); }
async function qtRevoke(i){ const f = QT.found[i]; if(!confirm(`Thu hồi gói của ${f.name || f.email}? Học sinh quay về ${FREE} câu miễn phí mỗi ngày.`)) return;
  QT.busy = true; vQT();
  try{ await C.setPlan(f.uid, 'free', 'Đã thu hồi', new Date(), val('qtNote' + i) || 'thu hồi'); f.plan = await C.planOf(f.uid); QT.msg = `✓ Đã thu hồi gói của ${f.name || f.email}.`; QT.list = null; }
  catch(e){ QT.msg = C.msg(e); }
  QT.busy = false; vQT(); }
async function qtList(){ QT.busy = true; try{ QT.list = await C.listPlans(); }catch(e){ QT.msg = C.msg(e); QT.list = null; } QT.busy = false; vQT(); }

/* ---------- tài khoản ---------- */
let AM = 'login', BUSY = false, AERR = '', AOK = '', EDIT = false, curUid = null, FORM = {};   // FORM: giữ chữ đã gõ khi vẽ lại màn hình
const gradeSel = (id, v)=> `<select id="${id}" class="inp">${[10, 11, 12].map(g=> `<option value="${g}" ${+(id in FORM ? FORM[id] : v) === g ? 'selected' : ''}>Lớp ${g}</option>`).join('')}</select>`;
const fld = (lab, html)=> `<label class="fl"><span>${lab}</span>${html}</label>`;
const inp = (id, type, ph, v)=> `<input id="${id}" class="inp" type="${type}" placeholder="${ph}" value="${esc(id in FORM ? FORM[id] : v || '')}" ${type === 'email' ? 'autocomplete="email" autocapitalize="off"' : type === 'password' ? 'autocomplete="current-password"' : ''}>`;
const val = id=> ($(id) && $(id).value || '').trim();
function vTK(){
  document.querySelectorAll('#view .inp').forEach(x=>{ FORM[x.id] = x.value; });
  setTab(''); let h = `<div class="qhead"><a class="back" href="#/luyen">‹</a><span>Tài khoản</span></div>`;
  const st = C ? C.state : 'off', msgs = (AERR ? `<div class="fb no">${esc(AERR)}</div>` : '') + (AOK ? `<div class="fb ok">${esc(AOK)}</div>` : '');
  if(st === 'off') h += `<div class="empty">Bản này chưa bật đăng nhập. Tiến độ lưu trên máy.</div>`;
  else if(st === 'loading') h += `<div class="loading">Đang kết nối…</div>`;
  else if(st === 'offline') h += `<div class="card"><b>Chưa kết nối được máy chủ</b><p class="muted">Có thể máy đang mất mạng. Em vẫn luyện tập được, tiến độ lưu tạm trên máy này và sẽ được gộp vào tài khoản khi đăng nhập.</p><button class="btn" style="width:100%" onclick="location.reload()">Thử lại</button></div>`;
  else if(st === 'out'){
    if(CF.requireLogin) h += `<div class="notice">Đăng nhập để bắt đầu luyện tập. Tiến độ của em được lưu vào tài khoản, đổi máy vẫn còn.</div>`;
    h += `<div class="chips">${[['login', 'Đăng nhập'], ['signup', 'Tạo tài khoản']].map(([m, t])=> `<button class="chip ${AM === m || (m === 'login' && AM === 'reset') ? 'on' : ''}" onclick="IMS.am('${m}')">${t}</button>`).join('')}</div><div class="card">`;
    if(AM === 'signup') h += fld('Họ và tên', inp('fName', 'text', 'Nguyễn Văn An')) + fld('Lớp', gradeSel('fGrade', DB.grade)) + fld('Trường <span class="muted">(không bắt buộc)</span>', inp('fSchool', 'text', 'THPT …'))
      + fld('Email', inp('fEmail', 'email', 'em@gmail.com')) + fld('Mật khẩu <span class="muted">(ít nhất 6 ký tự)</span>', inp('fPass', 'password', '')) + msgs
      + `<button class="btn gold" style="width:100%" ${BUSY ? 'disabled' : ''} onclick="IMS.acct('signup')">Tạo tài khoản</button>`;
    else if(AM === 'reset') h += `<p class="muted" style="margin-top:0">Nhập email đã đăng ký. Máy chủ sẽ gửi thư có đường dẫn đặt mật khẩu mới.</p>` + fld('Email', inp('fEmail', 'email', 'em@gmail.com')) + msgs
      + `<button class="btn" style="width:100%" ${BUSY ? 'disabled' : ''} onclick="IMS.acct('reset')">Gửi thư đặt lại mật khẩu</button><p style="text-align:center;margin:10px 0 0"><a href="javascript:IMS.am('login')">‹ Quay lại đăng nhập</a></p>`;
    else h += fld('Email', inp('fEmail', 'email', 'em@gmail.com')) + fld('Mật khẩu', inp('fPass', 'password', '')) + msgs
      + `<button class="btn" style="width:100%" ${BUSY ? 'disabled' : ''} onclick="IMS.acct('login')">Đăng nhập</button><p style="text-align:center;margin:10px 0 0"><a href="javascript:IMS.am('reset')">Quên mật khẩu?</a></p>`;
    h += `</div>`;
    if(AM !== 'reset' && CF.google !== false) h += `<div class="or"><span>hoặc</span></div><button class="btn sec gg" style="width:100%" ${BUSY ? 'disabled' : ''} onclick="IMS.acct('google')"><b>G</b> Tiếp tục với Google</button>`;
    if(Object.keys(DB.by).length) h += `<p class="muted">Tiến độ em đã làm trên máy này (${Object.values(DB.by).reduce((s, r)=> s + r.n, 0)} câu) sẽ được gộp vào tài khoản sau khi đăng nhập.</p>`;
  } else {
    const u = C.user, p = C.profile;
    if(!C.loaded) h += `<div class="loading">Đang tải hồ sơ…</div>`;
    else if(!p || EDIT){ h += `<div class="card"><b>${p ? 'Sửa hồ sơ' : 'Hoàn tất hồ sơ'}</b>${p ? '' : '<p class="muted" style="margin:4px 0 0">Cho thầy cô biết em là ai và học lớp mấy.</p>'}`
        + fld('Họ và tên', inp('fName', 'text', 'Nguyễn Văn An', (p && p.name) || u.displayName)) + fld('Lớp', gradeSel('fGrade', (p && p.grade) || DB.grade)) + fld('Trường <span class="muted">(không bắt buộc)</span>', inp('fSchool', 'text', 'THPT …', p && p.school)) + msgs
        + `<div class="row"><button class="btn gold" ${BUSY ? 'disabled' : ''} onclick="IMS.acct('profile')">Lưu</button>${p ? `<button class="btn sec" onclick="IMS.edit(false)">Huỷ</button>` : ''}</div></div>`; }
    else { const pl = C.plan, until = pl && pl.until && (pl.until.toDate ? pl.until.toDate() : new Date(pl.until));
      h += `<div class="card prof"><div class="av">${esc(String(p.name || '?').trim().split(/\s+/).pop().charAt(0).toLocaleUpperCase('vi'))}</div><div style="flex:1;min-width:0"><b>${esc(p.name || '')}</b>${C.admin ? ' <span class="kind TL">Quản trị</span>' : ''}<div class="muted">${esc(u.email || '')}</div><div class="muted">Lớp ${esc(p.grade)}${p.school ? ' · ' + esc(p.school) : ''}</div></div><button class="btn sec sm" onclick="IMS.edit(true)">Sửa</button></div>`
        + `<a class="card" href="#/goi" style="display:block;color:inherit;text-decoration:none"><div class="row" style="justify-content:space-between"><b>Gói học</b><span>${C.admin ? 'Quản trị · không giới hạn' : paid() ? esc(planLabel(pl)) + (until ? ' · đến ' + until.toLocaleDateString('vi-VN') : '') : `Miễn phí ${FREE} câu/ngày ›`}</span></div></a>`
        + (C.admin ? `<a class="btn gold" href="#/quantri" style="display:block;text-align:center;margin-bottom:12px">Quản trị gói học ›</a>` : '')
        + `<div class="card"><div class="row" style="justify-content:space-between"><b>Lưu tiến độ</b><span class="muted">${C.syncErr ? '' : C.pending ? 'Đang lưu…' : C.lastSync ? 'Đã lưu lúc ' + new Date(C.lastSync).toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit'}) : 'Tự động'}</span></div>${C.syncErr ? `<div class="fb no" style="margin-top:8px">${esc(C.syncErr)} Tiến độ vẫn được giữ trên máy và sẽ lưu lại khi có mạng.</div>` : `<p class="muted" style="margin:4px 0 0">Mỗi câu em làm được lưu vào tài khoản. Đăng nhập trên máy khác sẽ thấy cùng tiến độ.</p>`}</div>`
        + (standalone() ? '' : `<a class="btn sec" href="#/caidat" style="display:block;text-align:center;margin-bottom:12px">📲 Cài IMs lên màn hình</a>`)
        + msgs + `<button class="btn sec" style="width:100%" ${BUSY ? 'disabled' : ''} onclick="IMS.acct('out')">Đăng xuất</button>`; }
  }
  $('view').innerHTML = h; }
async function acct(what){
  if(BUSY) return; AERR = AOK = ''; const g = +val('fGrade') || DB.grade;
  if(what === 'signup' && !val('fName')){ AERR = 'Hãy nhập họ và tên.'; return vTK(); }
  if(what === 'profile' && !val('fName')){ AERR = 'Hãy nhập họ và tên.'; return vTK(); }
  const f = {name:val('fName'), grade:g, school:val('fSchool')}, em = val('fEmail'), pw = $('fPass') ? $('fPass').value : '';
  BUSY = true; vTK();
  try{
    if(what === 'login') await C.signIn(em, pw);
    else if(what === 'signup'){ await C.signUp(em, pw, f); DB.grade = g; save(); }
    else if(what === 'google') await C.google();
    else if(what === 'reset'){ await C.reset(em); AOK = 'Đã gửi thư. Mở hộp thư (cả mục Thư rác) để đặt mật khẩu mới.'; }
    else if(what === 'profile'){ await C.saveProfile(f); EDIT = false; if(DB.grade !== g){ DB.grade = g; save(); } }
    else if(what === 'out') await C.signOut();
    if(what !== 'reset' && what !== 'google'){ FORM = {}; document.querySelectorAll('#view .inp').forEach(x=> x.removeAttribute('id')); }
  }catch(e){ AERR = C.msg(e); console.warn(e); }
  BUSY = false; if(location.hash === '#/taikhoan') vTK(); topRight(); }
async function syncAccount(uid){   // vừa đăng nhập: gộp tiến độ trên máy (của tài khoản + của khách) với bản trên máy chủ
  const key = LS + '_u_' + uid, mine = load(key), guest = load(LS), remote = await C.pull();
  if(curUid !== uid) return;
  let db = remote ? C.merge(mine, remote) : mine;
  if(Object.keys(guest.by).length){ db = C.merge(guest, db); try{ localStorage.setItem(LS, JSON.stringify({grade:guest.grade})); }catch(e){} }
  LSK = key; DB = norm(db); saveLocal();
  if(remote === undefined){ setTimeout(()=>{ if(curUid === uid) syncAccount(uid); }, 20000); }   // chưa đọc được máy chủ: chưa ghi đè, thử lại sau
  else { C.ready(); C.push(DB); C.watch(r=>{ DB = norm(C.merge(DB, r)); saveLocal(); if(/^#\/(luyen|sai|tiendo)?$/.test(location.hash || '')) route(); else topRight(); }); }
  route(); }
function onCloud(st){
  if(st === 'in' && C.user && curUid !== C.user.uid){ curUid = C.user.uid; AERR = ''; syncAccount(curUid); }
  if(st !== 'in' && curUid){ curUid = null; LSK = LS; DB = load(LS); S = null; }
  if(st === 'out' && CF.requireLogin && location.hash !== '#/taikhoan'){ location.hash = '#/taikhoan'; return; }
  const r = location.hash || '';
  if(r === '#/taikhoan' || r === '#/goi' || r === '#/quantri' || r === '#/caidat'){ route(); } else if(st === 'out' || st === 'offline' || !/^#\/(lam|ketqua|xem)$/.test(r)) route(); else topRight(); }
function route(){ topRight(); const r = (location.hash || '#/luyen').slice(2);
  if(C && CF.requireLogin && r !== 'taikhoan' && r !== 'caidat' && (C.state === 'out' || C.state === 'loading')){ if(C.state === 'out'){ location.hash = '#/taikhoan'; return; } $('view').innerHTML = '<div class="loading">Đang kết nối…</div>'; return; }
  ({luyen:vLuyen, de:vDe, sai:vSai, tiendo:vTienDo, lam:vLam, ketqua:vKetQua, xem:vXem, taikhoan:vTK, goi:vGoi, quantri:vQT, caidat:vCai}[r] || vLuyen)(); }

/* ---------- khởi động ---------- */
async function boot(){
  try{ const r = await fetch('pack.json', {cache:'no-cache'}); PACK = await r.json(); }catch(e){ PACK = null; }
  if(PACK && Array.isArray(PACK.keys) && PACK.keys.length) KEYS = PACK.keys.filter(k=> G[k]);
  else { PACK = {dev:true}; KEYS = Object.keys(G).filter(k=> G[k].grade >= 10); }
  KEYS = KEYS.filter(k=> PPCT[G[k].grade] && PPCT[G[k].grade][G[k].ci]);
  window.addEventListener('hashchange', ()=>{ if(location.hash === '#/taikhoan'){ AERR = AOK = ''; EDIT = false; FORM = {}; } route(); }); route();
  if(C){ C.on(onCloud); C.init(); }
  if('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(()=>{});
}
boot();
return {
  grade(g, v){ DB.grade = g; save(); v === 'de' ? vDe() : vLuyen(); },
  startDang, startSai, startDe, startDe2(){ location.hash = '#/de'; },
  deN(n){ DB.deN = n; save(); vDe(); }, deK(k){ const a = DB.deK || ['TN','DS','TLN']; DB.deK = a.includes(k) ? (a.length > 1 ? a.filter(x=> x !== k) : a) : a.concat(k); save(); vDe(); },
  pick(i, L){ const c = S.items[i]; if(c.done) return; c.ans = L; vLam(); },
  pickDS(i, j, v){ const c = S.items[i]; if(c.done) return; c.ans = c.ans || []; c.ans[j] = v; vLam(); },
  typed(i, v){ const c = S.items[i]; c.ans = v; const b = $('chk'); if(b) b.disabled = !String(v).trim(); },
  check(){ const c = S.items[S.i]; c.done = true; if(c.kind !== 'TL'){ c.ok = grade(c); record(c.key, c.ok); } vLam(); topRight(); },
  self(ok){ const c = S.items[S.i]; c.ok = ok; record(c.key, ok); vLam(); topRight(); },
  again(){ if(!canDo(1)) return; const k = S.items[S.i].key, it = newItem(k); if(it){ S.items.push(it); S.i = S.items.length - 1; } vLam(); },
  nextSai(){ const ks = Object.keys(DB.wrong).filter(k=> G[k] && KEYS.includes(k)); if(!ks.length){ alert('Hết lỗi sai rồi. Giỏi lắm!'); location.hash = '#/sai'; return; } if(!canDo(1)) return; S.qi = ((S.qi || 0) + 1) % ks.length; const it = newItem(ks[S.qi]); S.items.push(it); S.i = S.items.length - 1; vLam(); },
  go(d){ S.i = Math.max(0, Math.min(S.items.length - 1, S.i + d)); vLam(); },
  submit(){ const left = S.items.filter(c=> !answered(c)).length; if(left && !confirm(`Còn ${left} câu chưa làm. Vẫn nộp bài?`)) return;
    S.items.forEach(c=>{ c.done = true; c.ok = answered(c) ? grade(c) : false; record(c.key, c.ok); }); S.t1 = Date.now(); S.res = {n:S.items.length, ok:S.items.filter(c=> c.ok).length}; location.hash = '#/ketqua'; },
  am(m){ AM = m; AERR = AOK = ''; vTK(); }, acct, edit(v){ EDIT = v; AERR = ''; vTK(); },
  review(i){ S.rv = i; location.hash === '#/xem' ? vXem() : (location.hash = '#/xem'); },
  install, copyLink,
  async refreshPlan(){ if(C) await C.refreshPlan(); vGoi(); topRight(); }, qtFind, qtGrant, qtRevoke, qtList,
};
})();
