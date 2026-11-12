// 터치 조작 어댑터 (안드로이드 전용). PC 화면과 index.html의 편집 코드는 바꾸지 않습니다.
//
// 문제 1 (노드가 안 움직임): 손가락이 조금 움직이기 전에는 브라우저가 화면을 스크롤하려고 손가락 동작을 가져갑니다.
//   그러면 앱에는 touchcancel만 전달되고 노드 끌기가 끊깁니다.
//   해결: #stage에 touch-action:none을 주어 브라우저가 스크롤하지 않게 하고, 손가락이 닿은 순간부터 막습니다.
// 끄는 동안에는 노드 위치를 바꾸고 프레임마다 다시 그려서 화살표가 따라오게 합니다 (PC의 mousemove와 같음).
//   손을 떼면 위치를 저장합니다. 터치 대상은 손가락을 댄 요소로 고정되므로 다시 그려도 끌기가 끊기지 않습니다.
// 추가: 두 손가락으로 확대·축소(핀치), 빈 곳 두 번 탭으로 노드 추가, 한 손가락 화면 밀기.
//  - 탭(움직임 없이 뗌): 원래 마우스 클릭 흐름(선택, 화살표 연결 등)을 그대로 실행합니다.
// 폰 화면 서랍: 위쪽 툴바는 왼쪽 가장자리에서 오른쪽으로 밀면 나오고, 하단 패널은 오른쪽 가장자리에서 왼쪽으로 밀면 나옵니다.
//   바깥(어두운 부분)을 누르면 닫힙니다. PC 화면에는 영향이 없습니다.
(function () {
  const MOVE_SLOP = 10;          // 이 거리(px)보다 적게 움직이면 탭으로 봅니다.
  const DOUBLE_TAP_MS = 320, DOUBLE_TAP_PX = 28;
  const MIN_ZOOM = 0.2, MAX_ZOOM = 3;   // index.html의 휠 확대 범위와 같습니다.
  const EDGE_PX = 28;            // 화면 가장자리에서 이 안쪽으로 시작해야 서랍이 열립니다.
  const SWIPE_PX = 56;           // 이만큼 가로로 밀어야 서랍이 열립니다.

  const style = document.createElement('style');
  style.textContent = `
    #stage{touch-action:none}
    #drawerShade{position:fixed;inset:0;background:#0005;z-index:55!important;display:none}
    #drawerShade.show{display:block}
    @media (max-width:800px){
      .panel-toggle{display:none!important}
      header{position:fixed!important;top:0;left:0;bottom:0;height:100%;width:min(190px,44vw)!important;z-index:60!important;
        flex-direction:column!important;flex-wrap:nowrap;align-items:stretch;gap:10px!important;padding:14px!important;
        overflow-x:hidden!important;overflow-y:auto;border-bottom:0!important;border-right:1px solid #dce1e8;
        box-sizing:border-box;transform:translateX(-105%);transition:transform .22s ease}
      header.drawer-open{transform:none;box-shadow:4px 0 18px #0003}
      header .toolbar-group{flex-wrap:wrap;border-right:0!important;padding-right:0!important}
      aside{position:fixed!important;top:0;right:0;bottom:0;left:auto;height:100%;width:min(190px,44vw)!important;
        max-height:none!important;flex:none!important;z-index:60!important;border-top:0;border-left:1px solid #ddd;
        box-sizing:border-box;transform:translateX(105%);transition:transform .22s ease}
      aside.drawer-open{transform:none;box-shadow:-4px 0 18px #0003}
      aside[hidden]{display:flex!important}
    }`;
  (document.head || document.documentElement).appendChild(style);

  let gesture = null;            // 한 손가락 동작: node / pan / tap
  let pinch = null;              // 두 손가락 확대·축소 상태
  let busy = false;              // 두 손가락 동작이 끝난 뒤, 손가락을 모두 뗄 때까지 새 동작을 막습니다.
  let lastTap = null;            // 직전 탭 (두 번 탭 확인용)
  let lastNodeTap = null;        // 직전 노드 탭 (노드 두 번 탭 확인용)
  let edge = null;               // 화면 가장자리에서 시작한 손가락 (서랍 열기용)

  const stageEl = () => document.getElementById('stage');
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const dist = (a, b) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  const stageXY = (cx, cy, stage) => { const r = stage.getBoundingClientRect(); return {x: cx - r.left, y: cy - r.top}; };
  const findNode = (id) => S.nodes.find(n => String(n.id) === String(id));

  const fire = (type, x, y, target) => {
    target.dispatchEvent(new MouseEvent(type, {
      bubbles: true, cancelable: true, view: window,
      clientX: x, clientY: y, button: 0, buttons: type === 'mouseup' ? 0 : 1
    }));
  };

  // 두 손가락: 손가락 사이 가운데 점 아래의 그래프 위치를 그대로 두고 확대율만 바꿉니다.
  function startPinch(touches) {
    const stage = stageEl(), [a, b] = touches;
    const m = stageXY((a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2, stage);
    pinch = {
      d0: Math.max(dist(a, b), 1), z0: zoom,
      wx: (stage.scrollLeft + m.x) / zoom + viewMinX,
      wy: (stage.scrollTop + m.y) / zoom + viewMinY
    };
  }
  function movePinch(touches) {
    const stage = stageEl(), [a, b] = touches;
    const m = stageXY((a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2, stage);
    zoom = clamp(pinch.z0 * dist(a, b) / pinch.d0, MIN_ZOOM, MAX_ZOOM);
    render();
    stage.scrollLeft = (pinch.wx - viewMinX) * zoom - m.x;
    stage.scrollTop = (pinch.wy - viewMinY) * zoom - m.y;
  }
  function endPinch() {
    pinch = null;
    busy = true;
    render();
  }

  // 다시 그리기 요청을 한 프레임에 한 번으로 모읍니다.
  let renderQueued = false;
  function scheduleRender() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => { renderQueued = false; render(); });
  }

  // 한 손가락으로 노드를 끌던 중이었다면 지금까지의 위치를 저장하고 다시 그립니다.
  function finishGesture() {
    const g = gesture;
    gesture = null;
    if (g && g.kind === 'node' && g.moved) { save(); render(); }
  }

  // ---------- 서랍 (폰 화면) ----------
  // 위쪽 툴바(header)는 왼쪽 서랍, 하단 패널(aside)은 오른쪽 서랍으로 나옵니다.
  let shade = null;
  function ensureShade() {
    if (!shade) {
      shade = document.createElement('div');
      shade.id = 'drawerShade';
      shade.addEventListener('click', closeDrawers);
      (document.body || document.documentElement).appendChild(shade);
    }
    return shade;
  }
  const drawerEls = () => ({header: document.querySelector('header'), aside: document.querySelector('aside')});
  function isDrawerOpen() {
    const {header, aside} = drawerEls();
    return !!((header && header.classList.contains('drawer-open')) || (aside && aside.classList.contains('drawer-open')));
  }
  function closeDrawers() {
    const {header, aside} = drawerEls();
    if (header) header.classList.remove('drawer-open');
    if (aside) aside.classList.remove('drawer-open');
    if (shade) shade.classList.remove('show');
  }
  function openDrawer(side) {
    const {header, aside} = drawerEls();
    closeDrawers();
    const el = side === 'left' ? header : aside;
    if (!el) return;
    el.classList.add('drawer-open');
    ensureShade().classList.add('show');
  }
  // 노드 편집 칸(하단 패널)을 펼칩니다. 입력칸 커서 위치 지정에도 씁니다.
  function expandPanel() { openDrawer('right'); }

  // 열린 서랍을 밀어서 닫기: 서랍 안에서 시작해 서랍 쪽 가장자리 방향으로 밀면 닫힙니다.
  let drawerClose = null;
  const openSide = () => {
    const {header, aside} = drawerEls();
    if (header && header.classList.contains('drawer-open')) return 'left';
    if (aside && aside.classList.contains('drawer-open')) return 'right';
    return null;
  };

  window.addEventListener('touchstart', (e) => {
    edge = null;
    drawerClose = null;
    const side = openSide();
    if (side && e.touches.length === 1) {
      const el = drawerEls()[side === 'left' ? 'header' : 'aside'];
      if (el && el.contains(e.target)) {
        drawerClose = {side, x0: e.touches[0].clientX, y0: e.touches[0].clientY};
        return;
      }
    }
    // 화면 가장자리에서 시작하면 서랍 열기 동작으로 봅니다. 노드·화면 조작은 하지 않습니다.
    if (e.touches.length === 1 && !isDrawerOpen()) {
      const t = e.touches[0], w = window.innerWidth;
      if (t.clientX <= EDGE_PX) { edge = {side: 'left', x0: t.clientX, y0: t.clientY}; gesture = null; return; }
      if (t.clientX >= w - EDGE_PX) { edge = {side: 'right', x0: t.clientX, y0: t.clientY}; gesture = null; return; }
    }
    if (e.touches.length >= 2) {
      if (!pinch) {
        finishGesture();
        startPinch(e.touches);
      }
      return;
    }
    if (busy || pinch || e.touches.length !== 1) return;
    const t = e.touches[0];
    const target = e.target;
    if (!target || !target.closest || !target.closest('#stage')) { gesture = null; return; }
    const ng = target.closest('[data-node]');
    const stage = stageEl();
    if (ng) {
      const n = findNode(ng.dataset.node);
      if (!n) { gesture = null; return; }
      const p = svgPoint({clientX: t.clientX, clientY: t.clientY});
      gesture = {kind: 'node', el: ng, node: n, dx: p.x - n.x, dy: p.y - n.y,
        x0: t.clientX, y0: t.clientY, moved: false, target};
    } else if (!target.closest('[data-edge]')) {
      gesture = {kind: 'pan', stage, left: stage.scrollLeft, top: stage.scrollTop,
        x0: t.clientX, y0: t.clientY, moved: false, target};
    } else {
      gesture = {kind: 'tap', x0: t.clientX, y0: t.clientY, moved: false, target};
    }
  }, {passive: true});

  window.addEventListener('touchmove', (e) => {
    if (drawerClose) {
      const t = e.touches[0];
      if (!t || e.touches.length !== 1) { drawerClose = null; return; }
      const dx = t.clientX - drawerClose.x0, dy = t.clientY - drawerClose.y0;
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 14) { drawerClose = null; return; }
      if ((drawerClose.side === 'left' && dx < -SWIPE_PX) || (drawerClose.side === 'right' && dx > SWIPE_PX)) {
        closeDrawers();
        drawerClose = null;
      }
      return;
    }
    if (edge) {
      const t = e.touches[0];
      if (!t || e.touches.length !== 1) { edge = null; return; }
      const dx = t.clientX - edge.x0, dy = t.clientY - edge.y0;
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 14) { edge = null; return; }   // 세로로 움직이면 서랍 동작이 아닙니다
      if (edge.side === 'left' && dx > SWIPE_PX) { openDrawer('left'); edge = null; }
      else if (edge.side === 'right' && dx < -SWIPE_PX) { openDrawer('right'); edge = null; }
      return;
    }
    if (pinch) {
      if (e.touches.length >= 2) { e.preventDefault(); movePinch(e.touches); }
      return;
    }
    if (!gesture) return;
    // 움직이기 전부터 막습니다. 그래야 브라우저가 스크롤을 가져가 touchcancel이 오지 않습니다.
    e.preventDefault();
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    if (!gesture.moved && Math.hypot(t.clientX - gesture.x0, t.clientY - gesture.y0) < MOVE_SLOP) return;
    gesture.moved = true;
    if (gesture.kind === 'node') {
      const p = svgPoint({clientX: t.clientX, clientY: t.clientY});
      gesture.node.x = Math.max(0, p.x - gesture.dx);
      gesture.node.y = Math.max(0, p.y - gesture.dy);
      // PC 편집기처럼 끄는 동안 화살표까지 다시 그립니다. 프레임마다 한 번만 그려서 부드럽게 합니다.
      scheduleRender();
    } else if (gesture.kind === 'pan') {
      gesture.stage.scrollLeft = gesture.left - (t.clientX - gesture.x0);
      gesture.stage.scrollTop = gesture.top - (t.clientY - gesture.y0);
    }
  }, {passive: false});

  window.addEventListener('touchend', (e) => {
    edge = null;
    drawerClose = null;
    if (pinch) {
      if (e.touches.length < 2) endPinch();
      if (e.touches.length === 0) busy = false;
      return;
    }
    if (e.touches.length === 0) busy = false;
    if (busy) return;
    const g = gesture;
    if (!g || e.touches.length > 0) { gesture = null; return; }
    gesture = null;
    e.preventDefault();          // 손을 뗀 뒤 브라우저가 따로 만드는 클릭을 막습니다.
    const t = e.changedTouches[0];
    if (g.moved && g.kind === 'node') {
      save();                    // 새 위치 저장 (실행 취소 기록 포함)
      render();                  // 화살표와 화면 전체를 다시 그립니다
      return;
    }
    if (g.moved) return;         // 화면 밀기 끝
    // 빈 곳 두 번 탭: 노드 추가 (PC의 더블클릭과 같습니다)
    if (g.kind === 'pan') {
      const now = Date.now();
      if (lastTap && now - lastTap.at < DOUBLE_TAP_MS && Math.hypot(t.clientX - lastTap.x, t.clientY - lastTap.y) < DOUBLE_TAP_PX) {
        lastTap = null;
        svg.dispatchEvent(new MouseEvent('dblclick', {bubbles: true, cancelable: true, view: window,
          clientX: t.clientX, clientY: t.clientY}));
        return;
      }
      lastTap = {at: now, x: t.clientX, y: t.clientY};
    } else {
      lastTap = null;
    }
    // 탭: 원래 마우스 흐름을 실행합니다. 이 시점에는 아직 그래프를 다시 그리지 않았으므로 대상이 남아 있습니다.
    const wasPending = !!pendingConnectionSource;   // 연결 모드에서 누른 탭이면 입력칸으로 가지 않습니다.
    fire('mousedown', t.clientX, t.clientY, g.target);
    fire('mouseup', t.clientX, t.clientY, window);
    // 노드를 한 번 탭하면 선택만 합니다. 같은 노드를 빠르게 두 번 탭하면 패널을 펼치고 제목·메모 칸에 커서를 둡니다.
    if (g.kind === 'node' && !wasPending) {
      const now = Date.now();
      const isDouble = !!lastNodeTap && lastNodeTap.id === g.node.id && now - lastNodeTap.at < DOUBLE_TAP_MS &&
        Math.hypot(t.clientX - lastNodeTap.x, t.clientY - lastNodeTap.y) < DOUBLE_TAP_PX;
      lastNodeTap = isDouble ? null : {id: g.node.id, at: now, x: t.clientX, y: t.clientY};
      if (isDouble) {
        const field = nodeFieldAt(g.node, t);
        if (field) focusNodeField(field);
        else expandPanel();
      }
    }
  }, {passive: false});

  // 노드 안의 위치(상자 기준)로 제목(title)·메모(memo) 자리를 나눕니다. index.html의 render()와 같은 배치입니다.
  function nodeFieldAt(n, t) {
    const p = svgPoint({clientX: t.clientX, clientY: t.clientY});
    const x = p.x - n.x, y = p.y - n.y;
    const D = dims();
    if (S.settings.shape === 'circle') {
      if (x < 0 || x > D.w || y < 0 || y > D.h) return null;
      if (y < D.h / 2) return 'title';
      return y < D.h / 2 + 28 ? 'memo' : null;
    }
    if (x < 0 || x > D.w || y < 0 || y > D.h) return null;
    if (y < 46) return 'title';          // 제목 줄 (22, 39 근처)
    if (y < 70) return 'memo';           // 메모 줄 (58 근처)
    return null;                         // 상태 표시 등 나머지 자리
  }

  // 패널을 펼치고 해당 입력칸에 커서를 둡니다.
  function focusNodeField(field) {
    setTimeout(() => {
      expandPanel();
      const el = document.getElementById(field === 'title' ? 'f_title' : 'f_memo');
      if (!el) return;
      el.focus();
      try { el.setSelectionRange(el.value.length, el.value.length); } catch (e) { /* 일부 입력칸은 커서 위치를 지원하지 않습니다 */ }
      el.scrollIntoView({block: 'center'});
    }, 0);
  }

  // 화살표 연결 버튼: PC의 Shift+클릭을 손가락용으로 바꾼 것입니다.
  // 노드를 선택하면 버튼이 나타나고, 누르면 연결 모드가 켜집니다. 다음에 탭하는 노드가 결과 노드가 됩니다.
  // 연결 모드 상태는 index.html의 pendingConnectionSource를 그대로 씁니다 (PC 메뉴의 "여기서 화살표 연결"과 같은 동작).
  const connectBtn = document.createElement('button');
  connectBtn.id = 'touchConnectBtn';
  connectBtn.type = 'button';
  connectBtn.textContent = '화살표 연결';
  connectBtn.style.cssText = 'display:none;position:fixed;right:14px;bottom:14px;z-index:60;padding:12px 16px;' +
    'border:0;border-radius:24px;background:#2d6cdf;color:#fff;font:inherit;font-size:15px;box-shadow:0 4px 14px #0003;';
  (document.body || document.documentElement).appendChild(connectBtn);

  connectBtn.addEventListener('click', () => {
    if (pendingConnectionSource) {
      pendingConnectionSource = null;
      setFstat('화살표 연결을 취소했습니다.');
    } else if (sel.type === 'node' && sel.id != null) {
      pendingConnectionSource = sel.id;
      setFstat('연결할 결과 노드를 탭하세요. 이 버튼을 다시 누르면 취소됩니다.');
    }
    updateConnectBtn();
  });

  let shownConnect = null;
  function updateConnectBtn() {
    const want = pendingConnectionSource ? 'cancel' : (sel.type === 'node' && sel.id != null ? 'connect' : 'hide');
    if (want === shownConnect) return;
    shownConnect = want;
    connectBtn.style.display = want === 'hide' ? 'none' : 'block';
    connectBtn.textContent = want === 'cancel' ? '연결 취소' : '화살표 연결';
    connectBtn.style.background = want === 'cancel' ? '#8a8f98' : '#2d6cdf';
  }
  setInterval(updateConnectBtn, 250);

  window.addEventListener('touchcancel', (e) => {
    gesture = null;
    edge = null;
    drawerClose = null;
    if (pinch && e.touches.length < 2) endPinch();
    if (e.touches.length === 0) busy = false;
  }, {passive: true});
})();
