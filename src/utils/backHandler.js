// 하드웨어 뒤로가기를 모달 등 오버레이가 먼저 처리하게 하는 스택.
//
// Capacitor는 backButton 이벤트를 등록된 모든 리스너에 동시에 보내고 우선순위가 없어서,
// 모달이 자기 리스너를 따로 달면 App.jsx 리스너의 navigate(-1)도 함께 실행된다.
// 대신 App.jsx 리스너가 가장 먼저 closeTopOverlay()를 부르고, 열린 오버레이가 있으면
// 그것만 닫은 뒤 끝낸다. 등록된 게 없으면 false를 반환해 기존 동작이 그대로 이어진다.

const handlers = []

/** 오버레이가 열릴 때 닫기 함수를 등록한다. 반환값(해제 함수)을 닫힐 때 호출할 것. */
export function registerBackHandler(fn) {
  handlers.push(fn)
  return () => {
    const i = handlers.lastIndexOf(fn)
    if (i !== -1) handlers.splice(i, 1)
  }
}

/** 가장 나중에 열린 오버레이를 닫는다. 닫았으면 true, 열린 게 없으면 false. */
export function closeTopOverlay() {
  const top = handlers[handlers.length - 1]
  if (!top) return false
  top()
  return true
}
