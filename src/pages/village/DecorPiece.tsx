import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { PixelSprite } from '@/components/pixel/PixelSprite'
import type { DecorDef } from '@/domain/decor'
import type { DecorItem } from '@/domain/types'
import { FIELD_REF, type FieldGeom } from '@/domain/village'
import { decorUnits, dryDecorPos } from './lake'

/** 이 거리(px) 이상 움직여야 드래그로 봄(마을 캐릭터와 같은 값). 그보다 짧으면 탭 = 선택 */
const DRAG_THRESHOLD = 6

interface Props {
  item: DecorItem
  def: DecorDef
  fieldRef: React.RefObject<HTMLDivElement | null>
  /** 여기에 놓으면 회수(꾸미기 상자) */
  binRef: React.RefObject<HTMLElement | null>
  selected: boolean
  onSelect: () => void
  onMove: (pos: { x: number; y: number }) => void
  onRecall: () => void
  /** 끄는 중 회수 상자 위에 있는지(상자 강조용) */
  onHoverBin: (over: boolean) => void
  /** 장면 크기·호수 위치. 호수(상태창 자리)에는 놓을 수 없음 */
  geom?: FieldGeom | null
}

/** 꾸미기 모드의 소품 1개. 끌어서 옮기고, 회수 상자 위에 놓거나 선택 후 [회수]로 되돌림 */
export function DecorPiece({ item, def, fieldRef, binRef, selected, onSelect, onMove, onRecall, onHoverBin, geom }: Props) {
  const [drag, setDrag] = useState<{ left: number; top: number; overBin: boolean } | null>(null)
  const g = useRef<{ id: number; sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null)

  const overBin = (cx: number, cy: number) => {
    if (def.fixed || !binRef.current) return false
    const b = binRef.current.getBoundingClientRect()
    return cx >= b.left && cx <= b.right && cy >= b.top && cy <= b.bottom
  }

  /** 포인터 좌표 → 장면 % (발 위치). 소품 머리가 장면 위로 잘리지 않게 위쪽 여유를 둠 */
  const pctAt = (st: { ox: number; oy: number }, cx: number, cy: number) => {
    const r = fieldRef.current!.getBoundingClientRect()
    const left = ((cx - st.ox - r.left) / r.width) * 100
    const top = ((cy - st.oy - r.top) / r.height) * 100
    const px = Math.min(r.width / FIELD_REF.village.w, r.height / FIELD_REF.village.h)
    const minTop = Math.min(60, ((decorUnits(def).h * px) / r.height) * 100)
    const p = { left: Math.min(98, Math.max(2, left)), top: Math.min(100, Math.max(minTop, top)) }
    return dryDecorPos(def, p, geom && { ...geom, w: r.width, h: r.height })
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0 || !fieldRef.current) return
    const r = fieldRef.current.getBoundingClientRect()
    const here = dryDecorPos(def, { left: item.x, top: item.y }, geom)
    const footX = r.left + (here.left / 100) * r.width
    const footY = r.top + (here.top / 100) * r.height
    g.current = { id: e.pointerId, sx: e.clientX, sy: e.clientY, ox: e.clientX - footX, oy: e.clientY - footY, moved: false }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const st = g.current
    if (!st || st.id !== e.pointerId) return
    if (!st.moved && Math.hypot(e.clientX - st.sx, e.clientY - st.sy) < DRAG_THRESHOLD) return
    if (!st.moved) onSelect()
    st.moved = true
    const bin = overBin(e.clientX, e.clientY)
    onHoverBin(bin)
    setDrag({ ...pctAt(st, e.clientX, e.clientY), overBin: bin })
  }

  const end = (e: ReactPointerEvent<HTMLButtonElement>, cancel: boolean) => {
    const st = g.current
    if (!st || st.id !== e.pointerId) return
    g.current = null
    onHoverBin(false)
    if (st.moved) {
      if (!cancel) {
        if (overBin(e.clientX, e.clientY)) onRecall()
        else {
          const p = pctAt(st, e.clientX, e.clientY)
          onMove({ x: p.left, y: p.top })
        }
      }
    } else if (!cancel) onSelect()
    setDrag(null)
  }

  const at = drag ?? { ...dryDecorPos(def, { left: item.x, top: item.y }, geom), overBin: false }
  return (
    <div
      className={'decor-piece' + (drag ? ' dragging' : '') + (selected ? ' sel' : '') + (at.overBin ? ' to-bin' : '')}
      style={{ left: `${at.left}%`, top: `${at.top}%`, zIndex: drag ? 300 : selected ? 150 : Math.round(at.top) }}
    >
      {selected && !drag && (
        <span className="decor-tools">
          <span className="decor-name">{def.name}</span>
          {!def.fixed && (
            <button type="button" className="decor-recall" onClick={onRecall} aria-label={`${def.name} 회수`}>
              <PixelSprite name="i_down" scale={2} />
              회수
            </button>
          )}
        </span>
      )}
      <button
        type="button"
        className="decor-grab"
        aria-label={`${def.name}: 끌어서 옮기기`}
        aria-pressed={selected}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => end(e, false)}
        onPointerCancel={(e) => end(e, true)}
        onLostPointerCapture={(e) => end(e, true)}
      >
        <PixelSprite name={def.sprite} scale={def.scale} fluid />
      </button>
    </div>
  )
}
