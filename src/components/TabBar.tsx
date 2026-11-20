import { NavLink } from 'react-router'
import { PixelSprite } from './pixel/PixelSprite'

const TABS = [
  { to: '/', label: '마을', icon: 'i_home', end: true },
  { to: '/library', label: '서재', icon: 'i_book', end: false },
  { to: '/collection', label: '수집', icon: 'i_star', end: false },
  { to: '/my', label: '내 정보', icon: 'i_person', end: false },
] as const

/** 하단 탭바 (목업 .tabbar) */
export function TabBar() {
  return (
    <nav className="tabbar" aria-label="주요 메뉴">
      {TABS.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => (isActive ? 'tab on' : 'tab')}>
          <PixelSprite name={t.icon} scale={3} />
          <span>{t.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
