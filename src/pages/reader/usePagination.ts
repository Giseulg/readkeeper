import { useCallback, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from 'react'
import { compareLocation } from '@/domain/location'
import type { ReadingLocation } from '@/domain/types'

/** 기준 위치: 문단 또는 표지 */
export type PageAnchor = ReadingLocation | 'cover'

interface Geom {
  /** 한 쪽 폭 = 단 폭 + 단 간격 = 본문 영역 폭 */
  pageW: number
  colW: number
  gap: number
  pageH: number
}

interface Span {
  loc: ReadingLocation
  /** 문단이 시작·끝나는 쪽 (한 문단이 두 쪽에 걸칠 수 있음) */
  start: number
  end: number
}

interface Options {
  enabled: boolean
  /** 한 줄 길이 제한(태블릿 680px). 남는 폭은 양옆 여백 */
  maxCol: number
  /** 바뀌면 쪽 나눔을 다시 잼: 본문·글자 크기·줄 간격 등 */
  relayoutKey: string
  /** 처음 펼칠 때·모드를 바꿀 때 보여 줄 위치 */
  initial: PageAnchor | null
}

const SIDE = 16
/** 위 여백, 아래 여백(쪽 넘김 막대·더보기 버튼 자리) */
const PAD_T = 12
const PAD_B = 76

/**
 * 페이지 넘김 모드. 본문을 CSS 다단(column)으로 화면 폭마다 한 단씩 흘리고,
 * scrollLeft 를 쪽 폭 단위로 옮김. 문단 id(p-장-문단)는 스크롤 모드와 같아서
 * 문단 선택·메모·여기까지 읽음 흐름은 그대로 씀.
 */
export function usePagination(mainRef: RefObject<HTMLElement | null>, { enabled, maxCol, relayoutKey, initial }: Options) {
  const [geom, setGeom] = useState<Geom | null>(null)
  const [page, setPage] = useState(0)
  const [pages, setPages] = useState(1)
  const [tick, setTick] = useState(0)
  const spans = useRef<Span[]>([])
  const anchor = useRef<PageAnchor | null>(null)
  const initialRef = useRef(initial)
  useLayoutEffect(() => {
    initialRef.current = initial
  })

  // 1. 본문 영역 크기 → 단 폭·간격
  useLayoutEffect(() => {
    const el = mainRef.current
    if (!enabled || !el) {
      anchor.current = null
      setGeom(null)
      return
    }
    el.scrollTop = 0
    const measure = () => {
      const pageW = el.clientWidth
      const pageH = Math.floor(el.clientHeight - PAD_T - PAD_B)
      const colW = Math.min(maxCol, pageW - SIDE * 2)
      setGeom((g) => (g && g.pageW === pageW && g.pageH === pageH && g.colW === colW ? g : { pageW, colW, gap: pageW - colW, pageH }))
      setTick((t) => t + 1)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    let alive = true
    document.fonts?.ready.then(() => alive && measure())
    return () => {
      alive = false
      ro.disconnect()
    }
  }, [enabled, maxCol, mainRef])

  // 2. 문단별 쪽 번호 측정 → 기준 위치가 있는 쪽으로 이동
  useLayoutEffect(() => {
    const el = mainRef.current
    if (!enabled || !el || !geom) return
    const base = el.getBoundingClientRect().left - el.scrollLeft
    const pageOf = (x: number) => Math.max(0, Math.floor((x - base) / geom.pageW))
    const list: Span[] = []
    let maxRight = 0
    el.querySelectorAll<HTMLElement>('p[id^="p-"]').forEach((p) => {
      const rects = p.getClientRects()
      if (!rects.length) return
      const [, c, para] = p.id.split('-').map(Number)
      const last = rects[rects.length - 1]
      list.push({ loc: { chapter: c, paragraph: para }, start: pageOf(rects[0].left + 1), end: pageOf(last.left + 1) })
      maxRight = Math.max(maxRight, last.right - base)
    })
    spans.current = list
    const n = Math.max(1, Math.ceil(maxRight / geom.pageW))
    const a = anchor.current ?? initialRef.current
    let target = 0
    if (a && a !== 'cover') {
      const hit = list.find((s) => compareLocation(s.loc, a) === 0) ?? list.find((s) => compareLocation(s.loc, a) > 0)
      target = hit?.start ?? 0
    }
    if (list.length) anchor.current = a
    const p = Math.min(target, n - 1)
    setPages(n)
    setPage(p)
    el.scrollLeft = p * geom.pageW
  }, [enabled, geom, relayoutKey, tick, mainRef])

  /** 이 쪽의 기준 문단: 이 쪽에서 시작하는 첫 문단, 없으면 앞 쪽에서 이어지는 문단 */
  const firstOn = useCallback(
    (n: number) => (spans.current.find((s) => s.start === n) ?? spans.current.find((s) => s.start <= n && s.end >= n))?.loc ?? null,
    [],
  )

  /** 이 쪽에서 끝까지 보인 마지막 문단 */
  const lastOn = useCallback(
    (n: number) => [...spans.current].reverse().find((span) => span.end === n)?.loc ?? null,
    [],
  )

  const goToPage = useCallback(
    (n: number, smooth = true) => {
      const el = mainRef.current
      if (!el || !geom) return
      const p = Math.max(0, Math.min(pages - 1, n))
      anchor.current = firstOn(p) ?? 'cover'
      setPage(p)
      el.scrollTo({ left: p * geom.pageW, behavior: smooth ? 'smooth' : 'auto' })
    },
    [geom, pages, firstOn, mainRef],
  )

  const goToLoc = useCallback(
    (loc: PageAnchor) => {
      if (loc === 'cover') return goToPage(0, false)
      const hit = spans.current.find((s) => compareLocation(s.loc, loc) === 0)
      if (hit) goToPage(hit.start, false)
    },
    [goToPage],
  )

  const style: CSSProperties | undefined =
    enabled && geom
      ? ({
          columnWidth: geom.colW,
          columnGap: geom.gap,
          paddingLeft: geom.gap / 2,
          paddingRight: geom.gap / 2,
          paddingTop: PAD_T,
          paddingBottom: PAD_B,
          '--page-h': `${geom.pageH}px`,
        } as CSSProperties)
      : undefined

  return { page, pages, style, ready: enabled && !!geom, firstOn, lastOn, goToPage, goToLoc }
}
