/**
 * 마을 꾸미기(사용자 요청 2026-11-20): [내 마을] 버튼 → 꾸미기 모드에서 소품을 고르고 끌어서 배치·이동·회수.
 * 기본 소품(지금까지 장면에 있던 집·나무·덤불·꽃·표지판·울타리·가로등)은 처음부터 배치 가능,
 * 새 소품(벤치·우체통·바위·우물)은 지식 포인트(성 모드와 같은 포인트)로 해금.
 * 순수 함수만 둠: mock 서버가 검증에 쓰고 화면은 표시용으로 읽음.
 */
import type { DecorItem, DecorKind, VillageLayout } from './types'

export interface DecorDef {
  kind: DecorKind
  name: string
  sprite: string
  /** PixelSprite fluid 배율(원본 칸 수 × scale × --px) */
  scale: number
  /** 해금 비용(지식 포인트). 0 = 기본 소품 */
  cost: number
  /** 장면에 놓을 수 있는 최대 개수 */
  max: number
  /** 회수 불가(집: 캐릭터 표시 선택 버튼 역할) */
  fixed?: boolean
}

export const DECOR_CATALOG: DecorDef[] = [
  { kind: 'house', name: '내 집', sprite: 'house', scale: 6, cost: 0, max: 1, fixed: true },
  { kind: 'tree', name: '나무', sprite: 'tree', scale: 4, cost: 0, max: 8 },
  { kind: 'bush', name: '덤불', sprite: 'bush', scale: 3, cost: 0, max: 8 },
  { kind: 'flowerv', name: '보라 꽃', sprite: 'flowerv', scale: 4, cost: 0, max: 10 },
  { kind: 'flowery', name: '노랑 꽃', sprite: 'flowery', scale: 4, cost: 0, max: 10 },
  { kind: 'sign', name: '표지판', sprite: 'sign', scale: 3, cost: 0, max: 3 },
  { kind: 'fence', name: '울타리', sprite: 'fence', scale: 4, cost: 0, max: 10 },
  { kind: 'lamp', name: '가로등', sprite: 'lamp', scale: 3, cost: 0, max: 4 },
  { kind: 'rock', name: '바위', sprite: 'rock', scale: 3, cost: 5, max: 6 },
  { kind: 'mailbox', name: '우체통', sprite: 'mailbox', scale: 3, cost: 10, max: 2 },
  { kind: 'bench', name: '벤치', sprite: 'bench', scale: 4, cost: 15, max: 4 },
  { kind: 'well', name: '우물', sprite: 'well', scale: 4, cost: 30, max: 1 },
]

export const DECOR: Record<DecorKind, DecorDef> = Object.fromEntries(DECOR_CATALOG.map((d) => [d.kind, d])) as Record<DecorKind, DecorDef>

export const BASIC_KINDS: DecorKind[] = DECOR_CATALOG.filter((d) => d.cost === 0).map((d) => d.kind)

/** 처음 마을 모습(예전 장면 고정 소품과 같은 자리) */
export const DEFAULT_ITEMS: DecorItem[] = [
  { id: 'd-house', kind: 'house', x: 50, y: 20 },
  { id: 'd-lamp', kind: 'lamp', x: 62, y: 20 },
  { id: 'd-tree1', kind: 'tree', x: 12, y: 18 },
  { id: 'd-tree2', kind: 'tree', x: 88, y: 20 },
  { id: 'd-tree3', kind: 'tree', x: 10, y: 100 },
  { id: 'd-fence', kind: 'fence', x: 80, y: 42 },
  { id: 'd-bush1', kind: 'bush', x: 14, y: 50 },
  { id: 'd-bush2', kind: 'bush', x: 30, y: 96 },
  { id: 'd-flower1', kind: 'flowerv', x: 22, y: 44 },
  { id: 'd-flower2', kind: 'flowery', x: 40, y: 86 },
  { id: 'd-flower3', kind: 'flowery', x: 92, y: 50 },
  { id: 'd-sign', kind: 'sign', x: 42, y: 52 },
]

export function freshLayout(): VillageLayout {
  return { items: structuredClone(DEFAULT_ITEMS), unlocked: [...BASIC_KINDS] }
}

export const countOf = (items: DecorItem[], kind: DecorKind) => items.filter((i) => i.kind === kind).length

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const round1 = (v: number) => Math.round(v * 10) / 10

/** 저장 전 검증: 해금 안 된 종류·최대 개수 초과 제거, 좌표 범위 제한, 집은 항상 1개. 실패 사유가 있으면 문자열 */
export function sanitizeItems(items: DecorItem[], unlocked: DecorKind[], prev: DecorItem[]): DecorItem[] | string {
  const out: DecorItem[] = []
  for (const it of items) {
    const def = DECOR[it.kind]
    if (!def) return '없는 소품'
    if (!unlocked.includes(it.kind)) return `${def.name}은(는) 아직 해금되지 않음`
    if (countOf(out, it.kind) >= def.max) return `${def.name}은(는) 최대 ${def.max}개까지 놓을 수 있음`
    if (!Number.isFinite(it.x) || !Number.isFinite(it.y)) return '잘못된 좌표'
    out.push({ id: String(it.id), kind: it.kind, x: round1(clamp(it.x, 2, 98)), y: round1(clamp(it.y, 4, 100)) })
  }
  // 회수 불가 소품(집)이 빠졌으면 이전 자리로 되돌림
  for (const def of DECOR_CATALOG.filter((d) => d.fixed)) {
    if (countOf(out, def.kind) === 0) {
      const old = prev.find((p) => p.kind === def.kind) ?? DEFAULT_ITEMS.find((p) => p.kind === def.kind)
      if (old) out.push(old)
    }
  }
  return out
}

/** 새로 놓을 소품의 처음 자리: 길 교차점 주변 후보 중 비어 있는 곳 */
const DROP_SPOTS = [
  { x: 34, y: 72 }, { x: 66, y: 72 }, { x: 26, y: 36 }, { x: 74, y: 36 },
  { x: 40, y: 40 }, { x: 60, y: 40 }, { x: 20, y: 80 }, { x: 80, y: 80 },
]
export function pickDropSpot(items: DecorItem[]): { x: number; y: number } {
  const near = (a: { x: number; y: number }) => items.some((i) => Math.abs(i.x - a.x) < 6 && Math.abs(i.y - a.y) < 6)
  const free = DROP_SPOTS.find((s) => !near(s))
  if (free) return free
  const s = DROP_SPOTS[items.length % DROP_SPOTS.length]
  return { x: s.x + ((items.length * 3) % 9) - 4, y: s.y }
}

export const newDecorId = (kind: DecorKind) => `${kind}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
