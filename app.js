/* IMs — Infinity Maths: app ôn luyện cho học sinh. Câu hỏi sinh mới mỗi lần từ bộ sinh của MathBank (đã được giáo viên duyệt, danh sách trong pack.json).
   Giai đoạn 1: luyện từng dạng, làm đề theo chủ đề, ôn lỗi sai, tiến độ — lưu trên máy (chưa đăng nhập). */
const IMS = (()=>{
const VER = '0.1';
const G = GENLIB.GEN, LS = 'ims_v1';
const $ = id=> document.getElementById(id);
const esc = s=> String(s == null ? '' : s).replace(/[&<>"]/g, c=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]);
const KN = {TN:'Trắc nghiệm', DS:'Đúng – sai', TLN:'Trả lời ngắn', TL:'Tự luận'}, KS = {TN:'TN', DS:'Đ–S', TLN:'TLN', TL:'TL'};
let PACK = null, KEYS = [], DB = load(), S = null;   // S: phiên làm bài đang mở
function load(){ try{ return Object.assign({by:{}, wrong:{}, days:{}, grade:12}, JSON.parse(localStorage.getItem(LS) || '{}')); }catch(e){ return {by:{}, wrong:{}, days:{}, grade:12}; } }
function save(){ try{ localStorage.setItem(LS, JSON.stringify(DB)); }catch(e){} }
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
function topRight(){ const n = DB.days[today()] || 0; $('topRight').textContent = n ? `Hôm nay: ${n} câu` : ''; }
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
  h += `<p class="muted">Một dạng được tính là thành thạo khi em làm đúng từ 80% số câu trở lên. Dữ liệu lưu trên máy này.</p><p class="muted">IMs ${VER} · gói câu hỏi ${PACK && PACK.at ? new Date(PACK.at).toLocaleDateString('vi-VN') : ''} · ${KEYS.length} dạng</p>`;
  $('view').innerHTML = h; }
/* ---------- phiên làm bài ---------- */
const goLam = ()=>{ if(location.hash === '#/lam') vLam(); else location.hash = '#/lam'; };
const backOf = d=> (location.hash && !/^#\/(lam|ketqua|xem)/.test(location.hash)) ? location.hash : d;
function startDang(key){ S = {mode:'dang', keys:[key], items:[newItem(key)], i:0, back:backOf('#/luyen')}; goLam(); }
function startSai(){ const ks = Object.keys(DB.wrong).filter(k=> G[k] && KEYS.includes(k)); if(!ks.length) return; S = {mode:'sai', keys:ks, items:[newItem(ks[0])], i:0, back:'#/sai', qi:0}; goLam(); }
function startDe(){
  const cis = [...document.querySelectorAll('.deci:checked')].map(x=> +x.value), kinds = DB.deK || ['TN','DS','TLN'], n = DB.deN || 10;
  if(!cis.length){ alert('Hãy chọn ít nhất một chương.'); return; } DB.deSel = {g:DB.grade, cis}; save();
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
function route(){ topRight(); const r = (location.hash || '#/luyen').slice(2);
  ({luyen:vLuyen, de:vDe, sai:vSai, tiendo:vTienDo, lam:vLam, ketqua:vKetQua, xem:vXem}[r] || vLuyen)(); }

/* ---------- khởi động ---------- */
async function boot(){
  try{ const r = await fetch('pack.json', {cache:'no-cache'}); PACK = await r.json(); }catch(e){ PACK = null; }
  if(PACK && Array.isArray(PACK.keys) && PACK.keys.length) KEYS = PACK.keys.filter(k=> G[k]);
  else { PACK = {dev:true}; KEYS = Object.keys(G).filter(k=> G[k].grade >= 10); }
  KEYS = KEYS.filter(k=> PPCT[G[k].grade] && PPCT[G[k].grade][G[k].ci]);
  window.addEventListener('hashchange', route); route();
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
  again(){ const k = S.items[S.i].key, it = newItem(k); if(it){ S.items.push(it); S.i = S.items.length - 1; } vLam(); },
  nextSai(){ const ks = Object.keys(DB.wrong).filter(k=> G[k] && KEYS.includes(k)); if(!ks.length){ alert('Hết lỗi sai rồi. Giỏi lắm!'); location.hash = '#/sai'; return; } S.qi = ((S.qi || 0) + 1) % ks.length; const it = newItem(ks[S.qi]); S.items.push(it); S.i = S.items.length - 1; vLam(); },
  go(d){ S.i = Math.max(0, Math.min(S.items.length - 1, S.i + d)); vLam(); },
  submit(){ const left = S.items.filter(c=> !answered(c)).length; if(left && !confirm(`Còn ${left} câu chưa làm. Vẫn nộp bài?`)) return;
    S.items.forEach(c=>{ c.done = true; c.ok = answered(c) ? grade(c) : false; record(c.key, c.ok); }); S.t1 = Date.now(); S.res = {n:S.items.length, ok:S.items.filter(c=> c.ok).length}; location.hash = '#/ketqua'; },
  review(i){ S.rv = i; location.hash === '#/xem' ? vXem() : (location.hash = '#/xem'); },
};
})();
