// 체험 계정 선택은 로그아웃 전까지 이 브라우저에 유지한다. 독서 기록은 서버(mock DB)에 유지한다.
const KEY = 'rf-demo-account'

function read() {
  try { return localStorage.getItem(KEY) === '1' } catch { return false }
}

let selected = read()

export const hasSelectedAccount = () => selected
export const selectDemoAccount = () => {
  selected = true
  try { localStorage.setItem(KEY, '1') } catch { /* 저장소를 쓸 수 없으면 이번 방문 동안만 유지 */ }
}
export const signOutDemoAccount = () => {
  selected = false
  try { localStorage.removeItem(KEY) } catch { /* 위와 같음 */ }
}
