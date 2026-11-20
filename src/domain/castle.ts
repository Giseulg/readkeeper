/**
 * 성 모드(지식의 성 디펜스) 규칙. 순수 함수만 둠: mock 서버가 판정에 쓰고, 화면은 표시용 상수만 읽음.
 *
 * 습격 시점·세기 = 에빙하우스 망각곡선(10분 후 망각 시작, 1시간 50%, 1일 70%, 1달 80% 망각).
 * 원래 피해(rawDamage)는 각 시점까지 늘어난 망각률(%p)을 성 최대 HP(100)에 그대로 대응시킴
 *  → 수호 캐릭터가 없으면 1달 뒤 성 HP = 기억 유지율(20%).
 * 학습(읽음 확정·퀴즈·메모)을 하면 망각곡선 기준 시각이 지금으로 돌아가 습격 순서가 처음부터 다시 시작됨.
 */
import type { CastleAction, CastleState, Character, DefenderLevel, EnemyKind, ID, RaidReport } from './types'

const MIN = 60_000

export interface Wave {
  label: string
  afterMin: number
  rawDamage: number
  enemies: Array<{ kind: EnemyKind; count: number }>
}

export const WAVES: Wave[] = [
  { label: '10분', afterMin: 10, rawDamage: 5, enemies: [{ kind: 'ninja', count: 2 }] },
  { label: '1시간', afterMin: 60, rawDamage: 45, enemies: [{ kind: 'ninja', count: 4 }] },
  { label: '1일', afterMin: 60 * 24, rawDamage: 20, enemies: [{ kind: 'ninja', count: 2 }, { kind: 'thief', count: 2 }] },
  { label: '1주', afterMin: 60 * 24 * 7, rawDamage: 5, enemies: [{ kind: 'thief', count: 2 }] },
  { label: '1달', afterMin: 60 * 24 * 30, rawDamage: 5, enemies: [{ kind: 'thief', count: 3 }] },
]

export const ENEMY_NAME: Record<EnemyKind, string> = { ninja: '망각닌자', thief: '기억도둑' }
export const ENEMY_SPRITE: Record<EnemyKind, string> = { ninja: 'e_ninja', thief: 'e_thief' }
/** 적 PNG 스프라이트(32x32). idle = 정지·아이콘, run = 이동 교대 프레임 */
export const ENEMY_IMG: Record<EnemyKind, { idle: string; run: string; atk: string[] }> = {
  ninja: {
    idle: '/sprites/ninja-fox/ninja-fox-v2-idle.png',
    run: '/sprites/ninja-fox/ninja-fox-v2-run.png',
    atk: [1, 2, 3].map((n) => `/sprites/ninja-fox/ninja-fox-v2-attack-${n}.png`),
  },
  thief: {
    idle: '/sprites/squirrel/squirrel-bundle_x1.png',
    run: '/sprites/squirrel/squirrel-gnaw-1.png',
    atk: [1, 2, 3].map((n) => `/sprites/squirrel/squirrel-gnaw-${n}.png`),
  },
}

export const CASTLE_MAX_HP = 100
/** 성 앞 바둑판 필드: 가로 5칸 × 세로 5칸. 칸 번호 = 행 × 5 + 열(0행이 성 바로 앞) */
export const GRID_COLS = 5
export const GRID_ROWS = 5
export const CELL_COUNT = GRID_COLS * GRID_ROWS
/** 한 번에 필드에 세울 수 있는 수호 캐릭터 수 */
export const MAX_DEFENDERS = 4
/** 배치할 수 없는 칸: 1행 가운데(성 바로 앞, 큰 캐릭터가 성을 가림). 배경 잔디로만 그림 */
export const BLOCKED_CELLS: readonly number[] = [2]
export const isBlocked = (i: number) => BLOCKED_CELLS.includes(i)
/** 처음 배치·예전 저장 데이터(자리 4곳) 옮길 때 쓰는 칸 */
const DEFAULT_CELLS = [6, 8, 12, 16]
export const cellLabel = (i: number) => `${Math.floor(i / GRID_COLS) + 1}행 ${(i % GRID_COLS) + 1}열`
/** 성이 갉아먹힌 모습으로 바뀌는 HP 비율 */
export const BITTEN_AT = 0.5

/** 등급별 막는 피해 비율(%)·최대 HP·이름 */
export const LEVELS: Record<DefenderLevel, { block: number; maxHp: number; name: string }> = {
  1: { block: 10, maxHp: 30, name: '견습 수호' },
  2: { block: 15, maxHp: 45, name: '수호 기사' },
  3: { block: 20, maxHp: 60, name: '정예 수호' },
}
/** 수호 캐릭터 전체가 막을 수 있는 최대 비율(%) */
export const BLOCK_CAP = 60
/** 습격 1회에 자리에 선 캐릭터가 각각 받는 피해 = 원래 피해 × 이 값(올림) */
export const DEFENDER_HIT = 0.3

