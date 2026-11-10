// 터치 조작 어댑터 (안드로이드 전용). PC 화면과 index.html은 바꾸지 않습니다.
//
// 문제: 편집기는 마우스 이벤트로 노드를 끌 때마다 그래프 전체를 다시 그립니다. 그러면 터치가 시작된 요소가
// 화면에서 사라지고, 손가락 이동 이벤트가 앱에 전달되지 않습니다.
// 해결: 터치 중에는 다시 그리지 않습니다.
//  - 노드 끌기: 노드 요소의 위치(transform)만 바꿔서 따라가게 하고, 손을 떼면 저장하고 다시 그립니다.
//  - 화면 밀기: 그래프 영역의 스크롤 위치만 바꿉니다.
//  - 탭(움직임 없이 뗌): 원래 마우스 클릭 흐름(선택, 화살표 연결 등)을 그대로 실행합니다.
(function () {
  const MOVE_SLOP = 10;          // 이 거리(px)보다 적게 움직이면 탭으로 봅니다.
  let gesture = null;            // 현재 손가락 동작 정보

  const fire = (type, x, y, target) => {
    target.dispatchEvent(new MouseEvent(type, {
      bubbles: true, cancelable: true, view: window,
      clientX: x, clientY: y, button: 0, buttons: type === 'mouseup' ? 0 : 1
    }));
  };

  const findNode = (id) => S.nodes.find(n => String(n.id) === String(id));

  const onStart = (e) => {
    gesture = null;
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    const target = e.target;
    if (!target || !target.closest || !target.closest('#stage')) return;
    const ng = target.closest('[data-node]');
    const stage = document.getElementById('stage');
    if (ng) {
      const n = findNode(ng.dataset.node);
      if (!n) return;
      const p = svgPoint({clientX: t.clientX, clientY: t.clientY});
      gesture = {kind: 'node', el: ng, node: n, dx: p.x - n.x, dy: p.y - n.y,
        x0: t.clientX, y0: t.clientY, moved: false, target, t0: t};
    } else if (!target.closest('[data-edge]')) {
      gesture = {kind: 'pan', stage, left: stage.scrollLeft, top: stage.scrollTop,
        x0: t.clientX, y0: t.clientY, moved: false, target, t0: t};
    } else {
      gesture = {kind: 'tap', x0: t.clientX, y0: t.clientY, moved: false, target, t0: t};
    }
  };

  const onMove = (e) => {
    if (!gesture) return;
    if (e.touches.length !== 1) { gesture = null; return; }
    const t = e.touches[0];
    const dist = Math.hypot(t.clientX - gesture.x0, t.clientY - gesture.y0);
    if (!gesture.moved && dist < MOVE_SLOP) return;
    e.preventDefault();          // 화면이 같이 스크롤되는 것을 막습니다.
    gesture.moved = true;
    if (gesture.kind === 'node') {
      const p = svgPoint({clientX: t.clientX, clientY: t.clientY});
      gesture.node.x = Math.max(0, p.x - gesture.dx);
      gesture.node.y = Math.max(0, p.y - gesture.dy);
      gesture.el.setAttribute('transform', `translate(${gesture.node.x},${gesture.node.y})`);
    } else if (gesture.kind === 'pan') {
      gesture.stage.scrollLeft = gesture.left - (t.clientX - gesture.x0);
      gesture.stage.scrollTop = gesture.top - (t.clientY - gesture.y0);
    }
  };

  const onEnd = (e) => {
    const g = gesture;
    gesture = null;
    if (!g) return;
    const t = e.changedTouches[0];
    e.preventDefault();          // 손을 뗀 뒤 브라우저가 따로 만드는 클릭을 막습니다.
    if (g.moved && g.kind === 'node') {
      save();                    // 새 위치 저장 (실행 취소 기록 포함)
      render();                  // 화살표와 화면 전체를 다시 그립니다
      return;
    }
    if (g.moved && g.kind === 'pan') return;
    // 탭: 원래 마우스 흐름을 실행합니다. 이 시점에는 아직 그래프를 다시 그리지 않았으므로 대상이 남아 있습니다.
    fire('mousedown', t.clientX, t.clientY, g.target);
    fire('mouseup', t.clientX, t.clientY, window);
  };

  const onCancel = () => { gesture = null; };

  window.addEventListener('touchstart', onStart, {passive: true});
  window.addEventListener('touchmove', onMove, {passive: false});
  window.addEventListener('touchend', onEnd, {passive: false});
  window.addEventListener('touchcancel', onCancel, {passive: true});
})();
