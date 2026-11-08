/* IMs 0.6 — Lớp học 2D (#/lophoc).
   Phòng học nhìn từ trên xuống: 48 chỗ (4 dãy bàn đôi × 6 bàn), bàn giáo viên, bảng, cửa ra vào.
   • Em là một nhân vật 2D: đi bằng phím mũi tên / WASD, hoặc bấm (chạm) vào sàn để đi tới — tự tìm đường né bàn ghế.
     Điện thoại: kéo để di chuyển khung nhìn, hai ngón để phóng to / thu nhỏ. Máy tính: kéo chuột, lăn chuột để phóng to.
   • Bấm vào ghế trống: nhân vật đi tới và ngồi, ghế được giữ cho em. Đang ngồi thì có nút Luyện đề (luồng làm đề sẵn có của IMs);
     làm xong quay về lớp, nhân vật vẫn ngồi đúng chỗ, điểm vừa đạt hiện trên đầu cho các bạn thấy.
   • Đã đăng nhập: thấy các bạn khác trong cùng lớp theo thời gian thực qua Firestore; ai quá 2 phút không cập nhật thì ẩn đi.
     Chưa đăng nhập / mất mạng / máy chủ chưa bật luật lớp học: chế độ xem thử, các bạn trong lớp là mô phỏng.
   • Đứng gần hoặc ngồi cạnh một bạn: nút Nhắn riêng (chat 1–1), tin nhắn nổi thành bong bóng trên đầu vài giây (chỉ hai bạn thấy chữ).
     An toàn: tối đa 200 ký tự, 1 tin / 2 giây (luật máy chủ), 8 tin / phút, che từ tục; có Chặn và Báo cáo; giáo viên (quản trị) xem báo cáo ngay trong lớp.
   Dữ liệu Firestore (luật trong firestore.rules):
     classrooms/{lop}                  {board, by, at}       lời nhắn trên bảng (chỉ quản trị ghi). lop: "chung" hoặc mã lớp (10A1, 12C3…)
     classrooms/{lop}/presence/{uid}   name, lk (kiểu nhân vật), x, y, tx, ty, dir, seat, st, sc, scAt, em, emAt, gv, dmTo, dmAt, lm, t (= lastSeen, giờ máy chủ)
     classrooms/{lop}/seats/{0..48}    {uid, at}  ghế đang giữ (48 = ghế giáo viên)
     classrooms/{lop}/dm/{uidA_uidB}/msgs/{id}   {from, to, text, at}
     blocks/{uid}   {u:[uid…]}  các bạn em đã chặn          reports/{id}   báo cáo gửi giáo viên */
