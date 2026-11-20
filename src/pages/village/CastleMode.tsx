import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { EnemySprite } from './EnemySprite'
import { MOCK_MODE } from '@/appMode'
import { PixelSprite } from '@/components/pixel/PixelSprite'
import { FLAIL_FRAMES, flailSprite } from '@/components/pixel/sprites'
import { Button } from '@/components/ui'
import { BITTEN_AT, CELL_COUNT, COST, ENEMY_NAME, GRID_COLS, GRID_ROWS, LEVELS, isBlocked, MAX_DEFENDERS, WAVES, blockRate, cellLabel, hpTone } from '@/domain/castle'
import type { Character, RaidReport } from '@/domain/types'
import { useCastle, useCastleAction, useCastleSkip } from '@/hooks/queries'
import { DefenderSheet } from './DefenderSheet'
import { RaidReportSheet } from './RaidReportSheet'
import './castle.css'

/*
 * 맵(사용자 스케치 기준): 위 가운데 지식의 성(마을 집과 같은 가운데 위치), 그 아래 5×5 바둑판 타일 필드.
 * 수호 캐릭터는 원하는 칸에 세우고(최대 4명), 적은 필드 아래쪽에서 성을 향해 올라옴.
 */
/** 습격 연출: 적이 달려오는 시간(ms) → 명중 → 결과 시트 */
const RUN_MS = 1300
/** 대상 옆에 도착한 뒤 공격 모션 시작 → 칼날이 닿는 순간(피격 플래시·상흔) */
const STRIKE_MS = RUN_MS + 240
/** 공격 모션이 끝나고 피해가 반영되는 순간 */
const HIT_MS = RUN_MS + 720
const SHEET_MS = HIT_MS + 1100
/** 이 거리(px) 이상 움직여야 드래그로 봄. 그보다 짧으면 탭(칸 시트 열기) */
const DRAG_THRESHOLD = 6
const FLAIL_MS = 110

/** 화면 좌표 아래에 있는 바둑판 칸 번호(없으면 null) */
function cellAt(x: number, y: number): number | null {
  const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('.tile[data-index]')
  return el ? Number(el.dataset.index) : null
}

