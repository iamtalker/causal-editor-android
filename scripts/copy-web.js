// PC 편집기(설치버전)의 화면 파일을 www/로 복사하고, 안드로이드용 어댑터(android-shim.js 등)를 끼워 넣습니다.
// PC 편집기 파일은 바꾸지 않습니다. 설치버전의 storage.js가 부르는 /api/* 요청은 android-shim.js가 기기 파일 작업으로 바꿔 줍니다.
const fs = require('fs');
const path = require('path');

const ANDROID_DIR = path.resolve(__dirname, '..');
// PC 편집기의 설치버전/프로그램/ 폴더를 찾습니다. PC_PROGRAM_DIR 환경 변수가 있으면 그것을 씁니다.
// 없으면 바로 위 폴더의 인과편집기/설치버전/프로그램, 그다음 이 저장소 안의 프로그램/ 순서로 찾습니다.
const PROGRAM_DIR = [
  process.env.PC_PROGRAM_DIR,
  path.resolve(ANDROID_DIR, '..', '인과편집기', '설치버전', '프로그램'),
  path.join(ANDROID_DIR, '프로그램'),
].find(p => p && fs.existsSync(path.join(p, 'index.html')) && fs.existsSync(path.join(p, 'app.js')));
if (!PROGRAM_DIR) throw new Error('PC 편집기 설치버전/프로그램/(index.html, app.js)을 찾지 못했습니다. PC_PROGRAM_DIR을 설정하세요.');
console.log('PC 편집기 소스: ' + PROGRAM_DIR);
const WWW = path.join(ANDROID_DIR, 'www');
const NATIVE_SRC_DIR = path.join(ANDROID_DIR, 'native');
const NATIVE_DEST = path.join(ANDROID_DIR, 'android', 'app', 'src', 'main', 'java', 'com', 'causaleditor', 'app');

// PC 화면 파일: index.html은 아래에서 손보고, 나머지는 그대로 복사합니다.
const PC_FILES = ['app.js', 'storage.js', 'md-graph.js'];

fs.mkdirSync(WWW, { recursive: true });
let html = fs.readFileSync(path.join(PROGRAM_DIR, 'index.html'), 'utf8');
// 앱 안의 페이지에는 웹 보안 정책(CSP) 줄이 필요 없고, 안드로이드 쪽이 넣는 스크립트를 막을 수 있어서 뺍니다.
html = html.replace(/[ \t]*<meta http-equiv="Content-Security-Policy"[^>]*>\r?\n?/, '');
if (!html.includes('android-shim.js')) {
  html = html.replace('<head>', '<head>\n<script src="android-shim.js"></script>\n<script src="android-update.js"></script>\n<script src="android-touch.js"></script>');
}
fs.writeFileSync(path.join(WWW, 'index.html'), html, 'utf8');
for (const name of ['android-shim.js', 'android-update.js', 'android-touch.js']) {
  fs.copyFileSync(path.join(ANDROID_DIR, 'web', name), path.join(WWW, name));
}
for (const name of PC_FILES) fs.copyFileSync(path.join(PROGRAM_DIR, name), path.join(WWW, name));
console.log('www/ 준비 완료');

if (fs.existsSync(path.join(ANDROID_DIR, 'android'))) {
  fs.mkdirSync(NATIVE_DEST, { recursive: true });
  for (const name of fs.readdirSync(NATIVE_SRC_DIR).filter(n => n.endsWith('.java'))) {
    fs.copyFileSync(path.join(NATIVE_SRC_DIR, name), path.join(NATIVE_DEST, name));
  }
  console.log('네이티브 플러그인 복사 완료');
}
