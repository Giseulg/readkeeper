import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { PixelSprite } from '@/components/pixel/PixelSprite'
import { QueryState } from '@/components/QueryState'
import { CATEGORY_LABEL, formatPrice } from '@/domain/labels'
import type { Category } from '@/domain/types'
import { useExplore } from '@/hooks/queries'
import { IconButton } from '@/components/ui'

const FILTERS: Array<Category | 'all'> = ['all', 'major', 'paper', 'novel', 'poetry', 'cs_book', 'general']

/**
 * 저자 공식 콘텐츠 스토어(구 3.0 탐색): 책의 저자가 직접 등록한 콘텐츠만 노출, 구매로만 받을 수 있음.
 * 하단 탭은 '수집'(3.0 캐릭터 도감)으로 바뀌었고, 이 화면은 서재 [추가] 시트에서 진입함.
 */
export function ExplorePage() {
  const { data, isLoading, error } = useExplore()
  const navigate = useNavigate()
  const [filter, setFilter] = useState<Category | 'all'>('all')
  const counts = useMemo(() => {
    const c: Partial<Record<Category | 'all', number>> = { all: data?.length ?? 0 }
    for (const x of data ?? []) c[x.category] = (c[x.category] ?? 0) + 1
    return c
  }, [data])
  const items = data?.filter((x) => filter === 'all' || x.category === filter) ?? []

  return (
    <>
      <div className="sec-h" style={{ alignItems: 'center' }}>
        <IconButton tone="light" icon="i_back" label="서재로" onClick={() => navigate('/library')} />
        <div className="col grow" style={{ gap: 0 }}>
          <b>저자 공식 콘텐츠</b>
          <span className="lbl">책의 저자가 직접 등록한 콘텐츠만 판매함</span>
        </div>
      </div>

      <div className="row chip-scroll">
        {FILTERS.filter((f) => f === 'all' || counts[f]).map((f) => (
          <button key={f} type="button" className={filter === f ? 'chip on' : 'chip'} onClick={() => setFilter(f)}>
            {f === 'all' ? '전체' : CATEGORY_LABEL[f]} <span className="n">{counts[f]}</span>
          </button>
        ))}
      </div>

      <QueryState isLoading={isLoading} error={error}>
        <div className="card-grid">
          {items.map((c) => (
            <Link key={c.id} to={`/explore/${c.id}`} className="book-row col store-card" style={{ alignItems: 'stretch', gap: 8, padding: 8 }}>
              <span className="pedestal" style={{ height: 120 }}><PixelSprite name={c.character.sprite} fit={96} /></span>
              <span className="col" style={{ gap: 4, padding: '0 4px 4px' }}>
                <span className="t" style={{ fontSize: 14 }}>{c.title}</span>
                <span className="lbl row" style={{ gap: 4 }}>
                  {c.authorVerified && <PixelSprite name="i_check" scale={2} color="var(--green)" />}
                  {c.authorName} · {CATEGORY_LABEL[c.category]}
                </span>
                {c.purchased ? <span className="tag g">구매함</span> : <b className="price">{formatPrice(c.price)}</b>}
              </span>
            </Link>
          ))}
        </div>
      </QueryState>
    </>
  )
}