const LOP = (()=>{
const C = typeof CLOUD !== 'undefined' ? CLOUD : null;
const $ = id=> document.getElementById(id);
const esc = s=> String(s == null ? '' : s).replace(/[&<>"]/g, c=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]);
const ask = (...a)=> IMS.ask(...a), say = m=> IMS.say(m);
const store = {get(k, d){ try{ const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); }catch(e){ return d; } }, set(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }};
const HB = 40000, STALE = 120000, SPEED = 3.4, NEAR = 2.3, MAXLEN = 200, SCORE_MS = 15*60000;
const FONT = '"Be Vietnam Pro",system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif';
const clamp = (v, a, b)=> Math.max(a, Math.min(b, v));

/* ---------- bản đồ phòng học (ô lưới 16 × 20, mỗi ô P điểm ảnh) ---------- */
const W = 16, H = 20, P = 40;
const DESKX = [2, 5, 9, 12], DESKY = [5, 7, 9, 11, 13, 15];
const BLOCK = new Uint8Array(W*H);
const blk = (x0, y0, x1, y1)=>{ for(let y = y0; y <= y1; y++) for(let x = x0; x <= x1; x++) BLOCK[y*W + x] = 1; };
blk(0, 0, W - 1, 0); blk(0, H - 1, W - 1, H - 1); blk(0, 0, 0, H - 1); blk(W - 1, 0, W - 1, H - 1);
DESKX.forEach(x=> DESKY.forEach(y=> blk(x, y, x + 1, y)));
blk(6, 3, 9, 3);     // bàn giáo viên
blk(1, 18, 3, 18);   // tủ sách cuối lớp
blk(1, 1, 1, 1); blk(14, 1, 14, 1); blk(14, 18, 14, 18);   // chậu cây, thùng rác
const solid = (x, y)=> x < 0 || y < 0 || x >= W || y >= H || BLOCK[(y|0)*W + (x|0)] === 1;
const SPAWN = {x:14.5, y:16.6};
const SEATS = [];
DESKY.forEach((y, r)=> DESKX.forEach((x, c)=> [0, 1].forEach(k=> SEATS.push({i:SEATS.length, tx:x + k, ty:y + 1, x:x + k + .5, y:y + 1.42, row:r + 1, col:c + 1}))));
SEATS.push({i:48, tx:8, ty:2, x:8, y:2.35, gv:true});
const seatName = i=> { const s = SEATS[i]; return !s ? '' : s.gv ? 'ghế giáo viên' : `ghế ${i + 1} (dãy ${s.col}, bàn ${s.row})`; };
function seatAt(tx, ty){ const x = Math.floor(tx), y = Math.floor(ty);
  if(y === 2 && (x === 7 || x === 8)) return SEATS[48];
  return SEATS.find(s=> !s.gv && s.tx === x && (s.ty === y || s.ty === y + 1)) || null; }   // bấm vào ghế hoặc vào nửa bàn ngay trước ghế

/* ---------- tìm đường (A* trên lưới, 8 hướng, không cắt góc) rồi kéo thẳng đoạn đường ---------- */
function free(x, y, r = .27){ return !solid(x - r, y - r) && !solid(x + r, y - r) && !solid(x - r, y + r) && !solid(x + r, y + r); }
function los(a, b){ const d = Math.hypot(b.x - a.x, b.y - a.y), n = Math.ceil(d/.12); for(let i = 1; i < n; i++){ const t = i/n; if(!free(a.x + (b.x - a.x)*t, a.y + (b.y - a.y)*t, .24)) return false; } return true; }
function nearOpen(x, y){ let best = null, bd = 1e9; for(let j = 0; j < H; j++) for(let i = 0; i < W; i++) if(!BLOCK[j*W + i]){ const d = (i + .5 - x)**2 + (j + .5 - y)**2; if(d < bd){ bd = d; best = {x:i, y:j}; } } return best; }
function findPath(sx, sy, tx, ty){
  let s = {x:Math.floor(sx), y:Math.floor(sy)}, g = {x:Math.floor(tx), y:Math.floor(ty)};
  if(solid(s.x, s.y)) s = nearOpen(sx, sy); if(solid(g.x, g.y)){ g = nearOpen(tx, ty); tx = g.x + .5; ty = g.y + .5; }
  const N = W*H, gs = new Float32Array(N).fill(1e9), from = new Int16Array(N).fill(-1), shut = new Uint8Array(N), open = [];
  const id = (x, y)=> y*W + x, hh = (x, y)=>{ const dx = Math.abs(x - g.x), dy = Math.abs(y - g.y); return Math.max(dx, dy) + .414*Math.min(dx, dy); };
  gs[id(s.x, s.y)] = 0; open.push(id(s.x, s.y)); let found = false;
  while(open.length){ let bi = 0, bf = 1e9; for(let k = 0; k < open.length; k++){ const c = open[k], f = gs[c] + hh(c % W, (c/W)|0); if(f < bf){ bf = f; bi = k; } }
    const c = open.splice(bi, 1)[0]; if(shut[c]) continue; shut[c] = 1; const cx = c % W, cy = (c/W)|0; if(cx === g.x && cy === g.y){ found = true; break; }
    for(let dy = -1; dy <= 1; dy++) for(let dx = -1; dx <= 1; dx++){ if(!dx && !dy) continue; const nx = cx + dx, ny = cy + dy; if(solid(nx, ny)) continue;
      if(dx && dy && (solid(cx + dx, cy) || solid(cx, cy + dy))) continue; const n = id(nx, ny); if(shut[n]) continue; const ng = gs[c] + (dx && dy ? 1.414 : 1);
      if(ng < gs[n]){ gs[n] = ng; from[n] = c; open.push(n); } } }
  if(!found) return null;
  const pts = []; for(let c = id(g.x, g.y); c !== -1 && c !== id(s.x, s.y); c = from[c]) pts.unshift({x:c % W + .5, y:((c/W)|0) + .5});
  if(pts.length) pts[pts.length - 1] = {x:tx, y:ty}; else pts.push({x:tx, y:ty});
  const out = []; let cur = {x:sx, y:sy}, k = 0;   // kéo thẳng: bỏ các điểm giữa nếu nhìn thấy nhau
  while(k < pts.length){ let j = pts.length - 1; while(j > k && !los(cur, pts[j])) j--; out.push(pts[j]); cur = pts[j]; k = j + 1; }
  return out; }

/* ---------- nhân vật: kiểu (lk = "áo.tóc.da.màu tóc") ---------- */
const SHIRT = ['#ffffff', '#3b5bdb', '#e7c878', '#14804a', '#c62f2f', '#7a35b0', '#0b7285', '#f08c00', '#e64980', '#495057'];
const HAIRS = ['Ngắn', 'Dài', 'Buộc', 'Xù', 'Mái bằng'];
const SKIN = ['#f7d7bd', '#ebb88f', '#c98b62'];
const HAIRC = ['#1f1a17', '#4a2f1d', '#7b4a24', '#a8662c'];
const EMO = ['👋', '✋', '👍', '😊', '😂', '🤔', '💪', '🎉'];
function hashStr(s){ let h = 2166136261; for(const ch of String(s)){ h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
const lkOf = id=>{ const h = hashStr(id); return [h % SHIRT.length, (h >> 4) % HAIRS.length, (h >> 8) % SKIN.length, (h >> 12) % HAIRC.length].join('.'); };
function look(lk){ const a = String(lk || '').split('.').map(n=> Math.abs(parseInt(n, 10)) || 0); return {c:(a[0] || 0) % SHIRT.length, h:(a[1] || 0) % HAIRS.length, k:(a[2] || 0) % SKIN.length, hc:(a[3] || 0) % HAIRC.length}; }

/* ---------- lọc từ ngữ không phù hợp ---------- */
const BAD = /(^|[^\p{L}\p{N}])(đm|dm|đcm|dcm|đkm|dkm|vcl|vkl|vl|cmm|clm|đéo|địt|đụ|cặc|lồn|loz|đĩ|buồi|chó đẻ|óc chó|ngu)(?=$|[^\p{L}\p{N}])/giu;
const clean = s=> String(s || '').replace(BAD, (m, a, w)=> a + '*'.repeat(w.length));
const short = n=>{ n = String(n || '').replace(/\s*\(.*\)\s*$/, '').trim(); return n.split(/\s+/).pop() || n || '?'; };

/* ---------- trạng thái ---------- */
let MODE = null, LIVEFAIL = false, ROOM = String(store.get('ims_lop_room', 'chung')), JOINED = false, ON = false, JOINT = 0, SKEW = 0;
const ENTS = new Map(); let ME = null, SEATHOLD = {}, BOARD = '', BLOCKS = new Set(store.get('ims_lop_block', [])), unsubs = [], hbT = 0, simT = 0, tickT = 0;
let CLEANED = false, CHAT = null, SHEET = null, JUST = null, SENT = [], LASTEM = 0, HOVER = null, MARK = null, BARKEY = '';
const UNREAD = {}, CONVO = new Map(), DMSEEN = {}, SIMCHAT = {}, KEYS = new Set();
let root = null, cv = null, ctx = null, VW = 0, VH = 0, DPR = 1, Z = 0, FITZ = 1, CX = W*P/2, CY = H*P/2, raf = 0, lastT = 0, lastPan = 0, ro = null;
let TOPPAD = 64, BOTPAD = 84;

const live = ()=> !!(!LIVEFAIL && C && C.state === 'in' && C.user && typeof firebase !== 'undefined' && firebase.firestore);
const db = ()=> firebase.firestore();
const R = ()=> db().collection('classrooms').doc(ROOM);
const TSV = ()=> firebase.firestore.FieldValue.serverTimestamp();
const pairId = (a, b)=> [a, b].sort().join('_');
const fresh = e=> e.me || e.bot || (Date.now() + SKEW - (e.t || 0) < STALE);
const myName = ()=>{ if(MODE === 'live'){ const p = C.profile, u = C.user; return String((p && p.name) || (u && u.displayName) || (u && u.email && u.email.split('@')[0]) || 'Học sinh').trim().slice(0, 40); } return 'Em'; };
const myLk = id=> store.get('ims_lop_look', null) || lkOf(id || 'me');
const roomLabel = r=> r === 'chung' ? 'Lớp chung' : 'Lớp ' + r;
function mkEnt(id, name, lk, at){ return {id, name:String(name || '?').slice(0, 40), lk:lk || lkOf(id), x:at.x, y:at.y, dir:0, path:null, onArrive:null, seat:-1, sit:false, st:'', sc:'', scAt:0, em:-1, emUntil:0, bub:null, dotsUntil:0, walkT:0, moving:false, seed:hashStr(id) % 1000, t:Date.now()}; }

/* ---------- vào / ra lớp ---------- */
function join(){
  if(JOINED) return; JOINED = true; MODE = live() ? 'live' : 'sim'; JOINT = Date.now(); ENTS.clear(); SEATHOLD = {}; BOARD = ''; CONVO.clear();
  const id = MODE === 'live' ? C.user.uid : 'me';
  ME = mkEnt(id, myName(), myLk(id), SPAWN); ME.me = true; ME.dir = 1; ME.gv = MODE === 'live' && !!C.admin; ENTS.set(id, ME);
  CLEANED = false; if(MODE === 'live'){ loadBlocks(); writeP(); hbT = setInterval(writeP, HB); } else simStart();
  clearInterval(tickT); tickT = setInterval(tick, 1000); }
function leave(){
  if(!JOINED) return; JOINED = false; clearInterval(hbT); clearInterval(simT); clearInterval(tickT); clearTimeout(wT); unlisten(); closeChat(true); closeSheet();
  if(MODE === 'live' && ME && C.user && C.user.uid === ME.id){ try{ const b = db().batch(); b.delete(R().collection('presence').doc(ME.id)); if(ME.seat >= 0 && SEATHOLD[ME.seat] === ME.id) b.delete(R().collection('seats').doc(String(ME.seat))); b.commit().catch(()=>{}); }catch(e){} }
  ENTS.clear(); ME = null; MODE = null; }
function rejoin(){ const on = ON; leave(); if(on){ join(); listen(); hud(true); } }
function fsErr(e){ console.warn('IMs lớp học', e && (e.code || e)); if(e && e.code === 'permission-denied' && MODE === 'live' && !LIVEFAIL){ LIVEFAIL = true; rejoin(); toast('Máy chủ chưa mở lớp học trực tuyến (thầy cô cần cập nhật luật Firestore). Em đang ở chế độ xem thử.', null, 7000); } }

/* ---------- Firestore: hiện diện, ghế, bảng ---------- */
function listen(){
  if(MODE !== 'live' || unsubs.length) return;
  const since = firebase.firestore.Timestamp.fromMillis(Date.now() - 10*60000);
  unsubs.push(R().collection('presence').where('t', '>', since).onSnapshot({includeMetadataChanges:true}, onPres, fsErr));
  unsubs.push(R().collection('seats').onSnapshot({includeMetadataChanges:true}, s=>{ SEATHOLD = {}; s.forEach(d=>{ SEATHOLD[+d.id] = (d.data() || {}).uid; });
    if(ME && !CLEANED && !s.metadata.fromCache){ CLEANED = true; for(const [i, u] of Object.entries(SEATHOLD)) if(u === ME.id && +i !== ME.seat){ delete SEATHOLD[i]; R().collection('seats').doc(i).delete().catch(()=>{}); } }   // ghế cũ của lần vào trước
    if(ME && ME.seat >= 0 && !s.metadata.hasPendingWrites && SEATHOLD[ME.seat] && SEATHOLD[ME.seat] !== ME.id){   // em vắng quá 2 phút, ghế đã có bạn khác ngồi
      const st = SEATS[ME.seat]; ME.seat = -1; ME.sit = false; ME.path = null; if(st){ ME.x = st.gv ? 8 : st.tx === DESKX[st.col - 1] ? st.tx - .5 : st.tx + 1.5; ME.y = st.gv ? 1.5 : st.y; } sync(true); hud(true);
      toast('Em vắng hơi lâu nên ghế đã có bạn khác ngồi. Em chọn ghế khác nhé.', null, 6000); } }, fsErr));
  unsubs.push(R().onSnapshot(s=>{ BOARD = s.exists ? clean(String((s.data() || {}).board || '')).slice(0, 120) : ''; }, ()=>{})); }
function unlisten(){ unsubs.forEach(f=>{ try{ f(); }catch(e){} }); unsubs = []; }
function onPres(snap){
  if(!ME) return; const seen = new Set([ME.id]);
  snap.forEach(doc=>{ const d = doc.data({serverTimestamps:'estimate'}) || {}, id = doc.id, t = d.t && d.t.toMillis ? d.t.toMillis() : 0;
    if(id === ME.id){ if(!doc.metadata.hasPendingWrites && t && Date.now() - lastW < 8000) SKEW = t - Date.now(); return; }
    if(Date.now() + SKEW - t >= STALE) return; seen.add(id);
    let e = ENTS.get(id); const st = d.seat >= 0 ? SEATS[d.seat] : null;
    if(!e){ e = mkEnt(id, d.name, d.lk, {x:+d.x || SPAWN.x, y:+d.y || SPAWN.y}); ENTS.set(id, e); if(st){ e.x = st.x; e.y = st.y; e.sit = true; e.seat = d.seat; e.dir = st.gv ? 0 : 2; e.goal = {x:st.x, y:st.y}; } }
    e.name = clean(d.name).slice(0, 40) || '?'; e.lk = d.lk || e.lk; e.t = t; e.gv = !!d.gv; e.st = d.st || ''; e.sc = String(d.sc || ''); e.scAt = +d.scAt || 0;
    if(d.em >= 0 && d.emAt && d.emAt !== e.emAt){ e.emAt = d.emAt; if(d.emAt > JOINT - 5000){ e.em = d.em; e.emUntil = Date.now() + 4000; } }
    if(d.dmTo && d.dmAt && d.dmAt !== e.dmAt){ const first = e.dmAt == null; e.dmAt = d.dmAt; if(d.dmAt > JOINT){ if(d.dmTo === ME.id) gotPing(e, d.dmAt); else if(!first) e.dotsUntil = Date.now() + 3500; } }
    steer(e, d); });
  for(const id of [...ENTS.keys()]) if(!seen.has(id)) ENTS.delete(id);
  hud(); }
function steer(e, d){   // bạn khác: đi tới ghế / điểm đích bạn ấy vừa gửi, tự tìm đường trên máy này
  const st = d.seat >= 0 ? SEATS[d.seat] : null; let tx, ty;
  if(st){ tx = st.x; ty = st.y; } else if(d.tx >= 0 && d.ty >= 0){ tx = +d.tx; ty = +d.ty; } else { tx = +d.x; ty = +d.y; }
  if(!isFinite(tx) || !isFinite(ty)) return;
  if(e.goal && Math.abs(e.goal.x - tx) < .05 && Math.abs(e.goal.y - ty) < .05) return;
  e.goal = {x:tx, y:ty}; e.seat = st ? d.seat : -1; if(e.sit) e.sit = false;
  if(Math.hypot(e.x - d.x, e.y - d.y) > 3 && !st){ e.x = +d.x; e.y = +d.y; }
  e.path = findPath(e.x, e.y, tx, ty); e.onArrive = st ? ()=>{ e.sit = true; e.x = st.x; e.y = st.y; e.dir = st.gv ? 0 : 2; } : null;
  if(!e.path){ e.x = tx; e.y = ty; if(e.onArrive) e.onArrive(); } }
let lastW = 0, wT = 0;
function sync(now){ if(MODE !== 'live' || !ME) return; const wait = 700 - (Date.now() - lastW); clearTimeout(wT); if(now || wait <= 0) writeP(); else wT = setTimeout(writeP, wait); }
function writeP(){ if(MODE !== 'live' || !ME) return; lastW = Date.now(); clearTimeout(wT);
  const g = ME.path && ME.path.length ? ME.path[ME.path.length - 1] : null, r2 = v=> Math.round(clamp(v, 0, 20)*100)/100;
  const d = {name:ME.name, lk:ME.lk, x:r2(ME.x), y:r2(ME.y), tx:g ? r2(g.x) : -1, ty:g ? r2(g.y) : -1, dir:ME.dir, seat:ME.seat, st:ME.st, sc:ME.sc, scAt:ME.scAt, em:ME.em, emAt:ME.emAt || 0, gv:!!ME.gv, t:TSV()};
  R().collection('presence').doc(ME.id).set(d, {merge:true}).catch(fsErr); }
function tick(){   // mỗi giây: ẩn bạn quá hạn, cập nhật thanh nút
  if(!JOINED) return; let ch = false;
  for(const [id, e] of ENTS) if(!fresh(e)){ ENTS.delete(id); ch = true; }
  if(ON) hud(ch); }

/* ---------- ghế ---------- */
function holder(i){ if(MODE === 'sim') return SEATHOLD[i] || null; const u = SEATHOLD[i]; if(u){ if(u === ME.id) return u; const e = ENTS.get(u); if(e && fresh(e)) return u; }
  for(const e of ENTS.values()) if(e !== ME && e.seat === i) return e.id; return null; }
async function claim(i){
  const ref = R().collection('seats').doc(String(i)), old = ME.seat >= 0 && ME.seat !== i ? R().collection('seats').doc(String(ME.seat)) : null;
  await db().runTransaction(async tx=>{ const s = await tx.get(ref), o = old ? await tx.get(old) : null;
    if(s.exists){ const u = (s.data() || {}).uid; if(u && u !== ME.id){ const e = ENTS.get(u); if(e && fresh(e)) throw Object.assign(new Error('taken'), {code:'taken'}); } }
    tx.set(ref, {uid:ME.id, at:TSV()}); if(o && o.exists && (o.data() || {}).uid === ME.id) tx.delete(old); });
  if(old) delete SEATHOLD[ME.seat]; SEATHOLD[i] = ME.id; }
function releaseSeat(){ if(!ME || ME.seat < 0) return; const i = ME.seat; ME.seat = -1; ME.sit = false;
  if(MODE === 'live'){ if(SEATHOLD[i] === ME.id){ delete SEATHOLD[i]; R().collection('seats').doc(String(i)).delete().catch(()=>{}); } } else delete SEATHOLD[i]; }
async function takeSeat(i){
  const s = SEATS[i]; if(!s || !ME) return;
  if(s.gv && !ME.gv){ toast('Đây là ghế của thầy cô giáo.'); return; }
  const h = holder(i); if(h && h !== ME.id){ const e = ENTS.get(h); if(e) openCard(e.id); else toast('Ghế này đã có bạn ngồi.'); return; }
  if(ME.seat === i && ME.sit) return;
  if(ME.seat !== i){
    if(MODE === 'live'){ try{ await claim(i); }catch(e){ if(!ME) return; say(e.code === 'taken' || e.code === 'permission-denied' ? 'Ghế này vừa có bạn ngồi. Em chọn ghế khác nhé.' : 'Chưa giữ được ghế: ' + C.msg(e)); return; } }
    else { if(ME.seat >= 0) delete SEATHOLD[ME.seat]; SEATHOLD[i] = ME.id; }
    ME.seat = i; }
  walk(s.x, s.y, ()=>{ ME.sit = true; ME.x = s.x; ME.y = s.y; ME.dir = s.gv ? 0 : 2; sync(true); hud(true); toast(`Em đã ngồi vào ${seatName(i)}. Ghế này được giữ cho em.`); }); }
function walk(x, y, then){ if(!ME) return false; const p = findPath(ME.x, ME.y, x, y); if(!p) return false; ME.sit = false; ME.path = p; ME.onArrive = then || null; sync(true); hud(true); return true; }
function walkFloor(x, y){ if(ME.seat >= 0) releaseSeat(); if(!free(x, y)){ const o = nearOpen(x, y); if(!o) return; x = o.x + .5; y = o.y + .5; } MARK = {x, y, t:performance.now()}; walk(x, y); }
function standUp(){ if(!ME || ME.seat < 0) return; const s = SEATS[ME.seat]; releaseSeat(); const o = s.gv ? {x:8, y:1.5} : {x:s.x, y:s.y + .02}; ME.x = o.x; ME.y = o.y; ME.dir = 0;
  if(!s.gv){ const side = s.tx === DESKX[s.col - 1] ? -1 : 1, ax = side < 0 ? s.tx - .5 : s.tx + 1.5; if(free(ax, s.y)) walk(ax, s.y); } else walk(o.x, o.y); hud(true); }

/* ---------- nhắn riêng ---------- */
const nearest = ()=>{ let b = null, bd = NEAR; for(const e of ENTS.values()){ if(e === ME || BLOCKS.has(e.id)) continue; const d = Math.hypot(e.x - ME.x, e.y - ME.y); if(d <= bd){ bd = d; b = e; } } return b; };
const isNear = e=> e && ME && Math.hypot(e.x - ME.x, e.y - ME.y) <= NEAR;
function bubble(e, text){ e.bub = {text:clean(text), until:Date.now() + 5500}; }
async function gotPing(e, at){
  if(BLOCKS.has(e.id) || (DMSEEN[e.id] || 0) >= at) return; DMSEEN[e.id] = at; CONVO.set(e.id, e.name);
  if(CHAT && CHAT.id === e.id) return;   // khung chat đang mở tự nhận tin
  try{ const s = await R().collection('dm').doc(pairId(ME.id, e.id)).collection('msgs').orderBy('at', 'desc').limit(1).get(); const m = s.docs[0] && s.docs[0].data();
    if(!m || m.from !== e.id || !ME) return; bubble(e, m.text); UNREAD[e.id] = (UNREAD[e.id] || 0) + 1; hud(true);
    toast(`${short(e.name)} nhắn: ${clean(m.text).slice(0, 80)}`, {t:'Trả lời', f:()=> openChat(e.id)}, 6000); }catch(err){ console.warn(err); } }
function openChat(id){
  const e = ENTS.get(id); if(!e && !CONVO.has(id)) return; if(BLOCKS.has(id)){ say('Em đã chặn bạn này. Mở thẻ của bạn ấy để bỏ chặn nếu muốn nhắn lại.'); return; }
  closeChat(true); closeSheet(); CHAT = {id, name:(e && e.name) || CONVO.get(id), msgs:MODE === 'sim' ? (SIMCHAT[id] || (SIMCHAT[id] = [])) : [], t0:Date.now(), unsub:null};
  CONVO.set(id, CHAT.name); UNREAD[id] = 0;
  if(MODE === 'live'){ let first = true;
    CHAT.unsub = R().collection('dm').doc(pairId(ME.id, id)).collection('msgs').orderBy('at').limitToLast(50).onSnapshot(s=>{
      if(!CHAT || CHAT.id !== id) return; const old = CHAT.msgs.length; CHAT.msgs = s.docs.map(d=> d.data({serverTimestamps:'estimate'}));
      if(!first && CHAT.msgs.length > old){ const m = CHAT.msgs[CHAT.msgs.length - 1], who = ENTS.get(m.from); if(m.from !== ME.id && who) bubble(who, m.text); }
      first = false; renderChat(); }, err=>{ fsErr(err); }); }
  renderChat(); hud(true); const i = $('lopIn'); if(i && window.matchMedia && matchMedia('(hover:hover)').matches) i.focus(); }
function closeChat(quiet){ if(CHAT && CHAT.unsub) try{ CHAT.unsub(); }catch(e){} CHAT = null; const el = $('lopChat'); if(el){ el.hidden = true; el.innerHTML = ''; } if(!quiet) hud(true); }
function renderChat(){
  const el = $('lopChat'); if(!el || !CHAT) return; const e = ENTS.get(CHAT.id), nm = CHAT.name || '?';
  const list = CHAT.msgs.map(m=>{ const mine = m.from === ME.id; return `<div class="lm ${mine ? 'me' : ''}"><span>${esc(clean(m.text))}</span></div>`; }).join('') || `<div class="lempty">Chưa có tin nhắn. Em gửi lời chào ${esc(short(nm))} nhé!</div>`;
  const keep = $('lopIn') ? $('lopIn').value : '';
  el.innerHTML = `<div class="lch"><span class="lav" style="background:${SHIRT[look(e ? e.lk : '').c]}"></span><b>${esc(nm)}</b>${e && e.bot ? '<span class="tag">mô phỏng</span>' : ''}${e ? '' : '<span class="tag">đã rời lớp</span>'}
      <button class="lx" onclick="LOP.closeChat()" aria-label="Đóng">×</button></div>
    <div class="lmsgs" id="lopMsgs">${list}</div>
    <form class="lfoot" onsubmit="event.preventDefault();LOP.send()"><input id="lopIn" maxlength="${MAXLEN}" placeholder="Nhắn riêng cho ${esc(short(nm))}…" autocomplete="off" enterkeyhint="send"><button class="btn sm" type="submit">Gửi</button></form>
    <div class="lnote">Chỉ hai em đọc được. Tối đa ${MAXLEN} ký tự · <a href="javascript:LOP.block('${CHAT.id}')">Chặn</a> · <a href="javascript:LOP.report('${CHAT.id}')">Báo cáo thầy cô</a></div>`;
  el.hidden = false; const i = $('lopIn'); if(i && keep) i.value = keep; const ms = $('lopMsgs'); if(ms) ms.scrollTop = ms.scrollHeight; }
async function send(){
  if(!CHAT || !ME) return; const inp = $('lopIn'); let text = String(inp && inp.value || '').replace(/\s+/g, ' ').trim().slice(0, MAXLEN); if(!text) return;
  const now = Date.now(); SENT = SENT.filter(t=> now - t < 60000);
  if(SENT.length && now - SENT[SENT.length - 1] < 2100){ toast('Đợi 2 giây giữa hai tin nhắn nhé.'); return; }
  if(SENT.length >= 8){ toast('Em gửi nhiều quá. Đợi một phút rồi nhắn tiếp nhé.'); return; }
  const id = CHAT.id, e = ENTS.get(id); if(!e){ toast('Bạn ấy đã rời lớp.'); return; }
  text = clean(text); SENT.push(now); inp.value = '';
  if(MODE === 'sim'){ CHAT.msgs.push({from:ME.id, to:id, text, at:now}); bubble(ME, text); renderChat(); botReply(e); return; }
  try{ const b = db().batch(); b.set(R().collection('dm').doc(pairId(ME.id, id)).collection('msgs').doc(), {from:ME.id, to:id, text, at:TSV()});
    b.set(R().collection('presence').doc(ME.id), {lm:TSV(), dmTo:id, dmAt:now, t:TSV()}, {merge:true}); await b.commit(); bubble(ME, text); }
  catch(err){ inp.value = text; toast(err && err.code === 'permission-denied' ? 'Chưa gửi được: em gửi nhanh quá, hoặc bạn ấy không nhận tin nhắn.' : 'Chưa gửi được: ' + C.msg(err)); } }
async function loadBlocks(){ try{ const s = await db().collection('blocks').doc(ME.id).get(); if(s.exists) BLOCKS = new Set([...BLOCKS, ...((s.data() || {}).u || [])]); }catch(e){} }
function saveBlocks(){ const u = [...BLOCKS].slice(-300); store.set('ims_lop_block', u); if(MODE === 'live') db().collection('blocks').doc(ME.id).set({u}).catch(e=> console.warn(e)); }
async function block(id){ const e = ENTS.get(id), nm = (e && e.name) || CONVO.get(id) || 'bạn này';
  if(BLOCKS.has(id)){ if(!await ask(`Bỏ chặn ${nm}?`, 'Bỏ chặn')) return; BLOCKS.delete(id); saveBlocks(); openCard(id); return; }
  if(!await ask(`Chặn ${nm}? Bạn ấy sẽ không nhắn riêng được cho em nữa, và em không thấy bong bóng chat của bạn ấy.`, 'Chặn')) return;
  BLOCKS.add(id); saveBlocks(); if(CHAT && CHAT.id === id) closeChat(); closeSheet(); toast(`Đã chặn ${short(nm)}.`); }
async function report(id){
  const e = ENTS.get(id), nm = (e && e.name) || CONVO.get(id) || 'bạn này';
  if(!await ask(`Báo cáo ${nm} với thầy cô? Thầy cô sẽ đọc được các tin nhắn gần nhất giữa hai em để giúp em.`, 'Gửi báo cáo')) return;
  if(MODE === 'sim' || (e && e.bot)){ say('Đây là chế độ xem thử nên báo cáo không gửi đi. Khi em đăng nhập và học cùng bạn thật, báo cáo sẽ tới thầy cô.'); return; }
  try{ let ms = CHAT && CHAT.id === id ? CHAT.msgs : null;
    if(!ms){ const s = await R().collection('dm').doc(pairId(ME.id, id)).collection('msgs').orderBy('at', 'desc').limit(20).get(); ms = s.docs.map(d=> d.data()).reverse(); }
    const lines = ms.slice(-20).map(m=> `${m.from === ME.id ? ME.name : nm}: ${String(m.text || '').slice(0, MAXLEN)}`);
    await db().collection('reports').add({by:ME.id, byName:ME.name, who:id, whoName:String(nm).slice(0, 40), room:ROOM, msgs:lines, at:TSV()});
    say('Đã gửi báo cáo cho thầy cô. Cảm ơn em! Nếu bạn ấy còn làm phiền, em bấm Chặn nhé.'); }
  catch(err){ say('Chưa gửi được báo cáo: ' + C.msg(err)); } }

/* ---------- chế độ xem thử: các bạn mô phỏng ---------- */
const BOTS = [['Nguyễn Minh Anh', '1.1.0.0'], ['Trần Hoàng Nam', '2.0.1.1'], ['Lê Thu Trang', '8.2.0.0'], ['Phạm Đức Huy', '3.3.1.0'], ['Vũ Ngọc Lan', '0.1.0.1'], ['Đỗ Quang Vinh', '6.0.2.0'],
  ['Bùi Bảo Ngọc', '5.4.0.2'], ['Hoàng Tuấn Kiệt', '4.3.0.0'], ['Ngô Khánh Linh', '7.2.1.1'], ['Đặng Gia Bảo', '9.0.0.0'], ['Phan Phương Thảo', '2.1.0.1'], ['Trịnh Hải Đăng', '0.3.2.0'], ['Lý Mai Chi', '3.4.0.0']];
const REPLY = ['Chào cậu 👋', 'Câu cuối đề vừa rồi khó ghê 😅', 'Tớ đang luyện chương đạo hàm.', 'Cố lên nhé! 💪', 'Lát làm đề 20 câu thi với tớ không?', 'Tớ vừa được 8/10 đó 😊', 'Ừ, để tớ xem lại lời giải đã.', 'Hihi, cảm ơn cậu!', 'Câu đúng – sai dễ nhầm lắm, đọc kỹ từng ý nhé.'];
const AISLE = []; for(let y = 1; y < H - 1; y++) for(let x = 1; x < W - 1; x++) if(!BLOCK[y*W + x] && !SEATS.some(s=> s.tx === x && s.ty === y)) AISLE.push({x:x + .5, y:y + .5});
const rnd = a=> a[Math.floor(Math.random()*a.length)];
function simStart(){
  const free = SEATS.filter(s=> !s.gv).map(s=> s.i).sort(()=> Math.random() - .5);
  BOTS.forEach((b, k)=>{ const e = mkEnt('bot' + k, b[0], b[1], rnd(AISLE)); e.bot = true; ENTS.set(e.id, e);
    if(k < 9){ const i = free.pop(), s = SEATS[i]; SEATHOLD[i] = e.id; e.seat = i; e.sit = true; e.x = s.x; e.y = s.y; e.dir = 2;
      if(Math.random() < .5){ e.st = 'lam'; e.examEnd = Date.now() + 8000 + Math.random()*40000; } else if(Math.random() < .5){ e.sc = (6 + Math.floor(Math.random()*5)) + '/10'; e.scAt = Date.now() - Math.random()*300000; } } });
  const t = mkEnt('botgv', 'Cô Hạnh', '6.1.0.0', SEATS[48]); t.bot = true; t.gv = true; t.sit = true; t.seat = 48; t.dir = 0; SEATHOLD[48] = t.id; ENTS.set(t.id, t);
  simT = setInterval(simTick, 1200); setTimeout(simHello, 9000); }
function simTick(){
  if(MODE !== 'sim' || !ME) return; const now = Date.now();
  for(const e of ENTS.values()){ if(!e.bot || e.gv) continue; const r = Math.random();
    if(e.st === 'lam'){ if(now > e.examEnd){ e.st = ''; e.sc = (5 + Math.floor(Math.random()*6)) + '/10'; e.scAt = now; if(Math.random() < .5){ e.em = rnd([2, 7, 6, 3]); e.emUntil = now + 4000; } } continue; }
    if(e.sit){ if(r < .03){ e.st = 'lam'; e.examEnd = now + 15000 + Math.random()*45000; } else if(r < .045){ delete SEATHOLD[e.seat]; e.seat = -1; e.sit = false; const p = rnd(AISLE); e.path = findPath(e.x, e.y, p.x, p.y); } else if(r < .055){ e.em = rnd([0, 1, 3, 5]); e.emUntil = now + 4000; } continue; }
    if(!e.path){ if(r < .35){ const fs = SEATS.filter(s=> !s.gv && !SEATHOLD[s.i]); if(fs.length){ const s = rnd(fs); SEATHOLD[s.i] = e.id; e.seat = s.i; e.path = findPath(e.x, e.y, s.x, s.y); e.onArrive = ()=>{ e.sit = true; e.x = s.x; e.y = s.y; e.dir = 2; }; } }
      else if(r < .6){ const p = rnd(AISLE); e.path = findPath(e.x, e.y, p.x, p.y); } } } }
function simHello(){ if(MODE !== 'sim' || !ME || !ON) return; let b = null, bd = 1e9; for(const e of ENTS.values()) if(e.bot && !e.gv){ const d = Math.hypot(e.x - ME.x, e.y - ME.y); if(d < bd){ bd = d; b = e; } }
  if(!b) return; const text = 'Chào cậu! Mới vào lớp à? Ngồi gần tớ đi 👋'; (SIMCHAT[b.id] = SIMCHAT[b.id] || []).push({from:b.id, to:ME.id, text, at:Date.now()}); CONVO.set(b.id, b.name);
  bubble(b, text); UNREAD[b.id] = (UNREAD[b.id] || 0) + 1; hud(true); toast(`${short(b.name)} nhắn: ${text}`, {t:'Trả lời', f:()=> openChat(b.id)}, 6000); }
function botReply(e){ setTimeout(()=>{ if(MODE !== 'sim' || !ENTS.has(e.id)) return; const text = rnd(REPLY); (SIMCHAT[e.id] = SIMCHAT[e.id] || []).push({from:e.id, to:ME.id, text, at:Date.now()}); bubble(e, text); if(CHAT && CHAT.id === e.id) renderChat(); else { UNREAD[e.id] = (UNREAD[e.id] || 0) + 1; hud(true); } }, 1200 + Math.random()*1800); }

/* ---------- vẽ ---------- */
function rr(c, x, y, w, h, r){ r = Math.min(r, w/2, h/2); c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function circ(c, x, y, r){ c.beginPath(); c.arc(x, y, r, 0, Math.PI*2); }
function ell(c, x, y, rx, ry){ c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI*2); }
let PLANKS = null;
function planks(){ if(PLANKS) return PLANKS; PLANKS = []; let s = 7; const r = ()=> (s = (s*9301 + 49297) % 233280)/233280;
  for(let j = 0; j < (H - 1.6)*2 + 2; j++){ const off = r()*P*2; PLANKS.push({off, tint:r()}); } return PLANKS; }
function drawRoom(c, now){
  // tường và sàn gỗ
  c.fillStyle = '#16213e'; rr(c, -6, -6, W*P + 12, H*P + 12, 18); c.fill();
  const fx = P*.82, fy = P*.92, fw = W*P - P*1.64, fh = H*P - P*1.74;
  c.fillStyle = '#ead8b8'; c.fillRect(fx, fy, fw, fh);
  const ph = P/2; planks().forEach((p, j)=>{ const y = fy + j*ph; if(y > fy + fh) return; c.fillStyle = p.tint < .33 ? 'rgba(160,110,50,.06)' : p.tint < .66 ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,0)';
    c.fillRect(fx, y, fw, Math.min(ph, fy + fh - y)); c.fillStyle = 'rgba(120,80,40,.13)'; c.fillRect(fx, y, fw, 1);
    for(let x = fx + p.off; x < fx + fw; x += P*2.4) c.fillRect(x, y, 1, Math.min(ph, fy + fh - y)); });
  c.strokeStyle = '#e7c878'; c.lineWidth = 2; c.strokeRect(fx - 1, fy - 1, fw + 2, fh + 2);
  // nắng từ cửa sổ
  c.save(); c.globalAlpha = .16; c.fillStyle = '#fff6cf';
  [[3, 5.6], [8, 10.6], [13, 15.6]].forEach(([a, b])=>{ c.beginPath(); c.moveTo(fx, a*P); c.lineTo(fx + 2.6*P, a*P + 1.2*P); c.lineTo(fx + 2.6*P, b*P + 1.2*P); c.lineTo(fx, b*P); c.closePath(); c.fill(); }); c.restore();
  // cửa sổ (tường trái)
  [[3, 5.6], [8, 10.6], [13, 15.6]].forEach(([a, b])=>{ c.fillStyle = '#9fd0ef'; c.fillRect(P*.18, a*P, P*.5, (b - a)*P); c.fillStyle = 'rgba(255,255,255,.55)'; c.fillRect(P*.24, a*P + 4, P*.12, (b - a)*P - 8);
    c.fillStyle = '#e8eef8'; c.fillRect(P*.16, a*P - 3, P*.56, 4); c.fillRect(P*.16, b*P - 1, P*.56, 4); c.fillRect(P*.16, (a + b)/2*P - 1.5, P*.56, 3); });
  // bảng
  const bx = 3.6*P, bw = 8.8*P; c.fillStyle = '#8b5a2b'; rr(c, bx - 6, P*.06, bw + 12, P*.98, 6); c.fill();
  c.fillStyle = '#24594a'; rr(c, bx, P*.14, bw, P*.78, 4); c.fill(); c.fillStyle = 'rgba(255,255,255,.05)'; c.fillRect(bx + 8, P*.2, bw*.3, 3);
  c.fillStyle = '#c9a26b'; c.fillRect(bx + 10, P*.92, bw - 20, 4);
  c.fillStyle = '#f5f1e6'; c.textAlign = 'center'; c.textBaseline = 'middle';
  const txt = BOARD || (MODE === 'sim' ? 'Lớp học IMs — xem thử' : 'Chào mừng các em đến ' + roomLabel(ROOM).toLowerCase().replace(/^l/, 'l') + '!');
  c.font = `600 13px ${FONT}`; fitText(c, txt, bx + bw/2, P*.47, bw - 30);
  const d = new Date(), wd = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'][d.getDay()];
  c.font = `500 9.5px ${FONT}`; c.fillStyle = 'rgba(245,241,230,.75)'; c.fillText(`${wd}, ${d.getDate()}/${d.getMonth() + 1} · ${roomLabel(ROOM)} · ∞ Infinity Maths`, bx + bw/2, P*.74);
  c.fillStyle = '#fff'; c.fillRect(bx + bw - 30, P*.86, 12, 4); c.fillStyle = '#f4d35e'; c.fillRect(bx + bw - 50, P*.86, 10, 4);
  // cửa ra vào (tường phải)
  c.fillStyle = '#ead8b8'; c.fillRect(W*P - P*.84, 16.05*P, P*.84, 1.3*P); c.fillStyle = '#9a6a3a'; c.save(); c.translate(W*P - P*.84, 16.05*P);
  c.beginPath(); c.moveTo(0, 0); c.lineTo(-P*1.05, P*.35); c.lineTo(-P*1.05, P*.5); c.lineTo(0, P*.15); c.closePath(); c.fill();
  c.strokeStyle = 'rgba(154,106,58,.35)'; c.setLineDash([3, 4]); c.beginPath(); c.arc(0, 0, P*1.1, Math.PI*.55, Math.PI*.9); c.stroke(); c.setLineDash([]); c.restore();
  c.save(); c.translate(W*P - P*.32, 16.7*P); c.rotate(Math.PI/2); c.fillStyle = '#e7c878'; c.font = `700 9px ${FONT}`; c.textAlign = 'center'; c.fillText('CỬA RA VÀO', 0, 0); c.restore();
  // bảng tin cuối lớp
  const nx = 6*P; c.fillStyle = '#8b5a2b'; c.fillRect(nx - 3, H*P - P*.86, 4*P + 6, P*.62); c.fillStyle = '#d2ad74'; c.fillRect(nx, H*P - P*.82, 4*P, P*.54);
  [['#fff3a8', 10], ['#bfe3ff', 46], ['#ffd1dc', 84], ['#c8f2d0', 122]].forEach(([col, ox], k)=>{ c.fillStyle = col; c.save(); c.translate(nx + ox + 10, H*P - P*.56); c.rotate((k % 2 ? 1 : -1)*.06); c.fillRect(-11, -8, 22, 16); c.restore(); });
  c.fillStyle = '#16213e'; c.font = `700 8.5px ${FONT}`; c.textAlign = 'center'; c.fillText('BẢNG TIN', nx + 2*P, H*P - P*.09);
  // tủ sách, cây, thùng rác
  c.fillStyle = '#7a4b25'; rr(c, P + 2, 18*P + 4, 3*P - 4, P - 10, 4); c.fill();
  const bc = ['#c62f2f', '#3b5bdb', '#e7c878', '#14804a', '#7a35b0', '#f08c00', '#0b7285']; for(let k = 0; k < 15; k++){ c.fillStyle = bc[k % bc.length]; c.fillRect(P + 7 + k*7.2, 18*P + 8, 5, P - 20); }
  [[1.5, 1.5], [14.5, 1.5]].forEach(([x, y])=>{ c.fillStyle = '#b5652b'; circ(c, x*P, y*P + 4, 10); c.fill(); c.fillStyle = '#2f8f4e'; [[-6, -4], [6, -3], [0, -9], [-3, 3], [5, 4]].forEach(([dx, dy])=>{ circ(c, x*P + dx, y*P + dy, 8); c.fill(); }); c.fillStyle = '#4fb46a'; circ(c, x*P - 2, y*P - 5, 5); c.fill(); });
  c.fillStyle = '#5f6b85'; rr(c, 14.5*P - 9, 18.5*P - 11, 18, 22, 4); c.fill(); c.fillStyle = '#7d89a3'; c.fillRect(14.5*P - 9, 18.5*P - 11, 18, 4);
  // bàn giáo viên
  c.fillStyle = 'rgba(20,27,45,.12)'; rr(c, 6*P + 4, 3*P + 8, 4*P - 4, P - 6, 8); c.fill();
  c.fillStyle = '#8a5a33'; rr(c, 6*P + 2, 3*P + 3, 4*P - 4, P - 8, 7); c.fill(); c.fillStyle = '#9c6a3f'; rr(c, 6*P + 5, 3*P + 6, 4*P - 10, P - 16, 5); c.fill();
  c.fillStyle = '#c9d1e3'; rr(c, 7.2*P, 3*P + 9, 26, 17, 2); c.fill(); c.fillStyle = '#3d4b6e'; c.fillRect(7.2*P + 2, 3*P + 11, 22, 11);
  c.fillStyle = '#c62f2f'; c.fillRect(8.6*P, 3*P + 10, 22, 6); c.fillStyle = '#3b5bdb'; c.fillRect(8.6*P + 2, 3*P + 16, 20, 6); c.fillStyle = '#fff'; circ(c, 9.5*P, 3*P + 18, 5); c.fill();
  c.fillStyle = '#e7c878'; c.font = `700 8px ${FONT}`; c.textAlign = 'center'; c.fillText('GIÁO VIÊN', 8*P, 3*P + 4.5);
  // bàn ghế học sinh
  const occ = {}; for(const e of ENTS.values()) if(e.sit && e.seat >= 0) occ[e.seat] = e;
  const standing = ME && !ME.sit;
  SEATS.forEach(s=>{ const x = s.x*P, y = s.ty*P + P*.5, isT = s.gv, o = occ[s.i], taken = o || holder(s.i);
    c.fillStyle = 'rgba(20,27,45,.12)'; ell(c, x, y + 10, 12, 5); c.fill();
    c.fillStyle = HOVER && HOVER.seat === s.i ? '#5370b8' : isT ? '#6b4a2e' : '#40527f'; rr(c, x - 11, y - 9, 22, 19, 5); c.fill();
    c.fillStyle = isT ? '#553a23' : '#2f3e66'; if(isT) rr(c, x - 12, y - 14, 24, 6, 3); else rr(c, x - 12, y + 8, 24, 6, 3); c.fill();
    if(standing && !taken && (!isT || (ME && ME.gv))){ c.strokeStyle = `rgba(231,200,120,${.55 + .35*Math.sin(now/400 + s.i)})`; c.lineWidth = 2; rr(c, x - 13, y - 11, 26, 23, 7); c.stroke(); } });
  DESKX.forEach((x, ci)=> DESKY.forEach((y, ri)=>{ const X = x*P, Y = y*P;
    c.fillStyle = 'rgba(20,27,45,.13)'; rr(c, X + 4, Y + 9, 2*P - 6, P - 10, 6); c.fill();
    c.fillStyle = '#b97f47'; rr(c, X + 2, Y + 4, 2*P - 4, P - 10, 6); c.fill(); c.fillStyle = '#cf9558'; rr(c, X + 4, Y + 6, 2*P - 8, P - 16, 4); c.fill();
    c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(X + 8, Y + 8, 2*P - 16, 2);
    [0, 1].forEach(k=>{ const si = (ri*4 + ci)*2 + k, o = occ[si], cx = X + k*P + P/2;
      if(o && o.st === 'lam'){ c.fillStyle = '#fff'; c.save(); c.translate(cx, Y + P*.48); c.rotate(k ? .08 : -.08); c.fillRect(-9, -8, 18, 15); c.fillStyle = '#9fb0d6'; for(let l = 0; l < 4; l++) c.fillRect(-6, -5 + l*3.3, 12, 1); c.restore();
        c.strokeStyle = '#f4b400'; c.lineWidth = 2.4; c.beginPath(); c.moveTo(cx + 6, Y + P*.6); c.lineTo(cx + 13, Y + P*.35); c.stroke(); }
      else if(o){ c.fillStyle = SHIRT[(o.seed + 3) % SHIRT.length] === '#ffffff' ? '#3b5bdb' : SHIRT[(o.seed + 3) % SHIRT.length]; rr(c, cx - 8, Y + P*.3, 15, 11, 2); c.fill(); }
      else if((si*7) % 5 === 0){ c.fillStyle = 'rgba(255,255,255,.7)'; rr(c, cx - 6, Y + P*.34, 11, 8, 1.5); c.fill(); } }); }));
  if(MARK){ const a = 1 - (now - MARK.t)/700; if(a <= 0) MARK = null; else { c.strokeStyle = `rgba(59,91,219,${a})`; c.lineWidth = 2; ell(c, MARK.x*P, MARK.y*P + 6, 14*(1.4 - a*.4), 6*(1.4 - a*.4)); c.stroke(); } } }
function fitText(c, t, x, y, w){ let s = String(t); while(c.measureText(s).width > w && s.length > 4) s = s.slice(0, -2); if(s !== String(t)) s = s.replace(/.$/, '…'); c.fillText(s, x, y); }

function drawChar(c, e, now, scale = 1, ox, oy){
  const L = look(e.lk), x = ox != null ? ox : e.x*P, y = oy != null ? oy : e.y*P;
  c.save(); if(scale !== 1){ c.translate(x, y); c.scale(scale, scale); c.translate(-x, -y); }
  const ph = e.moving ? Math.sin(e.walkT*11) : 0, bob = e.moving ? Math.abs(ph)*1.8 : Math.sin(now/650 + e.seed)*.5, sit = e.sit, dir = e.dir;
  const skin = SKIN[L.k], hair = HAIRC[L.hc], shirt = SHIRT[L.c], by = sit ? 3 : 0;
  c.fillStyle = 'rgba(20,27,45,.2)'; ell(c, x, y + 9, 11, 4.2); c.fill();
  if(e.me){ c.strokeStyle = '#e7c878'; c.lineWidth = 2.2; ell(c, x, y + 9, 15, 6.2); c.stroke(); }
  if(!sit){ c.fillStyle = '#2b3553'; const a = ph*2.6; rr(c, x - 6.5, y - 1 + a, 5.5, 9 - a*.3, 2.5); c.fill(); rr(c, x + 1, y - 1 - a, 5.5, 9 + a*.3, 2.5); c.fill(); }
  const tY = y - 13 + by - bob;
  // tóc dài phía sau (nhìn từ trước)
  if(L.h === 1 && dir !== 2){ c.fillStyle = hair; rr(c, x - 10.5, tY - 9, 21, 17, 7); c.fill(); }
  c.fillStyle = shirt; rr(c, x - 9, tY, 18, 15, 6.5); c.fill(); c.strokeStyle = 'rgba(20,27,45,.16)'; c.lineWidth = 1; c.stroke();
  if(L.c === 0){ c.fillStyle = '#16213e'; if(dir !== 2){ c.beginPath(); c.moveTo(x - 1.6, tY + 1); c.lineTo(x + 1.6, tY + 1); c.lineTo(x + .9, tY + 9); c.lineTo(x, tY + 10.5); c.lineTo(x - .9, tY + 9); c.closePath(); c.fill(); } }
  const sw = e.moving ? ph*2.5 : 0; c.fillStyle = skin;
  if(sit && dir === 2){ circ(c, x - 7.5, tY + 1.5, 3.2); c.fill(); circ(c, x + 7.5, tY + 1.5, 3.2); c.fill(); }
  else { circ(c, x - 10, tY + 7 + sw, 3.2); c.fill(); circ(c, x + 10, tY + 7 - sw, 3.2); c.fill(); }
  const hx = x, hy = tY - 7.5;
  c.fillStyle = skin; circ(c, hx, hy, 9.6); c.fill();
  c.fillStyle = hair;
  if(dir === 2){ circ(c, hx, hy - .6, 10.1); c.fill();
    if(L.h === 1){ rr(c, hx - 10, hy - 2, 20, 16, 6); c.fill(); }
    if(L.h === 2){ circ(c, hx, hy + 9, 3.6); c.fill(); rr(c, hx - 2.4, hy + 9, 4.8, 8, 2.4); c.fill(); c.fillStyle = '#e64980'; c.fillRect(hx - 3, hy + 7.5, 6, 2.2); } }
  else { const sx = dir === 1 ? 1.8 : dir === 3 ? -1.8 : 0;
    ell(c, hx + sx, hy - 4.6, 10.6, L.h === 4 ? 7.6 : 6.6); c.fill();
    if(dir !== 0){ circ(c, hx + sx*2.6, hy - 1, 8); c.fill(); }
    if(L.h === 4){ c.fillRect(hx - 10 + sx, hy - 5, 20, 3.5); }
    if(L.h === 1 && dir === 0){ rr(c, hx - 11, hy - 4, 4.4, 15, 2); c.fill(); rr(c, hx + 6.6, hy - 4, 4.4, 15, 2); c.fill(); }
    if(L.h === 2){ circ(c, hx - sx*3, hy - 11.5, 3.8); c.fill(); }
  }
  if(L.h === 3){ for(let k = -2; k <= 2; k++){ c.beginPath(); c.moveTo(hx + k*4 - 3, hy - 7); c.lineTo(hx + k*4.6, hy - 14.5 + Math.abs(k)); c.lineTo(hx + k*4 + 3, hy - 7); c.closePath(); c.fill(); } }
  if(dir !== 2){ const ex = dir === 1 ? -3 : dir === 3 ? 3 : 0; c.fillStyle = '#1f1a17';
    if(dir === 0){ circ(c, hx - 3.4, hy + 1, 1.35); c.fill(); circ(c, hx + 3.4, hy + 1, 1.35); c.fill(); c.fillStyle = 'rgba(240,120,140,.35)'; ell(c, hx - 5.6, hy + 3.8, 2, 1.2); c.fill(); ell(c, hx + 5.6, hy + 3.8, 2, 1.2); c.fill();
      c.strokeStyle = '#8a4a3a'; c.lineWidth = 1; c.beginPath(); c.arc(hx, hy + 3.6, 2, .15*Math.PI, .85*Math.PI); c.stroke(); }
    else { circ(c, hx + ex*1.4, hy + 1, 1.35); c.fill(); } }
  c.restore(); }

function pill(c, text, bg, fg, y, bold){ c.font = `${bold ? 700 : 600} 10.5px ${FONT}`; const w = c.measureText(text).width + 12; c.fillStyle = bg; rr(c, -w/2, y - 14, w, 15, 7.5); c.fill(); c.fillStyle = fg; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, 0, y - 6.3); return w; }
function wrap(c, t, maxW){ const words = String(t).split(' '), lines = []; let cur = ''; for(const w of words){ const s = cur ? cur + ' ' + w : w; if(c.measureText(s).width > maxW && cur){ lines.push(cur); cur = w; } else cur = s; } if(cur) lines.push(cur);
  return lines.slice(0, 3).map((l, i, a)=> i === 2 && lines.length > 3 ? l.replace(/.{0,2}$/, '…') : l); }
function overlay(c, e, now, showName){
  const k = clamp(Z, .85, 1.5)/Z; c.save(); c.translate(e.x*P, e.y*P - (e.sit ? 28 : 31)); c.scale(k, k); let top = 0;
  if(showName){ const nm = e.gv ? (e.bot ? e.name : 'GV · ' + short(e.name)) : e.me ? 'Em' : short(e.name);
    const w = pill(c, nm, e.me ? '#e7c878' : e.gv ? '#16213e' : 'rgba(22,33,62,.82)', e.me ? '#2b1f00' : e.gv ? '#e7c878' : '#fff', 0, e.me || e.gv);
    if(e.st === 'lam'){ c.fillStyle = '#fff'; circ(c, w/2 + 8, -6.5, 8); c.fill(); c.strokeStyle = '#e7c878'; c.lineWidth = 1.5; c.stroke(); c.font = `10px ${FONT}`; c.fillText('✏️', w/2 + 8, -6); }
    if(UNREAD[e.id]){ c.fillStyle = '#c62f2f'; circ(c, -w/2 - 3, -12, 5); c.fill(); }
    top = -17; }
  else if(e.st === 'lam'){ c.fillStyle = '#fff'; circ(c, 0, -6.5, 8); c.fill(); c.font = `10px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('✏️', 0, -6); top = -17; }
  if(e.sc && now - e.scAt < SCORE_MS && e.st !== 'lam'){ pill(c, '★ ' + e.sc, '#e7c878', '#3a2a00', top, true); top -= 17; }
  const n = Date.now();
  if(e.em >= 0 && e.emUntil > n){ c.font = `20px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'bottom'; c.fillText(EMO[e.em] || '', 0, top - 1 - Math.max(0, 6 - (e.emUntil - n)/60)); top -= 24; }
  if(e.bub && e.bub.until > n && !BLOCKS.has(e.id)){ c.font = `500 11.5px ${FONT}`; const ls = wrap(c, e.bub.text, 150), w = Math.max(...ls.map(l=> c.measureText(l).width)) + 16, h = ls.length*15 + 10;
    c.globalAlpha = clamp((e.bub.until - n)/400, 0, 1); c.fillStyle = '#fff'; c.shadowColor = 'rgba(20,27,45,.25)'; c.shadowBlur = 6; rr(c, -w/2, top - h - 6, w, h, 9); c.fill(); c.shadowBlur = 0;
    c.beginPath(); c.moveTo(-5, top - 6.5); c.lineTo(0, top - 1); c.lineTo(5, top - 6.5); c.fill(); c.fillStyle = '#141b2d'; c.textAlign = 'center'; c.textBaseline = 'top'; ls.forEach((l, i)=> c.fillText(l, 0, top - h - 1 + i*15)); c.globalAlpha = 1; }
  else if(e.dotsUntil > n){ c.fillStyle = '#fff'; rr(c, -14, top - 18, 28, 14, 7); c.fill(); c.fillStyle = '#5f6b85'; for(let j = 0; j < 3; j++){ circ(c, -6 + j*6, top - 11 + Math.sin(n/150 + j)*1.2, 1.7); c.fill(); } }
  c.restore(); }
function draw(now){
  const c = ctx; if(!c) return; c.setTransform(DPR, 0, 0, DPR, 0, 0); c.fillStyle = '#e9edf5'; c.fillRect(0, 0, VW, VH);
  c.save(); c.translate(VW/2, VH/2); c.scale(Z, Z); c.translate(-CX, -CY);
  drawRoom(c, now);
  const list = [...ENTS.values()].sort((a, b)=> a.y - b.y); list.forEach(e=> drawChar(c, e, now));
  const many = Z >= .8, cnt = list.length;
  list.sort((a, b)=> (a.me ? 1 : 0) - (b.me ? 1 : 0) || a.y - b.y);   // nhãn của em vẽ sau cùng, không bị che
  list.forEach(e=>{ const near = ME && Math.hypot(e.x - ME.x, e.y - ME.y) < 2.6; overlay(c, e, now, e.me || e.gv || many || near || (HOVER && HOVER.ent === e.id) || cnt < 6); });
  c.restore(); }

/* ---------- vòng lặp, máy ảnh, điều khiển ---------- */
function frame(){ raf = requestAnimationFrame(frame); update(); }
let FB = 0;   // dự phòng: trình duyệt ngừng gọi requestAnimationFrame (khung bị ẩn, máy tiết kiệm pin) thì vẫn cập nhật vị trí theo giờ thật
function update(){
  const now = performance.now(), dt = Math.min(.25, (now - (lastT || now))/1000); lastT = now; if(!ME) return;
  let kx = 0, ky = 0; if(KEYS.has('l')) kx--; if(KEYS.has('r')) kx++; if(KEYS.has('u')) ky--; if(KEYS.has('d')) ky++;
  if(kx || ky){ if(ME.sit || ME.seat >= 0){ const s = SEATS[ME.seat]; releaseSeat(); if(s && s.gv){ ME.x = 8; ME.y = 1.5; } } ME.path = null; ME.onArrive = null;
    const n = Math.hypot(kx, ky), sp = SPEED*dt; let nx = ME.x + kx/n*sp, ny = ME.y + ky/n*sp;
    if(free(nx, ME.y)) ME.x = nx; if(free(ME.x, ny)) ME.y = ny; ME.dir = Math.abs(kx) >= Math.abs(ky) && kx ? (kx < 0 ? 1 : 3) : (ky < 0 ? 2 : 0); ME.moving = true; ME.walkT += dt; ME.kb = true; sync(); }
  else if(ME.kb){ ME.kb = false; ME.moving = false; sync(true); }
  for(const e of ENTS.values()) if(!(e === ME && (kx || ky))) step(e, dt);
  if(Z > FITZ*1.15 && Date.now() - lastPan > 2500){ const px = ME.x*P, py = ME.y*P, mx = VW*.3/Z, my = (VH - TOPPAD - BOTPAD)*.3/Z;
    if(Math.abs(px - CX) > mx) CX += (px - CX - Math.sign(px - CX)*mx)*.08; if(Math.abs(py - CY) > my) CY += (py - CY - Math.sign(py - CY)*my)*.08; clampCam(); }
  draw(now); }
function step(e, dt){
  if(e.path && e.path.length){ const p = e.path[0], dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy), s = SPEED*dt*(e.bot ? .8 : 1);
    if(d <= s){ e.x = p.x; e.y = p.y; e.path.shift(); if(!e.path.length){ e.path = null; const f = e.onArrive; e.onArrive = null; e.moving = false; if(f) f(); if(e === ME){ sync(true); hud(true); } } }
    else { e.x += dx/d*s; e.y += dy/d*s; }
    if(d > .01) e.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 1 : 3) : (dy < 0 ? 2 : 0); if(e.path) { e.moving = true; e.walkT += dt; } }
  else e.moving = false; }
function pads(){ if(!root) return; const b = root.getBoundingClientRect(); let t = 0, d = 0;   // chừa chỗ cho các nút nổi phía trên / dưới
  root.querySelectorAll('.lop-room,.lop-tools,.lop-demo,.lop-bar').forEach(el=>{ if(el.hidden || !el.offsetParent) return; const r = el.getBoundingClientRect(); if(!r.height) return;
    if(r.top - b.top < b.height/2) t = Math.max(t, r.bottom - b.top); else d = Math.max(d, b.bottom - r.top); });
  TOPPAD = Math.round(t + 8); BOTPAD = Math.round(d + 8); }
function fit(){ pads(); FITZ = Math.min(VW/(W*P + 16), (VH - TOPPAD - BOTPAD)/(H*P + 8)); FITZ = Math.max(.25, FITZ); }
function center(){ Z = FITZ; CX = W*P/2; CY = H*P/2 - (TOPPAD - BOTPAD)/2/Z; }
function clampCam(){ const hw = VW/2/Z, hh = VH/2/Z, oy = (TOPPAD - BOTPAD)/2/Z;
  CX = W*P <= VW/Z ? W*P/2 : clamp(CX, hw - 40, W*P - hw + 40);
  CY = H*P <= (VH - TOPPAD - BOTPAD)/Z ? H*P/2 - oy : clamp(CY, hh - TOPPAD/Z - 30, H*P - hh + BOTPAD/Z + 30); }
function zoomAt(f, sx, sy){ const w = s2w(sx, sy); Z = clamp(Z*f, FITZ*.85, 2.8); CX = w.x - (sx - VW/2)/Z; CY = w.y - (sy - VH/2)/Z; clampCam(); lastPan = Date.now(); }
const s2w = (sx, sy)=> ({x:(sx - VW/2)/Z + CX, y:(sy - VH/2)/Z + CY});
function resize(){ if(!cv) return; const r = cv.parentElement.getBoundingClientRect(); if(!r.width || !r.height) return; const was = !Z || Math.abs(Z - FITZ) < .01;
  VW = r.width; VH = r.height; DPR = Math.min(3, window.devicePixelRatio || 1); cv.width = Math.round(VW*DPR); cv.height = Math.round(VH*DPR); cv.style.width = VW + 'px'; cv.style.height = VH + 'px';
  fit(); if(was) center(); else { Z = Math.max(Z, FITZ*.85); clampCam(); } }
function hit(sx, sy){
  const w = s2w(sx, sy), tx = w.x/P, ty = w.y/P; let best = null, bd = .62;
  for(const e of ENTS.values()){ const d = Math.hypot(e.x - tx, (e.y - .45) - ty); if(d < bd){ bd = d; best = e; } }
  if(best) return {ent:best.id};
  const s = seatAt(tx, ty); if(s) return {seat:s.i};
  if(ty < 1.05 && tx > 3.5 && tx < 12.5) return {board:true};
  if(Math.floor(ty) === 3 && tx >= 6 && tx < 10) return {tdesk:true};
  if(tx > W - 1.2 && ty > 16 && ty < 17.4) return {door:true};
  return {floor:{x:tx, y:ty}}; }
function tap(sx, sy){
  if(!ME) return; const h = hit(sx, sy);
  if(h.ent){ if(h.ent === ME.id) lookSheet(); else openCard(h.ent); return; }
  if(h.seat != null){ takeSeat(h.seat); return; }
  if(h.board || h.tdesk){ if(ME.gv && MODE === 'live') boardSheet(); else toast(h.board ? (BOARD ? 'Trên bảng: ' + BOARD : 'Bảng lớp — thầy cô có thể viết lời nhắn lên đây.') : 'Bàn giáo viên.'); return; }
  if(h.door){ toast('Cửa ra vào. Muốn ra khỏi lớp, em chọn mục khác trên thanh điều hướng.'); return; }
  const f = h.floor; if(f.x < .8 || f.y < .9 || f.x > W - .8 || f.y > H - .8) return; walkFloor(f.x, f.y); }
function bindInput(){
  const ptr = new Map(); let drag = null, pinch = null;
  const pos = e=>{ const r = cv.getBoundingClientRect(); return {x:e.clientX - r.left, y:e.clientY - r.top}; };
  cv.addEventListener('pointerdown', e=>{ cv.setPointerCapture && cv.setPointerCapture(e.pointerId); const p = pos(e); ptr.set(e.pointerId, p);
    if(ptr.size === 1) drag = {x:p.x, y:p.y, cx:CX, cy:CY, moved:false, t:Date.now()};
    else if(ptr.size === 2){ const [a, b] = [...ptr.values()]; pinch = {d:Math.hypot(a.x - b.x, a.y - b.y) || 1, z:Z, w:s2w((a.x + b.x)/2, (a.y + b.y)/2)}; if(drag) drag.moved = true; } });
  cv.addEventListener('pointermove', e=>{ const p = pos(e);
    if(!ptr.has(e.pointerId)){ if(e.pointerType === 'mouse'){ const h = hit(p.x, p.y); HOVER = h.ent || h.seat != null ? h : null; cv.style.cursor = h.ent || h.seat != null || h.board ? 'pointer' : 'default'; } return; }
    ptr.set(e.pointerId, p);
    if(pinch && ptr.size >= 2){ const [a, b] = [...ptr.values()], d = Math.hypot(a.x - b.x, a.y - b.y) || 1, mx = (a.x + b.x)/2, my = (a.y + b.y)/2;
      Z = clamp(pinch.z*d/pinch.d, FITZ*.85, 2.8); CX = pinch.w.x - (mx - VW/2)/Z; CY = pinch.w.y - (my - VH/2)/Z; clampCam(); lastPan = Date.now(); return; }
    if(drag){ const dx = p.x - drag.x, dy = p.y - drag.y; if(!drag.moved && Math.hypot(dx, dy) > 8) drag.moved = true;
      if(drag.moved){ CX = drag.cx - dx/Z; CY = drag.cy - dy/Z; clampCam(); lastPan = Date.now(); cv.style.cursor = 'grabbing'; } } });
  const up = e=>{ const had = ptr.has(e.pointerId); ptr.delete(e.pointerId); if(ptr.size < 2) pinch = null;
    if(had && drag && ptr.size === 0){ if(!drag.moved && e.type === 'pointerup') tap(drag.x, drag.y); drag = null; cv.style.cursor = 'default'; } };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up); cv.addEventListener('pointerleave', e=>{ if(e.pointerType === 'mouse') HOVER = null; });
  cv.addEventListener('wheel', e=>{ e.preventDefault(); const p = pos(e); zoomAt(Math.exp(-e.deltaY*(e.ctrlKey ? .01 : .0016)), p.x, p.y); }, {passive:false});
  cv.addEventListener('contextmenu', e=> e.preventDefault()); }
