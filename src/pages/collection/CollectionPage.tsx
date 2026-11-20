import { useMemo, useState, type CSSProperties } from 'react'
import { PixelSprite } from '@/components/pixel/PixelSprite'
import { QueryState } from '@/components/QueryState'
import { Button, Modal, Panel } from '@/components/ui'
import type { Book, Collectible } from '@/domain/types'
import { useBooks, useCollectibles, useMyCharacters } from '@/hooks/queries'
import { CATEGORY_ICON } from '@/pages/library/LibraryShelf'
import { CharacterInfoModal } from '@/pages/village/CharacterInfoModal'

type Filter = 'all' | 'earned' | 'locked'
const FILTER_LABEL: Record<Filter, string> = { all: '전체', earned: '해금', locked: '미해금' }

/**
 * 3.0 수집: 내 서재 책별 캐릭터 도감.
 * 해금 캐릭터는 원래 모습, 미해금 캐릭터는 실루엣(콘텐츠별 실루엣 규칙 §13 그대로)과 잠금 표시.
 * 해금 캐릭터를 누르면 마을과 같은 캐릭터 정보 팝업(1.1), 미해금은 등장 위치 안내.
 */
export function CollectionPage() {
  const books = useBooks()
  const list = useCollectibles()
  const mine = useMyCharacters()
  const [filter, setFilter] = useState<Filter>('all')
  const [openId, setOpenId] = useState<string | null>(null)

  const all = list.data ?? []
  const earned = all.filter((x) => x.earnedAt).length
  const counts: Record<Filter, number> = { all: all.length, earned, locked: all.length - earned }

  const groups = useMemo(() => {
    const byBook = new Map<string, Collectible[]>()
    for (const x of list.data ?? []) byBook.set(x.bookId, [...(byBook.get(x.bookId) ?? []), x])
    return (books.data ?? []).map((book) => ({ book, items: byBook.get(book.id) ?? [] }))
  }, [books.data, list.data])

  const opened = all.find((x) => x.id === openId)
  const openedBook = opened && books.data?.find((b) => b.id === opened.bookId)
  const openedChar = opened?.characterId ? mine.data?.find((c) => c.id === opened.characterId) : undefined

  return (
    <>
      <div className="sec-h" style={{ alignItems: 'center' }}>
        <div className="col grow" style={{ gap: 0 }}>
          <b>캐릭터 수집</b>
          <span className="lbl">내 서재 {books.data?.length ?? 0}권 · 해금 <span className="num">{earned}/{all.length}</span></span>
        </div>
      </div>

      <div className="row chip-scroll">
        {(Object.keys(FILTER_LABEL) as Filter[]).map((f) => (
          <button key={f} type="button" className={filter === f ? 'chip on' : 'chip'} onClick={() => setFilter(f)} aria-pressed={filter === f}>
            {FILTER_LABEL[f]} <span className="n">{counts[f]}</span>
          </button>
        ))}
      </div>

      <QueryState isLoading={books.isLoading || list.isLoading} error={books.error ?? list.error}>
        {groups.length === 0 && <p className="lbl">서재에 책을 추가하면 책마다 만날 캐릭터가 여기에 나타나요.</p>}
        <div className="dex-books">
          {groups.map(({ book, items }) => (
            <DexBook key={book.id} book={book} items={items} filter={filter} onOpen={setOpenId} />
          ))}
        </div>
      </QueryState>

      {opened && openedChar && <CharacterInfoModal char={openedChar} onClose={() => setOpenId(null)} />}
      {opened && !openedChar && (
        <Modal title={opened.earnedAt ? '캐릭터 정보' : '아직 만나지 않은 캐릭터'} icon={opened.earnedAt ? 'i_star' : 'i_lock'} onClose={() => setOpenId(null)}>
          <div className="char-info">
            <span className="pic">
              <PixelSprite name={opened.sprite} fit={96} className={opened.earnedAt ? undefined : 'collectible-locked'} />
            </span>
            <div className="col grow" style={{ gap: 8, minWidth: 0 }}>
              <b className="h" style={{ fontSize: 22 }}>{opened.earnedAt ? opened.name : '???'}</b>
              {openedBook && <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}><span className="tag">{openedBook.title}</span></div>}
            </div>
          </div>
          <div className="char-info-why">
            <span className="lbl">{opened.earnedAt ? '획득 사유' : '등장'}</span>
            <p>{opened.reason}</p>
            {!opened.earnedAt && <p className="lbl">책을 읽고 관계도 탐색·이전 내용 점검을 하면 해금돼요.</p>}
          </div>
          <div className="row" style={{ gap: 12 }}>
            {openedBook && <Button to={`/library/${openedBook.id}/read`} full icon="i_book">{opened.earnedAt ? '이 책 열기' : '이어 읽기'}</Button>}
          </div>
        </Modal>
      )}
    </>
  )
}

function DexBook({ book, items, filter, onOpen }: { book: Book; items: Collectible[]; filter: Filter; onOpen: (id: string) => void }) {
  const earned = items.filter((x) => x.earnedAt).length
  const shown = items.filter((x) => filter === 'all' || (filter === 'earned' ? x.earnedAt : !x.earnedAt))
  if (filter !== 'all' && shown.length === 0) return null
  return (
    <Panel tone="white" stack gap={10} className="dex-book">
      <div className="row" style={{ gap: 10 }}>
        <span className="cover library-cover" data-category={book.category} style={{ '--c': `var(--${book.coverColor})` } as CSSProperties}>
          <PixelSprite name={CATEGORY_ICON[book.category]} scale={2} />
        </span>
        <div className="col grow" style={{ gap: 4, minWidth: 0 }}>
          <b className="dex-title">{book.title}</b>
          {items.length > 0 ? (
            <span className="row" style={{ gap: 8 }}>
              <span className="bar mark grow"><i style={{ width: `${Math.round((earned / items.length) * 100)}%` }} /></span>
              <span className="num lbl">{earned}/{items.length}</span>
            </span>
          ) : (
            <span className="lbl">{book.status === 'processing' ? '분석 중' : '아직 등장한 캐릭터가 없어요'}</span>
          )}
        </div>
      </div>
      {shown.length > 0 && (
        <ul className="dex-grid">
          {shown.map((x) => {
            const locked = !x.earnedAt
            return (
              <li key={x.id}>
                <button type="button" className={locked ? 'dex-slot locked' : 'dex-slot'} onClick={() => onOpen(x.id)} aria-label={locked ? `미해금 캐릭터 · ${x.reason}` : `${x.name} 정보 보기`}>
                  <span className="dex-pic">
                    <PixelSprite name={x.sprite} fit={56} className={locked ? 'collectible-locked' : undefined} />
                    {locked && <span className="dex-lock"><PixelSprite name="i_lock" scale={2} /></span>}
                  </span>
                  <span className="dex-name">{locked ? '???' : x.name}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}