/** 포인트 적립 */
export const EARN = { confirmRead: 10, quizCorrect: 6, quizPartial: 3, quizFinish: 10, memo: 3, dailyVisit: 5 } as const
/** 포인트 사용 */
export const COST = { repair: 20, heal: 10, upgrade: { 2: 40, 3: 80 } as Record<2 | 3, number> } as const
/** 성 수리 1회 회복량 */
export const REPAIR_HP = 25
/** HP 바 색 구간: 50% 초과 초록 · 25% 초과 노랑(a) · 이하 빨강(r) */
export const hpTone = (ratio: number) => (ratio > 0.5 ? '' : ratio > 0.25 ? 'a' : 'r')
const START_POINTS = 30
const KEEP = 10

const iso = (t: number) => new Date(t).toISOString()
const dayOf = (t: number) => iso(t).slice(0, 10)

export function freshCastle(chars: Character[], now: number): CastleState {
  const s: CastleState = {
    hp: CASTLE_MAX_HP,
    maxHp: CASTLE_MAX_HP,
    points: START_POINTS,
    slots: Array<ID | null>(CELL_COUNT).fill(null),
    defenders: {},
    lastStudyAt: iso(now),
    wavesDone: 0,
    reports: [],
    pointLog: [{ at: iso(now), amount: START_POINTS, reason: '지식의 성 건설 기념' }],
  }
  chars.slice(0, 3).forEach((c, i) => (s.slots[DEFAULT_CELLS[i]] = c.id))
  syncDefenders(s, chars)
  return s
}

/** 새로 얻은 캐릭터는 견습 등급으로 추가, 없어진 캐릭터는 자리에서 뺌 */
export function syncDefenders(s: CastleState, chars: Character[]) {
  const ids = new Set(chars.map((c) => c.id))
  for (const c of chars) s.defenders[c.id] ??= { level: 1, hp: LEVELS[1].maxHp }
  // 예전 형식(자리 4곳) → 바둑판 칸으로 옮김
  if (s.slots.length !== CELL_COUNT) {
    const old = s.slots
    s.slots = Array<ID | null>(CELL_COUNT).fill(null)
    old.forEach((id, i) => id && i < DEFAULT_CELLS.length && (s.slots[DEFAULT_CELLS[i]] = id))
  }
  s.slots = s.slots.map((id) => (id && ids.has(id) ? id : null))
  // 막힌 칸에 있던 캐릭터는 빈 칸(기본 칸 우선)으로 옮김
  for (const b of BLOCKED_CELLS) {
    const id = s.slots[b]
    if (!id) continue
    s.slots[b] = null
    const free = [...DEFAULT_CELLS, ...s.slots.keys()].find((i) => !isBlocked(i) && !s.slots[i])
    if (free !== undefined) s.slots[free] = id
  }
}

const alive = (s: CastleState) => s.slots.filter((id): id is ID => Boolean(id && s.defenders[id]?.hp > 0))

/** 지금 자리에 선(쓰러지지 않은) 캐릭터가 막는 피해 비율(%) */
export function blockRate(s: CastleState): number {
  return Math.min(BLOCK_CAP, alive(s).reduce((sum, id) => sum + LEVELS[s.defenders[id].level].block, 0))
}

const dueAt = (s: CastleState, wave: number) => Date.parse(s.lastStudyAt) + WAVES[wave].afterMin * MIN

function applyRaid(s: CastleState, wave: number, at: number): RaidReport {
  const w = WAVES[wave]
  const rate = blockRate(s)
  const blocked = Math.round((w.rawDamage * rate) / 100)
  const before = s.hp
  s.hp = Math.max(0, s.hp - (w.rawDamage - blocked))
  const hit = Math.ceil(w.rawDamage * DEFENDER_HIT)
  const defenders = alive(s).map((charId) => {
    const d = s.defenders[charId]
    const damage = Math.min(d.hp, hit)
    d.hp -= damage
    return { charId, damage, hpAfter: d.hp }
  })
  const report: RaidReport = {
    id: `raid_${at.toString(36)}_${wave}`,
    at: iso(at),
    wave,
    enemies: w.enemies,
    rawDamage: w.rawDamage,
    blocked,
    castleHpBefore: before,
    castleHpAfter: s.hp,
    defenders,
    seen: false,
  }
  s.reports = [report, ...s.reports].slice(0, KEEP)
  return report
}

