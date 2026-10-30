/* Cấu hình Firebase của app IMs.
   Để trống (null) thì app chạy không đăng nhập, tiến độ chỉ lưu trên máy.
   Cách lấy: Firebase console → Project settings → Your apps → Web app → SDK setup and configuration → Config,
   rồi dán các dòng apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId vào giữa cặp ngoặc { } dưới đây.
   Mã này công khai được (mọi web dùng Firebase đều lộ nó); dữ liệu được bảo vệ bằng luật trong firestore.rules. */
window.IMS_FIREBASE = null;
/* Ví dụ:
window.IMS_FIREBASE = {
  apiKey: "AIza...",
  authDomain: "ims-xxxx.firebaseapp.com",
  projectId: "ims-xxxx",
  storageBucket: "ims-xxxx.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef",
  requireLogin: false   // true: bắt buộc đăng nhập mới được luyện
};
*/
