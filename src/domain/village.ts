import type { Character } from './types'

type Spot = NonNullable<Character['villagePosition']>

/**
 * 마을에 새로 띄울 캐릭터의 배치 후보(타일 좌표, 가로 10칸·세로 7칸).
 * 집·표지판·길 교차점과 겹치지 않는 칸만 앞에서부터 사용함.
 */
export const VILLAGE_SPOTS: Spot[] = [
  { x: 3, y: 2 }, { x: 6, y: 4 }, { x: 8, y: 1 }, { x: 1, y: 5 },
  { x: 9, y: 6 }, { x: 7, y: 2 }, { x: 3, y: 5 }, { x: 8, y: 5 },
  { x: 1, y: 3 }, { x: 6, y: 1 }, { x: 2, y: 4 }, { x: 7, y: 6 },
  { x: 0, y: 2 }, { x: 9, y: 3 }, { x: 4, y: 6 }, { x: 5, y: 5 },
]

const same = (a: Spot, b: Spot) => a.x === b.x && a.y === b.y

/** 다른 캐릭터가 쓰지 않는 첫 후보 칸. 모두 차 있으면 후보를 순환해 겹쳐 배치 */
export function pickFreeSpot(chars: Character[]): Spot {
  const used = chars.flatMap((c) => (c.villagePosition ? [c.villagePosition] : []))
  return VILLAGE_SPOTS.find((s) => !used.some((u) => same(u, s))) ?? VILLAGE_SPOTS[used.length % VILLAGE_SPOTS.length]
}

/*
 * 타일 좌표 ↔ 장면(.field) % 좌표. 가로 10칸·세로 7칸, % 는 캐릭터 발 위치.
 * 드래그로 놓은 위치는 소수 타일 좌표로 저장함(정수 칸 기반 자동 배치와 같은 필드 사용).
 */
const COL = { base: 8, step: 9.4, n: 10 }
const ROW = { base: 14, step: 12.5, n: 7 }
const round2 = (v: number) => Math.round(v * 100) / 100

export function toScenePct(p: Spot): { left: number; top: number } {
  return { left: COL.base + (p.x % COL.n) * COL.step, top: ROW.base + (p.y % ROW.n) * ROW.step }
}

export function fromScenePct(left: number, top: number): Spot {
  return { x: round2((left - COL.base) / COL.step), y: round2((top - ROW.base) / ROW.step) }
}

/** 장면 요소 크기 기준(사용자 요청 2026-11-20: 화면 크기 비율에 맞춘 유동 크기).
 *  iPad 가로(1180x820)의 필드 크기를 기준으로, 기준 1px(--px) = min(필드 폭/w, 필드 높이/h).
 *  CSS(village.css·castle.css)의 --px 식과 같은 값을 써야 함 */
export const FIELD_REF = { village: { w: 1076, h: 753 }, castle: { w: 732, h: 753 } } as const

/** 장면(.field) 기준 % 사각형: 왼쪽·위·오른쪽·아래 */
export interface Zone {
  l: number
  t: number
  r: number
  b: number
}

/** 장면 크기(px)와 호수(배치 금지 구역) 위치. 호수가 장면 밖이면 lake 는 null */
export interface FieldGeom {
  w: number
  h: number
  lake: Zone | null
  pond?: Zone | null
}

/** 스프라이트 원본 크기(칸 수 × 배율) → 장면 % 크기. village.css --px 와 같은 식 */
export function unitsToPct(geom: FieldGeom, wUnits: number, hUnits: number): { w: number; h: number } {
  const px = Math.min(geom.w / FIELD_REF.village.w, geom.h / FIELD_REF.village.h)
  return { w: ((wUnits * px) / geom.w) * 100, h: ((hUnits * px) / geom.h) * 100 }
}

/** 호수와 요소 사이 여유(%) */
const SHORE_GAP = 0.6

/**
 * 호수 금지(사용자 요청 2026-11-20): 상태창(이어 읽기 카드) 아래 호수에는 캐릭터·소품을 둘 수 없음.
 * 발 위치(left·top %)·크기(w·h %)인 요소가 호수와 겹치면 위·왼쪽·오른쪽 중 가장 가까운 물가로 밀어냄.
 * bounds 는 요소가 장면 안에 남는 범위(발 위치 기준).
 */
export function avoidZone(
  p: { left: number; top: number },
  size: { w: number; h: number },
  zone: Zone | null,
  bounds: { minLeft: number; maxLeft: number; minTop: number },
): { left: number; top: number } {
  if (!zone) return p
  const half = size.w / 2
  const hit = p.left + half > zone.l && p.left - half < zone.r && p.top > zone.t && p.top - size.h < zone.b
  if (!hit) return p
  const cands = [
    { left: p.left, top: zone.t - SHORE_GAP },
    { left: zone.l - half - SHORE_GAP, top: p.top },
    { left: zone.r + half + SHORE_GAP, top: p.top },
  ].filter((c) => c.top >= bounds.minTop && c.left >= bounds.minLeft && c.left <= bounds.maxLeft)
  if (cands.length === 0) return { left: p.left, top: Math.max(0, zone.t - SHORE_GAP) }
  const dist = (c: { left: number; top: number }) => Math.hypot(c.left - p.left, c.top - p.top)
  return cands.reduce((a, c) => (dist(c) < dist(a) ? c : a))
}