/** now 까지 지난 습격을 시각 순서대로 판정 */
export function resolveRaids(s: CastleState, now: number) {
  while (s.wavesDone < WAVES.length && dueAt(s, s.wavesDone) <= now) {
    applyRaid(s, s.wavesDone, dueAt(s, s.wavesDone))
    s.wavesDone++
  }
}

export function earn(s: CastleState, amount: number, reason: string, now: number) {
  if (amount <= 0) return
  s.points += amount
  s.pointLog = [{ at: iso(now), amount, reason }, ...s.pointLog].slice(0, KEEP)
}

/** 학습 이벤트: 밀린 습격을 먼저 판정하고, 포인트 적립 후 망각곡선을 지금부터 다시 시작 */
export function study(s: CastleState, amount: number, reason: string, now: number) {
  resolveRaids(s, now)
  earn(s, amount, reason, now)
  s.lastStudyAt = iso(now)
  s.wavesDone = 0
}

/** 하루 첫 방문 보너스 */
export function visit(s: CastleState, now: number) {
  const day = dayOf(now)
  if (s.lastVisitDay === day) return
  s.lastVisitDay = day
  earn(s, EARN.dailyVisit, '오늘의 방문', now)
}

/** 응답용: 다음 습격 정보 채움 */
export function withNextRaid(s: CastleState): CastleState {
  const w = s.wavesDone
  return {
    ...s,
    nextRaid: w < WAVES.length ? { at: iso(dueAt(s, w)), wave: w, enemies: WAVES[w].enemies } : undefined,
  }
}

/** 데모용: 다음 습격 시각이 지금이 되도록 망각곡선 기준 시각을 앞당김 */
export function skipToNextRaid(s: CastleState, now: number) {
  if (s.wavesDone >= WAVES.length) return
  const shift = dueAt(s, s.wavesDone) - now
  if (shift > 0) s.lastStudyAt = iso(Date.parse(s.lastStudyAt) - shift)
}

/** 포인트 사용(성 행동·마을 꾸미기 해금 공용). 모자라면 사유 문자열 */
export const spend = (s: CastleState, cost: number, reason: string, now: number): string | null => {
  if (s.points < cost) return `포인트가 ${cost - s.points}점 모자람`
  s.points -= cost
  s.pointLog = [{ at: iso(now), amount: -cost, reason }, ...s.pointLog].slice(0, KEEP)
  return null
}

/** 사용자 행동 처리. 실패 시 사유 문자열 */
export function applyAction(s: CastleState, a: CastleAction, now: number): string | null {
  switch (a.type) {
    case 'repair': {
      if (s.hp >= s.maxHp) return '성이 이미 온전함'
      const err = spend(s, COST.repair, '성 수리', now)
      if (!err) s.hp = Math.min(s.maxHp, s.hp + REPAIR_HP)
      return err
    }
    case 'heal': {
      const d = s.defenders[a.charId]
      if (!d) return '없는 캐릭터'
      if (d.hp >= LEVELS[d.level].maxHp) return '이미 체력이 가득함'
      const err = spend(s, COST.heal, '캐릭터 회복', now)
      if (!err) d.hp = LEVELS[d.level].maxHp
      return err
    }
    case 'upgrade': {
      const d = s.defenders[a.charId]
      if (!d) return '없는 캐릭터'
      if (d.level >= 3) return '최고 등급임'
      const next = (d.level + 1) as 2 | 3
      const err = spend(s, COST.upgrade[next], `${LEVELS[next].name} 해금`, now)
      if (!err) {
        d.level = next
        d.hp = LEVELS[next].maxHp
      }
      return err
    }
    case 'slot': {
      if (a.index < 0 || a.index >= CELL_COUNT) return '없는 칸'
      if (isBlocked(a.index)) return '이 칸에는 캐릭터를 세울 수 없음'
      if (a.charId && !s.defenders[a.charId]) return '없는 캐릭터'
      const placed = s.slots.filter(Boolean).length
      const moving = a.charId !== null && s.slots.includes(a.charId)
      if (a.charId && !moving && !s.slots[a.index] && placed >= MAX_DEFENDERS)
        return `필드에는 최대 ${MAX_DEFENDERS}명까지 세울 수 있음. 다른 칸의 캐릭터를 빼거나 옮겨야 함`
      // 다른 칸에 있던 캐릭터면 옮기고, 옮겨 갈 칸에 있던 캐릭터와는 자리를 바꿈
      const from = a.charId ? s.slots.indexOf(a.charId) : -1
      const prev = s.slots[a.index]
      if (from >= 0) s.slots[from] = prev
      s.slots[a.index] = a.charId
      return null
    }
    case 'ack':
      s.reports = s.reports.map((r) => ({ ...r, seen: true }))
      return null
  }
}
