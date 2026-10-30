// IMs service worker (0.2): lưu app + bộ câu hỏi vào máy để luyện khi mất mạng; có bản mới thì tự cập nhật ở lần mở sau
const CACHE = 'ims-v0-2b';
const CORE = ['./', 'index.html', 'app.css', 'app.js', 'engine.js', 'engine.css', 'pack.json', 'cloud.js', 'firebase-config.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.css', 'https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.js', 'https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/contrib/auto-render.min.js'];
self.addEventListener('install', e=> e.waitUntil(caches.open(CACHE).then(c=> c.addAll(CORE)).then(()=> self.skipWaiting())));
self.addEventListener('activate', e=> e.waitUntil(caches.keys().then(ks=> Promise.all(ks.filter(k=> k !== CACHE).map(k=> caches.delete(k)))).then(()=> self.clients.claim())));
self.addEventListener('fetch', e=>{
  const u = new URL(e.request.url); if(e.request.method !== 'GET') return;
  if(u.origin === location.origin && /(pack\.json|firebase-config\.js|genmeta\.json|engine\.js|engine\.css)$/.test(u.pathname)){   // gói câu hỏi, cấu hình Firebase: lấy bản mới khi có mạng, mất mạng thì dùng bản đã lưu
    e.respondWith(fetch(e.request).then(r=>{ const c = r.clone(); caches.open(CACHE).then(x=> x.put(e.request, c)); return r; }).catch(()=> caches.match(e.request))); return; }
  const keep = u.origin === location.origin || u.host === 'cdnjs.cloudflare.com' || (u.host === 'www.gstatic.com' && u.pathname.startsWith('/firebasejs/'));
  if(!keep) return;   // máy chủ đăng nhập / Firestore: để trình duyệt tự xử lý, không lưu
  e.respondWith(caches.match(e.request).then(hit=> hit || fetch(e.request).then(r=>{ if(r.ok){ const c = r.clone(); caches.open(CACHE).then(x=> x.put(e.request, c)); } return r; })));
});
