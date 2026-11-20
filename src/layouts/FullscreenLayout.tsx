import { Outlet } from 'react-router'

/** 탭바 숨김 화면: 관계도·퀴즈·메모·온보딩 (Reader는 화면 안에서 TabBar 직접 표시). 상단 바는 각 화면이 SubBar로 구성 */
export function FullscreenLayout() {
  return (
    <div className="app-shell">
      <Outlet />
    </div>
  )
}
