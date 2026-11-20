import { ANALYSIS_LABEL } from '@/domain/labels'
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { PixelSprite } from '@/components/pixel/PixelSprite'
import { QueryState } from '@/components/QueryState'
import { SubBar } from '@/components/SubBar'
import { TabBar } from '@/components/TabBar'
import { Button } from '@/components/ui'
import { compareLocation, formatLocation, paragraphAt, parseLocation, percentAt } from '@/domain/location'
import { MOCK_MODE } from '@/appMode'
import type { Memo, Quote, ReadingLocation, ReadingMode } from '@/domain/types'
import { useBook, useBookContent, useConfirmRead, useDueReviews, useMemos, useSaveCurrent, useSettings, useUpdateSettings } from '@/hooks/queries'
import { BookCover } from './BookCover'
import { PageNav } from './PageNav'
import { usePagination, type PageAnchor } from './usePagination'
import { MemoSheet } from './MemoSheet'
import { ReaderMoreMenu, type MoreItem } from './ReaderMoreMenu'
import { ReaderProgress } from './ReaderProgress'
import { ReaderSettingsSheet } from './ReaderSettingsSheet'
import { RecallSheet } from './RecallSheet'
import { ReviewModal } from './ReviewModal'
import { ReaderSidePanel } from './ReaderSidePanel'
import { TocSheet } from './TocSheet'
import { useLayout } from '@/hooks/useMediaQuery'

type Panel = 'memo' | 'clue' | 'settings' | 'toc' | null

const THEME_STYLE: Record<string, CSSProperties> = {
  parchment: { background: 'var(--parch-l)', color: 'var(--ink)' },
  light: { background: '#ffffff', color: '#1e1e1e' },
  dark: { background: '#2a1a10', color: 'var(--sand)' },
}

const pid = (l: ReadingLocation) => `p-${l.chapter}-${l.paragraph}`
const recallKey = (bookId: string) => `rf-recall-shown-${bookId}`

/** 2.5 Reader. ?loc= 가 바뀌면 해당 위치로 다시 열리도록 key 로 재마운트 */
export function ReaderPage() {
  const { bookId = '' } = useParams()
  const [params] = useSearchParams()
  const loc = params.get('loc')
  return <ReaderView key={`${bookId}:${loc ?? ''}`} bookId={bookId} jumpTo={parseLocation(loc)} />
}

function readRecallSeen(bookId: string) {
  try {
    return !!sessionStorage.getItem(recallKey(bookId))
  } catch {
    return false
  }
}