const KMAP = {ArrowLeft:'l', ArrowRight:'r', ArrowUp:'u', ArrowDown:'d', a:'l', d:'r', w:'u', s:'d', A:'l', D:'r', W:'u', S:'d'};
function keyOk(e){ const t = e.target; return ON && ME && $('modal').hidden && $('gate').hidden && !(t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) && !e.metaKey && !e.ctrlKey && !e.altKey; }
window.addEventListener('keydown', e=>{
  if(!ON) return; if(e.key === 'Escape' && $('modal').hidden){ if(SHEET){ closeSheet(); e.preventDefault(); return; } if(CHAT){ closeChat(); e.preventDefault(); return; } }
  if(!keyOk(e)) return; const k = KMAP[e.key]; if(k){ e.preventDefault(); KEYS.add(k); closeSheet(); return; }
  if(e.key === '+' || e.key === '='){ zoomAt(1.2, VW/2, VH/2); } else if(e.key === '-'){ zoomAt(1/1.2, VW/2, VH/2); }
  else if(e.key === 'Enter' && ME.sit && !SHEET && !CHAT){ e.preventDefault(); deSheet(); } });
window.addEventListener('keyup', e=>{ const k = KMAP[e.key]; if(k) KEYS.delete(k); });
window.addEventListener('blur', ()=> KEYS.clear());

