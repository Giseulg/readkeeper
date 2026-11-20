import type { CSSProperties, ReactNode } from 'react'
import { PixelSprite } from '@/components/pixel/PixelSprite'
import { Panel } from '@/components/ui'
import type { Book, Category } from '@/domain/types'
import { useShelfColumns } from '@/hooks/useMediaQuery'

export const CATEGORY_ICON: Record<Category, string> = { major: 'i_gear', paper: 'i_eye', novel: 'i_heart', poetry: 'i_leaf', cs_book: 'i_gear', general: 'i_leaf' }

interface Props {
  books: Book[]
  editing: boolean
  badgeOf: (b: Book) => ReactNode
  onOpen: (b: Book) => void
  onDelete: (b: Book) => void
  onAdd: () => void
}

/** 2.0 책장형: 표지 N열(모바일 3 · 태블릿 5~6) + 칸마다 선반 */
export function LibraryShelf({ books, editing, badgeOf, onOpen, onDelete, onAdd }: Props) {
  const COLS = useShelfColumns()
  // 마지막 칸은 '추가하기' 슬롯, 남는 칸은 빈 자리로 채움
  const cells: Array<Book | 'add' | null> = [...books, 'add']
  while (cells.length % COLS) cells.push(null)
  const rows = Array.from({ length: cells.length / COLS }, (_, i) => cells.slice(i * COLS, i * COLS + COLS))

  return (
    <Panel
      className="shelf"
      title={
        <span className="row" style={{ gap: 8 }}>
          <PixelSprite name="i_book" scale={2} /> BOOKSHELF
        </span>
      }
      titleRight="읽기 진도"
    >
      {rows.map((row, i) => (
        <div key={i} className="shelf-row">
          <ul className="shelf-grid" style={{ gridTemplateColumns: `repeat(${COLS},minmax(0,1fr))` }}>
            {row.map((c, j) => (
              <li key={c === null ? `empty-${j}` : c === 'add' ? 'add' : c.id}>
                {c === null ? (
                  <span className="shelf-cover empty" aria-hidden />
                ) : c === 'add' ? (
                  <button type="button" className="shelf-book" onClick={onAdd}>
                    <span className="shelf-cover add"><PixelSprite name="i_plus" scale={4} /></span>
                    <span className="shelf-t muted">추가하기</span>
                  </button>
                ) : (
                  <ShelfBook book={c} editing={editing} badge={badgeOf(c)} onOpen={onOpen} onDelete={onDelete} />
                )}
              </li>
            ))}
          </ul>
          <div className="shelf-plank" />
        </div>
      ))}
    </Panel>
  )
}

function ShelfBook({ book: b, editing, badge, onOpen, onDelete }: { book: Book; editing: boolean; badge: ReactNode; onOpen: (b: Book) => void; onDelete: (b: Book) => void }) {
  const ready = b.status === 'ready'
  return (
    <div className="shelf-item">
      <button type="button" className={ready ? 'shelf-book' : 'shelf-book off'} disabled={editing || !ready} onClick={() => onOpen(b)}>
        <span className="shelf-cover library-cover" data-category={b.category} style={{ '--c': `var(--${b.coverColor})` } as CSSProperties}>
          <span className="emb"><PixelSprite name={CATEGORY_ICON[b.category]} scale={3} /></span>
          {badge && <span className="badge">{badge}</span>}
        </span>
        <span className="shelf-t">{b.title}</span>
        {ready ? (
          <span className="shelf-prog">
            <span className="bar mark"><i style={{ width: `${b.progress.percent}%` }} /></span>
            <span className="pct">{b.progress.percent}%</span>
          </span>
        ) : (
          <span className={b.status === 'failed' ? 'tag v' : 'tag d'}>{b.status === 'failed' ? '분석 실패' : '분석 중…'}</span>
        )}
      </button>
      {editing && (
        <button type="button" className="del-btn mini" aria-label={`${b.title} 삭제`} onClick={() => onDelete(b)}>
          <PixelSprite name="i_trash" scale={2} />
        </button>
      )}
    </div>
  )
}
