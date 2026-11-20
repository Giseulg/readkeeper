import { Outlet } from 'react-router'
import { AppBar } from '@/components/AppBar'
import { TabBar } from '@/components/TabBar'

/** 탭바 노출 화면: 각 탭의 1단계 화면 */
export function TabLayout() {
  return (
    <div className="app-shell">
      <AppBar />
      <main className="app-content">
        <Outlet />
      </main>
      <TabBar />
    </div>
  )
}
