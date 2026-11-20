import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import blipUrl from '@/assets/dialogue-blip.wav'
import { useSettings } from '@/hooks/queries'
import { PixelSprite } from '@/components/pixel/PixelSprite'
import { FLAIL_FRAMES, SPRITES, flailSprite } from '@/components/pixel/sprites'
import type { Character } from '@/domain/types'
import { FIELD_REF, avoidZone, fromScenePct, toScenePct, unitsToPct, type FieldGeom } from '@/domain/village'

import { constrainRoamPoint, roamingZones, useVillageRoam } from './useVillageRoam'

/** 이 거리(px) 이상 움직여야 드래그로 봄. 그보다 짧으면 탭 */
const DRAG_THRESHOLD = 6
/** 바둥 프레임 간격(ms) */
const FLAIL_MS = 110

interface Props {
  char: Character
  /** 캐릭터를 둘 수 있는 장면 요소(.field) */
  fieldRef: React.RefObject<HTMLDivElement | null>
  /** 놓은 위치(타일 좌표, 소수 허용) */
  onDrop: (pos: { x: number; y: number }) => void
  /** 드래그 없이 눌렀다 뗀 경우. 캐릭터 상세 등 */
  onInfo?: () => void
  /** 장면 크기·호수 위치. 호수(상태창 자리)에는 놓을 수 없음 */
  geom?: FieldGeom | null
  paused?: boolean
}

/** 마을 캐릭터 배율(PixelSprite scale) */
const SCALE = 3

/**
 * 마을 캐릭터 1개. 터치·마우스로 끌어 옮김.
 * 끄는 동안 팔다리 바둥 프레임 + 찡그린 표정, 놓으면 원래 모습으로.
 */