/* ---------- giao diện phủ trên lớp (HTML) ---------- */
let TT = 0;
function toast(msg, act, ms = 3800){ const el = $('lopToast'); if(!el) return; clearTimeout(TT);
  el.innerHTML = `<span>${esc(msg)}</span>${act ? `<button class="btn sm gold" id="lopTA">${esc(act.t)}</button>` : ''}`; el.hidden = false; el.classList.remove('out'); void el.offsetWidth; el.classList.add('in');
  if(act) $('lopTA').onclick = ()=>{ el.hidden = true; act.f(); }; TT = setTimeout(()=>{ el.classList.remove('in'); el.classList.add('out'); setTimeout(()=>{ el.hidden = true; }, 250); }, ms); }
function hud(force){
  if(!root || !ME) return; const n = [...ENTS.values()].filter(fresh).length, nb = nearest(), unread = Object.values(UNREAD).reduce((a, b)=> a + b, 0);
  const rm = $('lopRoom'); if(rm) rm.innerHTML = `<b>${esc(roomLabel(ROOM))}</b><span>${MODE === 'sim' ? 'xem thử · ' : ''}${n} người trong lớp</span>`;
  const demo = $('lopDemo'); if(demo){ const sim = MODE === 'sim'; demo.hidden = !sim; if(sim) demo.innerHTML = C && C.state !== 'off' && C.state !== 'in' ? `Xem thử: các bạn trong lớp là mô phỏng. <a href="#/taikhoan">Đăng nhập</a> để vào lớp cùng bạn thật.` : LIVEFAIL ? 'Xem thử: máy chủ chưa mở lớp học trực tuyến.' : C && C.state === 'in' ? 'Xem thử: chưa kết nối được máy chủ.' : 'Xem thử: các bạn trong lớp là mô phỏng.'; }
  const ad = $('lopAdm'); if(ad){ ad.hidden = !(ME.gv && MODE === 'live'); }
  const key = [ME.sit, ME.seat, ME.path ? 1 : 0, nb && nb.id, nb && UNREAD[nb.id], unread, CONVO.size, !!CHAT, ME.st].join('|'); if(!force && key === BARKEY) return; BARKEY = key;
  const bar = $('lopBar'); if(!bar) return; let h = '';
  if(ME.sit) h += `<button class="btn gold" onclick="LOP.de()"><svg><use href="#i-de"/></svg>Luyện đề</button><button class="btn sec" onclick="LOP.stand()">Đứng dậy</button>`;
  else h += `<div class="lhint">${ME.seat >= 0 && ME.path ? 'Đang đi tới ' + esc(seatName(ME.seat)) + '…' : 'Bấm vào <b>ghế trống</b> (viền vàng) để ngồi' + (matchMedia('(hover:hover)').matches ? ' · đi bằng phím mũi tên / WASD' : ' · chạm sàn để đi')}</div>`;
  if(nb) h += `<button class="btn acc" onclick="LOP.chat('${nb.id}')"><span class="lav" style="background:${SHIRT[look(nb.lk).c]}"></span>Nhắn ${esc(short(nb.name))}${UNREAD[nb.id] ? `<i class="dot">${UNREAD[nb.id]}</i>` : ''}</button>`;
  if(CONVO.size && !(nb && CONVO.size === 1 && CONVO.has(nb.id))) h += `<button class="btn sec ico" onclick="LOP.inbox()" aria-label="Tin nhắn">💬${unread ? `<i class="dot">${unread}</i>` : ''}</button>`;
  h += `<button class="btn sec ico" onclick="LOP.emo()" aria-label="Biểu cảm">😊</button>`;
  bar.innerHTML = h; }
