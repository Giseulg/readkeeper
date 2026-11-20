import { useRef, useState, type PointerEvent } from 'react'
import { EnemySprite } from './EnemySprite'
import { PixelSprite } from '@/components/pixel/PixelSprite'
import { Button, Sheet } from '@/components/ui'
import { ENEMY_NAME, WAVES } from '@/domain/castle'
import type { CastleState, Character, ID, RaidReport } from '@/domain/types'

interface Props {
  reports: RaidReport[]
  castle: CastleState
  chars: Map<ID, Character>
  /** true 면 지난 기록 보기(포인트 내역 포함) */
  log?: boolean
  onClose: () => void
}

const time = (iso: string) => new Date(iso).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })

/**
 * 마우스로 끌어도 스크롤되게 함(터치·트랙패드는 브라우저 기본 스크롤).
 * 끌다가 놓은 직후의 클릭은 막아 토글·버튼이 잘못 눌리지 않게 함.
 */
function useDragScroll() {
  const drag = useRef<{ y: number; top: number; moved: boolean } | null>(null)
  return {
    onPointerDown(e: PointerEvent<HTMLDivElement>) {
      if (e.pointerType !== 'mouse' || e.button !== 0) return
      drag.current = { y: e.clientY, top: e.currentTarget.scrollTop, moved: false }
    },
    onPointerMove(e: PointerEvent<HTMLDivElement>) {
      const d = drag.current
      if (!d) return
      const dy = e.clientY - d.y
      if (!d.moved && Math.abs(dy) < 6) return
      if (!d.moved) e.currentTarget.setPointerCapture(e.pointerId)
      d.moved = true
      e.currentTarget.scrollTop = d.top - dy
    },
    onPointerUp(e: PointerEvent<HTMLDivElement>) {
      const d = drag.current
      drag.current = null
      if (!d?.moved) return
      const el = e.currentTarget
      const stop = (ev: Event) => {
        ev.stopPropagation()
        ev.preventDefault()
      }
      el.addEventListener('click', stop, { capture: true, once: true })
      setTimeout(() => el.removeEventListener('click', stop, { capture: true }), 0)
    },
    onPointerCancel() {
      drag.current = null
    },
  }
}

/** 습격 결과(방금 습격) 또는 습격·포인트 기록 */
export function RaidReportSheet({ reports, castle, chars, log, onClose }: Props) {
  const lost = reports.reduce((s, r) => s + (r.castleHpBefore - r.castleHpAfter), 0)
  const [pointsOpen, setPointsOpen] = useState(false)
  const dragScroll = useDragScroll()
  return (
    <Sheet
      title={log ? '습격 기록' : `습격 ${reports.length}회 발생`}
      aside={!log && <span className="tag mono">성 -{lost}</span>}
      onClose={onClose}
      className="raid-sheet"
    >
      {/* 제목만 고정, 기록·포인트 내역·버튼은 팝업 본문 전체가 스크롤(휠·터치 스와이프·마우스 끌기) */}
      <div className="raid-scroll" {...dragScroll}>
        {!log && <p className="lbl">학습이 멈춘 사이 망각곡선 시점에 맞춰 적이 쳐들어왔음.</p>}
        {reports.length === 0 && <div className="empty-slot">아직 습격이 없음</div>}
        <ul className="raid-list">
          {reports.map((r) => (
            <li key={r.id} className="raid">
              <div className="row" style={{ gap: 8 }}>
                <span className="foes">
                  {r.enemies.map((e) => (
                    <EnemySprite key={e.kind} kind={e.kind} size={32} />
                  ))}
                </span>
                <span className="col grow" style={{ gap: 2, minWidth: 0 }}>
                  <span className="t">{r.enemies.map((e) => `${ENEMY_NAME[e.kind]} ×${e.count}`).join(' · ')}</span>
                  <span className="lbl">
                    학습 {WAVES[r.wave].label} 뒤 · {time(r.at)}
                  </span>
                </span>
                <span className="num loss">-{r.castleHpBefore - r.castleHpAfter}</span>
              </div>
              <span className="lbl">
                피해 {r.rawDamage} 중 {r.blocked} 막음 · 성 HP {r.castleHpBefore} → {r.castleHpAfter}
                {r.defenders.length > 0 &&
                  ` · ${r.defenders.map((d) => `${chars.get(d.charId)?.name ?? '수호'} -${d.damage}${d.hpAfter === 0 ? '(쓰러짐)' : ''}`).join(', ')}`}
              </span>
            </li>
          ))}
        </ul>
        {log && castle.pointLog.length > 0 && (
          <div className="point-box">
            <button type="button" className="point-toggle" aria-expanded={pointsOpen} aria-controls="raid-point-log" onClick={() => setPointsOpen((v) => !v)}>
              <PixelSprite name="i_chev" scale={2} className="chev" />
              <span className="grow">포인트 내역</span>
              <span className="mono cnt">{castle.pointLog.length}건</span>
            </button>
            {pointsOpen && (
              <ul className="point-log" id="raid-point-log">
                {castle.pointLog.map((p, i) => (
                  <li key={i} className="row" style={{ gap: 8 }}>
                    <span className="grow">{p.reason}</span>
                    <span className={`num${p.amount < 0 ? ' minus' : ''}`}>{p.amount > 0 ? `+${p.amount}` : p.amount}P</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {!log && <Button full onClick={onClose}>성 지키러 가기</Button>}
      </div>
    </Sheet>
  )
}
