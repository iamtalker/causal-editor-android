// PC 편집기(크롬 확장)와 이 저장소 src/의 화면 파일이 얼마나 다른지 보고만 합니다. 파일을 고치지 않습니다.
// 기본 PC 위치: ../인과편집기/크롬확장/  (다른 곳이면 PC_DIR 환경 변수로 지정)
// 차이가 있어도 실패로 끝나지 않습니다. 의도한 차이(README "동기화" 절 참고)를 사람이 확인하는 도구입니다.
const fs = require('fs');
const path = require('path');

const ANDROID_DIR = path.resolve(__dirname, '..');
const SRC_DIR = process.env.SRC_DIR ? path.resolve(process.env.SRC_DIR) : path.join(ANDROID_DIR, 'src');
const PC_DIR = process.env.PC_DIR
  ? path.resolve(process.env.PC_DIR)
  : path.resolve(ANDROID_DIR, '..', '인과편집기', '크롬확장');
const FILES = ['index.html', 'app.js', 'storage.js', 'md-graph.js'];

// 줄바꿈(CRLF/LF) 차이는 무시하고 줄 단위로 비교합니다.
const lines = (file) => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n').split('\n');

function diffCount(a, b) {
  // 가장 긴 공통 부분열 길이로 "바뀐 줄 수"를 대략 셉니다. 파일이 크지 않아 단순 DP로 충분합니다.
  const n = a.length, m = b.length;
  let prev = new Array(m + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    const cur = new Array(m + 1).fill(0);
    for (let j = 1; j <= m; j++) {
      cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1]);
    }
    prev = cur;
  }
  const common = prev[m];
  return (n - common) + (m - common);
}

console.log('PC 원본: ' + PC_DIR);
console.log('안드로이드 src: ' + SRC_DIR);
let problems = 0;
for (const name of FILES) {
  const pc = path.join(PC_DIR, name), and = path.join(SRC_DIR, name);
  if (!fs.existsSync(pc)) { console.log(`[없음] PC 쪽 ${name}: ${pc}`); problems++; continue; }
  if (!fs.existsSync(and)) { console.log(`[없음] src ${name}: ${and}`); problems++; continue; }
  const d = diffCount(lines(pc), lines(and));
  console.log(d === 0 ? `[같음] ${name}` : `[다름] ${name}: 바뀐 줄 약 ${d}개`);
}
console.log(problems === 0 ? '확인 완료. 다른 부분은 README의 의도한 차이와 맞는지 보세요.' : `확인하지 못한 파일 ${problems}개`);
