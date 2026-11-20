import { useState } from 'react'
import { Link } from 'react-router'
import { PixelSprite } from '@/components/pixel/PixelSprite'
import { Button } from '@/components/ui'
import { MEMO_TYPE_LABEL, READING_MODE_OPTIONS } from '@/domain/labels'
import { compareLocation, formatLocation } from '@/domain/location'
import type { BookContent, Memo, Quote, ReadingLocation, ReadingMode } from '@/domain/types'
import type { PageAnchor } from './usePagination'

type Tab = 'memo' | 'toc'

interface Props {
  bookId: string
  content?: BookContent
  memos?: Memo[]
  current: ReadingLocation | null
  memoQuote: Quote | null
  mode: ReadingMode
  onMode: (m: ReadingMode) => void
  onWriteMemo: () => void
  onJump: (loc: PageAnchor) => void
}

/** 가로 태블릿 Reader 우측 패널: 메모·목차를 본문 옆에 펼쳐 둠 (모바일은 더보기 메뉴의 시트로 대신함) */
export function ReaderSidePanel({ bookId, content, memos, current, memoQuote, mode, onMode, onWriteMemo, onJump }: Props) {
  const [tab, setTab] = useState<Tab>('memo')
  const sorted = [...(memos ?? [])].sort((a, b) => compareLocation(a.quote.location, b.quote.location))

  return (
    <aside className="reader-side" aria-label="읽기 도구">
      <div className="reader-side-mode" role="group" aria-label="읽기 방식">
        <span className="lbl">읽기 방식</span>
        <div className="seg sm">
          {READING_MODE_OPTIONS.map((o) => (
            <button key={o.value} type="button" className={o.value === mode ? 'on' : ''} aria-pressed={o.value === mode} onClick={() => onMode(o.value)}>
              {o.label}
            </button>
          ))}
        </div>
      </div>
      <div className="seg reader-side-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'memo'} className={tab === 'memo' ? 'on' : ''} onClick={() => setTab('memo')}>
          메모 <span className="num" style={{ fontSize: 12 }}>{memos?.length ?? 0}</span>
        </button>
        <button type="button" role="tab" aria-selected={tab === 'toc'} className={tab === 'toc' ? 'on' : ''} onClick={() => setTab('toc')}>
          목차
        </button>
      </div>

      <div className="reader-side-body">
        {tab === 'memo' ? (
          <>
            <Button variant="secondary" size="sm" full icon="i_pencil" disabled={!memoQuote} onClick={onWriteMemo}>
              {memoQuote ? `${formatLocation(memoQuote.location)} 메모 쓰기` : '문단을 눌러 메모 쓰기'}
            </Button>
            {sorted.length === 0 ? (
              <p className="lbl" style={{ textAlign: 'center', padding: '16px 0' }}>아직 남긴 메모가 없어요</p>
            ) : (
              <ul className="side-memos">
                {sorted.map((m) => (
                  <li key={m.id}>
                    <button type="button" className={m.type === 'hypothesis' ? 'side-memo accent' : 'side-memo'} onClick={() => onJump(m.quote.location)}>
                      <span className="row" style={{ gap: 6 }}>
                        <span className={m.type === 'hypothesis' ? 'tag v' : 'tag'}>{MEMO_TYPE_LABEL[m.type]}</span>
                        <span className="lbl grow">{formatLocation(m.quote.location)}</span>
                      </span>
                      <span className="q">{m.quote.text}</span>
                      <span className="c">{m.content}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <Link to={`/library/${bookId}/notes`} className="link-btn" style={{ alignSelf: 'center' }}>메모 보드에서 모두 보기</Link>
          </>
        ) : (
          <nav className="menu">
            <button type="button" className="menu-row" style={{ width: '100%' }} aria-current={!current} onClick={() => onJump('cover')}>
              <PixelSprite name="i_book" scale={2} color={!current ? 'var(--amber)' : 'var(--wood)'} />
              <span className="grow" style={{ textAlign: 'left', fontWeight: !current ? 700 : 500 }}>표지</span>
            </button>
            {content?.chapters.map((ch, i) => {
              const here = current?.chapter === i
              return (
                <button key={i} type="button" className="menu-row" style={{ width: '100%' }} aria-current={here} onClick={() => onJump({ chapter: i, paragraph: 0 })}>
                  {here && <PixelSprite name="i_flag" scale={2} color="var(--amber)" />}
                  <span className="grow" style={{ textAlign: 'left', fontWeight: here ? 700 : 500 }}>{ch.title}</span>
                  <span className="lbl">{ch.paragraphs.length}문단</span>
                </button>
              )
            })}
          </nav>
        )}
      </div>
    </aside>
  )
}
