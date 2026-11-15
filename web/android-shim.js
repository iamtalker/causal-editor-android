// 안드로이드 어댑터: 프로그램/server.js가 하던 /api/* 요청을 기기 저장소 파일 작업으로 바꿔 줍니다.
// index.html은 PC와 같은 코드를 씁니다. 이 파일은 copy-web.js가 index.html 맨 앞에 끼워 넣습니다.
// 작은 화면에 맞춘 확대율: 노드 상자가 휴대폰에서 너무 커 보이지 않도록 PC 기본값(1)보다 작게 둡니다.
// index.html이 이 값을 읽습니다. 값을 바꾸면 '실제 크기'와 '전체 그래프 보기'의 최대 확대율이 함께 바뀝니다.
window.CAUSAL_BASE_ZOOM = 0.7;
window.CAUSAL_FIT_MAX_ZOOM = 0.7;

// 뒤로 가기(MainActivity가 호출): 열린 대화상자나 메뉴를 먼저 닫습니다.
// 닫을 것이 없으면 false를 돌려주고, 그때 앱이 종료 처리를 합니다.
window.__androidBack = function () {
  const open = [...document.querySelectorAll('dialog[open]')];
  if (open.length) { open[open.length - 1].close(); return true; }
  for (const id of ['canvasMenu', 'layoutOptions', 'searchResults']) {
    const el = document.getElementById(id);
    if (el && !el.hidden) { el.hidden = true; return true; }
  }
  return false;
};