function mount(el){
  el.innerHTML = `<div class="lop" id="lopRoot"><canvas id="lopCv" aria-label="Phòng học 2D"></canvas>
    <div class="lop-top"><button class="lop-room" id="lopRoom" onclick="LOP.rooms()"></button>
      <div class="lop-tools"><span id="lopAdm" hidden><button class="btn sec sm" onclick="LOP.board()">Viết lên bảng</button><button class="btn sec sm" onclick="LOP.reports()">Báo cáo</button></span>
        <button class="btn sec sm" onclick="LOP.look()" aria-label="Đổi nhân vật">Nhân vật</button>
        <span class="lzoom"><button onclick="LOP.zoom(1/1.25)" aria-label="Thu nhỏ">−</button><button onclick="LOP.zoom(0)" aria-label="Vừa màn hình">⤢</button><button onclick="LOP.zoom(1.25)" aria-label="Phóng to">+</button></span></div></div>
    <div class="lop-demo" id="lopDemo" hidden></div>
    <div class="lop-toast" id="lopToast" hidden></div>
    <div class="lop-bar" id="lopBar"></div>
    <div class="lop-sheet" id="lopSheet" hidden></div>
    <div class="lop-chat" id="lopChat" hidden></div></div>`;
  root = $('lopRoot'); cv = $('lopCv'); ctx = cv.getContext('2d'); Z = 0; BARKEY = ''; bindInput();
  if(ro) ro.disconnect(); if(window.ResizeObserver){ ro = new ResizeObserver(()=> resize()); ro.observe(root); } else window.addEventListener('resize', resize);
  resize(); }

