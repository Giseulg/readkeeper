import { useMemo, useState, type CSSProperties } from 'react'
import { QueryState } from '@/components/QueryState'
import { PixelSprite } from '@/components/pixel/PixelSprite'
import { Button, IconButton } from '@/components/ui'
import { CATEGORY_LABEL, LIBRARY_VIEW_LABEL } from '@/domain/labels'
import { formatLocation } from '@/domain/location'
import type { Book, Category, LibraryView } from '@/domain/types'
import { useBooks, useSettings, useStats, useUpdateSettings } from '@/hooks/queries'
import { AddBookSheet } from './AddBookSheet'
import { BookActionSheet } from './BookActionSheet'
import { DeleteBookModal } from './DeleteBookModal'
import { CATEGORY_ICON, LibraryShelf } from './LibraryShelf'

const FILTERS: Array<Category | 'all'> = ['all', 'major', 'paper', 'novel', 'poetry', 'cs_book', 'general']

type SortKey = 'recent' | 'added' | 'title' | 'progress'
const SORT_LABEL: Record<SortKey, string> = { recent: '최근 읽은 순', added: '추가한 순', title: '제목 순', progress: '진도 순' }

const NEW_DAYS = 3

function sortBooks(books: Book[], key: SortKey) {
  const list = [...books]
  switch (key) {
    case 'recent':
      // 읽은 적 없는 책은 뒤로
      return list.sort((a, b) => (b.progress.lastReadAt ?? '').localeCompare(a.progress.lastReadAt ?? '') || b.createdAt.localeCompare(a.createdAt))
    case 'added':
      return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    case 'title':
      return list.sort((a, b) => a.title.localeCompare(b.title, 'ko'))
    case 'progress':
      return list.sort((a, b) => b.progress.percent - a.progress.percent)
  }
}

function statusText(b: Book) {
  if (b.status === 'processing') return '분석 중'
  if (b.status === 'failed') return '분석 실패'
  return b.progress.percent > 0 ? `${formatLocation(b.progress.confirmed)}까지` : '읽기 전'
}

function badgeOf(b: Book) {
  if (b.status !== 'ready') return null
  if (b.progress.percent >= 100) return <span className="tag a">완독</span>
  const isNew = b.progress.percent === 0 && Date.now() - new Date(b.createdAt).getTime() < NEW_DAYS * 86_400_000
  return isNew ? <span className="tag v">NEW</span> : null
}

/** 2.0 서재(목록형·책장형, 설정 4.3에서 기본값 선택) · 2.2 삭제(편집 모드) */
export function LibraryPage() {
  const { data, isLoading, error } = useBooks()
  const stats = useStats()
  const settings = useSettings()
  const updateSettings = useUpdateSettings()
  const view: LibraryView = settings.data?.library.view ?? 'list'
  const nextView: LibraryView = view === 'list' ? 'shelf' : 'list'
  const [filter, setFilter] = useState<Category | 'all'>('all')
  const [sort, setSort] = useState<SortKey>('recent')
  const [editing, setEditing] = useState(false)
  const [selected, setSelected] = useState<Book | null>(null)
  const [deleting, setDeleting] = useState<Book | null>(null)
  const [adding, setAdding] = useState(false)

  const counts = useMemo(() => {
    const c: Partial<Record<Category | 'all', number>> = { all: data?.length ?? 0 }
    for (const b of data ?? []) c[b.category] = (c[b.category] ?? 0) + 1
    return c
  }, [data])
  const books = sortBooks(data?.filter((b) => filter === 'all' || b.category === filter) ?? [], sort)

  return (
    <>
      <div className="sec-h" style={{ alignItems: 'center' }}>
        <div className="col grow" style={{ gap: 0 }}>
          <b>내 서재</b>
          <span className="lbl">
            {data?.length ?? 0}권 · 메모 {stats.data?.memoCount ?? 0}개
          </span>
        </div>
        <IconButton
          tone="light"
          icon={view === 'list' ? 'i_book' : 'i_toc'}
          label={`${LIBRARY_VIEW_LABEL[nextView]}으로 보기`}
          onClick={() => updateSettings.mutate({ library: { view: nextView } })}
        />
        <IconButton
          tone="light"
          icon={editing ? 'i_check' : 'i_trash'}
          label={editing ? '편집 완료' : '삭제 편집'}
          onClick={() => setEditing((v) => !v)}
          aria-pressed={editing}
        />
        <Button variant="secondary" size="sm" icon="i_plus" onClick={() => setAdding(true)}>
          추가
        </Button>
      </div>

      <div className="row chip-scroll">
        {FILTERS.filter((f) => f === 'all' || counts[f]).map((f) => (
          <button key={f} type="button" className={filter === f ? 'chip on' : 'chip'} onClick={() => setFilter(f)}>
            {f === 'all' ? '전체' : CATEGORY_LABEL[f]} <span className="n">{counts[f]}</span>
          </button>
        ))}
      </div>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <label className="lbl row" style={{ gap: 4 }}>
          <PixelSprite name="i_sort" scale={2} />
          <select className="select" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="정렬">
            {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
              <option key={k} value={k}>{SORT_LABEL[k]}</option>
            ))}
          </select>
        </label>
      </div>

      <QueryState isLoading={isLoading || settings.isLoading} error={error}>
        {books.length === 0 ? (
          <button type="button" className="empty-slot" onClick={() => setAdding(true)}>
            <PixelSprite name="i_plus" scale={4} />
            <span>첫 책을 추가해 보세요 (.txt, .pdf)</span>
          </button>
        ) : view === 'shelf' ? (
          <LibraryShelf books={books} editing={editing} badgeOf={badgeOf} onOpen={setSelected} onDelete={setDeleting} onAdd={() => setAdding(true)} />
        ) : (
          <ul className="book-list">
            {books.map((b) => (
              <li key={b.id} className="row" style={{ gap: 8, alignItems: 'stretch' }}>
                <button
                  type="button"
                  className="book-row"
                  disabled={editing || b.status !== 'ready'}
                  onClick={() => setSelected(b)}
                >
                  <span className="cover library-cover" data-category={b.category} style={{ '--c': `var(--${b.coverColor})` } as CSSProperties}><PixelSprite name={CATEGORY_ICON[b.category]} scale={2} /></span>
                  <span className="col grow" style={{ gap: 4 }}>
                    <span className="row" style={{ gap: 6 }}>
                      <span className="t grow">{b.title}</span>
                      {badgeOf(b)}
                    </span>
                    <span className="row" style={{ gap: 4 }}>
                      <span className="tag">{CATEGORY_LABEL[b.category]}</span>
                      <span className="tag mono">{b.fileType.toUpperCase()}</span>
                      <span className="lbl" style={{ marginLeft: 4, color: b.status === 'failed' ? 'var(--color-danger)' : undefined }}>
                        {statusText(b)}
                      </span>
                    </span>
                    {b.status === 'ready' && (
                      <span className="bar mark" style={{ marginTop: 4 }}><i style={{ width: `${b.progress.percent}%` }} /></span>
                    )}
                  </span>
                  {b.status === 'ready' && <span className="pct">{b.progress.percent}%</span>}
                </button>
                {editing && (
                  <button type="button" className="del-btn" aria-label={`${b.title} 삭제`} onClick={() => setDeleting(b)}>
                    <PixelSprite name="i_trash" scale={3} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </QueryState>

      {selected && <BookActionSheet book={selected} onClose={() => setSelected(null)} />}
      {adding && <AddBookSheet onClose={() => setAdding(false)} />}
      {deleting && <DeleteBookModal book={deleting} onClose={() => setDeleting(null)} />}
    </>
  )
}
