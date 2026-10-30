/* IMs — tài khoản và lưu tiến độ trên máy chủ (Firebase).
   Chưa điền firebase-config.js thì app chạy như cũ, chỉ lưu trên máy.
   Dữ liệu trên Firestore:
     users/{uid}     hồ sơ học sinh: name, grade, school, email, createdAt, lastSeen  (học sinh tự sửa được)
     progress/{uid}  tiến độ: {v, json, dev, updatedAt}                               (học sinh tự sửa được)
     plans/{uid}     gói đã mua: {plan, until, note}                                  (chỉ giáo viên/quản trị ghi)
     admins/{uid}    tài khoản quản trị                                               (tạo tay trong Firebase console) */
const CLOUD = (()=>{
const CFG = window.IMS_FIREBASE || null, SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
const DEV = (()=>{ try{ let d = localStorage.getItem('ims_dev'); if(!d){ d = Math.random().toString(36).slice(2, 10); localStorage.setItem('ims_dev', d); } return d; }catch(e){ return 'x'; } })();
let auth = null, fs = null, user = null, profile = null, plan = null, admin = false, state = CFG && CFG.apiKey ? 'loading' : 'off';
let ready = false, loaded = false, pending = null, timer = null, lastSync = null, syncErr = null, unsub = null;
const subs = [];
const emit = ()=> subs.forEach(f=>{ try{ f(state); }catch(e){ console.error(e); } });
const loadJs = src=> new Promise((ok, no)=>{ const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = ()=> no(new Error('load ' + src)); document.head.appendChild(s); });

/* Gộp tiến độ của hai nơi (máy này và tài khoản). Mỗi dạng lấy bản ghi đã làm nhiều câu hơn; ngày luyện lấy số lớn hơn. */
function merge(a, b){
  a = a || {}; b = b || {}; const o = Object.assign({}, b, a), ab = a.by || {}, bb = b.by || {}, aw = a.wrong || {}, bw = b.wrong || {};
  o.by = {}; o.wrong = {}; o.days = Object.assign({}, b.days || {});
  for(const [d, n] of Object.entries(a.days || {})) o.days[d] = Math.max(n, o.days[d] || 0);
  for(const k of new Set([...Object.keys(ab), ...Object.keys(bb)])){
    const x = ab[k], y = bb[k], useA = x && (!y || x.n > y.n || (x.n === y.n && (x.at || 0) >= (y.at || 0)));
    o.by[k] = useA ? x : y; const w = useA ? aw[k] : bw[k]; if(w) o.wrong[k] = w; }
  for(const k of new Set([...Object.keys(aw), ...Object.keys(bw)])) if(!(k in o.by)) o.wrong[k] = Math.max(aw[k] || 0, bw[k] || 0);
  return o; }

const VI = {
  'auth/invalid-email':'Email không hợp lệ.', 'auth/missing-email':'Hãy nhập email.', 'auth/missing-password':'Hãy nhập mật khẩu.',
  'auth/user-not-found':'Sai email hoặc mật khẩu.', 'auth/wrong-password':'Sai email hoặc mật khẩu.', 'auth/invalid-credential':'Sai email hoặc mật khẩu.', 'auth/invalid-login-credentials':'Sai email hoặc mật khẩu.',
  'auth/email-already-in-use':'Email này đã có tài khoản. Hãy chuyển sang Đăng nhập.', 'auth/weak-password':'Mật khẩu cần ít nhất 6 ký tự.',
  'auth/network-request-failed':'Không có mạng. Kiểm tra kết nối rồi thử lại.', 'auth/too-many-requests':'Thử sai nhiều lần. Đợi vài phút rồi thử lại.',
  'auth/popup-blocked':'Trình duyệt chặn cửa sổ đăng nhập Google. Hãy cho phép cửa sổ bật lên, hoặc đăng nhập bằng email.',
  'auth/operation-not-supported-in-this-environment':'Máy này không mở được cửa sổ đăng nhập Google. Hãy đăng nhập bằng email, hoặc mở app bằng Safari/Chrome.',
  'auth/operation-not-allowed':'Cách đăng nhập này chưa được bật (giáo viên cần bật trong Firebase).', 'auth/unauthorized-domain':'Trang web này chưa được phép đăng nhập (giáo viên cần thêm tên miền trong Firebase).',
  'auth/account-exists-with-different-credential':'Email này đã đăng ký bằng cách khác. Hãy đăng nhập bằng email và mật khẩu.', 'auth/user-disabled':'Tài khoản này đã bị khoá.',
  'auth/requires-recent-login':'Hãy đăng xuất rồi đăng nhập lại để làm việc này.', 'permission-denied':'Máy chủ từ chối (luật bảo mật).', 'unavailable':'Không kết nối được máy chủ.',
};
const msg = e=> (e && (VI[e.code] || (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request' ? '' : null))) ?? ('Có lỗi: ' + (e && (e.code || e.message) || e));

const ref = (c, id)=> fs.collection(c).doc(id || user.uid);
async function readDoc(c){ try{ const s = await ref(c).get(); return s.exists ? s.data() : null; }catch(e){ console.warn('IMs cloud read', c, e.code || e); return undefined; } }

async function init(){
  if(state === 'off') return;
  try{ for(const f of ['firebase-app-compat.js', 'firebase-auth-compat.js', 'firebase-firestore-compat.js']) await loadJs(SDK + f); }
  catch(e){ state = 'offline'; emit(); return; }   // mất mạng lần đầu mở: vẫn luyện được, lưu trên máy
  try{
    firebase.initializeApp(CFG); auth = firebase.auth(); fs = firebase.firestore();
    try{ await fs.enablePersistence({synchronizeTabs:true}); }catch(e){}
    if(CFG.emulator){ auth.useEmulator(CFG.emulator.auth); const [h, p] = CFG.emulator.firestore.split(':'); fs.useEmulator(h, +p); }
  }catch(e){ console.error(e); state = 'offline'; emit(); return; }
  auth.onAuthStateChanged(async u=>{
    if(unsub){ unsub(); unsub = null; } const same = user && u && user.uid === u.uid; user = u; loaded = false; if(!same){ ready = false; pending = null; profile = plan = null; admin = false; }
    if(!u){ state = 'out'; emit(); return; }
    state = 'in'; emit();   // app gộp tiến độ rồi gọi CLOUD.ready()
    const [p, pl, ad] = await Promise.all([readDoc('users'), readDoc('plans'), readDoc('admins')]);
    if(user !== u) return; loaded = true; profile = p || profile || null; plan = pl || null; admin = !!ad;
    if(profile) ref('users').set({lastSeen:firebase.firestore.FieldValue.serverTimestamp()}, {merge:true}).catch(()=>{});
    emit(); });
}

/* Tiến độ */
async function pull(){ const d = await readDoc('progress'); if(d === undefined) return undefined; if(!d || !d.json) return null; try{ return JSON.parse(d.json); }catch(e){ return null; } }
function push(db){ if(!user || !ready) return; pending = db; clearTimeout(timer); timer = setTimeout(flush, 2500); }
async function flush(){ clearTimeout(timer); if(!user || !ready || !pending) return; const db = pending; pending = null;
  try{ await ref('progress').set({v:1, json:JSON.stringify(db), dev:DEV, updatedAt:firebase.firestore.FieldValue.serverTimestamp()}); lastSync = Date.now(); syncErr = null; }
  catch(e){ syncErr = msg(e); if(!pending) pending = db; console.warn('IMs cloud push', e); }
  emit(); }
function watch(onRemote){ if(!user) return; if(unsub) unsub();   // máy khác của cùng học sinh vừa lưu: gộp vào máy này
  unsub = ref('progress').onSnapshot(s=>{ if(!s.exists || s.metadata.hasPendingWrites) return; const d = s.data(); if(!d || d.dev === DEV || !d.json) return;
    try{ onRemote(JSON.parse(d.json)); }catch(e){} }, ()=>{}); }
document.addEventListener('visibilitychange', ()=>{ if(document.visibilityState === 'hidden') flush(); });
window.addEventListener('pagehide', ()=> flush());

/* Tài khoản */
async function saveProfile(p){ const o = {name:String(p.name || '').trim().slice(0, 60), grade:+p.grade || 12, school:String(p.school || '').trim().slice(0, 80), email:user.email || ''};
  if(!profile) o.createdAt = firebase.firestore.FieldValue.serverTimestamp();
  o.lastSeen = firebase.firestore.FieldValue.serverTimestamp();
  await ref('users').set(o, {merge:true}); profile = Object.assign({}, profile, o); if(o.name && user.displayName !== o.name) user.updateProfile({displayName:o.name}).catch(()=>{}); emit(); }
const api = {
  get state(){ return state; }, get user(){ return user; }, get profile(){ return profile; }, get plan(){ return plan; }, get admin(){ return admin; }, get loaded(){ return loaded; },
  get lastSync(){ return lastSync; }, get syncErr(){ return syncErr; }, get pending(){ return !!pending; }, get config(){ return CFG; },
  on(f){ subs.push(f); }, init, merge, msg, pull, push, flush, watch, saveProfile,
  ready(){ ready = true; },
  async signUp(email, pass, p){ const r = await auth.createUserWithEmailAndPassword(email.trim(), pass); if(user !== r.user){ user = r.user; } await saveProfile(p); return r.user; },
  signIn: (email, pass)=> auth.signInWithEmailAndPassword(email.trim(), pass),
  google(){ const pr = new firebase.auth.GoogleAuthProvider(); pr.setCustomParameters({prompt:'select_account'}); return auth.signInWithPopup(pr); },
  reset: email=> auth.sendPasswordResetEmail(email.trim()),
  async signOut(){ await flush(); return auth.signOut(); },
};
return api;
})();
