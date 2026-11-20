import { useLayoutEffect, useSyncExternalStore } from 'react'
import type { LayoutMode } from '@/domain/types'
import { useSettings } from './queries'

/** 자동 모드에서 태블릿 배치로 바꾸는 폭 */
export const TABLET_QUERY = '(min-width: 768px)'
/** 가로 태블릿 폭: Reader 2단 등 */
export const WIDE_QUERY = '(min-width: 1024px)'

const MODE_CACHE = 'rf-layout-mode'

export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(query)
      mq.addEventListener('change', onChange)
      return () => mq.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}

function cachedMode(): LayoutMode {
  try {
    const v = localStorage.getItem(MODE_CACHE)
    return v === 'mobile' || v === 'tablet' ? v : 'auto'
  } catch {
    return 'auto'
  }
}

/**
 * 실제 적용 중인 배치. 설정(4.3 화면 모드)이 자동이면 화면 폭으로 정함.
 * tablet: 세로 레일·넓은 배치 / wide: tablet 이면서 가로 폭 1024px 이상(Reader 2단)
 */
export function useLayout() {
  const { data } = useSettings()
  const mode = data?.display.layout ?? cachedMode()
  const tabletWidth = useMediaQuery(TABLET_QUERY)
  const wideWidth = useMediaQuery(WIDE_QUERY)
  const tablet = mode === 'tablet' || (mode === 'auto' && tabletWidth)
  return { mode, tablet, wide: tablet && wideWidth, roomy: tablet && tabletWidth }
}

/**
 * 적용 배치를 <html data-tablet data-wide> 로 반영. tablet.css 가 이 속성을 기준으로 덮어씀.
 * 앱 최상단에서 한 번만 렌더함.
 */
export function LayoutModeSync() {
  const { mode, tablet, wide } = useLayout()
  useLayoutEffect(() => {
    const el = document.documentElement
    el.toggleAttribute('data-tablet', tablet)
    el.toggleAttribute('data-wide', wide)
    try {
      localStorage.setItem(MODE_CACHE, mode)
    } catch {
      /* 저장 불가 환경은 무시 */
    }
  }, [mode, tablet, wide])
  return null
}

/** 서재 책장 열 수: 모바일 3 · 태블릿 5 · 가로 태블릿 6 (좁은 화면에서 태블릿 강제 시 3) */
export function useShelfColumns() {
  const { roomy, wide } = useLayout()
  return wide ? 6 : roomy ? 5 : 3
}