/** 진도(확정/현재 구분), 문단 선택, 여기까지 읽음, 2.5a~d */
function ReaderView({ bookId, jumpTo }: { bookId: string; jumpTo?: ReadingLocation }) {
  const navigate = useNavigate()
  const book = useBook(bookId)
  const content = useBookContent(bookId)
  const settings = useSettings()
  const memos = useMemos(bookId)
  const confirm = useConfirmRead(bookId)
  const saveCurrent = useSaveCurrent(bookId)
  const due = useDueReviews(bookId)

  const [selected, setSelected] = useState<ReadingLocation | null>(jumpTo ?? null)
  /** 하단 액션(단서·여기까지 읽음 등)은 기본 닫힘, 토글 버튼으로 엶 */
  const [footOpen, setFootOpen] = useState(false)
  const [selText, setSelText] = useState<{ loc: ReadingLocation; text: string } | null>(null)
  const [scrollEnd, setScrollEnd] = useState<ReadingLocation | null>(null)
  const [visible, setVisible] = useState<ReadingLocation | null>(null)
  const [panel, setPanel] = useState<Panel>(null)
  const [recallSeen] = useState(() => readRecallSeen(bookId))
  const [recallDone, setRecallDone] = useState(false)
  const [review, setReview] = useState<Memo | null>(null)
  const [newClue, setNewClue] = useState<string | null>(null)
  const mainRef = useRef<HTMLElement>(null)
  const { wide, tablet } = useLayout()
  const updateSettings = useUpdateSettings()

  const reader = settings.data?.reader
  const mode: ReadingMode = reader?.mode ?? 'scroll'
  const pageMode = mode === 'page'

  const start = jumpTo ?? book.data?.progress.current
  // 아직 읽기 전이면 표지부터, 이어 읽기·원문 위치 이동이면 해당 문단부터
  const fromCover = !jumpTo && !!book.data && book.data.progress.percent === 0 && compareLocation(book.data.progress.current, { chapter: 0, paragraph: 0 }) === 0
  const confirmed = book.data?.progress.confirmed

  const pager = usePagination(mainRef, {
    enabled: pageMode && !!settings.data,
    maxCol: tablet ? 680 : Infinity,
    relayoutKey: `${content.data ? 1 : 0}:${book.data ? 1 : 0}:${reader?.fontSize}:${reader?.lineHeight}`,
    initial: visible ?? (fromCover ? 'cover' : (start ?? null)),
  })
  const onCover = pageMode && pager.ready && pager.page === 0 && !pager.firstOn(0)
  const pageLoc = pageMode && pager.ready ? pager.firstOn(pager.page) : null
  const current = (pageMode ? pageLoc ?? visible : scrollEnd ?? visible) ?? start ?? null

  // 첫 진입(스크롤 모드): 지정 위치(또는 마지막 위치)로 스크롤. 읽기 전이면 표지에 머묾
  const scrolled = useRef(false)
  useEffect(() => {
    if (pageMode || scrolled.current || !start || !content.data || !book.data) return
    scrolled.current = true
    if (fromCover) return
    document.getElementById(pid(start))?.scrollIntoView({ block: jumpTo ? 'center' : 'start' })
  }, [content.data, book.data, start, pageMode]) // eslint-disable-line react-hooks/exhaustive-deps

  // 페이지 모드에서 넘긴 위치를 현재 위치로 기억 → 스크롤로 바꿔도 같은 문단에서 이어짐
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- 쪽 측정(레이아웃) 결과를 위치 상태로 옮김
    if (pageLoc) setVisible(pageLoc)
  }, [pageLoc?.chapter, pageLoc?.paragraph]) // eslint-disable-line react-hooks/exhaustive-deps

  // 페이지 → 스크롤 전환: 보던 문단으로 스크롤
  const prevMode = useRef(mode)
  useEffect(() => {
    if (prevMode.current === mode) return
    prevMode.current = mode
    scrolled.current = true
    if (mode === 'scroll' && current) requestAnimationFrame(() => document.getElementById(pid(current))?.scrollIntoView({ block: 'start' }))
  }, [mode]) // eslint-disable-line react-hooks/exhaustive-deps

  // 2.5a: 재개 시 세션당 1회 회상 질문 제안 (원문 위치로 바로 온 경우·읽기 전 제외)
  const showRecall =
    !recallSeen && !recallDone && !jumpTo && !!book.data && book.data.progress.percent > 0 && !!settings.data?.learning.recallPrompt

  // 현재 위치 추적: 화면 위쪽에 걸친 첫 문단
  useEffect(() => {
    const root = mainRef.current
    if (!root || !content.data || pageMode) return
    const io = new IntersectionObserver(
      (entries) => {
        const top = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        if (!top) return
        const [, c, p] = top.target.id.split('-').map(Number)
        setVisible({ chapter: c, paragraph: p })
      },
      { root, rootMargin: '0px 0px -70% 0px' },
    )
    root.querySelectorAll('p[id^="p-"]').forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [content.data, pageMode])

  const [readThrough, setReadThrough] = useState<ReadingLocation | null>(null)
  const allowAutoProgress = !jumpTo || (jumpTo.chapter === 0 && jumpTo.paragraph === 0)
  const savedThrough = useRef<ReadingLocation | null>(null)

  // Only mark a continuous range. Opening a distant reference does not count.
  useEffect(() => {
    const root = mainRef.current
    if (!root || !content.data || pageMode || !allowAutoProgress || !confirmed) return
    const paragraphs = [...root.querySelectorAll<HTMLElement>('p[id^="p-"]')].map((element) => {
      const [, chapter, paragraph] = element.id.split('-').map(Number)
      return { element, loc: { chapter, paragraph } }
    })
    let frame = 0
    let previousTop = root.scrollTop
    const measure = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const view = root.getBoundingClientRect()
        const traveled = Math.max(0, root.scrollTop - previousTop)
        previousTop = root.scrollTop
        const atBottom = root.scrollHeight - root.clientHeight - root.scrollTop <= 2
        setScrollEnd(atBottom ? paragraphs[paragraphs.length - 1]?.loc ?? null : null)
        setReadThrough((previous) => {
          let next = previous && compareLocation(previous, confirmed) > 0 ? previous : confirmed
          let changed = false
          for (const { element, loc } of paragraphs) {
            if (compareLocation(loc, next) <= 0) continue
            const rect = element.getBoundingClientRect()
            if (rect.bottom < view.top - traveled - 1 || rect.bottom > view.bottom + 1) break
            next = loc
            changed = true
          }
          return changed ? next : previous
        })
      })
    }
    root.addEventListener('scroll', measure, { passive: true })
    return () => {
      root.removeEventListener('scroll', measure)
      cancelAnimationFrame(frame)
    }
  }, [allowAutoProgress, confirmed, content.data, pageMode])

  const saveReadThrough = confirm.mutate
  useEffect(() => {
    if (!allowAutoProgress || !readThrough || !confirmed || compareLocation(readThrough, confirmed) <= 0 ||
        (savedThrough.current && compareLocation(readThrough, savedThrough.current) <= 0)) return
    const timer = window.setTimeout(() => {
      savedThrough.current = readThrough
      setRecallDone(true)
      saveReadThrough(readThrough, { onError: () => { savedThrough.current = null } })
    }, 180)
    return () => window.clearTimeout(timer)
  }, [allowAutoProgress, confirmed, readThrough, saveReadThrough])

  // 페이지 모드: 화면 양옆 누르기·옆으로 밀기·방향키로 넘김. 가운데 누르기는 문단 선택
  const swipe = useRef<{ x: number; y: number } | null>(null)
  const turn = useCallback((d: 1 | -1) => {
    const next = pager.page + d
    if (d === 1 && allowAutoProgress && confirmed && next < pager.pages) {
      const first = pager.firstOn(next)
      const last = pager.lastOn(next)
      const previous = pager.lastOn(pager.page)
      const hasGap = first && compareLocation(first, confirmed) > 0 && previous &&
        compareLocation(previous, confirmed) > 0 && (!readThrough || compareLocation(previous, readThrough) > 0)
      if (last && !hasGap) setReadThrough(last)
    }
    pager.goToPage(next)
  }, [allowAutoProgress, confirmed, pager, readThrough])
  const edgeOf = (e: { clientX: number; currentTarget: Element }) => {
    const r = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width
    return x <= 0.22 ? -1 : x >= 0.78 ? 1 : 0
  }
  const onPointerDown = (e: ReactPointerEvent) => {
    swipe.current = e.button === 0 ? { x: e.clientX, y: e.clientY } : null
  }
  // 넘기기는 pointerup 에서 처리(가장자리 탭은 click 이 오지 않는 브라우저가 있음)
  const onPointerUp = (e: ReactPointerEvent) => {
    const s = swipe.current
    swipe.current = null
    if (!s || window.getSelection()?.toString()) return
    const dx = e.clientX - s.x
    const dy = e.clientY - s.y
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.5) return turn(dx < 0 ? 1 : -1)
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
      const d = edgeOf(e)
      if (d) turn(d)
    }
  }
  // 가장자리 탭은 넘기기 전용: 문단 선택으로 이어지지 않게 막음
  const onPageClickCapture = (e: ReactMouseEvent) => {
    if (edgeOf(e) && !window.getSelection()?.toString()) e.stopPropagation()
  }
  useEffect(() => {
    if (!pageMode || panel) return
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input, textarea, [contenteditable]')) return
      if (e.key === 'ArrowRight' || e.key === 'PageDown') turn(1)
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') turn(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pageMode, panel, turn])

  // 현재 위치 저장 (1.5초 디바운스)
  useEffect(() => {
    if (!current || !book.data) return
    if (compareLocation(current, book.data.progress.current) === 0) return
    const t = setTimeout(() => saveCurrent.mutate(current), 1500)
    return () => clearTimeout(t)
  }, [current?.chapter, current?.paragraph]) // eslint-disable-line react-hooks/exhaustive-deps

  // 문장 드래그 선택 → 메모 인용문
  useEffect(() => {
    const onSel = () => {
      const sel = window.getSelection()
      const text = sel?.toString().trim()
      const p = sel?.anchorNode?.parentElement?.closest('p[id^="p-"]')
      if (!text || !p) return
      const [, c, para] = p.id.split('-').map(Number)
      const loc = { chapter: c, paragraph: para }
      setSelText({ loc, text })
      setSelected(loc)
    }
    document.addEventListener('selectionchange', onSel)
    return () => document.removeEventListener('selectionchange', onSel)
  }, [])

  const memoLocs = useMemo(() => {
    const m = new Map<string, Memo['type']>()
    for (const x of memos.data ?? []) {
      const k = pid(x.quote.location)
      if (m.get(k) !== 'hypothesis') m.set(k, x.type)
    }
    return m
  }, [memos.data])

  // 페이지 모드는 이 쪽에서 시작한 마지막 문단까지를 '여기까지'로 봄. 표지에서는 확정할 위치 없음
  const target = selected ?? (pageMode ? (onCover ? null : pager.ready ? pager.lastOn(pager.page) : current) : readThrough ?? current)
  const pctOf = useCallback((l?: ReadingLocation | null) => (content.data && l ? percentAt(content.data, l) : 0), [content.data])

  const memoQuote: Quote | null = useMemo(() => {
    if (!selected || !content.data) return null
    if (selText && compareLocation(selText.loc, selected) === 0) return { text: selText.text, location: selected }
    return { text: paragraphAt(content.data, selected), location: selected }
  }, [selected, selText, content.data])

  const doConfirm = (location: ReadingLocation | null) => {
    if (!location) return
    setRecallDone(true)
    confirm.mutate(location, {
      onSuccess: async (updated) => {
        setSelected(null)
        const { data } = await due.refetch()
        if (!data?.length && updated.progress.percent === 100) {
          navigate(`/library/${bookId}/complete`, { replace: true })
        }
      },
    })
  }

  const textStyle: CSSProperties = {
    fontFamily: 'var(--font-reading)',
    fontSize: reader?.fontSize ?? 17,
    lineHeight: reader?.lineHeight ?? 1.8,
    ...THEME_STYLE[reader?.theme ?? 'parchment'],
    ...pager.style,
  }
  const setMode = (m: ReadingMode) => updateSettings.mutate({ reader: { mode: m } })
  const moreItems: MoreItem[] = [
    { key: 'toc', icon: 'i_toc', label: '목차', disabled: !content.data || !current, onSelect: () => setPanel('toc') },
    { key: 'graph', icon: 'i_graph', label: book.data ? ANALYSIS_LABEL[book.data.category] : '분석', hint: '읽은 범위의 원문 분석', onSelect: () => navigate(`/library/${bookId}/graph`) },
    {
      key: 'memo',
      icon: 'i_pencil',
      label: '메모 쓰기',
      hint: memoQuote ? `${formatLocation(memoQuote.location)} 인용` : '문단을 먼저 눌러 고르세요',
      disabled: !memoQuote,
      onSelect: () => setPanel('memo'),
    },
    { key: 'notes', icon: 'i_memo', label: '메모 보기', hint: memos.data ? `${memos.data.length}개` : undefined, onSelect: () => navigate(`/library/${bookId}/notes`) },
    {
      key: 'mode',
      icon: pageMode ? 'i_down' : 'i_book',
      label: pageMode ? '스크롤로 읽기' : '페이지 넘겨 읽기',
      hint: pageMode ? '지금: 페이지 넘기기' : '지금: 스크롤',
      disabled: !reader,
      onSelect: () => setMode(pageMode ? 'scroll' : 'page'),
    },
    { key: 'settings', icon: 'i_gear', label: '읽기 설정', hint: '읽기 방식·글자 크기·줄 간격·테마', disabled: !reader, onSelect: () => setPanel('settings') },
  ].filter((item) => item.key !== 'graph' || MOCK_MODE || book.data?.graphAvailable)
  const goTo = (l: PageAnchor) => {
    if (pageMode) return pager.goToLoc(l)
    if (l === 'cover') mainRef.current?.scrollTo({ top: 0 })
    else document.getElementById(pid(l))?.scrollIntoView({ block: l.paragraph === 0 ? 'start' : 'center' })
  }
  const jump = (l: PageAnchor) => {
    goTo(l)
    if (l !== 'cover' && l.paragraph !== 0) setSelected(l)
  }
  const alreadyConfirmed = !!(target && confirmed && compareLocation(target, confirmed) <= 0)
  const chapters = content.data?.chapters
  const completed = book.data?.progress.percent === 100
  const finalChapter = chapters?.at(-1)

  return (
    <>
      <SubBar
        title={book.data?.title ?? ''}
        subtitle={current ? `${content.data?.chapters[current.chapter]?.title ?? ''}` : undefined}
        backTo="/library"
      />
      {confirmed && current && (
        <ReaderProgress confirmed={confirmed} confirmedPct={book.data?.progress.percent ?? 0} current={current} currentPct={pctOf(current)} />
      )}

      {/* 테마 배경을 본문 상자에도 칠해 화면 가장자리 여백까지 이어지게 함(global.css 배경 이어 칠하기) */}
      <div className="reader-body" style={{ background: THEME_STYLE[reader?.theme ?? 'parchment'].background }}>
        <div className="reader-col">
          <div className="reader-scroll">
            <main
              ref={mainRef}
              className={pageMode ? 'app-content reader-text paged' : 'app-content reader-text'}
              style={textStyle}
              onClickCapture={pageMode ? onPageClickCapture : undefined}
              onPointerDown={pageMode ? onPointerDown : undefined}
              onPointerUp={pageMode ? onPointerUp : undefined}
            >
              <QueryState isLoading={content.isLoading} error={content.error}>
                {book.data && content.data && <BookCover book={book.data} mode={mode} />}
                {content.data?.chapters.map((ch, ci) => (
                  <section key={ci} className={ch.layout?.some(Boolean) ? 'reader-source-lines' : 'col'} style={{ gap: '0.6em' }}>
                    <h2 className="h" style={{ fontSize: '1.3em', marginTop: 8 }}>{ch.title}</h2>
                    {ch.paragraphs.map((p, pi) => {
                      const loc = { chapter: ci, paragraph: pi }
                      const read = confirmed && compareLocation(loc, confirmed) <= 0
                      const isSel = selected && compareLocation(loc, selected) === 0
                      const memo = memoLocs.get(pid(loc))
                      const layout = ch.layout?.[pi]
                      const continues = !!layout && pi > 0 && ch.layout?.[pi - 1]?.group === layout.group
                      return (
                        <p
                          key={pi}
                          id={pid(loc)}
                          className={['para', layout && (layout.kind === 'code' ? 'source-code' : 'source-line'),
                            layout && !continues && 'source-line-start', read && 'read', isSel && 'sel'].filter(Boolean).join(' ')}
                          onClick={() => !window.getSelection()?.toString() && setSelected(isSel ? null : loc)}
                        >
                          {memo && (
                            <span className={`para-pin ${memo}${newClue === pid(loc) ? ' clue-pin-new' : ''}`} aria-label={memo === 'hypothesis' ? '단서 있음' : '메모 있음'} onAnimationEnd={() => {
                              if (newClue === pid(loc)) setNewClue(null)
                            }}>
                              <PixelSprite name="i_pin" scale={2} color="currentColor" />
                            </span>
                          )}
                          {continues ? layout?.separator : ''}{p}
                        </p>
                      )
                    })}
                  </section>
                ))}
                {chapters && finalChapter?.paragraphs.length && !completed ? (
                  <Button variant="secondary" full icon="i_check" disabled={confirm.isPending}
                    onClick={() => doConfirm({ chapter: chapters.length - 1, paragraph: finalChapter.paragraphs.length - 1 })}>
                    마지막까지 읽었어요
                  </Button>
                ) : null}
              </QueryState>
            </main>
            {pageMode && pager.ready && <PageNav page={pager.page} pages={pager.pages} onCover={onCover} onTurn={turn} />}
            <ReaderMoreMenu items={moreItems} />
            {/* 하단 액션 열기/닫기: 더보기 버튼 왼쪽 */}
            <button
              type="button"
              className={`fab fab-foot${footOpen ? ' on' : ''}`}
              aria-expanded={footOpen}
              aria-controls="reader-foot-actions"
              aria-label={footOpen ? '읽기 메뉴 닫기' : `읽기 메뉴 열기${due.data?.length ? ` (다시 볼 단서 ${due.data.length}개)` : ''}`}
              title={footOpen ? '읽기 메뉴 닫기' : '읽기 메뉴 열기'}
              onClick={() => setFootOpen((o) => !o)}
            >
              <PixelSprite name={footOpen ? 'i_tri_down' : 'i_tri_up'} scale={3} />
              {!footOpen && !!due.data?.length && <span className="reader-foot-badge mono" aria-hidden="true">{due.data.length}</span>}
            </button>
          </div>

          <div className="reader-foot">
            {confirm.isError && <span className="lbl" role="alert">{confirm.error.message}</span>}
            <span className="lbl reader-foot-status">
              {onCover && !selected ? '표지 · 넘겨서 읽기 시작' : target ? (alreadyConfirmed ? `${formatLocation(target)}은 이미 읽음 확정됨` : `${formatLocation(target)}까지 읽음으로 확정`) : '문단을 눌러 위치를 고르세요'}
            </span>
            {footOpen && <div className="reader-foot-actions" id="reader-foot-actions">
              {!!due.data?.length && (
                <Button full variant="accent" icon="i_memo" onClick={() => setReview(due.data![0])}>
                  전에 남긴 단서 {due.data.length}개 보기
                </Button>
              )}
              {memoQuote && <Button full variant="ghost" icon="i_pin" onClick={() => setPanel('clue')}>단서 남기기</Button>}
              <Button variant="secondary" full icon="i_check" disabled={!target || alreadyConfirmed || confirm.isPending} onClick={() => doConfirm(target)}>
                여기까지 읽음
              </Button>
              {!!book.data?.progress.percent && (
                <Button variant="ghost" full to={`/library/${bookId}/${completed ? 'complete' : 'quiz'}`}>
                  {completed ? '완독 기록 보기' : '잠깐 놀기'}
                </Button>
              )}
            </div>}
          </div>
        </div>
        {wide && (
          <ReaderSidePanel
            bookId={bookId}
            content={content.data}
            memos={memos.data}
            current={onCover ? null : current}
            memoQuote={memoQuote}
            mode={mode}
            onMode={setMode}
            onWriteMemo={() => setPanel('memo')}
            onJump={jump}
          />
        )}
      </div>
      <TabBar />

      {showRecall && book.data && (
        <RecallSheet book={book.data} count={settings.data?.learning.recallCount ?? 2} onClose={() => setRecallDone(true)} />
      )}
      {(panel === 'memo' || panel === 'clue') && memoQuote && (
        <MemoSheet bookId={bookId} quote={memoQuote} clue={panel === 'clue'} percent={pctOf(memoQuote.location)}
          onClose={() => { setPanel(null); window.getSelection()?.removeAllRanges() }}
          onSaved={() => {
            if (panel === 'clue') setNewClue(pid(memoQuote.location))
            setPanel(null)
            window.getSelection()?.removeAllRanges()
          }}
        />
      )}
      {panel === 'settings' && reader && <ReaderSettingsSheet value={reader} onClose={() => setPanel(null)} />}
      {panel === 'toc' && content.data && current && (
        <TocSheet
          content={content.data}
          current={onCover ? null : current}
          onClose={() => setPanel(null)}
          onPick={(l) => { goTo(l); setPanel(null) }}
        />
      )}
      {review && confirmed && <ReviewModal key={review.id} memo={review} confirmed={confirmed} onClose={() => setReview(null)} />}
    </>
  )
}
