/* IMs — Infinity Maths: app ôn luyện cho học sinh. Câu hỏi sinh mới mỗi lần từ bộ sinh của MathBank (đã được giáo viên duyệt, danh sách trong pack.json).
   Giai đoạn 1: luyện từng dạng, làm đề theo chủ đề, ôn lỗi sai, tiến độ.
   0.2: đăng nhập (email/mật khẩu hoặc Google) và lưu tiến độ lên tài khoản qua cloud.js; chưa cấu hình Firebase thì chỉ lưu trên máy.
   0.3: gói học — chưa có gói thì mỗi ngày làm miễn phí FREE câu; quản trị cấp / gia hạn gói ngay trong app (mục Quản trị).
   0.3.1: trang cài app lên màn hình (#/caidat) — link gửi học sinh: https://chudinhcoi-afk.github.io/ims/#/caidat
   0.4: mục Lộ trình — chọn câu theo kết quả làm bài (học theo chế độ chẩn đoán của Numbas): Kiểm tra đầu vào theo chương, Luyện đến thành thạo theo chuyên đề.
   0.5: chỉ dùng ở chế độ toàn màn hình (thoát ra là app tự đóng); giao diện mới: thanh bên trên máy tính, tìm dạng, luyện tiếp, đồng hồ và bảng câu khi làm đề,
        phím tắt (A–D, Enter, ←/→), biểu đồ 14 ngày, hộp thoại trong app thay cho alert/confirm của trình duyệt (để không bật ra khỏi toàn màn hình).
   0.6: Lớp học 2D (#/lophoc, mã trong classroom.js): 48 chỗ ngồi, đi lại, vào chỗ, luyện đề ngay tại chỗ, thấy các bạn khác, nhắn riêng.
   0.6.1: tự cập nhật — có bản mới thì app tự tải lại khi đang ở màn mở đầu / màn "IMs đã đóng" (không đang làm bài), không phải tắt hẳn app rồi mở lại. */
