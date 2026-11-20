import { forwardRef, useState } from 'react'
import { PixelSprite } from '@/components/pixel/PixelSprite'
import { countOf, DECOR_CATALOG, type DecorDef } from '@/domain/decor'
import type { DecorItem, DecorKind } from '@/domain/types'

interface Props {
  items: DecorItem[]
  unlocked: DecorKind[]
  /** 지식 포인트(성 모드와 공용). 모르면 undefined */
  points?: number
  /** 끄는 소품이 상자 위에 있음 */
  binHot: boolean
  busy: boolean
  error?: string
  onAdd: (def: DecorDef) => void
  onUnlock: (def: DecorDef) => void
}

/** 꾸미기 상자: 소품 목록(해금·배치 개수). 장면의 소품을 여기로 끌어 놓으면 회수 */
export const DecorPanel = forwardRef<HTMLDivElement, Props>(function DecorPanel(
  { items, unlocked, points, binHot, busy, error, onAdd, onUnlock },
  ref,
) {
  /** 접으면 상자 뒤에 가려진 장면 아래쪽 소품도 잡을 수 있음 */
  const [folded, setFolded] = useState(false)
  return (
    <div className={'decor-panel' + (binHot ? ' hot' : '') + (folded ? ' folded' : '')} ref={ref} aria-label="꾸미기 상자">
      <div className="decor-head">
        <b>꾸미기 상자</b>
        <span className="decor-hint">{binHot ? '여기에 놓으면 회수' : '눌러서 놓기 · 상자로 끌면 회수'}</span>
        {points !== undefined && (
          <span className="decor-points" aria-label={`지식 포인트 ${points}점`}>
            <PixelSprite name="i_star" scale={2} />
            <span className="num">{points}</span>
          </span>
        )}
        <button type="button" className="decor-fold" onClick={() => setFolded((f) => !f)} aria-expanded={!folded} aria-label={folded ? '꾸미기 상자 펼치기' : '꾸미기 상자 접기'}>
          <PixelSprite name={folded ? 'i_tri_up' : 'i_tri_down'} scale={2} />
        </button>
      </div>
      {error && <p className="decor-error" role="alert">{error}</p>}
      <ul className="decor-list">
        {DECOR_CATALOG.filter((d) => !d.fixed).map((d) => {
          const open = unlocked.includes(d.kind)
          const n = countOf(items, d.kind)
          const full = n >= d.max
          const short = points !== undefined && points < d.cost
          return (
            <li key={d.kind}>
              <button
                type="button"
                className={'decor-card' + (open ? '' : ' locked')}
                disabled={busy || (open ? full : short)}
                onClick={() => (open ? onAdd(d) : onUnlock(d))}
                aria-label={open ? `${d.name} 놓기 (${n}/${d.max})` : `${d.name} 해금: 지식 포인트 ${d.cost}점`}
              >
                <span className="decor-thumb">
                  <PixelSprite name={d.sprite} fit={40} />
                  {!open && <span className="decor-lock"><PixelSprite name="i_lock" scale={2} /></span>}
                </span>
                <span className="decor-cname">{d.name}</span>
                {open ? (
                  <span className="decor-count num">{n}/{d.max}</span>
                ) : (
                  <span className="decor-cost">{short ? `${d.cost}P 부족` : `${d.cost}P 해금`}</span>
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
})
