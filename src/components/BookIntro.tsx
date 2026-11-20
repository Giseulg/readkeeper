import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from 'react'
import './bookIntro.css'

/** 같은 탭 세션에서 한 번만 재생. ?intro=1 이면 강제 재생(확인용) */
const SEEN_KEY = 'rf-intro-seen'
/** 표지 열림 → 종이 넘김 → 마지막 쪽 머무름 → 사라짐 (bookIntro.css 타이밍과 맞춤) */
const FULL_MS = 4100
const REDUCED_MS = 2600
const EXIT_MS = 320
const SHEETS = 1

/** 책 속 글. 모든 쪽에 같은 글을 채움 */
const PAGE_TEXT =
  '정보의 편재에도 불구하고 의미의 내면화가 유예되는 현대에, 텍스트는 이해의 대상이기보다 신속히 통과해야 할 표면으로 경험된다. ' +
  '이때 읽기의 곤란은 단순한 능력의 결핍이 아니라, 사유가 머무를 시간을 허락하지 않는 환경과 주체 사이의 긴장으로 고찰될 수 있다. ' +
  '재미읽게는 이러한 문제의식 아래, 흩어진 내용을 회상하고 그 관계를 탐색하며 자신의 이해를 다시 구성하는 과정을 통해, ' +
  '읽기가 지닌 능동적이고도 유희적인 가능성을 복원하고자 한다.'

/** 글이 쪽을 빼곡히 채우도록 넘치지 않는 가장 큰 글자 크기를 찾아 --bi-fs 로 지정 */
function useFitText(root: RefObject<HTMLDivElement | null>, probe: RefObject<HTMLDivElement | null>, active: boolean) {
  useLayoutEffect(() => {
    if (!active) return
    const fit = () => {
      const el = probe.current
      const host = root.current
      if (!el || !host) return
      let lo = 12
      let hi = 44
      while (hi - lo > 0.5) {
        const mid = (lo + hi) / 2
        host.style.setProperty('--bi-fs', `${mid}px`)
        if (el.scrollHeight <= el.clientHeight && el.scrollWidth <= el.clientWidth) lo = mid
        else hi = mid
      }
      host.style.setProperty('--bi-fs', `${lo}px`)
    }
    fit()
    document.fonts?.ready.then(fit)
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [root, probe, active])
}

function shouldPlay() {
  try {
    if (new URLSearchParams(window.location.search).get('intro') === '1') return true
    return sessionStorage.getItem(SEEN_KEY) !== '1'
  } catch {
    return true
  }
}

function markSeen() {
  try {
    sessionStorage.setItem(SEEN_KEY, '1')
  } catch {
    /* 저장 불가 환경은 매번 재생 */
  }
}

/**
 * 앱 첫 진입 인트로: 화면 전체 크기 가죽 표지가 열리고 글이 빼곡한 종이가 몇 장 넘어간 뒤 화면(로그인 등)이 드러남.
 * 화면은 뒤에서 먼저 렌더되므로 인트로가 로딩을 막지 않음. 탭·키 입력으로 건너뜀.
 */
export function BookIntro() {
  const [phase, setPhase] = useState<'play' | 'exit' | 'done'>(() => (shouldPlay() ? 'play' : 'done'))

  const rootRef = useRef<HTMLDivElement>(null)
  const probeRef = useRef<HTMLDivElement>(null)
  useFitText(rootRef, probeRef, phase !== 'done')

  const skip = useCallback(() => setPhase((p) => (p === 'play' ? 'exit' : p)), [])

  useEffect(() => {
    if (phase === 'done') return
    markSeen()
    if (phase === 'exit') {
      const t = window.setTimeout(() => setPhase('done'), EXIT_MS)
      return () => window.clearTimeout(t)
    }
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const t = window.setTimeout(() => setPhase('done'), reduced ? REDUCED_MS : FULL_MS)
    const onKey = () => skip()
    window.addEventListener('keydown', onKey)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener('keydown', onKey)
    }
  }, [phase, skip])

  if (phase === 'done') return null

  return (
    <div
      ref={rootRef}
      className={`book-intro${phase === 'exit' ? ' is-exit' : ''}`}
      role="presentation"
      onPointerDown={skip}
    >
      <div className="bi-stage" aria-hidden="true">
        <div className="bi-book">
          <div className="bi-page">
            <div ref={probeRef} className="bi-text">{PAGE_TEXT}</div>
          </div>
          {Array.from({ length: SHEETS }, (_, i) => (
            <div key={i} className="bi-sheet" style={{ '--i': i } as CSSProperties}>
              <div className="bi-face bi-front">
                <div className="bi-text">{PAGE_TEXT}</div>
              </div>
              <div className="bi-face bi-back" />
            </div>
          ))}
          <div className="bi-cover">
            <div className="bi-face bi-front">
              <span className="bi-frame">
                <span className="bi-rule" />
                <span className="bi-title">읽기의 재미</span>
                <span className="bi-rule" />
              </span>
            </div>
            <div className="bi-face bi-back" />
          </div>
        </div>
      </div>
      <button type="button" className="bi-skip" onClick={skip}>
        건너뛰기
      </button>
    </div>
  )
}