const IMS = (()=>{
const VER = '0.6.1';
const G = GENLIB.GEN, LS = 'ims_v1';
const $ = id=> document.getElementById(id);
const esc = s=> String(s == null ? '' : s).replace(/[&<>"]/g, c=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]);
const KN = {TN:'Trắc nghiệm', DS:'Đúng – sai', TLN:'Trả lời ngắn', TL:'Tự luận'}, KS = {TN:'TN', DS:'Đ–S', TLN:'TLN', TL:'TL'};
const C = typeof CLOUD !== 'undefined' ? CLOUD : null, CF = (C && C.config) || {};
const norm = o=> Object.assign({by:{}, wrong:{}, days:{}, grade:12}, o || {});
let LSK = LS, PACK = null, KEYS = [], KSET = new Set(), DB = load(LS), S = null;   // LSK: khoá lưu trên máy (khách: ims_v1; đã đăng nhập: ims_v1_u_<uid>). S: phiên làm bài đang mở
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
const ico = id=> `<svg><use href="#i-${id}"/></svg>`;
const backBtn = href=> `<a class="back" href="${href}" aria-label="Quay lại">${ico('back')}</a>`;
const toTop = ()=>{ const v = $('view'); if(v) v.scrollTop = 0; };
const fold = s=> String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd').toLowerCase();
const mmss = ms=>{ const s = Math.max(0, Math.floor(ms/1000)); return String(Math.floor(s/60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
const LOPM = ()=> typeof LOP !== 'undefined' ? LOP : null;   // lớp học 2D (classroom.js, nạp sau app.js)
const hoverDev = ()=> !!(window.matchMedia && matchMedia('(hover:hover) and (pointer:fine)').matches);
function streak(){ let n = 0; for(let d = new Date(); ; d.setDate(d.getDate() - 1)){ const k = d.toISOString().slice(0, 10); if(DB.days[k]) n++; else if(k !== today()) break; if(n > 999) break; } return n; }

/* ---------- hộp thoại trong app (0.5): alert/confirm của trình duyệt có thể đẩy trang ra khỏi toàn màn hình ---------- */
let MDONE = null;
function ask(msg, ok = 'Đồng ý', cancel = 'Huỷ'){
  return new Promise(res=>{ const m = $('modal'); if(MDONE) MDONE(false);
    MDONE = v=>{ MDONE = null; m.hidden = true; m.innerHTML = ''; res(v); };
    m.innerHTML = `<div class="mbox" role="dialog" aria-modal="true"><p>${esc(msg)}</p><div class="row">${cancel ? `<button class="btn sec" id="mNo">${esc(cancel)}</button>` : ''}<button class="btn" id="mOk">${esc(ok)}</button></div></div>`;
    m.hidden = false; $('mOk').onclick = ()=> MDONE && MDONE(true); if($('mNo')) $('mNo').onclick = ()=> MDONE && MDONE(false);
    m.onclick = e=>{ if(e.target === m && MDONE) MDONE(false); }; $('mOk').focus(); }); }
const say = msg=> ask(msg, 'Đã hiểu', '');

/* ---------- chỉ dùng ở chế độ toàn màn hình (0.5) ----------
   • Mở app: màn chặn "Vào IMs" — trình duyệt chỉ cho bật toàn màn hình sau một lần bấm của người dùng.
   • Đang dùng mà thoát toàn màn hình (Esc, vuốt quay lại, đổi tab) hoặc rời app (chuyển ứng dụng, tắt màn hình) → IMs tự đóng:
     đề đang làm được nộp luôn, phiên luyện đang mở kết thúc, màn hình bị xoá, thử đóng cửa sổ; muốn dùng tiếp phải bấm "Mở lại" (vào lại toàn màn hình).
   • iPhone không cho trang web bật toàn màn hình → phải cài IMs lên màn hình chính (app cài chạy toàn màn hình); khi đó chỉ kiểm tra việc rời app.
   • Đăng nhập Google (cửa sổ bật lên) và hộp cài app: tạm ngừng kiểm tra, xong thì mời bấm vào lại toàn màn hình, không tính là thoát.
   • Máy tính dùng Chrome/Edge: khoá phím Esc (phải giữ Esc mới thoát) để tránh thoát nhầm. Giữ màn hình sáng khi đang dùng (Wake Lock).
   • Tắt khi chạy thử: firebase-config.js đặt kiosk:false, hoặc mở trên localhost với ?kiosk=0. Trang #/caidat (hướng dẫn cài) không bị chặn. */
const KIOSK = {on: CF.kiosk !== false && !(/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && /[?&]kiosk=0/.test(location.search)), armed:false, closed:null, pause:0, resume:false, wake:null, after:null};
const fsEl = ()=> document.fullscreenElement || document.webkitFullscreenElement || null;
const fsApi = ()=>{ const d = document.documentElement; return d.requestFullscreen || d.webkitRequestFullscreen || null; };
const appMode = ()=> !!((window.matchMedia && (matchMedia('(display-mode: fullscreen)').matches || matchMedia('(display-mode: standalone)').matches)) || navigator.standalone === true);
const fsOK = ()=> !!fsEl() || (!fsApi() && appMode());
const kExempt = ()=> /^#\/caidat/.test(location.hash || '');
function kArm(){ KIOSK.armed = true; KIOSK.resume = false; KIOSK.closed = null;
  try{ if(navigator.keyboard && navigator.keyboard.lock) navigator.keyboard.lock(['Escape']).catch(()=>{}); }catch(e){}
  try{ if(navigator.wakeLock && !KIOSK.wake) navigator.wakeLock.request('screen').then(l=>{ KIOSK.wake = l; l.addEventListener('release', ()=>{ KIOSK.wake = null; }); }).catch(()=>{}); }catch(e){}
  kRender(); }
function kEnter(){   // gọi ngay trong sự kiện bấm
  const d = document.documentElement, f = fsApi();
  if(f && !fsEl()){   // bật xong: sự kiện fullscreenchange sẽ gọi kArm
    let told = false; const fail = ()=>{ if(told || fsEl() || KIOSK.armed) return; told = true; kRender(); say('Trình duyệt này chưa cho bật toàn màn hình. Em bấm lại nút, hoặc mở IMs bằng Chrome / Edge / Safari (hoặc app IMs đã cài).'); };
    try{ const p = f.call(d, {navigationUI:'hide'}); if(p && p.catch) p.catch(fail); }catch(e){ fail(); }
    setTimeout(fail, 2500); return; }
  if(fsOK()) kArm(); else kRender(); }
function kReopen(){ const to = KIOSK.after || '#/luyen'; KIOSK.closed = null; KIOSK.after = null; if(to !== '#/ketqua') S = null;
  if(location.hash !== to) location.hash = to; else route(); kEnter(); }
function kClose(why){
  if(KIOSK.closed || !KIOSK.armed) return; KIOSK.armed = false; let note = '';
  if(S && S.mode === 'de' && !S.res){ finishDe(); note = `Đề đang làm đã được nộp tự động: đúng ${S.res.ok}/${S.res.n} câu. Câu chưa làm tính là sai.`; KIOSK.after = '#/ketqua'; }
  else { if(S && !S.res && S.items && S.items.length) note = 'Phiên luyện tập đang mở đã kết thúc. Kết quả các câu đã kiểm tra vẫn được lưu.'; S = null; KIOSK.after = null; }
  const k = DB.kiosk || (DB.kiosk = {n:0}); k.n++; k.at = Date.now(); save();
  KIOSK.closed = {why, note}; if(MDONE) MDONE(false); if(LOPM()) LOPM().route(''); $('view').innerHTML = ''; document.body.classList.remove('focus');   // LOPM().route(''): rời lớp học 2D, nhả ghế
  try{ if(KIOSK.wake) KIOSK.wake.release(); }catch(e){}
  try{ if(navigator.keyboard && navigator.keyboard.unlock) navigator.keyboard.unlock(); }catch(e){}
  try{ if(fsEl()) (document.exitFullscreen || document.webkitExitFullscreen).call(document).catch?.(()=>{}); }catch(e){}
  kRender(); try{ window.close(); }catch(e){} }
function kPause(fn){ KIOSK.pause++;   // tạm ngừng kiểm tra trong lúc có cửa sổ của hệ thống (đăng nhập Google, hộp cài app)
  const end = ()=> setTimeout(()=>{ KIOSK.pause = Math.max(0, KIOSK.pause - 1); if(KIOSK.on && !KIOSK.closed && !fsOK()){ KIOSK.armed = false; KIOSK.resume = true; } kRender(); }, 600);
  return Promise.resolve().then(fn).finally(end); }
function kRender(){
  const g = $('gate'); if(!g) return;
  if(!KIOSK.on || (KIOSK.armed && fsOK()) || (!KIOSK.closed && kExempt())){ g.hidden = true; g.innerHTML = ''; return; }
  let h;
  if(KIOSK.closed) h = `<div class="glogo warn">${ico('lock')}</div><h1>IMs đã đóng</h1><p>${esc(KIOSK.closed.why)}</p>${KIOSK.closed.note ? `<div class="why">${esc(KIOSK.closed.note)}</div>` : ''}
      <button class="gbtn" onclick="IMS.kReopen()">${ico('max')}Mở lại IMs</button><p style="font-size:13px">IMs chỉ chạy ở chế độ toàn màn hình. Không dùng nữa thì em đóng cửa sổ này.</p>`;
  else if(!fsApi() && !appMode()) h = `<div class="glogo">∞</div><h1>Cài IMs để bắt đầu</h1><p>IMs chỉ chạy toàn màn hình. Trình duyệt này không bật được toàn màn hình cho trang web${isIOS() ? ' (iPhone)' : ''}, nên em cần cài IMs lên màn hình chính rồi mở từ biểu tượng <b>∞ IMs</b>.</p>
      <button class="gbtn" onclick="location.hash='#/caidat'">Xem cách cài IMs</button>`;
  else if(KIOSK.resume) h = `<div class="glogo">∞</div><h1>Tiếp tục với IMs</h1><p>Bấm nút dưới đây để quay lại chế độ toàn màn hình.</p><button class="gbtn" onclick="IMS.kEnter()" autofocus>${ico('max')}Tiếp tục toàn màn hình</button>`;
  else h = `<div class="glogo">∞</div><h1>IMs · Infinity Maths</h1><p>Luyện Toán THPT — câu hỏi sinh mới mỗi lần, có lời giải chi tiết.</p>
      <button class="gbtn" onclick="IMS.kEnter()" autofocus>${ico('max')}Vào IMs toàn màn hình</button>
      <div class="rules"><div>IMs chỉ chạy ở chế độ toàn màn hình để em tập trung làm bài.</div><div>Thoát toàn màn hình, đổi tab hay chuyển sang ứng dụng khác thì IMs tự đóng; đề đang làm sẽ được nộp luôn.</div><div>${hoverDev() ? 'Muốn thoát IMs: nhấn giữ phím Esc.' : 'Muốn thoát IMs: vuốt hoặc bấm nút quay lại của máy.'}</div></div>`;
  g.innerHTML = `<div class="gbox">${h}</div>`; g.hidden = false; setTimeout(tryUpd, 0);
  const b = g.querySelector('.gbtn'); if(b && hoverDev()) b.focus(); }
['fullscreenchange', 'webkitfullscreenchange'].forEach(ev=> document.addEventListener(ev, ()=>{
  if(!KIOSK.on) return; if(fsEl()){ if(!KIOSK.closed) kArm(); return; }
  if(KIOSK.pause) return; if(KIOSK.armed) kClose('Em đã thoát khỏi chế độ toàn màn hình.'); else kRender(); }));
document.addEventListener('visibilitychange', ()=>{
  if(document.visibilityState !== 'hidden'){ swCheck(); tryUpd(); }   // quay lại app: hỏi máy chủ có bản mới không (0.6.1)
  if(!KIOSK.on) return;
  if(document.visibilityState === 'hidden'){ if(KIOSK.armed && !KIOSK.pause) kClose('Em đã rời khỏi IMs (đổi tab, chuyển ứng dụng hoặc tắt màn hình).'); }
  else if(KIOSK.armed && !KIOSK.wake){ try{ navigator.wakeLock && navigator.wakeLock.request('screen').then(l=>{ KIOSK.wake = l; }).catch(()=>{}); }catch(e){} } });

/* ---------- tự cập nhật (0.6.1) ----------
   sw.js lưu app vào máy và trả bản đã lưu trước (để chạy khi mất mạng), nên bản mới chỉ hiện sau khi trang được tải lại.
   Điện thoại hay giữ app chạy nền rất lâu (đổi app rồi quay lại không tải lại trang) → tự hỏi máy chủ có bản mới mỗi khi quay lại app;
   bản mới cài xong (controllerchange) thì tải lại ngay nếu đang an toàn, chưa an toàn (đang dùng toàn màn hình, vừa nộp đề tự động) thì chờ lần sau. */
let SWREG = null, SWAT = 0, NEWV = false;
function swCheck(){ if(SWREG && Date.now() - SWAT > 60000){ SWAT = Date.now(); SWREG.update().catch(()=>{}); } }
function updSafe(){ return KIOSK.on ? !KIOSK.armed && !KIOSK.pause && !(KIOSK.closed && KIOSK.closed.note) && !KIOSK.after : !/^#\/(lam|ketqua|xem|chandoan|xong)$/.test(location.hash || ''); }   // không bật toàn màn hình (chạy thử): chờ ra khỏi màn làm bài / kết quả
function tryUpd(){ if(!NEWV || !updSafe()) return;
  try{ if(Date.now() - (+sessionStorage.getItem('ims_upd') || 0) < 30000) return; sessionStorage.setItem('ims_upd', Date.now()); }catch(e){}
  location.reload(); }
function swInit(){
  if(!('serviceWorker' in navigator) || location.protocol !== 'https:') return;
  const had = !!navigator.serviceWorker.controller;   // lần đầu cài (chưa có bản cũ) thì không cần tải lại
  navigator.serviceWorker.addEventListener('controllerchange', ()=>{ if(had){ NEWV = true; tryUpd(); } });
  navigator.serviceWorker.register('sw.js').then(r=>{ SWREG = r; SWAT = Date.now(); }).catch(()=>{}); }

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
  if(k === 'TN') h += `<div class="opts${shortOpts(q) ? ' two' : ''}">${['A','B','C','D'].map(L=>{ const cls = done ? (L === q.dapan ? 'isok' : (c.ans === L ? 'isno' : '')) : (c.ans === L ? 'sel' : ''); return `<button class="opt ${cls}" ${done ? 'disabled' : ''} onclick="IMS.pick(${idx},'${L}')"><b>${L}</b><span>${noDot(q[L])}.</span></button>`; }).join('')}</div>`;
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
  $('topRight').innerHTML = t + a;
  const sf = $('sideFoot'); if(sf) sf.innerHTML = `<div>Hôm nay: <b style="color:#fff">${n}</b> câu · chuỗi ${streak()} ngày</div>${KIOSK.on ? `<div style="margin-top:6px">Giữ <span class="kbd">Esc</span> để thoát IMs</div>` : ''}<div style="margin-top:6px;opacity:.7">IMs ${VER}</div>`; }
const gradeSeg = (gs, v)=> `<div class="seg">${gs.map(g=> `<button class="${g === DB.grade ? 'on' : ''}" onclick="IMS.grade(${g}${v ? `,'${v}'` : ''})">Lớp ${g}</button>`).join('')}</div>`;
const dangRow = (k, sub)=>{ const p = pct(k); return `<div class="dang" onclick="IMS.startDang('${k}')"><span class="kind ${G[k].kind || 'TN'}">${KS[G[k].kind || 'TN']}</span><span class="t">${esc(name(G[k]))}${sub ? `<br><span class="muted">${sub}</span>` : ''}</span><span class="pct ${p == null ? '' : p >= 80 ? 'good' : p < 50 ? 'low' : ''}">${p == null ? '' : p + '%'}</span><span class="go">›</span></div>`; };
const firstName = ()=>{ const p = C && C.state === 'in' && C.profile; return p && p.name ? String(p.name).trim().split(/\s+/).pop() : ''; };
let LQ = '';   // chữ đang tìm trong mục Luyện tập
function vLuyen(){
  setTab('luyen'); const gs = grades(); if(!gs.includes(DB.grade)) DB.grade = gs.at(-1);
  const all = Object.values(DB.by), n = all.reduce((s, r)=> s + r.n, 0), ok = all.reduce((s, r)=> s + r.ok, 0), td = DB.days[today()] || 0, nm = firstName();
  let h = `<div class="hero"><div class="hx"><h1>${nm ? `Chào ${esc(nm)}!` : 'Luyện tập theo dạng'}</h1><p>${td ? `Hôm nay em đã làm ${td} câu. Cố lên!` : 'Chọn một dạng bên dưới để bắt đầu — mỗi lần là một câu mới.'}</p>
    <div class="hs"><div><b>${td}</b>hôm nay</div><div><b>${n ? Math.round(100*ok/n) : 0}%</b>làm đúng</div><div><b>${streak()}</b>ngày liên tiếp</div></div></div></div>`;
  const last = KEYS.filter(k=> DB.by[k] && DB.by[k].at).sort((a, b)=> DB.by[b].at - DB.by[a].at)[0];
  if(last) h += `<div class="card cont" onclick="IMS.startDang('${last}')"><span class="ic">${ico('play')}</span><span class="t"><span class="muted">Luyện tiếp · Lớp ${G[last].grade}${pct(last) != null ? ' · đúng ' + pct(last) + '%' : ''}</span><b>${esc(name(G[last]))}</b></span><span class="go" style="color:var(--muted);font-size:20px">›</span></div>`;
  h += `<div class="row" style="justify-content:space-between;align-items:center;margin-top:6px">${gradeSeg(gs)}</div>`;
  if(PACK && PACK.dev) h += `<div class="notice">Bản chạy thử: đang dùng toàn bộ bộ sinh của MathBank. Bản phát hành chỉ có các dạng giáo viên đã duyệt.</div>`;
  h += `<label class="search">${ico('search')}<input id="lq" type="search" placeholder="Tìm dạng: cực trị, tích phân, xác suất…" value="${esc(LQ)}" oninput="IMS.q(this.value)" autocomplete="off"></label><div id="lbody"></div>`;
  $('view').innerHTML = h; lBody(); }
function lBody(){
  const box = $('lbody'); if(!box) return; const ks = KEYS.filter(k=> G[k].grade === DB.grade), q = fold(LQ).trim();
  if(q){ const ws = q.split(/\s+/), sc = {}, has = (t, w)=> (' ' + t).includes(' ' + w);   // xếp hạng: cả cụm trong tên dạng → mọi từ trong tên dạng → có từ nằm ở tên bài / chương
    const hit = ks.filter(k=>{ const n1 = fold(name(G[k])), n2 = fold(chName(G[k].grade, G[k].ci) + ' ' + baiName(G[k].grade, G[k].ci, G[k].bi));
      if(!ws.every(w=> has(n1, w) || has(n2, w))) return false; sc[k] = n1.includes(q) ? 0 : ws.every(w=> has(n1, w)) ? 1 : 2; return true; }).sort((x, y)=> sc[x] - sc[y]);
    box.innerHTML = hit.length ? `<p class="muted" style="margin:0 0 8px">${hit.length} dạng phù hợp${hit.length > 80 ? ' · hiện 80 dạng đầu' : ''}</p><div class="card" style="padding:0;overflow:hidden">${hit.slice(0, 80).map(k=> dangRow(k, esc(baiName(G[k].grade, G[k].ci, G[k].bi)))).join('')}</div>` : `<div class="empty"><span class="big">🔍</span>Không tìm thấy dạng nào khớp “${esc(LQ)}” ở lớp ${DB.grade}.</div>`; return; }
  const cis = [...new Set(ks.map(k=> G[k].ci))].sort((a, b)=> a - b);
  box.innerHTML = cis.map(ci=>{ const a = ks.filter(k=> G[k].ci === ci), bis = [...new Set(a.map(k=> G[k].bi))].sort((x, y)=> x - y), tried = a.filter(k=> DB.by[k]).length, done = a.filter(k=> (pct(k) || 0) >= 80).length, p = a.length ? Math.round(100*done/a.length) : 0;
    return `<details class="ch"><summary><span class="ring" style="--p:${p}" data-v="${p}%"></span><span class="st">${esc(chName(DB.grade, ci))}<br><span class="muted" style="font-weight:400">${tried}/${a.length} dạng đã làm · ${done} thành thạo</span></span></summary>` + bis.map(bi=> `<div class="bai">${esc(baiName(DB.grade, ci, bi))}</div>` + a.filter(k=> G[k].bi === bi).map(k=> dangRow(k)).join('')).join('') + `</details>`; }).join('') || '<div class="empty">Chưa có bộ câu hỏi.</div>'; }
function vDe(){
  setTab('de'); const gs = grades(); if(!gs.includes(DB.grade)) DB.grade = gs.at(-1);
  const ks = KEYS.filter(k=> G[k].grade === DB.grade), cis = [...new Set(ks.map(k=> G[k].ci))].sort((a, b)=> a - b), sel = DB.deSel && DB.deSel.g === DB.grade ? DB.deSel.cis : [];
  $('view').innerHTML = `<h1>Làm đề theo chủ đề</h1><p class="sub">Mỗi lần làm là một đề mới, số liệu khác. Có đồng hồ tính giờ; làm xong bấm Nộp bài để xem điểm và lời giải từng câu.</p>${gradeSeg(gs, 'de')}
    <div class="grid2"><div class="card"><div class="cardh"><span class="lbl" style="margin:0">Chọn chương</span><button class="btn ghost sm" onclick="IMS.deAll()">${sel.length === cis.length && cis.length ? 'Bỏ chọn hết' : 'Chọn tất cả'}</button></div>${cis.map(ci=> `<label class="ck"><input type="checkbox" value="${ci}" ${sel.includes(ci) ? 'checked' : ''} class="deci" onchange="IMS.deCi()"><span>${esc(chName(DB.grade, ci))}</span><span class="muted">${ks.filter(k=> G[k].ci === ci).length} dạng</span></label>`).join('')}</div>
    <div class="card"><span class="lbl">Số câu</span><div class="chips">${[10, 20, 30].map(n=> `<button class="chip ${(DB.deN || 10) === n ? 'on' : ''}" onclick="IMS.deN(${n})">${n} câu</button>`).join('')}</div>
    <span class="lbl">Hình thức</span><div class="chips">${['TN','DS','TLN'].map(k=> `<button class="chip ${(DB.deK || ['TN','DS','TLN']).includes(k) ? 'on' : ''}" onclick="IMS.deK('${k}')">${KN[k]}</button>`).join('')}</div>
    <button class="btn gold big block" style="margin-top:6px" onclick="IMS.startDe()">${ico('play')}Bắt đầu làm đề</button>${!paid() ? `<p class="muted" style="margin:10px 0 0;text-align:center">Hôm nay còn ${freeLeft()}/${FREE} câu miễn phí</p>` : ''}</div></div>`; }
function vSai(){
  setTab('sai'); const ks = Object.keys(DB.wrong).filter(k=> G[k] && KEYS.includes(k)).sort((a, b)=> DB.wrong[b] - DB.wrong[a]);
  $('view').innerHTML = `<h1>Ôn lỗi sai</h1><p class="sub">Các dạng em từng làm sai, sai nhiều xếp trước. Làm đúng 3 lần liên tiếp thì dạng đó ra khỏi danh sách.</p>` + (ks.length ? `<button class="btn gold big block" style="margin-bottom:14px" onclick="IMS.startSai()">${ico('sai')}Ôn tất cả (${ks.length} dạng)</button><div class="card" style="padding:0;overflow:hidden">${ks.map(k=> dangRow(k, `Lớp ${G[k].grade} · sai ${DB.wrong[k]} lần`)).join('')}</div>` : '<div class="empty"><span class="big">🎉</span>Chưa có lỗi sai nào. Luyện tập thêm nhé!</div>'); }
function vTienDo(){
  setTab('tiendo'); const all = Object.values(DB.by), n = all.reduce((s, r)=> s + r.n, 0), ok = all.reduce((s, r)=> s + r.ok, 0);
  const gs = grades(); let h = `<h1>Tiến độ</h1><div class="stat"><div><b>${n}</b><span>câu đã làm</span></div><div><b>${n ? Math.round(100*ok/n) : 0}%</b><span>làm đúng</span></div><div><b>${streak()}</b><span>ngày liên tiếp</span></div></div>`;
  const D = []; for(let i = 13; i >= 0; i--){ const d = new Date(); d.setDate(d.getDate() - i); const k = d.toISOString().slice(0, 10); D.push({k, v:DB.days[k] || 0, l:i ? String(d.getDate()) : 'Nay'}); }
  const mx = Math.max(1, ...D.map(d=> d.v));
  h += `<div class="card"><div class="cardh"><b>14 ngày gần đây</b><span class="muted">${D.reduce((s, d)=> s + d.v, 0)} câu</span></div><div class="days">${D.map(d=> `<div class="${d.l === 'Nay' ? 'td' : ''}" title="${d.k}: ${d.v} câu"><i class="${d.v ? '' : 'z'}" style="height:${d.v ? Math.max(6, Math.round(70*d.v/mx)) : 3}px"></i><span>${d.l}</span></div>`).join('')}</div></div>`;
  gs.forEach(g=>{ const ks = KEYS.filter(k=> G[k].grade === g), cis = [...new Set(ks.map(k=> G[k].ci))].sort((a, b)=> a - b);
    h += `<h2>Lớp ${g}</h2>` + cis.map(ci=>{ const a = ks.filter(k=> G[k].ci === ci), done = a.filter(k=> (pct(k) || 0) >= 80).length;
      return `<div class="card" style="padding:12px 16px"><div class="row" style="justify-content:space-between;flex-wrap:nowrap"><span style="min-width:0">${esc(chName(g, ci))}</span><span class="muted" style="white-space:nowrap">${done}/${a.length} thành thạo</span></div><div class="bar"><i style="width:${a.length ? Math.round(100*done/a.length) : 0}%"></i></div></div>`; }).join(''); });
  h += `<p class="muted">Một dạng được tính là thành thạo khi em làm đúng từ 80% số câu trở lên. ${C && C.state === 'in' && C.user ? `Tiến độ được lưu vào tài khoản ${esc(C.user.email || '')}.` : C && C.state !== 'off' ? `Dữ liệu đang lưu trên máy này. <a href="#/taikhoan">Đăng nhập</a> để không mất tiến độ khi đổi máy.` : 'Dữ liệu lưu trên máy này.'}</p>${standalone() ? '' : `<a class="btn sec block" href="#/caidat" style="margin:8px 0">📲 Cài IMs lên màn hình</a>`}<p class="muted">IMs ${VER} · gói câu hỏi ${PACK && PACK.at ? new Date(PACK.at).toLocaleDateString('vi-VN') : ''} · ${KEYS.length} dạng</p>`;
  $('view').innerHTML = h; }
/* ---------- lộ trình (0.4): chọn câu theo kết quả làm bài ----------
   Học theo chế độ chẩn đoán của Numbas (DIAGNOSYS và Mastery). Chủ đề = chuyên đề (một buổi dạy) của MathBank, xếp theo thứ tự PPCT trong chương;
   trong CÙNG MỘT BÀI coi chuyên đề sau cần nền tảng của chuyên đề trước; các bài khác nhau kiểm tra riêng (kết quả chỉ mang tính gợi ý).
   • Kiểm tra đầu vào: mỗi chuyên đề hỏi tối đa 1 câu, luôn hỏi chuyên đề ở giữa đoạn chưa xác định của bài. Đúng → chuyên đề đó và các chuyên đề trước cùng bài
     "đã nắm"; sai → chuyên đề đó và các chuyên đề sau cùng bài "chưa nắm". Hết đoạn chưa xác định thì dừng (mỗi bài khoảng log2 số chuyên đề câu). Ưu tiên câu TH/VD,
     TLN/Đ–S để khó đoán mò.
   • Luyện đến thành thạo: các dạng của chuyên đề xếp hàng NB → VDC, TN → TL. Đúng thì dạng ra khỏi hàng; sai thì xuống cuối hàng và ra lại với số liệu mới.
     Hết hàng là thành thạo. Hàng đợi lưu trong DB.lt.q để làm tiếp hôm sau. */
const LVO = {NB:0, TH:1, VD:2, VDC:3}, KO = {TN:0, DS:1, TLN:2, TL:3};
const LT = ()=>{ const t = DB.lt || (DB.lt = {}); t.diag = t.diag || {}; t.done = t.done || {}; t.q = t.q || {}; return t; };
let CDX = null;   // {ch:{'g|ci':[cd]}, by:{ma:cd}} — cd = {ma, ten, keys, g, ci, i}
function cdIndex(){ if(CDX) return CDX; CDX = {ch:{}, by:{}};
  grades().forEach(g=>{ (PPCT[g] || []).forEach((ch, ci)=>{ const out = [];
    (ch.bai || []).forEach((_, bi)=>{ const bm = typeof baiMa === 'function' ? baiMa(g, ci, bi) : ''; let L = [];
      try{ L = bm && typeof cdList === 'function' ? cdList(bm) : []; }catch(e){ L = []; }
      const own = KEYS.filter(k=> G[k].grade === g && G[k].ci === ci && G[k].bi === bi);
      if(!L.length) L = [{ma: bm ? bm + '.1' : `${g}|${ci}|${bi}`, ten: baiName(g, ci, bi), keys: own}];
      L.forEach(c=>{ const keys = (c.keys || []).filter(k=> KSET.has(k) && G[k].grade === g && G[k].ci === ci); if(keys.length) out.push({ma:c.ma, ten:c.ten || baiName(g, ci, bi), keys}); });
      const seen = new Set([].concat(...out.map(c=> c.keys))), rest = own.filter(k=> !seen.has(k));   // dạng chưa vào chuyên đề nào: gộp vào chuyên đề cuối của bài
      if(rest.length && out.length) out[out.length - 1].keys.push(...rest); });
    out.forEach((c, i)=>{ Object.assign(c, {g, ci, i}); CDX.by[c.ma] = c; }); if(out.length) CDX.ch[g + '|' + ci] = out; }); });
  return CDX; }
const cdsOf = (g, ci)=> cdIndex().ch[g + '|' + ci] || [];
const cdBy = ma=> cdIndex().by[ma];
const qOrder = ks=> ks.slice().sort((a, b)=> (LVO[G[a].mucdo] ?? 1) - (LVO[G[b].mucdo] ?? 1) || (KO[G[a].kind || 'TN'] - KO[G[b].kind || 'TN']) || (a < b ? -1 : 1));
function diagKey(c){   // câu hỏi kiểm tra cho một chuyên đề: TH trước, rồi VD, NB; TLN, Đ–S trước TN; tránh TL (phải tự chấm)
  const ks = c.keys.filter(k=> (G[k].kind || 'TN') !== 'TL'), pool = ks.length ? ks : c.keys;
  const sc = k=> ({TH:0, VD:1, NB:2, VDC:3}[G[k].mucdo] ?? 2)*4 + ({TLN:0, DS:1, TN:2, TL:3}[G[k].kind || 'TN']);
  const best = Math.min(...pool.map(sc)); const top = pool.filter(k=> sc(k) === best);
  return top[Math.floor(Math.random()*top.length)]; }
const baiOf = c=> String(c.ma).split('.')[0];
const diagLen = L=>{ const n = {}; L.forEach(c=>{ n[baiOf(c)] = (n[baiOf(c)] || 0) + 1; }); return Object.values(n).reduce((s, x)=> s + Math.ceil(Math.log2(x + 1)), 0); };
function stTag(ma){ const t = LT(), c = cdBy(ma); if(t.done[ma]) return `<span class="lt ok">✓ Thành thạo</span>`;
  const q = t.q[ma]; if(q && q.k && c) return `<span class="lt mid">Đang luyện ${c.keys.length - q.k.length}/${c.keys.length}</span>`;
  const d = c && t.diag[c.g + '|' + c.ci]; if(d && ma in d.r) return d.r[ma] ? `<span class="lt ok2">Đã nắm</span>` : `<span class="lt no">Chưa nắm</span>`; return ''; }
function vLoTrinh(){
  setTab('lotrinh'); const gs = grades(); if(!gs.includes(DB.grade)) DB.grade = gs.at(-1);
  const g = DB.grade, cis = [...new Set(KEYS.filter(k=> G[k].grade === g).map(k=> G[k].ci))].sort((a, b)=> a - b), t = LT();
  let h = `<h1>Lộ trình</h1>${gradeSeg(gs, 'lt')}
    <p class="sub" style="margin-top:0"><b>Kiểm tra đầu vào</b>: vài câu để biết em đã nắm đến chuyên đề nào của chương. <b>Luyện đến thành thạo</b>: làm lần lượt các dạng của một chuyên đề, sai dạng nào thì dạng đó quay lại với số liệu mới cho tới khi đúng hết.</p>`;
  h += cis.map(ci=>{ const L = cdsOf(g, ci); if(!L.length) return ''; const d = t.diag[g + '|' + ci], nDone = L.filter(c=> t.done[c.ma]).length, first = d ? L.find(c=> !d.r[c.ma] && !t.done[c.ma]) : null;
    return `<details class="ch" ${d || L.some(c=> t.q[c.ma]) ? 'open' : ''}><summary><span class="ring" style="--p:${Math.round(100*nDone/L.length)}" data-v="${nDone}/${L.length}"></span><span class="st">${esc(chName(g, ci))}<br><span class="muted" style="font-weight:400">${nDone}/${L.length} chuyên đề thành thạo</span></span></summary><div class="ltbox">`
      + `<button class="btn sec block" onclick="IMS.startChan(${g},${ci})">${d ? 'Kiểm tra lại' : 'Kiểm tra đầu vào'} · khoảng ${diagLen(L)} câu</button>`
      + (d ? `<p class="muted" style="margin:8px 0 0">Kiểm tra ngày ${new Date(d.at).toLocaleDateString('vi-VN')}. ${first ? `Nên học tiếp: <b>${esc(first.ten)}</b>.` : 'Em đã nắm cả chương — luyện thành thạo từng chuyên đề để chắc chắn.'}</p>` : '')
      + `</div>` + L.map(c=> `<div class="dang" onclick="IMS.startThao('${c.ma}')"><span class="kind ma">${esc(c.ma)}</span><span class="t">${esc(c.ten)}<br><span class="muted">${c.keys.length} dạng</span></span>${stTag(c.ma)}</div>`).join('') + `</details>`; }).join('');
  $('view').innerHTML = h; }
function startChan(g, ci){ const L = cdsOf(g, ci); if(!L.length || !canDo(1)) return;
  S = {mode:'chan', g, ci, L, st:L.map(()=> null), tested:{}, items:[], i:0, back:'#/lotrinh'}; chanNext(); }
function chanNext(){ const st = S.st, lo = st.indexOf(null); if(lo < 0) return chanEnd(); let hi = lo; while(hi + 1 < st.length && st[hi + 1] === null && baiOf(S.L[hi + 1]) === baiOf(S.L[lo])) hi++;
  const m = Math.floor((lo + hi)/2), c = S.L[m], it = newItem(diagKey(c)); if(!it){ st[m] = 0; return chanNext(); }
  it.cd = m; S.items.push(it); S.i = S.items.length - 1; goLam(); }
function chanAnswer(c){ const m = c.cd, st = S.st, b = baiOf(S.L[m]); S.tested[S.L[m].ma] = c.ok ? 1 : 0;
  if(c.ok){ for(let j = m; j >= 0 && baiOf(S.L[j]) === b; j--) if(st[j] === null) st[j] = 1; }
  else { for(let j = m; j < st.length && baiOf(S.L[j]) === b; j++) if(st[j] === null) st[j] = 0; } }
function chanEnd(){ const r = {}; S.L.forEach((c, j)=>{ r[c.ma] = S.st[j] ? 1 : 0; }); LT().diag[S.g + '|' + S.ci] = {at:Date.now(), r, t:S.tested}; save(); S.res = r; location.hash = '#/chandoan'; }
function vChan(){ if(!S || S.mode !== 'chan' || !S.res){ location.hash = '#/lotrinh'; return; } setTab('lotrinh');
  const L = S.L, first = L.find(c=> !S.res[c.ma]), nOk = L.filter(c=> S.res[c.ma]).length;
  let h = `<div class="qhead">${backBtn('#/lotrinh')}<span class="ttl">Kết quả kiểm tra đầu vào</span></div><h1 style="margin-top:0">${esc(chName(S.g, S.ci))}</h1>
    <div class="score">${nOk}/${L.length}</div><p class="muted" style="text-align:center">chuyên đề đã nắm · em làm ${S.items.length} câu, đúng ${S.items.filter(c=> c.ok).length} câu</p><div class="card" style="padding:4px 14px">`;
  h += L.map(c=> `<div class="rv"><span class="mk ${S.res[c.ma] ? 'ok' : 'no'}">${S.res[c.ma] ? '✓' : '✗'}</span><span style="flex:1">${esc(c.ten)}<br><span class="muted">${c.ma in S.tested ? 'đã hỏi 1 câu' : S.res[c.ma] ? 'suy ra: em làm được chuyên đề sau cùng bài' : 'suy ra: em chưa làm được chuyên đề trước cùng bài'}</span></span></div>`).join('') + `</div>`;
  h += first ? `<button class="btn gold block" onclick="IMS.startThao('${first.ma}')">Luyện đến thành thạo: ${esc(first.ten)}</button>` : `<div class="fb ok">Em đã nắm cả chương. Hãy luyện thành thạo từng chuyên đề để chắc chắn hơn.</div>`;
  h += `<p class="muted">Mỗi chuyên đề hỏi nhiều nhất một câu; trong cùng một bài, làm được chuyên đề sau thì coi như nắm chuyên đề trước. Kết quả mang tính gợi ý để chọn chỗ bắt đầu học.</p><a class="btn sec block" href="#/lotrinh">Về Lộ trình</a>`;
  $('view').innerHTML = h; toTop(); }
function startThao(ma){ const c = cdBy(ma); if(!c || !canDo(1)) return; const t = LT();
  let q = t.q[ma] && Array.isArray(t.q[ma].k) ? t.q[ma].k.filter(k=> c.keys.includes(k)) : null; if(!q || !q.length) q = qOrder(c.keys);
  t.q[ma] = {k:q, at:Date.now()}; save(); S = {mode:'thao', ma, c, items:[], i:0, back:'#/lotrinh', n:0}; thaoNext(); }
function thaoNext(){ const q = LT().q[S.ma]; if(!q || !q.k.length) return thaoEnd();
  let it = null; for(let tries = 0; tries < q.k.length && !it; tries++){ it = newItem(q.k[0]); if(!it){ q.k.shift(); } } if(!it) return thaoEnd();
  S.items.push(it); S.i = S.items.length - 1; goLam(); }
function thaoAnswer(c){ const t = LT(), q = t.q[S.ma]; if(!q) return; S.n++; const k = q.k.shift(); if(!c.ok) q.k.push(k); q.at = Date.now(); if(!q.k.length){ delete t.q[S.ma]; t.done[S.ma] = Date.now(); } save(); }
function thaoEnd(){ const t = LT(); delete t.q[S.ma]; t.done[S.ma] = t.done[S.ma] || Date.now(); save(); location.hash = '#/xong'; }
function vXong(){ if(!S || S.mode !== 'thao'){ location.hash = '#/lotrinh'; return; } setTab('lotrinh'); const c = S.c, nx = cdsOf(c.g, c.ci)[c.i + 1];
  $('view').innerHTML = `<div class="qhead">${backBtn('#/lotrinh')}<span class="ttl">Luyện đến thành thạo</span></div><div class="fb ok" style="font-size:17px">✓ Em đã thành thạo chuyên đề <b>${esc(c.ten)}</b>: làm đúng cả ${c.keys.length} dạng${S.n ? ` sau ${S.n} câu` : ''}.</div>`
    + (nx ? `<button class="btn gold block" style="margin-bottom:10px" onclick="IMS.startThao('${nx.ma}')">Chuyên đề tiếp theo: ${esc(nx.ten)}</button>` : '') + `<a class="btn sec block" href="#/lotrinh">Về Lộ trình</a>`; }
function ltAnswered(c){ if(!S || c.ltDone) return; c.ltDone = true; if(S.mode === 'chan') chanAnswer(c); else if(S.mode === 'thao') thaoAnswer(c); }
/* ---------- phiên làm bài ---------- */
const goLam = ()=>{ if(location.hash === '#/lam') vLam(); else location.hash = '#/lam'; };
const backOf = d=> (location.hash && !/^#\/(lam|ketqua|xem)/.test(location.hash)) ? location.hash : d;
function startDang(key){ if(!canDo(1)) return; S = {mode:'dang', keys:[key], items:[newItem(key)], i:0, back:backOf('#/luyen')}; goLam(); }
function startSai(){ const ks = Object.keys(DB.wrong).filter(k=> G[k] && KEYS.includes(k)); if(!ks.length || !canDo(1)) return; S = {mode:'sai', keys:ks, items:[newItem(ks[0])], i:0, back:'#/sai', qi:0}; goLam(); }
async function startDe(){
  const cis = [...document.querySelectorAll('.deci:checked')].map(x=> +x.value), kinds = DB.deK || ['TN','DS','TLN'], n = DB.deN || 10;
  if(!cis.length){ say('Hãy chọn ít nhất một chương.'); return; } DB.deSel = {g:DB.grade, cis}; save();
  if(!paid() && freeLeft() < n){ if(freeLeft() > 0) say(`Hôm nay em còn ${freeLeft()} câu miễn phí, chưa đủ cho đề ${n} câu. Hãy chọn đề ngắn hơn hoặc mua gói học.`); else location.hash = '#/goi'; return; }
  const ks = KEYS.filter(k=> G[k].grade === DB.grade && cis.includes(G[k].ci) && kinds.includes(G[k].kind || 'TN')); if(!ks.length){ say('Các chương đã chọn chưa có dạng thuộc hình thức này.'); return; }
  makeDe(ks, n, '#/de'); }
function makeDe(ks, n, back){
  ks = ks.slice().sort(()=> Math.random() - 0.5); const pick = []; for(let i = 0; i < n; i++) pick.push(ks[i % ks.length]);
  const R = {TN:0, DS:1, TLN:2}; pick.sort((a, b)=> R[G[a].kind || 'TN'] - R[G[b].kind || 'TN']);
  const items = pick.map(newItem).filter(Boolean); S = {mode:'de', items, i:0, back, t0:Date.now()}; goLam(); }
/* Lớp học 2D (0.6): đang ngồi trong lớp thì bấm Luyện đề — đề theo lớp g, một chương ci (bỏ trống: mọi chương), n câu; làm xong quay về lớp */
function deInfo(g){ const gs = grades(); g = gs.includes(+g) ? +g : gs.includes(DB.grade) ? DB.grade : gs.at(-1); const ks = KEYS.filter(k=> G[k].grade === g);
  return {g, grades:gs, n:DB.deN || 10, chs:[...new Set(ks.map(k=> G[k].ci))].sort((a, b)=> a - b).map(ci=> ({ci, name:chName(g, ci), n:ks.filter(k=> G[k].ci === ci).length}))}; }
function startDeLop(o){ o = o || {}; const g = +o.g || DB.grade, n = +o.n || 10, kinds = DB.deK || ['TN','DS','TLN'];
  if(!paid() && freeLeft() < n){ if(freeLeft() > 0) say(`Hôm nay em còn ${freeLeft()} câu miễn phí, chưa đủ cho đề ${n} câu. Hãy chọn đề ngắn hơn hoặc mua gói học.`); else location.hash = '#/goi'; return false; }
  const ks = KEYS.filter(k=> G[k].grade === g && (o.ci == null || o.ci === '' || G[k].ci === +o.ci) && kinds.includes(G[k].kind || 'TN')); if(!ks.length){ say('Chương này chưa có dạng thuộc hình thức đã chọn.'); return false; }
  DB.grade = g; DB.deN = n; save(); makeDe(ks, n, '#/lophoc'); return true; }
function finishDe(){ S.items.forEach(c=>{ c.done = true; c.ok = answered(c) ? grade(c) : false; record(c.key, c.ok); }); S.t1 = Date.now(); S.res = {n:S.items.length, ok:S.items.filter(c=> c.ok).length};
  try{ window.dispatchEvent(new CustomEvent('ims:de', {detail:{ok:S.res.ok, n:S.res.n, back:S.back}})); }catch(e){} }   // lớp học 2D hiện điểm vừa đạt trên đầu nhân vật
const shortOpts = q=> ['A','B','C','D'].every(L=> String(q[L] || '').replace(/\\[a-z]+|[{}$\s]/gi, '').length <= 22) && !q.hinhVe;
/* vLam(how): how = undefined → lên đầu trang (câu mới); 'keep' → giữ chỗ đang xem (chọn đáp án); 'fb' → cuộn tới phần nhận xét, lời giải */
function vLam(how){
  if(!S){ location.hash = '#/luyen'; return; } const c = S.items[S.i]; if(!c){ $('view').innerHTML = `<div class="qhead">${backBtn(S.back || '#/luyen')}</div><div class="empty">Không sinh được câu hỏi.</div>`; return; }
  const de = S.mode === 'de', g = G[c.key], v = $('view'), y = v.scrollTop;
  const q = S.mode === 'thao' && LT().q[S.ma], tot = S.mode === 'thao' ? S.c.keys.length : 0, left = q ? q.k.length : 0;
  const head = de ? `Đề ${S.items.length} câu · câu ${S.i + 1}` : S.mode === 'chan' ? `Kiểm tra đầu vào · câu ${S.items.length} · ${esc(chName(S.g, S.ci))}` : S.mode === 'thao' ? `${esc(S.c.ten)} · còn ${left}/${tot} dạng` : esc(name(g));
  let h = `<div class="qhead">${backBtn(S.back)}<span class="ttl" title="${head}">${head}</span>${de ? `<span class="timer">${ico('clock')}<span id="tmr">${mmss(Date.now() - S.t0)}</span></span>` : ''}<span class="kind ${c.kind}">${KN[c.kind]}</span></div>`;
  if(S.mode === 'thao') h += `<div class="bar" style="margin:-2px 0 12px"><i style="width:${tot ? Math.round(100*(tot - left)/tot) : 0}%"></i></div>`;
  if(de) h += `<div class="qnav" id="qnav">${S.items.map((x, i)=> `<button class="${i === S.i ? 'cur' : answered(x) ? 'an' : ''}" onclick="IMS.goto(${i})" aria-label="Câu ${i + 1}">${i + 1}</button>`).join('')}</div>`;
  h += qHtml(c, S.i);
  const keys = c.kind === 'TN' ? '<kbd>A</kbd>–<kbd>D</kbd> chọn đáp án · ' : '';
  if(de){ const nA = S.items.filter(answered).length;
    h += `<div class="actbar"><div class="row"><button class="btn sec" ${S.i ? '' : 'disabled'} onclick="IMS.go(-1)">‹ Câu trước</button>${S.i < S.items.length - 1 ? `<button class="btn" data-k="enter" onclick="IMS.go(1)">Câu sau ›</button>` : `<button class="btn gold" onclick="IMS.submit()">Nộp bài</button>`}</div><div class="hint">Đã làm <b>${nA}/${S.items.length}</b> câu${nA === S.items.length && S.i < S.items.length - 1 ? ` · <a href="javascript:IMS.submit()">Nộp bài ngay</a>` : ''}<span class="hint keys"> · ${keys}<kbd>←</kbd> <kbd>→</kbd> chuyển câu</span></div></div>`; }
  else if(!c.done){ h += `<div class="actbar">` + (c.kind === 'TL' ? `<button class="btn block" data-k="enter" onclick="IMS.check()">Xem lời giải</button>` : `<button class="btn block" data-k="enter" ${answered(c) ? '' : 'disabled'} id="chk" onclick="IMS.check()">Kiểm tra</button>`) + `<div class="hint keys">${keys}<kbd>Enter</kbd> ${c.kind === 'TL' ? 'xem lời giải' : 'kiểm tra'}</div></div>`; }
  else if(c.kind === 'TL' && c.ok == null){ h += `<div class="lg" id="fbk"><b>Lời giải.</b> ${c.q.loigiai || ''}</div><div class="actbar"><div class="row"><button class="btn" onclick="IMS.self(true)">Em làm đúng</button><button class="btn sec" onclick="IMS.self(false)">Chưa đúng</button></div></div>`; }
  else { const nx = S.mode === 'sai' ? `<button class="btn block" data-k="enter" onclick="IMS.nextSai()">Câu tiếp ›</button>` : S.mode === 'chan' ? `<button class="btn block" data-k="enter" onclick="IMS.nextChan()">${S.st.includes(null) ? 'Câu tiếp ›' : 'Xem kết quả ›'}</button>` : S.mode === 'thao' ? `<button class="btn block" data-k="enter" onclick="IMS.nextThao()">${LT().q[S.ma] ? (c.ok ? 'Dạng tiếp theo ›' : 'Tiếp — dạng này sẽ quay lại ›') : 'Hoàn thành ›'}</button>` : `<button class="btn block" data-k="enter" onclick="IMS.again()">Câu khác cùng dạng ›</button>`;
    h += `<div class="fb ${c.ok ? 'ok' : 'no'}" id="fbk">${c.ok ? '✓ Chính xác!' : '✗ Chưa đúng — xem lời giải bên dưới.'}</div><div class="lg"><b>Lời giải.</b> ${c.q.loigiai || ''}</div><div class="actbar">${nx}<div class="hint keys"><kbd>Enter</kbd> tiếp tục</div></div>`; }
  v.innerHTML = h; math(v);
  if(how === 'keep') v.scrollTop = y; else if(how === 'fb' && $('fbk')){ v.scrollTop = y; const f = $('fbk'), top = f.offsetTop - v.clientHeight/3; if(f.offsetTop + 60 > y + v.clientHeight || f.offsetTop < y) v.scrollTo({top:Math.max(0, top), behavior:'smooth'}); } else toTop();
  const nav = $('qnav'); if(nav){ const b = nav.children[S.i]; if(b) nav.scrollLeft = b.offsetLeft - nav.clientWidth/2 + 18; }
  const inp = v.querySelector('input.ans:not(:disabled)'); if(inp && hoverDev() && how !== 'keep') inp.focus({preventScroll:true}); }
function vKetQua(){
  if(!S || !S.res){ location.hash = '#/de'; return; } const r = S.res, mins = Math.max(1, Math.round((S.t1 - S.t0)/60000)), p = Math.round(100*r.ok/r.n);
  const lop = S.back === '#/lophoc';
  let h = `<div class="qhead">${backBtn(lop ? '#/lophoc' : '#/de')}<span class="ttl">Kết quả làm đề</span></div><div class="card" style="text-align:center;padding:22px 16px"><div class="score" style="color:${p >= 80 ? 'var(--ok)' : p >= 50 ? 'var(--navy)' : 'var(--bad)'}">${r.ok}/${r.n}</div><p class="muted" style="margin:2px 0 0">Đúng ${p}% · ${mins} phút · ${p >= 80 ? 'Rất tốt!' : p >= 50 ? 'Khá — xem lại các câu sai nhé.' : 'Cần ôn thêm — xem lời giải từng câu.'}</p><div class="bar" style="max-width:320px;margin:14px auto 0"><i style="width:${p}%"></i></div></div><div class="card" style="padding:4px 16px">`;
  h += S.items.map((c, i)=> `<div class="rv" onclick="IMS.review(${i})"><span class="mk ${c.ok ? 'ok' : 'no'}">${c.ok ? '✓' : '✗'}</span><span style="flex:1;min-width:0">Câu ${i + 1}. ${esc(name(G[c.key]))}</span><span class="kind ${c.kind}">${KS[c.kind]}</span><span class="muted">›</span></div>`).join('');
  h += `</div><div class="row">${lop ? `<button class="btn gold" onclick="location.hash='#/lophoc'">Về lớp học</button>` : ''}<button class="btn ${lop ? 'sec' : 'gold'}" onclick="IMS.startDe2()">Làm đề mới</button><button class="btn sec" onclick="location.hash='#/sai'">Ôn lỗi sai</button></div>`;
  $('view').innerHTML = h; }
function vXem(){ if(!S || !S.res){ location.hash = '#/de'; return; } const i = S.rv || 0, c = S.items[i];
  $('view').innerHTML = `<div class="qhead">${backBtn('#/ketqua')}<span class="ttl">Xem lại · câu ${i + 1}/${S.items.length}</span><span class="kind ${c.kind}">${KN[c.kind]}</span></div>${qHtml(c, i)}<div class="fb ${c.ok ? 'ok' : 'no'}">${c.ok ? '✓ Đúng' : answered(c) ? '✗ Sai' : '✗ Chưa làm'}</div><div class="lg"><b>Lời giải.</b> ${c.q.loigiai || ''}</div><div class="actbar"><div class="row"><button class="btn sec" ${i ? '' : 'disabled'} onclick="IMS.review(${i - 1})">‹ Câu trước</button><button class="btn sec" ${i < S.items.length - 1 ? '' : 'disabled'} onclick="IMS.review(${i + 1})">Câu sau ›</button></div></div>`;
  math($('view')); toTop(); }
/* ---------- trang cài đặt (0.3.1) ---------- */
function vCai(){
  setTab(''); let h = `<div class="qhead">${backBtn('#/luyen')}<span class="ttl">Cài IMs lên màn hình</span></div>`;
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
async function install(){ if(!INST){ vCai(); return; } const ev = INST; INST = null;
  await kPause(async()=>{ ev.prompt(); try{ const r = await ev.userChoice; if(r && r.outcome === 'accepted') INSTALLED = true; }catch(e){} }); vCai(); }
async function copyLink(){ const u = APP_URL + '#/caidat'; try{ await navigator.clipboard.writeText(u); $('cpMsg').innerHTML = '✓ Đã chép link. Mở ' + (isIOS() ? 'Safari' : 'Chrome') + ', dán vào thanh địa chỉ.'; }catch(e){ $('cpMsg').textContent = u; } }

/* ---------- gói học, quản trị (0.3) ---------- */
function vGoi(){
  setTab(''); const pl = C && C.plan, u = pl && toDate(pl.until), signed = C && C.state === 'in' && C.user;
  let h = `<div class="qhead">${backBtn('#/luyen')}<span class="ttl">Gói học</span></div>`;
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
  let h = `<div class="qhead">${backBtn('#/taikhoan')}<span class="ttl">Quản trị gói học</span></div>`;
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
  if(!await ask(`${f.name || f.email}\n${P.label} — hạn đến hết ngày ${until.toLocaleDateString('vi-VN')}${note ? '\nGhi chú: ' + note : ''}\n\nXác nhận cấp gói?`, 'Cấp gói')) return;
  QT.busy = true; vQT();
  try{ await C.setPlan(f.uid, code, P.label, until, note); f.plan = await C.planOf(f.uid); QT.msg = `✓ Đã cấp ${P.label} cho ${f.name || f.email} đến ${until.toLocaleDateString('vi-VN')}.`; QT.list = null; }
  catch(e){ QT.msg = C.msg(e); }
  QT.busy = false; vQT(); }
async function qtRevoke(i){ const f = QT.found[i]; if(!await ask(`Thu hồi gói của ${f.name || f.email}? Học sinh quay về ${FREE} câu miễn phí mỗi ngày.`, 'Thu hồi')) return;
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
  setTab(''); let h = `<div class="qhead">${backBtn('#/luyen')}<span class="ttl">Tài khoản</span></div>`;
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
    else if(what === 'google') await kPause(()=> C.google());
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
  else { C.ready(); C.push(DB); C.watch(r=>{ DB = norm(C.merge(DB, r)); saveLocal(); if(/^#\/(luyen|lotrinh|sai|tiendo)?$/.test(location.hash || '')) route(); else topRight(); }); }
  route(); }
function onCloud(st){
  if(st === 'in' && C.user && curUid !== C.user.uid){ curUid = C.user.uid; AERR = ''; syncAccount(curUid); }
  if(st !== 'in' && curUid){ curUid = null; LSK = LS; DB = load(LS); S = null; }
  if(st === 'out' && CF.requireLogin && location.hash !== '#/taikhoan'){ location.hash = '#/taikhoan'; return; }
  const r = location.hash || '';
  if(r === '#/taikhoan' || r === '#/goi' || r === '#/quantri' || r === '#/caidat'){ route(); } else if(st === 'out' || st === 'offline' || !/^#\/(lam|ketqua|xem|chandoan|xong)$/.test(r)) route(); else topRight(); }
let LASTR = null;
function route(){ topRight(); kRender(); if(!KIOSK.on) setTimeout(tryUpd, 0); const r = (location.hash || '#/luyen').slice(2); if(LOPM()) LOPM().route(KIOSK.closed ? '' : r); if(KIOSK.closed){ $('view').innerHTML = ''; return; }
  document.body.classList.toggle('focus', /^(lam|ketqua|xem|chandoan|xong)$/.test(r)); document.body.classList.toggle('lop', r === 'lophoc'); if(r !== LASTR){ LASTR = r; toTop(); }
  if(C && CF.requireLogin && r !== 'taikhoan' && r !== 'caidat' && (C.state === 'out' || C.state === 'loading')){ if(C.state === 'out'){ location.hash = '#/taikhoan'; return; } $('view').innerHTML = '<div class="loading">Đang kết nối…</div>'; return; }
  ({luyen:vLuyen, lotrinh:vLoTrinh, chandoan:vChan, xong:vXong, de:vDe, sai:vSai, tiendo:vTienDo, lam:vLam, ketqua:vKetQua, xem:vXem, taikhoan:vTK, goi:vGoi, quantri:vQT, caidat:vCai,
    lophoc:()=>{ if(LOPM()){ setTab('lophoc'); LOPM().view($('view')); } else vLuyen(); }}[r] || vLuyen)(); }

/* ---------- phím tắt khi làm bài (0.5): A–D hoặc 1–4 chọn đáp án, Enter kiểm tra / câu tiếp, ←/→ chuyển câu trong đề ---------- */
function onKey(e){
  if(!$('modal').hidden){ if(e.key === 'Escape' && MDONE){ e.preventDefault(); MDONE(false); } return; }
  if(!$('gate').hidden || !S || location.hash !== '#/lam' || e.metaKey || e.ctrlKey || e.altKey) return;
  const c = S.items[S.i]; if(!c) return; const t = e.target, typing = t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName);
  if(e.key === 'Enter'){ if(t && t.tagName === 'BUTTON' && !typing && t.closest('#view') && !t.dataset.k) return; const b = document.querySelector('#view [data-k="enter"]:not(:disabled)'); if(b){ e.preventDefault(); b.click(); } return; }
  if(typing) return;
  const L = {A:'A', B:'B', C:'C', D:'D', 1:'A', 2:'B', 3:'C', 4:'D'}[e.key.length === 1 ? e.key.toUpperCase() : ''];
  if(L && c.kind === 'TN' && !c.done){ e.preventDefault(); IMS.pick(S.i, L); return; }
  if(S.mode === 'de' && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')){ e.preventDefault(); IMS.go(e.key === 'ArrowRight' ? 1 : -1); } }

/* ---------- khởi động ---------- */
async function boot(){
  try{ const r = await fetch('pack.json', {cache:'no-cache'}); PACK = await r.json(); }catch(e){ PACK = null; }
  if(PACK && Array.isArray(PACK.keys) && PACK.keys.length) KEYS = PACK.keys.filter(k=> G[k]);
  else { PACK = {dev:true}; KEYS = Object.keys(G).filter(k=> G[k].grade >= 10); }
  KEYS = KEYS.filter(k=> PPCT[G[k].grade] && PPCT[G[k].grade][G[k].ci]); KSET = new Set(KEYS);
  window.addEventListener('hashchange', ()=>{ if(location.hash === '#/taikhoan'){ AERR = AOK = ''; EDIT = false; FORM = {}; } route(); }); route();
  if(C){ C.on(onCloud); C.init(); }
  setInterval(()=>{ const el = $('tmr'); if(el && S && S.t0 && !S.res) el.textContent = mmss(Date.now() - S.t0); }, 1000);
  document.addEventListener('keydown', onKey);
  swInit();
}
boot();
return {
  grade(g, v){ DB.grade = g; save(); v === 'de' ? vDe() : v === 'lt' ? vLoTrinh() : vLuyen(); },
  startDang, startSai, startDe, startDe2(){ location.hash = '#/de'; },
  deN(n){ DB.deN = n; save(); vDe(); }, deK(k){ const a = DB.deK || ['TN','DS','TLN']; DB.deK = a.includes(k) ? (a.length > 1 ? a.filter(x=> x !== k) : a) : a.concat(k); save(); vDe(); },
  pick(i, L){ const c = S.items[i]; if(c.done) return; c.ans = L; vLam('keep'); },
  pickDS(i, j, v){ const c = S.items[i]; if(c.done) return; c.ans = c.ans || []; c.ans[j] = v; vLam('keep'); },
  typed(i, v){ const c = S.items[i]; c.ans = v; const b = $('chk'); if(b) b.disabled = !String(v).trim(); },
  check(){ const c = S.items[S.i]; if(c.done || (c.kind !== 'TL' && !answered(c))) return; c.done = true; if(c.kind !== 'TL'){ c.ok = grade(c); record(c.key, c.ok); ltAnswered(c); } vLam('fb'); topRight(); },
  self(ok){ const c = S.items[S.i]; c.ok = ok; record(c.key, ok); ltAnswered(c); vLam('fb'); topRight(); },
  startChan, startThao, nextChan(){ if(S.st.includes(null) && !canDo(1)) return; chanNext(); }, nextThao(){ if(LT().q[S.ma] && !canDo(1)) return; thaoNext(); },
  again(){ if(!canDo(1)) return; const k = S.items[S.i].key, it = newItem(k); if(it){ S.items.push(it); S.i = S.items.length - 1; } vLam(); },
  nextSai(){ const ks = Object.keys(DB.wrong).filter(k=> G[k] && KEYS.includes(k)); if(!ks.length){ say('Hết lỗi sai rồi. Giỏi lắm!').then(()=>{ location.hash = '#/sai'; }); return; } if(!canDo(1)) return; S.qi = ((S.qi || 0) + 1) % ks.length; const it = newItem(ks[S.qi]); S.items.push(it); S.i = S.items.length - 1; vLam(); },
  go(d){ const j = Math.max(0, Math.min(S.items.length - 1, S.i + d)); if(j !== S.i){ S.i = j; vLam(); } },
  goto(i){ S.i = i; vLam(); },
  async submit(){ if(!S || S.mode !== 'de' || S.res) return; const left = S.items.filter(c=> !answered(c)).length;
    if(!await ask(left ? `Còn ${left} câu chưa làm (tính là sai). Vẫn nộp bài?` : 'Nộp bài và xem kết quả?', 'Nộp bài', 'Làm tiếp')) return;
    if(!S || S.res) return; finishDe(); location.hash = '#/ketqua'; },
  q(v){ LQ = v; lBody(); },
  deCi(){ DB.deSel = {g:DB.grade, cis:[...document.querySelectorAll('.deci:checked')].map(x=> +x.value)}; save(); },
  deAll(){ const all = [...document.querySelectorAll('.deci')], on = all.every(x=> x.checked); DB.deSel = {g:DB.grade, cis:on ? [] : all.map(x=> +x.value)}; save(); vDe(); },
  kEnter, kReopen,
  ask, say, startDeLop, deInfo, sess(){ return S ? {mode:S.mode, back:S.back, done:!!S.res} : null; },   // dùng cho lớp học 2D (classroom.js)
  am(m){ AM = m; AERR = AOK = ''; vTK(); }, acct, edit(v){ EDIT = v; AERR = ''; vTK(); },
  review(i){ S.rv = i; location.hash === '#/xem' ? vXem() : (location.hash = '#/xem'); },
  install, copyLink,
  async refreshPlan(){ if(C) await C.refreshPlan(); vGoi(); topRight(); }, qtFind, qtGrant, qtRevoke, qtList,
};
})();