(function () {
  const DEFAULT_DIR = '/storage/emulated/0/Documents/인과편집기';
  const DIR_KEY = 'causal-android-data-folder';
  const OWN_FILE = /^(n\d+_.*|_경로)\.md$/;
  const HISTORY_FILE = /^\d{8}T\d{6}Z_[a-z0-9-]+\.json$/;
  const nativeOk = () => !!(window.Capacitor && window.Capacitor.nativePromise);
  const originalFetch = window.fetch.bind(window);

  const native = (method, options) => window.Capacitor.nativePromise('DataFiles', method, options || {});
  const reply = (status, obj) => new Response(JSON.stringify(obj), {status, headers: {'Content-Type': 'application/json; charset=utf-8'}});
  const fail = (err) => reply(500, {ok: false, error: (err && err.message) || String(err)});

  function dataDir() {
    try { const v = localStorage.getItem(DIR_KEY); if (v) return v; } catch (e) {}
    return DEFAULT_DIR;
  }
  const nodeDir = () => `${dataDir()}/노드파일`;
  // 노드 파일 경로 -> 파일에 들어 있다고 아는 내용. 저장할 때 바뀐 파일만 쓰려고 씁니다. 파일을 읽을 때마다 새로 채웁니다.
  const nodeFileCache = new Map();
  const graphTextCache = new Map();   // 그래프 JSON 경로 -> 마지막으로 쓴 내용
  let legacyGraphRemoved = false;
  const historyDir = () => `${dataDir()}/변경이력`;
  // 그래프 JSON은 노드파일 폴더 밖의 내부데이터에 둡니다 (원본은 노드 .md 파일).
  const graphDir = () => `${dataDir()}/내부데이터`;
  const graphFile = () => `${graphDir()}/그래프.json`;
  const legacyGraphFile = () => `${nodeDir()}/그래프.json`;   // 예전 위치 (옮긴 뒤 지웁니다)
  const stamp = () => new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');

  async function readJson(path) {
    const r = await native('readText', {path});
    return r.exists ? JSON.parse(r.text) : null;
  }
  const writeJson = (path, value) => native('writeText', {path, text: JSON.stringify(value, null, 2)});
  const readBody = (init) => JSON.parse((init && init.body) || '{}');

  async function versionsList() {
    await native('mkdirs', {path: historyDir()});
    const {files} = await native('list', {path: historyDir()});
    const names = files.map(f => f.name).filter(n => HISTORY_FILE.test(n)).sort().reverse();
    const items = [];
    for (const name of names) items.push(await readJson(`${historyDir()}/${name}`));
    return items;
  }

  async function handle(method, path, params, init) {
    if (method === 'GET' && path === '/api/graph') {
      const internal = await readJson(graphFile());
      if (internal) return reply(200, {ok: true, source: 'internal', data: internal});
      const legacy = await readJson(legacyGraphFile());
      if (legacy) return reply(200, {ok: true, source: 'legacy', data: legacy});
      return reply(200, {ok: true, data: null});
    }
    if (method === 'POST' && path === '/api/graph') {
      const data = readBody(init);
      if (!data || !Array.isArray(data.nodes) || !Array.isArray(data.edges)) throw new Error('잘못된 그래프 데이터입니다.');
      const text = JSON.stringify(data, null, 2), file = graphFile();
      if (graphTextCache.get(file) === text) return reply(200, {ok: true});   // 파일에 이미 같은 내용이 있으면 쓰지 않습니다
      await native('mkdirs', {path: graphDir()});
      await native('writeText', {path: file, text});
      graphTextCache.set(file, text);
      if (!legacyGraphRemoved) { await native('remove', {path: legacyGraphFile()}); legacyGraphRemoved = true; }   // 예전 위치의 파일은 한 번만 정리합니다
      return reply(200, {ok: true});
    }
    // 노드 파일 전체: 그래프의 원본입니다. 파일 내용을 그대로 돌려줍니다.
    if (method === 'GET' && path === '/api/nodes') {
      await native('mkdirs', {path: nodeDir()});
      const {files} = await native('list', {path: nodeDir()});
      const out = [];
      nodeFileCache.clear();   // 지금 파일에 있는 내용으로 다시 기억합니다
      for (const f of files) {
        if (!OWN_FILE.test(f.name)) continue;
        const r = await native('readText', {path: f.path});
        out.push({name: f.name, text: r.text || ''});
        nodeFileCache.set(f.path, r.text || '');
      }
      out.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
      return reply(200, {ok: true, files: out});
    }
    if (method === 'GET' && path === '/api/versions') {
      return reply(200, {ok: true, versions: await versionsList()});
    }
    if (method === 'POST' && path === '/api/versions') {
      const item = readBody(init);
      if (!item || !item.data || !Array.isArray(item.data.nodes) || !Array.isArray(item.data.edges) || typeof item.summary !== 'string') throw new Error('잘못된 버전 데이터입니다.');
      const id = `${stamp()}_${Math.random().toString(36).slice(2, 8)}`;
      const saved = {id, at: new Date().toISOString(), summary: item.summary.slice(0, 160), data: item.data};
      await native('mkdirs', {path: historyDir()});
      await writeJson(`${historyDir()}/${id}.json`, saved);
      return reply(200, {ok: true, version: saved});
    }
    const del = path.match(/^\/api\/versions\/(\d{8}T\d{6}Z_[a-z0-9-]+)$/);
    if (method === 'DELETE' && del) {
      const full = `${historyDir()}/${del[1]}.json`;
      const r = await native('readText', {path: full});
      if (!r.exists) return reply(404, {ok: false, error: '버전을 찾지 못했습니다.'});
      await native('remove', {path: full});
      return reply(200, {ok: true});
    }
    if (method === 'POST' && path === '/api/nodes') {
      const {files} = readBody(init);
      await native('mkdirs', {path: nodeDir()});
      const written = new Set();
      let changed = 0;
      for (const f of files) {
        const name = String(f.name).split('/').pop();
        if (!OWN_FILE.test(name)) continue;
        const full = `${nodeDir()}/${name}`, text = String(f.text);
        written.add(name);
        if (nodeFileCache.get(full) === text) continue;   // 파일에 이미 같은 내용이 있으면 쓰지 않습니다 (기기 파일 쓰기는 느립니다)
        await native('writeText', {path: full, text});
        nodeFileCache.set(full, text);
        changed++;
      }
      const listing = await native('list', {path: nodeDir()});
      for (const f of listing.files) {
        if (OWN_FILE.test(f.name) && !written.has(f.name)) { await native('remove', {path: f.path}); nodeFileCache.delete(f.path); }
      }
      return reply(200, {ok: true, count: written.size, changed});
    }
    // 데이터 폴더: 현재 폴더 보기 / 바꾸기(바로 적용) / 기기 파일 탐색기로 고르기 / 폴더 안 노드 파일 개수
    if (method === 'GET' && path === '/api/data-folder') {
      return reply(200, {ok: true, active: dataDir(), default: DEFAULT_DIR, custom: dataDir() !== DEFAULT_DIR});
    }
    if (method === 'POST' && path === '/api/data-folder') {
      const requested = String(readBody(init).path || '').trim();
      if (!requested) {
        try { localStorage.removeItem(DIR_KEY); } catch (e) {}
        nodeFileCache.clear();
      } else {
        await native('list', {path: requested});   // 폴더가 없거나 접근할 수 없으면 여기서 오류
        try { localStorage.setItem(DIR_KEY, requested); } catch (e) {}
        nodeFileCache.clear();
      }
      return reply(200, {ok: true, active: dataDir(), custom: dataDir() !== DEFAULT_DIR});
    }
    if (method === 'POST' && path === '/api/pick-folder') {
      try { return reply(200, {ok: true, path: (await native('pickFolder')).path || ''}); }
      catch (err) {
        const msg = (err && err.message) || String(err);
        if (!msg.includes('취소')) alert(msg);   // 취소가 아닌 실패(사용할 수 없는 위치 등)는 이유를 알려 줍니다
        return reply(200, {ok: true, path: ''});
      }
    }
    if (method === 'GET' && path === '/api/folder-info') {
      const p = params.get('path') || '';
      try {
        const top = await native('list', {path: p});   // 고른 폴더에 아무것도 만들지 않고 살펴봅니다
        const nodes = top.dirs.find(d => d.name === '노드파일');
        if (!nodes) return reply(200, {ok: true, nodeFiles: 0});
        const {files} = await native('list', {path: nodes.path});
        return reply(200, {ok: true, nodeFiles: files.filter(f => OWN_FILE.test(f.name) && f.name !== '_경로.md').length});
      } catch (err) { return reply(400, {ok: false, error: '폴더를 찾지 못했습니다.'}); }
    }
    return reply(404, {ok: false, error: '지원하지 않는 요청입니다.'});
  }

  window.fetch = function (input, init) {
    const url = typeof input === 'string' ? input : ((input && input.url) || '');
    if (!url.startsWith('/api/')) return originalFetch(input, init);
    const u = new URL(url, 'https://localhost');
    const method = ((init && init.method) || 'GET').toUpperCase();
    if (!nativeOk()) return Promise.resolve(fail(new Error('안드로이드 앱 안에서만 동작합니다.')));
    return handle(method, u.pathname, u.searchParams, init).catch(fail);
  };

  // PC 설치버전의 storage.js는 서버에 "살아 있음" 연결(/api/alive-stream)을 열어 둡니다. 앱에는 서버가 없으므로 아무 일도 하지 않는 연결로 바꿉니다.
  const RealEventSource = window.EventSource;
  window.EventSource = function (url, opt) {
    if (String(url).startsWith('/api/')) return {close() {}, addEventListener() {}, removeEventListener() {}, readyState: 1};
    return new RealEventSource(url, opt);
  };

  // "노드 md 파일 보기": PC는 새 탭(blob)으로 보여 주지만 앱에서는 기기의 텍스트 보기·편집 앱 선택창을 엽니다.
  // 노드 파일을 먼저 저장한 뒤 그 파일을 엽니다. PC 코드보다 먼저 받도록 문서 단계에서 가로챕니다.
  document.addEventListener('click', async (e) => {
    if (!(e.target && e.target.closest && e.target.closest('#btnOpenMd'))) return;
    e.stopImmediatePropagation();
    e.preventDefault();
    try {
      const n = node(sel.id);
      if (!n) return;
      await persistNow();   // 파일이 최신 내용이 되도록 먼저 저장합니다
      await native('openFile', {path: `${nodeDir()}/${fileName(n)}`});
    } catch (err) { setFstat(`파일을 열지 못했습니다: ${(err && err.message) || err}`); }
  }, true);

  // 시작할 때 파일 접근 권한을 확인합니다.
  document.addEventListener('DOMContentLoaded', async () => {
    if (!nativeOk()) return;
    try {
      const s = await native('status');
      if (!s.granted) {
        alert('그래프 파일을 저장하려면 "모든 파일 관리" 권한이 필요합니다. 다음 화면에서 허용해 주세요.');
        await native('openAccessSettings');
      }
    } catch (e) { /* 권한 확인 실패 시에도 편집은 계속할 수 있습니다 */ }
  });
})();
