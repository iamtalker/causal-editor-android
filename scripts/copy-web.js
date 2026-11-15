// 편집기 화면 파일(src/)을 www/로 복사하고, 안드로이드용 어댑터(android-shim.js 등)를 끼워 넣습니다.
// src/의 storage.js는 서버에 /api/* 요청을 보내는 방식이고, 앱에는 서버가 없어서 android-shim.js가 그 요청을 기기 파일 작업으로 바꿔 줍니다.
const fs = require('fs');
const path = require('path');

const ANDROID_DIR = path.resolve(__dirname, '..');
// 화면 파일 위치: 기본은 이 저장소의 src/ 입니다. 다른 곳의 파일로 빌드해 보려면 SRC_DIR 환경 변수로 지정합니다.
const SRC_DIR = process.env.SRC_DIR ? path.resolve(process.env.SRC_DIR) : path.join(ANDROID_DIR, 'src');
for (const name of ['index.html', 'app.js', 'storage.js', 'md-graph.js']) {
  if (!fs.existsSync(path.join(SRC_DIR, name))) throw new Error(`화면 파일을 찾지 못했습니다: ${path.join(SRC_DIR, name)}`);
}
console.log('화면 파일 위치: ' + SRC_DIR);
const WWW = path.join(ANDROID_DIR, 'www');
const NATIVE_SRC_DIR = path.join(ANDROID_DIR, 'native');
const NATIVE_DEST = path.join(ANDROID_DIR, 'android', 'app', 'src', 'main', 'java', 'com', 'causaleditor', 'app');

// 화면 파일: index.html은 아래에서 손보고, 나머지는 그대로 복사합니다.
const SRC_FILES = ['app.js', 'storage.js', 'md-graph.js'];

fs.mkdirSync(WWW, { recursive: true });
let html = fs.readFileSync(path.join(SRC_DIR, 'index.html'), 'utf8');
// 앱 안의 페이지에는 웹 보안 정책(CSP) 줄이 필요 없고, 안드로이드 쪽이 넣는 스크립트를 막을 수 있어서 뺍니다.
html = html.replace(/[ \t]*<meta http-equiv="Content-Security-Policy"[^>]*>\r?\n?/, '');
if (!html.includes('android-shim.js')) {
  html = html.replace('<head>', '<head>\n<script src="android-shim.js"></script>\n<script src="android-update.js"></script>\n<script src="android-touch.js"></script>');
}
fs.writeFileSync(path.join(WWW, 'index.html'), html, 'utf8');
for (const name of ['android-shim.js', 'android-update.js', 'android-touch.js']) {
  fs.copyFileSync(path.join(ANDROID_DIR, 'web', name), path.join(WWW, name));
}
for (const name of SRC_FILES) fs.copyFileSync(path.join(SRC_DIR, name), path.join(WWW, name));
console.log('www/ 준비 완료');

if (fs.existsSync(path.join(ANDROID_DIR, 'android'))) {
  fs.mkdirSync(NATIVE_DEST, { recursive: true });
  for (const name of fs.readdirSync(NATIVE_SRC_DIR).filter(n => n.endsWith('.java'))) {
    fs.copyFileSync(path.join(NATIVE_SRC_DIR, name), path.join(NATIVE_DEST, name));
  }
  console.log('네이티브 플러그인 복사 완료');
}