function untilText(ms: number) {
  if (ms <= 0) return '곧'
  const m = Math.ceil(ms / 60_000)
  if (m < 60) return `${m}분 후`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}시간 ${m % 60}분 후`
  return `${Math.floor(h / 24)}일 후`
}

/** 1분마다 바뀌는 현재 시각(다음 습격 카운트다운용) */
function useNow(step = 30_000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), step)
    return () => clearInterval(t)
  }, [step])
  return now
}


interface Props {
  chars: Character[]
}

/** 1.0 랜딩홈 > 성 모드: 지식의 성 디펜스 (장면 field 안쪽 + 아래 상태 카드) */
export function CastleMode({ chars }: Props) {
  const castle = useCastle()
  const act = useCastleAction()
  const skip = useCastleSkip()
  const now = useNow()
  const [slotOpen, setSlotOpen] = useState<number | null>(null)
  const [logOpen, setLogOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 습격 연출: 확인하지 않은 습격 기록이 있으면 오래된 것부터 한 번에 재생
  const [play, setPlay] = useState<RaidReport[] | null>(null)
  const [hit, setHit] = useState(false)
  const [phase, setPhase] = useState<'run' | 'atk' | 'strike'>('run')
  const [reportOpen, setReportOpen] = useState(false)
  const data = castle.data
  const unseenKey = data?.reports.filter((r) => !r.seen).map((r) => r.id).join(',') ?? ''
  useEffect(() => {
    if (!data || !unseenKey) return
    const batch = data.reports.filter((r) => !r.seen).reverse()
    setPlay(batch)
    setHit(false)
    setPhase('run')
    setReportOpen(false)
    const ts = [
      setTimeout(() => setPhase('atk'), RUN_MS),
      setTimeout(() => setPhase('strike'), STRIKE_MS),
      setTimeout(() => setHit(true), HIT_MS),
      setTimeout(() => setReportOpen(true), SHEET_MS),
    ]
    return () => ts.forEach(clearTimeout)
    // 새 습격 기록이 생길 때만 다시 재생
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unseenKey])

  const byId = useMemo(() => new Map(chars.map((c) => [c.id, c])), [chars])

  // 칸 사이 드래그: 캐릭터가 선 칸을 눌러 끌면 바둥거리며 손가락을 따라오고, 놓은 칸으로 옮김(있던 캐릭터와는 자리 바꿈)
  const fieldRef = useRef<HTMLDivElement>(null)
  // 습격 재생 시 칸·성 위치를 재서 적이 설 자리(대상 옆, 발 기준)를 구함
  const [spots, setSpots] = useState<Record<string, { x: number; y: number; w: number }>>({})
  useLayoutEffect(() => {
    const f = fieldRef.current
    if (!play || !f) return
    const fr = f.getBoundingClientRect()
    const out: Record<string, { x: number; y: number; w: number }> = {}
    f.querySelectorAll<HTMLElement>('.tile[data-index]').forEach((t) => {
      const r = t.getBoundingClientRect()
      out[t.dataset.index!] = { x: r.left - fr.left + r.width / 2, y: r.bottom - fr.top, w: r.width }
    })
    const c = f.querySelector<HTMLElement>('.castle .px')
    if (c) {
      const r = c.getBoundingClientRect()
      out.castle = { x: r.left - fr.left + r.width / 2, y: r.bottom - fr.top, w: r.width * 0.7 }
    }
    setSpots(out)
  }, [play])
  const g = useRef<{ id: number; from: number; sx: number; sy: number; moved: boolean } | null>(null)
  const suppressClick = useRef(false)
  const [drag, setDrag] = useState<{ from: number; x: number; y: number; over: number | null } | null>(null)
  const [frame, setFrame] = useState(0)
  const dragging = drag !== null
  useEffect(() => {
    if (!dragging) return
    const t = window.setInterval(() => setFrame((f) => (f + 1) % FLAIL_FRAMES), FLAIL_MS)
    return () => window.clearInterval(t)
  }, [dragging])

  if (!data) {
    return (
      <>
        <div className="field">
          <div className="path-v" />
          <div className="path-h" />
        </div>
        {castle.isError && (
          <div className="castle-panel">
            <span className="lbl" role="alert">{castle.error.message}</span>
          </div>
        )}
      </>
    )
  }

  const playing = play !== null && !hit
  const shownHp = playing ? play[0].castleHpBefore : data.hp
  const ratio = shownHp / data.maxHp
  const bitten = ratio <= BITTEN_AT
  const totalCastleDmg = play ? play[0].castleHpBefore - data.hp : 0
  /** 연출 중에는 맞기 전 HP를 보여줌 */
  const defenderHp = (id: string) => {
    const d = data.defenders[id]
    if (!d) return 0
    if (!playing) return d.hp
    const dmg = play.flatMap((r) => r.defenders).filter((x) => x.charId === id).reduce((s, x) => s + x.damage, 0)
    return Math.min(LEVELS[d.level].maxHp, d.hp + dmg)
  }
  const enemies = play
    ? play.flatMap((r) => r.enemies.flatMap((e) => Array.from({ length: e.count }, () => e.kind))).slice(0, 8)
    : []
  // 공격 대상: 피해를 입은 수호 캐릭터 칸, 성이 피해를 입었으면 성도 포함(적마다 번갈아 배정)
  const hitCells = play
    ? [...new Set(play.flatMap((r) => r.defenders).filter((x) => x.damage > 0).map((x) => x.charId))]
        .map((id) => data.slots.indexOf(id))
        .filter((i) => i >= 0)
    : []
  const targets: Array<number | 'castle'> = [...(totalCastleDmg > 0 || hitCells.length === 0 ? ['castle' as const] : []), ...hitCells]
  const targetOf = (i: number) => targets[i % targets.length]
  const struckCells = new Set(enemies.map((_, i) => targetOf(i)))
  /** 대상별 첫 공격자: 블레이드 잔상 색(망각닌자 청록·기억도둑 주황)과 방향(오른쪽에서 베면 좌우 반전) */
  const slashOf = (t: number | 'castle') => {
    const i = enemies.findIndex((_, j) => targetOf(j) === t)
    const kind = enemies[i]
    return `slash ${kind}${play && phase !== 'run' ? ' on' : ''}`
  }

  const run = (a: Parameters<typeof act.mutate>[0]) =>
    act.mutate(a, { onSuccess: () => setError(null), onError: (e) => setError(e.message) })

  const onTileDown = (i: number) => (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0 || !data.slots[i] || playing) return
    g.current = { id: e.pointerId, from: i, sx: e.clientX, sy: e.clientY, moved: false }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onTileMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const st = g.current
    if (!st || st.id !== e.pointerId || !fieldRef.current) return
    if (!st.moved && Math.hypot(e.clientX - st.sx, e.clientY - st.sy) < DRAG_THRESHOLD) return
    st.moved = true
    const r = fieldRef.current.getBoundingClientRect()
    setDrag({ from: st.from, x: e.clientX - r.left, y: e.clientY - r.top, over: cellAt(e.clientX, e.clientY) })
  }
  const onTileEnd = (e: ReactPointerEvent<HTMLButtonElement>, cancel: boolean) => {
    const st = g.current
    if (!st || st.id !== e.pointerId) return
    g.current = null
    if (st.moved) {
      // 드래그 뒤 따라오는 click 이 칸 시트를 열지 않게 함
      suppressClick.current = true
      const to = cancel ? null : cellAt(e.clientX, e.clientY)
      const id = data.slots[st.from]
      if (to !== null && to !== st.from && id) run({ type: 'slot', index: to, charId: id })
    }
    setDrag(null)
    setFrame(0)
  }

  const closeReport = () => {
    setReportOpen(false)
    setPlay(null)
    act.mutate({ type: 'ack' })
  }

  const next = data.nextRaid
  const rate = blockRate(data)
  const placed = data.slots.filter(Boolean).length
  // 칸 안 캐릭터: HP 바·별 자리(약 14px)를 빼고 들어가는 정수배(1~3배)

  return (
    <>
      <div className={`field castle-field${dragging ? ' dragging' : ''}`} ref={fieldRef}>
        <div className="castle-top">
          <div className={`castle${hit && play ? ' hit' : ''}${play && phase === 'strike' && !hit && struckCells.has('castle') ? ' struck' : ''}`}>
            <div className="castle-hp" role="meter" aria-label="지식의 성 HP" aria-valuemin={0} aria-valuemax={data.maxHp} aria-valuenow={shownHp}>
              <span className="nm">지식의 성</span>
              <div className="hpbar big">
                <i className={hpTone(ratio)} style={{ width: `${Math.max(0, ratio * 100)}%` }} />
                <span className="num">{shownHp}/{data.maxHp}</span>
              </div>
            </div>
            <PixelSprite name={bitten ? 'castle~bitten' : 'castle'} scale={6} fluid title={bitten ? '갉아먹힌 지식의 성' : '지식의 성'} />
            {play && (phase === 'strike' || hit) && struckCells.has('castle') && <span className={slashOf('castle')} aria-hidden="true" />}
            {hit && play && totalCastleDmg > 0 && <span className="dmg">-{totalCastleDmg}</span>}
          </div>
        </div>

        <div className="board-wrap">
          <div
            className="board"
            role="grid"
            aria-label={`수호 필드 ${GRID_COLS}×${GRID_ROWS}, ${placed}/${MAX_DEFENDERS}명 배치`}
          >
            {Array.from({ length: CELL_COUNT }, (_, i) => {
              const id = data.slots[i]
              const c = id ? byId.get(id) : undefined
              const st = id ? data.defenders[id] : undefined
              const hp = c ? defenderHp(c.id) : 0
              const dark = (Math.floor(i / GRID_COLS) + (i % GRID_COLS)) % 2 === 0
              // 배치 불가 칸: 배경 잔디만 보이는 빈 자리(누르기·놓기 대상 아님)
              if (isBlocked(i)) return <div key={i} className="tile blocked" role="gridcell" aria-label={`${cellLabel(i)} 배치 불가`} />
              return (
                <button
                  key={i}
                  type="button"
                  role="gridcell"
                  data-index={i}
                  className={`tile${dark ? ' d' : ''}${c ? ' guard' : ''}${c && hp === 0 ? ' ko' : ''}${drag?.from === i ? ' lifted' : ''}${play && phase === 'strike' && !hit && struckCells.has(i) ? ' struck' : ''}${drag && drag.over === i && drag.from !== i ? ' over' : ''}`}
                  aria-label={c ? `${cellLabel(i)} ${c.name}: 누르면 관리, 끌면 옮기기` : `${cellLabel(i)} 빈 칸`}
                  onPointerDown={onTileDown(i)}
                  onPointerMove={onTileMove}
                  onPointerUp={(e) => onTileEnd(e, false)}
                  onPointerCancel={(e) => onTileEnd(e, true)}
                  onLostPointerCapture={(e) => onTileEnd(e, true)}
                  onClick={() => {
                    if (suppressClick.current) {
                      suppressClick.current = false
                      return
                    }
                    setSlotOpen(i)
                  }}
                >
                  {c && st && (
                    <>
                      <span className="tile-hud">
                        <span className="stars" aria-label={`${st.level}등급`}>{'★'.repeat(st.level)}</span>
                        <span className="hpbar">
                          <i className={hpTone(hp / LEVELS[st.level].maxHp)} style={{ width: `${(hp / LEVELS[st.level].maxHp) * 100}%` }} />
                        </span>
                      </span>
                      <PixelSprite name={c.sprite} scale={4.5} fluid />
                      {play && (phase === 'strike' || hit) && struckCells.has(i) && <span className={slashOf(i)} aria-hidden="true" />}
                      {hp === 0 && <span className="ko-tag">쓰러짐</span>}
                    </>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {drag && data.slots[drag.from] && byId.get(data.slots[drag.from]!) && (
          <div className="drag-ghost" style={{ left: drag.x, top: drag.y }} aria-hidden="true">
            <PixelSprite name={flailSprite(byId.get(data.slots[drag.from]!)!.sprite, frame)} scale={4.5} fluid />
          </div>
        )}

        {enemies.map((kind, i) => {
          // 필드 아래쪽 열에서 출발해 공격 대상(칸 캐릭터 또는 성) 바로 옆까지 달려가 공격함
          const col = [1, 3, 0, 4, 2][i % 5]
          const tg = targetOf(i)
          const spot = spots[String(tg)]
          // 같은 대상에 붙는 적은 왼쪽·오른쪽 번갈아 섬
          const nth = enemies.slice(0, i).filter((_, j) => targetOf(j) === tg).length
          const left = nth % 2 === 0
          const ex = spot ? `${spot.x + (left ? -1 : 1) * spot.w * 0.42}px` : `calc(50% + ${(col - 2) * 22}px)`
          const ey = spot ? `${spot.y - 2 - Math.floor(nth / 2) * 6}px` : 'var(--castle-h)'
          const style = {
            '--sx': `${((col + 0.5) / GRID_COLS) * 100}%`,
            '--sy': 'calc(100% + 40px)',
            '--ex': ex,
            '--ey': ey,
            animationDelay: `${Math.floor(i / 2) * 60}ms`,
          } as CSSProperties
          // 대상 쪽을 바라봄: 왼쪽에 선 적은 오른쪽을 봐야 하므로 뒤집음(원본 스프라이트는 왼쪽을 봄)
          const atk = phase !== 'run' && !hit
          return (
            <div key={i} className={`enemy${left ? ' flip' : ''}${atk ? ' atk' : ''}${hit ? ' gone' : ''}`} style={style} aria-hidden="true">
              {atk ? (
                <>
                  <span className="a0"><EnemySprite kind={kind} frame={0} fluid /></span>
                  <span className="a1"><EnemySprite kind={kind} frame={1} fluid /></span>
                  <span className="a2"><EnemySprite kind={kind} frame={2} fluid /></span>
                </>
              ) : (
                <>
                  <span className="f0"><EnemySprite kind={kind} fluid /></span>
                  <span className="f1"><EnemySprite kind={kind} frame="run" fluid /></span>
                </>
              )}
            </div>
          )
        })}
      </div>

      <div className="castle-panel">
        <div className="row" style={{ gap: 8, alignItems: 'center' }}>
          <span className="pts" aria-label={`지식 포인트 ${data.points}점`}>
            <PixelSprite name="i_star" scale={2} color="var(--gold)" />
            <span className="num">{data.points}</span>
            <span className="u">P</span>
          </span>
          <span className="tag mono" title="자리에 선 수호 캐릭터가 막는 피해 비율">방어 {rate}%</span>
          <span className="grow" />
          {MOCK_MODE && next && (
            <button type="button" className="chip skip" title="데모: 다음 습격 시각까지 시간을 건너뜀" onClick={() => skip.mutate()} disabled={skip.isPending}>
              <PixelSprite name="i_ff" scale={2} />
              건너뛰기
            </button>
          )}
          <button type="button" className="chip" onClick={() => setLogOpen(true)}>
            기록
          </button>
        </div>

        <div className="next">
          {next ? (
            <>
              <span className="foes" aria-hidden="true">
                {next.enemies.map((e) => (
                  <EnemySprite key={e.kind} kind={e.kind} size={32} />
                ))}
              </span>
              <span className="col grow" style={{ gap: 2, minWidth: 0 }}>
                <span className="lbl">다음 습격 · 학습 {WAVES[next.wave].label} 뒤</span>
                <span className="t">
                  {next.enemies.map((e) => `${ENEMY_NAME[e.kind]} ×${e.count}`).join(' · ')}
                </span>
              </span>
              <span className="num when">{untilText(Date.parse(next.at) - now)}</span>
            </>
          ) : (
            <span className="lbl">이번 망각곡선의 습격이 모두 끝남. 읽거나 퀴즈를 풀면 다시 시작됨.</span>
          )}
        </div>

        {/* 습격 일정(망각곡선 5시점): 가로형 오른쪽 패널에서만 보임 */}
        <ol className="raid-plan" aria-label="이번 망각곡선 습격 일정">
          {WAVES.map((w, i) => {
            const at = Date.parse(data.lastStudyAt) + w.afterMin * 60_000
            const state = i < data.wavesDone ? 'done' : i === data.wavesDone ? 'next' : 'later'
            return (
              <li key={w.label} className={state}>
                <span className="when-l">{w.label}</span>
                <span className="foes" aria-hidden="true">
                  {w.enemies.map((e) => (
                    <EnemySprite key={e.kind} kind={e.kind} size={32} />
                  ))}
                </span>
                <span className="grow who">{w.enemies.map((e) => `${ENEMY_NAME[e.kind]}×${e.count}`).join(' ')}</span>
                <span className="st">{state === 'done' ? '지남' : untilText(at - now)}</span>
              </li>
            )
          })}
        </ol>

        {error && <p className="lbl err" role="alert">{error}</p>}

        <div className="row acts" style={{ gap: 8 }}>
          <Button
            variant="ghost"
            size="sm"
            full
            icon="i_heart"
            trailing={`${COST.repair}P`}
            disabled={data.hp >= data.maxHp || act.isPending}
            onClick={() => run({ type: 'repair' })}
          >
            성 수리
          </Button>
          <Button size="sm" full icon="i_book" to="/library">
            읽고 포인트 얻기
          </Button>
        </div>
      </div>

      {slotOpen !== null && (
        <DefenderSheet
          castle={data}
          chars={chars}
          index={slotOpen}
          pending={act.isPending}
          error={error}
          onAction={run}
          onClose={() => {
            setSlotOpen(null)
            setError(null)
          }}
        />
      )}
      {reportOpen && play && <RaidReportSheet reports={play} castle={data} chars={byId} onClose={closeReport} />}
      {logOpen && <RaidReportSheet reports={data.reports} castle={data} chars={byId} log onClose={() => setLogOpen(false)} />}
    </>
  )
}
