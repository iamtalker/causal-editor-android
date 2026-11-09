// 안드로이드 앱 업데이트 화면: 헤더에 '업데이트' 버튼을 달고, 최신 GitHub 릴리즈와 현재 버전을 비교합니다.
// 다운로드 진행률, 설치 권한 안내, 오류를 화면에 보여 줍니다. copy-web.js가 index.html에 끼워 넣습니다.
(function () {
  const REPO = 'iamtalker/causal-editor-android';
  const TOKEN_KEY = 'causal-android-update-token';

  const nativeOk = () => !!(window.Capacitor && window.Capacitor.nativePromise);
  const updater = (method, options) => window.Capacitor.nativePromise('Updater', method, options || {});
  const mb = (bytes) => (bytes / 1024 / 1024).toFixed(1) + 'MB';

  function getToken() {
    try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; }
  }
  function saveToken(value) {
    try { localStorage.setItem(TOKEN_KEY, value); } catch (e) { /* 저장이 막혀도 이번 실행에는 쓸 수 있습니다 */ }
  }

  // 'v1.1.0' 또는 '1.0' 같은 버전을 숫자 배열로 바꿉니다.
  const parseVersion = (text) => String(text || '').replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
  function isNewer(latest, current) {
    const a = parseVersion(latest), b = parseVersion(current);
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      const x = a[i] || 0, y = b[i] || 0;
      if (x !== y) return x > y;
    }
    return false;
  }

  // 화면 요소 만들기
  const dlg = document.createElement('dialog');
  dlg.id = 'updDlg';
  dlg.style.cssText = 'width:min(440px,92vw);border:1px solid #cbd2dc;border-radius:12px;padding:18px;font:inherit;color:#222';
  dlg.innerHTML = [
    '<h2 style="font-size:17px;margin:0 0 10px">앱 업데이트</h2>',
    '<p id="updCurrent" style="margin:0 0 8px;font-size:14px"></p>',
    '<label style="display:block;font-size:13px;margin-bottom:4px">GitHub 읽기 토큰 (비공개 저장소용, 이 기기에만 저장됩니다)</label>',
    '<input id="updToken" type="password" autocomplete="off" style="width:100%;box-sizing:border-box;padding:7px;border:1px solid #cbd2dc;border-radius:7px;font:inherit;margin-bottom:10px">',
    '<div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap">',
    '  <button id="updCheck" type="button">업데이트 확인</button>',
    '  <button id="updAction" type="button" hidden></button>',
    '</div>',
    '<div id="updStatus" role="status" style="font-size:14px;min-height:20px;margin-bottom:8px"></div>',
    '<div id="updBarWrap" hidden style="height:10px;background:#e5e7eb;border-radius:6px;overflow:hidden;margin-bottom:6px">',
    '  <div id="updBar" style="height:100%;width:0;background:#2563eb;transition:width .2s"></div>',
    '</div>',
    '<div id="updProgressText" style="font-size:12px;color:#555;margin-bottom:8px"></div>',
    '<pre id="updNotes" hidden style="white-space:pre-wrap;font:inherit;font-size:13px;background:#f4f5f7;border-radius:8px;padding:8px;max-height:160px;overflow:auto;margin:0 0 10px"></pre>',
    '<div style="text-align:right"><button id="updClose" type="button">닫기</button></div>'
  ].join('');
  // 이 스크립트는 <head>에서 실행되므로 body가 준비된 뒤에 대화상자를 붙입니다.
  const attachDialog = () => document.body.appendChild(dlg);
  if (document.body) attachDialog();
  else document.addEventListener('DOMContentLoaded', attachDialog);

  const $ = (id) => dlg.querySelector('#' + id);
  const setStatus = (text, isError) => {
    const el = $('updStatus');
    el.textContent = text;
    el.style.color = isError ? '#b91c1c' : '#222';
  };
  const setAction = (label, handler) => {
    const btn = $('updAction');
    if (!label) { btn.hidden = true; btn.onclick = null; return; }
    btn.hidden = false;
    btn.textContent = label;
    btn.onclick = handler;
  };
  const showProgress = (show) => {
    $('updBarWrap').hidden = !show;
    if (!show) { $('updBar').style.width = '0'; $('updProgressText').textContent = ''; }
  };

  let pollTimer = null;
  function startPolling() {
    stopPolling();
    pollTimer = setInterval(async () => {
      try {
        const p = await updater('progress');
        if (!p.total) {
          $('updBar').style.width = '100%';
          $('updProgressText').textContent = `다운로드 중… ${mb(p.received)}`;
          return;
        }
        const pct = Math.min(100, Math.floor(p.received * 100 / p.total));
        $('updBar').style.width = pct + '%';
        $('updProgressText').textContent = `다운로드 중 ${pct}% (${mb(p.received)} / ${mb(p.total)})`;
      } catch (e) { /* 진행률 조회 실패는 무시하고 다운로드는 계속합니다 */ }
    }, 300);
  }
  function stopPolling() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  }

  let currentVersion = '';
  let latest = null;

  async function check() {
    const token = $('updToken').value.trim();
    saveToken(token);
    $('updCheck').disabled = true;
    setAction(null);
    showProgress(false);
    $('updNotes').hidden = true;
    setStatus('업데이트를 확인하는 중…');
    try {
      latest = await updater('checkLatest', {repo: REPO, token});
      $('updNotes').hidden = !latest.notes;
      $('updNotes').textContent = latest.notes || '';
      if (isNewer(latest.tag, currentVersion)) {
        setStatus(`새 버전 ${latest.tag} 이(가) 있습니다. 현재 버전은 v${currentVersion}입니다.`);
        setAction('다운로드 후 설치', () => download());
      } else {
        setStatus(`최신 버전을 사용 중입니다 (v${currentVersion}).`);
      }
    } catch (err) {
      latest = null;
      setStatus(err.message || String(err), true);
    } finally {
      $('updCheck').disabled = false;
    }
  }

  async function download() {
    if (!latest) return;
    const token = $('updToken').value.trim();
    const info = latest;
    setAction(null);
    $('updCheck').disabled = true;
    showProgress(true);
    $('updBar').style.width = '0';
    setStatus('다운로드를 시작합니다…');
    startPolling();
    try {
      const file = await updater('download', {url: info.assetUrl, token, fileName: info.assetName});
      stopPolling();
      $('updBar').style.width = '100%';
      $('updProgressText').textContent = `다운로드 완료 (${mb(file.size)})`;
      await installFlow(file.path);
    } catch (err) {
      stopPolling();
      showProgress(false);
      setStatus(err.message || String(err), true);
      setAction('다시 시도', () => download());
    } finally {
      $('updCheck').disabled = false;
    }
  }

  async function installFlow(path) {
    setStatus('설치 권한을 확인하는 중…');
    const can = await updater('canInstall');
    if (!can.allowed) {
      setStatus('설치하려면 이 앱의 "출처를 알 수 없는 앱 설치"를 허용해야 합니다. 허용한 뒤 다시 눌러 주세요.', true);
      setAction('설치 허용 화면 열기', async () => {
        await updater('openInstallSettings');
        setStatus('허용했다면 "설치 계속"을 누르세요.');
        setAction('설치 계속', () => installFlow(path));
      });
      return;
    }
    setStatus('설치 화면을 여는 중…');
    await updater('install', {path});
    setStatus('설치 화면을 열었습니다. 설치를 마치면 앱이 새 버전으로 바뀝니다.');
    setAction(null);
  }

  async function openDialog() {
    $('updToken').value = getToken();
    showProgress(false);
    $('updNotes').hidden = true;
    setAction(null);
    setStatus('');
    dlg.showModal();
    try {
      const info = await updater('appInfo');
      currentVersion = info.versionName;
      $('updCurrent').textContent = `현재 버전: v${currentVersion} (빌드 ${info.versionCode})`;
    } catch (e) {
      $('updCurrent').textContent = '현재 버전을 읽지 못했습니다.';
    }
  }

  $('updCheck').onclick = check;
  dlg.querySelector('#updClose').onclick = () => { stopPolling(); dlg.close(); };

  // 이 스크립트는 안드로이드 빌드에만 들어가므로 바로 버튼을 답니다.
  function addButton() {
    const btn = document.createElement('button');
    btn.id = 'btnUpdate';
    btn.type = 'button';
    btn.textContent = '업데이트';
    btn.onclick = openDialog;
    const header = document.querySelector('header') || document.body;
    header.appendChild(btn);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addButton);
  else addButton();
})();