export function VillageCharacter({ char, fieldRef, onDrop, onInfo, geom, paused }: Props) {
  const rows = SPRITES[char.sprite]
  const wUnits = (rows ? Math.max(...rows.map((r) => r.length)) : 32) * SCALE
  const hUnits = (rows?.length ?? 32) * SCALE
  /** 호수와 겹치면 물가로 밀어낸 위치(저장값은 그대로, 화면 크기에 따라 호수 위치가 달라서) */
  const keepDry = (p: { left: number; top: number }, g: FieldGeom, minTop: number) =>
    avoidZone(p, unitsToPct(g, wUnits, hUnits), g.lake, { minLeft: 4, maxLeft: 96, minTop })
  const saved = toScenePct(char.villagePosition!)
  const zones = useMemo(() => geom ? roamingZones(geom, unitsToPct(geom, wUnits, hUnits)) : [], [geom, wUnits, hUnits])
  const anchor = useMemo(() => constrainRoamPoint(
    { left: saved.left, top: saved.top }, zones,
  ), [saved.left, saved.top, zones])
  const [drag, setDrag] = useState<{ left: number; top: number } | null>(null)
  const [pressed, setPressed] = useState(false)
  const [frame, setFrame] = useState(0)
  const [reaction, setReaction] = useState(0)
  const timer = useRef<number | undefined>(undefined)
  const audio = useRef<HTMLAudioElement | null>(null)
  const settings = useSettings()
  const soundEnabled = settings.data?.learning.gameSound ?? false

  useEffect(() => () => window.clearTimeout(timer.current), [])
  useEffect(() => () => { audio.current?.pause(); audio.current = null }, [soundEnabled])
  const greet = () => {
    window.clearTimeout(timer.current)
    setReaction((previous) => previous + 1)
    timer.current = window.setTimeout(() => setReaction(0), 3000)
    if (soundEnabled) {
      audio.current ??= new Audio(blipUrl)
      audio.current.currentTime = 0
      audio.current.preservesPitch = false
      audio.current.volume = 0.24
      void audio.current.play().catch(() => undefined)
    }
  }
  const g = useRef<{ id: number; sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null)

  const dragging = drag !== null
  const pose = useVillageRoam(char.id, anchor, geom, zones, Boolean(paused || pressed || dragging || reaction))
  useEffect(() => {
    if (!dragging) return
    const t = window.setInterval(() => setFrame((f) => (f + 1) % FLAIL_FRAMES), FLAIL_MS)
    return () => window.clearInterval(t)
  }, [dragging])

  /** 포인터 좌표 → 장면 % (발 위치). 머리가 장면 위로 잘리지 않게 위쪽 여유를 둠 */
  const pctAt = (st: { ox: number; oy: number }, cx: number, cy: number) => {
    const r = fieldRef.current!.getBoundingClientRect()
    const left = ((cx - st.ox - r.left) / r.width) * 100
    const top = ((cy - st.oy - r.top) / r.height) * 100
    // 캐릭터 높이 = 원본 칸 수 × 배율 × 기준 1px(village.css --px 와 같은 식)
    const px = Math.min(r.width / FIELD_REF.village.w, r.height / FIELD_REF.village.h)
    const minTop = Math.min(60, ((hUnits * px) / r.height) * 100)
    const p = { left: Math.min(96, Math.max(4, left)), top: Math.min(100, Math.max(minTop, top)) }
    return zones.length ? constrainRoamPoint(p, zones)
      : geom ? keepDry(p, { ...geom, w: r.width, h: r.height }, minTop) : p
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || !fieldRef.current) return
    const r = fieldRef.current.getBoundingClientRect()
    // 누른 지점과 발 위치의 차이를 기억해 끌 때 캐릭터가 손가락 아래로 튀지 않게 함
    const footX = r.left + (pose.left / 100) * r.width
    const footY = r.top + (pose.top / 100) * r.height
    g.current = { id: e.pointerId, sx: e.clientX, sy: e.clientY, ox: e.clientX - footX, oy: e.clientY - footY, moved: false }
    setPressed(true)
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const st = g.current
    if (!st || st.id !== e.pointerId) return
    if (!st.moved && Math.hypot(e.clientX - st.sx, e.clientY - st.sy) < DRAG_THRESHOLD) return
    st.moved = true
    setDrag(pctAt(st, e.clientX, e.clientY))
  }

  const end = (e: ReactPointerEvent<HTMLDivElement>, cancel: boolean) => {
    const st = g.current
    if (!st || st.id !== e.pointerId) return
    g.current = null
    setPressed(false)
    if (st.moved) {
      if (!cancel) {
        const p = pctAt(st, e.clientX, e.clientY)
        onDrop(fromScenePct(p.left, p.top))
      }
    } else if (!cancel) greet()
    setDrag(null)
    setFrame(0)
  }

  const at = drag ?? pose
  return (
    <div
      className={'chr' + (dragging ? ' dragging' : '')}
      data-greeting={reaction > 0}
      style={{ left: `${at.left}%`, top: `${at.top}%`, zIndex: dragging ? 200 : Math.round(at.top), '--hop-lift': String(pose.lift) + "px" } as CSSProperties}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(e) => end(e, false)}
      onPointerCancel={(e) => end(e, true)}
      onLostPointerCapture={(e) => end(e, true)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          greet()
        }
      }}
      aria-label={`${char.name}: 누르면 인사, 끌면 옮기기`}
    >
      {reaction > 0 && <span className="chr-bubble" role="status" onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}>
        안녕! 내 이름은 {char.name}. <button type="button" onClick={(e) => { e.stopPropagation(); onInfo?.() }} onKeyDown={(e) => e.stopPropagation()}>정보</button>
      </span>}
      <span className="chr-body" key={reaction}>
        <span className="chr-hop">
          <PixelSprite name={dragging ? flailSprite(char.sprite, frame) : char.sprite} scale={SCALE} fluid title={char.name} />
        </span>
        <span className="sh" />
      </span>
    </div>
  )
}