/* ---------- bảng chọn (thẻ bạn học, luyện đề, lớp, nhân vật, bảng, báo cáo) ---------- */
function sheet(html, cls){ const el = $('lopSheet'); if(!el) return; SHEET = cls || 'x'; el.className = 'lop-sheet ' + (cls || ''); el.innerHTML = `<button class="lx" onclick="LOP.close()" aria-label="Đóng">×</button>${html}`; el.hidden = false; }
function closeSheet(){ SHEET = null; const el = $('lopSheet'); if(el){ el.hidden = true; el.innerHTML = ''; } }
function avatarCanvas(id, lk, size){ setTimeout(()=>{ const c = $(id); if(!c) return; const d = Math.min(3, window.devicePixelRatio || 1); c.width = size*d; c.height = size*d; const x = c.getContext('2d'); x.scale(d, d);
  drawChar(x, {lk, dir:0, sit:false, moving:false, seed:1, walkT:0}, performance.now(), size/44, size/2, size*.72); }, 0); }
function openCard(id){
  const e = ENTS.get(id); if(!e) return; const near = isNear(e), bl = BLOCKS.has(id);
  const st = e.st === 'lam' ? 'Đang làm bài' : e.sit && e.seat >= 0 ? 'Đang ngồi ' + seatName(e.seat) : e.moving ? 'Đang đi lại' : 'Đang đứng trong lớp';
  const sc = e.sc && Date.now() - e.scAt < SCORE_MS ? ` · vừa đạt <b>${esc(e.sc)}</b>` : '';
  sheet(`<div class="lcard"><canvas id="lopAv" class="lavc"></canvas><div><b class="nm">${esc(e.name)}</b>${e.gv ? '<span class="tag gold">Giáo viên</span>' : ''}${e.bot ? '<span class="tag">mô phỏng</span>' : ''}<div class="muted">${st}${sc}</div></div></div>
    ${bl ? `<p class="muted">Em đã chặn bạn này.</p><div class="row"><button class="btn sec" onclick="LOP.block('${id}')">Bỏ chặn</button></div>`
      : near ? `<div class="row"><button class="btn acc" onclick="LOP.chat('${id}')">💬 Nhắn riêng</button></div>`
      : `<p class="muted">Đi lại gần ${esc(short(e.name))} (đứng cạnh hoặc ngồi cùng bàn) để nhắn riêng.</p><div class="row"><button class="btn" onclick="LOP.goNear('${id}')">Đi tới chỗ ${esc(short(e.name))}</button></div>`}
    ${bl ? '' : `<div class="lsmall"><a href="javascript:LOP.block('${id}')">Chặn</a> · <a href="javascript:LOP.report('${id}')">Báo cáo thầy cô</a></div>`}`, 'card');
  avatarCanvas('lopAv', e.lk, 52); }
