# Dựng app IMs (Infinity Maths) cho học sinh từ mã nguồn MathBank: lấy bộ sinh + hàm vẽ hình, bỏ mọi dữ liệu riêng
import re, sys, os, json
OUT = 'ims'; os.makedirs(OUT, exist_ok=True)
SRC = sys.argv[1] if len(sys.argv) > 1 else 'work.html'   # đường dẫn file MathBank_Vx.html
s = open(SRC).read()
a = s.index('<script>\n', s.index('auto-render.min.js')) + len('<script>\n'); b = s.index('/* ============================================================\n   KHỞI ĐỘNG')
js = s[a:b]
def rep(x, y):
    global js
    assert js.count(x) >= 1, x[:60]; js = js.replace(x, y)
# ---- bỏ dữ liệu riêng: tài khoản Firebase của trường, danh sách giáo viên, danh sách học sinh, thông tin trường ----
js = re.sub(r"const FIXED_DB_URL = '[^']*';", "const FIXED_DB_URL = '';", js)
js = re.sub(r"const FIXED_CLOUD_EMAIL = '[^']*';", "const FIXED_CLOUD_EMAIL = '';", js)
js = re.sub(r"const FIXED_CLOUD_PASSWORD = '[^']*';", "const FIXED_CLOUD_PASSWORD = '';", js)
js = re.sub(r"const FIXED_CLOUD_APIKEY = '[^']*';", "const FIXED_CLOUD_APIKEY = '';", js)
js = re.sub(r"const FIXED_REVIEWERS = \[[^\]]*\];", "const FIXED_REVIEWERS = [];", js, count=1)
js = re.sub(r"reviewers: \[(\s*//[^\n]*)?\s*\{name:'[^\]]*\]", "reviewers: []", js, count=1)
i = js.index('const CLASS_LISTS = {'); j = js.index('\n};', i) + 3; js = js[:i] + 'const CLASS_LISTS = {};' + js[j:]
js = re.sub(r'info: \{soGD:"[^"]*", truong:"[^"]*", to:"[^"]*",', 'info: {soGD:"", truong:"", to:"",', js, count=1)
js = js.replace('kho-de-toan-vonhai', '')
names = re.findall(r"\{name:'([^']+)', passcode:", s)   # tên người duyệt lấy ngay từ bản MathBank — không ghi sẵn trong script
for nm in names: js = js.replace(nm, 'Quản trị')   # tên còn sót trong chữ giao diện giáo viên
for bad in names + ['AIzaSy', '@gmail.com', 'firebaseio.com']:
    assert bad not in js, 'còn dữ liệu riêng: ' + bad
js = js.replace("const LOCAL_KEY = 'sinhdetoan_state_v1';", "const LOCAL_KEY = 'ims_engine_unused';")
open(f'{OUT}/engine.js', 'w').write('/* IMs engine — trích từ MathBank (bộ sinh câu hỏi + vẽ hình). Không sửa tay: dựng lại bằng mkims.py */\n' + js)
css = '\n'.join(m.group(1) for m in re.finditer(r'<style[^>]*>(.*?)</style>', s[:s.index('<body')], re.S))
open(f'{OUT}/engine.css', 'w').write(css)
print('engine', len(js)//1024, 'KB; css', len(css)//1024, 'KB')