function goNear(id){ const e = ENTS.get(id); if(!e) return; closeSheet(); let best = null, bd = 1e9;
  for(const a of [[-1, 0], [1, 0], [0, 1], [0, -1], [-1, 1], [1, 1], [-1, -1], [1, -1]]){ const x = e.x + a[0]*1.05, y = e.y + a[1]*1.05; if(!free(x, y) || seatAt(x, y)) continue; const d = Math.hypot(x - ME.x, y - ME.y); if(d < bd){ bd = d; best = {x, y}; } }
  if(!best){ const o = nearOpen(e.x, e.y + 1); best = {x:o.x + .5, y:o.y + .5}; } walkFloor(best.x, best.y); }
let DEO = null;
function deSheet(g){ const I = IMS.deInfo(g); DEO = DEO && DEO.g === I.g ? DEO : {g:I.g, ci:'', n:I.n};
  sheet(`<h3>Luyện đề ngay tại chỗ</h3><p class="muted">Đề mới, có đồng hồ. Làm xong em quay về đúng chỗ này, điểm hiện trên đầu cho các bạn thấy.</p>
    <div class="seg">${I.grades.map(x=> `<button class="${x === I.g ? 'on' : ''}" onclick="LOP.deG(${x})">Lớp ${x}</button>`).join('')}</div>
    <label class="fl"><span>Chương</span><select class="inp" id="lopCh" onchange="LOP.deC(this.value)"><option value="">Tất cả các chương</option>${I.chs.map(c=> `<option value="${c.ci}" ${String(DEO.ci) === String(c.ci) ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
    <div class="chips">${[10, 20, 30].map(n=> `<button class="chip ${DEO.n === n ? 'on' : ''}" onclick="LOP.deN(${n})">${n} câu</button>`).join('')}</div>
    <button class="btn gold big block" onclick="LOP.deGo()"><svg><use href="#i-play"/></svg>Bắt đầu làm đề</button>`, 'de'); }
function deGo(){ if(!DEO || !ME) return; const o = DEO; closeSheet(); const st = ME.st; ME.st = 'lam'; writeP();
  if(!IMS.startDeLop({g:o.g, ci:o.ci, n:o.n})){ ME.st = st; writeP(); } }
function roomSheet(){ const rec = store.get('ims_lop_rooms', []).filter(r=> r !== 'chung').slice(0, 6);
  sheet(`<h3>Chọn lớp</h3><p class="muted">Lớp chung có mọi học sinh IMs. Lớp của em (ví dụ 10A1) chỉ có các bạn gõ cùng mã lớp.</p>
    <div class="chips"><button class="chip ${ROOM === 'chung' ? 'on' : ''}" onclick="LOP.room('chung')">Lớp chung</button>${rec.map(r=> `<button class="chip ${ROOM === r ? 'on' : ''}" onclick="LOP.room('${esc(r)}')">Lớp ${esc(r)}</button>`).join('')}</div>
    <form class="lrow" onsubmit="event.preventDefault();LOP.room(document.getElementById('lopRc').value)"><input class="inp" id="lopRc" maxlength="12" placeholder="Mã lớp, ví dụ 10A1" autocapitalize="characters" autocomplete="off"><button class="btn" type="submit">Vào lớp</button></form>`, 'room'); }
function setRoom(r){ r = String(r || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12); if(String(r).toLowerCase() === 'chung' || !r) r = 'chung';
  closeSheet(); if(r === ROOM) return; ROOM = r; store.set('ims_lop_room', r); if(r !== 'chung') store.set('ims_lop_rooms', [r, ...store.get('ims_lop_rooms', []).filter(x=> x !== r)].slice(0, 8)); rejoin(); toast('Em đã vào ' + roomLabel(r) + '.'); }
let LK = null;
function lookSheet(){ LK = look(ME.lk);
  const sw = (arr, key)=> arr.map((col, i)=> `<button class="sw ${LK[key] === i ? 'on' : ''}" style="background:${col}" onclick="LOP.lk('${key}',${i})" aria-label="Màu ${i + 1}"></button>`).join('');
  sheet(`<div class="lcard"><canvas id="lopAv2" class="lavc big"></canvas><div><h3 style="margin:0">Nhân vật của em</h3><div class="muted">${esc(ME.name)}</div></div></div>
    <div class="lk"><span>Áo</span><div>${sw(SHIRT, 'c')}</div></div>
    <div class="lk"><span>Tóc</span><div>${HAIRS.map((n, i)=> `<button class="chip sm ${LK.h === i ? 'on' : ''}" onclick="LOP.lk('h',${i})">${n}</button>`).join('')}</div></div>
    <div class="lk"><span>Màu tóc</span><div>${sw(HAIRC, 'hc')}</div></div><div class="lk"><span>Da</span><div>${sw(SKIN, 'k')}</div></div>
    <button class="btn block" onclick="LOP.close()">Xong</button>`, 'look');
  avatarCanvas('lopAv2', ME.lk, 72); }
function setLk(k, v){ LK[k] = v; ME.lk = [LK.c, LK.h, LK.k, LK.hc].join('.'); store.set('ims_lop_look', ME.lk); sync(true); lookSheet(); }
function boardSheet(){ sheet(`<h3>Viết lên bảng</h3><p class="muted">Cả lớp ${esc(roomLabel(ROOM))} thấy dòng này trên bảng. Tối đa 120 ký tự.</p>
    <input class="inp" id="lopBd" maxlength="120" value="${esc(BOARD)}" placeholder="Ví dụ: 20h tối nay cả lớp làm đề chương 1"><div class="row" style="margin-top:10px"><button class="btn sec" onclick="LOP.boardSave(true)">Xoá bảng</button><button class="btn" onclick="LOP.boardSave()">Lưu</button></div>`, 'board'); }
async function boardSave(clear){ const t = clear ? '' : String(($('lopBd') || {}).value || '').trim().slice(0, 120);
  try{ await R().set({board:t, by:ME.id, at:TSV()}); BOARD = t; closeSheet(); toast(t ? 'Đã viết lên bảng.' : 'Đã xoá bảng.'); }catch(e){ say('Chưa lưu được: ' + C.msg(e)); } }
async function reportsSheet(){ sheet('<h3>Báo cáo của học sinh</h3><div class="loading">Đang tải…</div>', 'rep');
  try{ const s = await db().collection('reports').orderBy('at', 'desc').limit(30).get(); if(SHEET !== 'rep') return;
    const rows = s.docs.map(d=>{ const r = d.data(), at = r.at && r.at.toDate ? r.at.toDate() : null;
      return `<div class="lrep"><div><b>${esc(r.byName || r.by)}</b> báo cáo <b>${esc(r.whoName || r.who)}</b> <span class="muted">· ${esc(roomLabel(r.room || ''))}${at ? ' · ' + at.toLocaleString('vi-VN') : ''}</span></div>
        <div class="lrepm">${(r.msgs || []).map(m=> `<div>${esc(m)}</div>`).join('') || '<div class="muted">(không kèm tin nhắn)</div>'}</div>
        <div class="lsmall">UID bị báo cáo: <code>${esc(r.who)}</code> · <a href="javascript:LOP.repDel('${d.id}')">Đã xử lý — xoá</a></div></div>`; }).join('');
    sheet(`<h3>Báo cáo của học sinh</h3>${rows || '<p class="muted">Chưa có báo cáo nào.</p>'}`, 'rep'); }
  catch(e){ sheet(`<h3>Báo cáo của học sinh</h3><p class="muted">Chưa tải được: ${esc(C.msg(e))}</p>`, 'rep'); } }
async function repDel(id){ if(!await ask('Xoá báo cáo này (đã xử lý xong)?', 'Xoá')) return; try{ await db().collection('reports').doc(id).delete(); reportsSheet(); }catch(e){ say('Chưa xoá được: ' + C.msg(e)); } }
function inboxSheet(){ const rows = [...CONVO.entries()].map(([id, nm])=> `<button class="lin" onclick="LOP.chat('${id}')"><span class="lav" style="background:${SHIRT[look((ENTS.get(id) || {}).lk).c]}"></span><span>${esc(nm)}${ENTS.has(id) ? '' : ' <span class="muted">(đã rời lớp)</span>'}</span>${UNREAD[id] ? `<i class="dot">${UNREAD[id]}</i>` : ''}</button>`).join('');
  sheet(`<h3>Tin nhắn riêng</h3>${rows || '<p class="muted">Chưa có cuộc trò chuyện nào.</p>'}`, 'inbox'); }
function emoSheet(){ sheet(`<div class="lemo">${EMO.map((m, i)=> `<button onclick="LOP.em(${i})" aria-label="${m}">${m}</button>`).join('')}</div>`, 'emo'); }
function emote(i){ closeSheet(); const n = Date.now(); if(n - LASTEM < 2000) return; LASTEM = n; ME.em = i; ME.emAt = n; ME.emUntil = n + 4000; sync(true); }

/* ---------- nối với app (app.js gọi LOP.route mỗi lần đổi màn, LOP.view khi mở #/lophoc) ---------- */
function view(el){
  ON = true; if(!document.getElementById('lopRoot')) mount(el); else resize();
  const want = live() ? 'live' : 'sim'; if(JOINED && (want !== MODE || (MODE === 'live' && ME && C.user && ME.id !== C.user.uid))) leave();
  if(!JOINED) join(); listen(); if(ME){ ME.gv = MODE === 'live' && !!C.admin; }
  const s = IMS.sess(); if(ME && ME.st === 'lam' && !(s && s.mode === 'de' && !s.done && s.back === '#/lophoc')){ ME.st = ''; sync(true); }
  if(!raf){ lastT = 0; raf = requestAnimationFrame(frame); } clearInterval(FB); FB = setInterval(()=>{ if(ON && performance.now() - lastT > 300) update(); }, 200); hud(true);
  const was = Math.abs(Z - FITZ) < .01; fit(); if(was) center();
  if(JUST){ toast(`Em vừa đạt ${JUST}. Các bạn trong lớp đều thấy điểm trên đầu nhân vật của em!`, null, 5000); JUST = null; } }
function hide(){ ON = false; if(raf) cancelAnimationFrame(raf); raf = 0; clearInterval(FB); KEYS.clear(); unlisten(); if(CHAT && CHAT.unsub){ try{ CHAT.unsub(); }catch(e){} } CHAT = null; SHEET = null;
  if(ro){ ro.disconnect(); ro = null; } root = cv = ctx = null; }
function route(r){ const stay = r === 'lophoc' || (JOINED && /^(lam|ketqua|xem)$/.test(r)); if(r !== 'lophoc' && ON) hide(); if(!stay) leave(); }
window.addEventListener('ims:de', e=>{ const d = e.detail || {}; if(!JOINED || !ME || d.back !== '#/lophoc') return; ME.st = ''; ME.sc = `${d.ok}/${d.n}`; ME.scAt = Date.now(); JUST = ME.sc; writeP(); });
window.addEventListener('pagehide', ()=>{ if(JOINED && MODE === 'live') leave(); });
if(C && C.beforeSignOut) C.beforeSignOut(async ()=>{   // đăng xuất: xoá hiện diện và nhả ghế trước, kẻo các bạn còn thấy em thêm 2 phút
  if(!JOINED || MODE !== 'live' || !ME) return; const b = db().batch(); b.delete(R().collection('presence').doc(ME.id)); if(ME.seat >= 0 && SEATHOLD[ME.seat] === ME.id) b.delete(R().collection('seats').doc(String(ME.seat)));
  await Promise.race([b.commit(), new Promise(r=> setTimeout(r, 2500))]); });
if(C) C.on(()=>{ if(!JOINED) return; const want = live() ? 'live' : 'sim';
  if(want !== MODE || (MODE === 'live' && ME && C.user && ME.id !== C.user.uid)){ if(ON) rejoin(); else leave(); }
  else if(ME){ const gv = MODE === 'live' && !!C.admin, nm = myName(); if(gv !== ME.gv || nm !== ME.name){ ME.gv = gv; ME.name = nm; sync(true); } if(ON) hud(true); } });

return {view, route, close:closeSheet, closeChat:()=> closeChat(), send, block, report, chat:openChat, goNear, stand:standUp, de:()=> deSheet(), deG:g=>{ DEO = null; deSheet(g); }, deC:v=>{ if(DEO) DEO.ci = v; }, deN:n=>{ if(DEO){ DEO.n = n; deSheet(DEO.g); } }, deGo,
  rooms:roomSheet, room:setRoom, look:lookSheet, lk:setLk, board:boardSheet, boardSave, reports:reportsSheet, repDel, inbox:inboxSheet, emo:emoSheet, em:emote,
  zoom(f){ if(!f){ fit(); center(); } else zoomAt(f, VW/2, VH/2); lastPan = Date.now(); },
  get cam(){ return {Z, CX, CY, VW, VH, P, TOPPAD, BOTPAD}; },   // để kiểm thử
  get state(){ return {mode:MODE, room:ROOM, joined:JOINED, me:ME && {id:ME.id, x:ME.x, y:ME.y, seat:ME.seat, sit:ME.sit, st:ME.st, sc:ME.sc}, n:ENTS.size, others:[...ENTS.values()].filter(e=> !e.me).map(e=> ({id:e.id, name:e.name, x:+e.x.toFixed(2), y:+e.y.toFixed(2), seat:e.seat, sit:e.sit, st:e.st, sc:e.sc}))}; },
};
})();
