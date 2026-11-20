import { http, HttpResponse } from 'msw'
import { applyAction, freshCastle, resolveRaids, skipToNextRaid, study, syncDefenders, visit, withNextRaid } from '@/domain/castle'
import type { CastleAction, CastleState } from '@/domain/types'
import { db, persist } from '../data/db'

/** 성 상태를 꺼내 밀린 습격까지 판정. 없으면 새로 만듦 */
export function castle(now = Date.now()): CastleState {
  db.castle ??= freshCastle(db.characters, now)
  syncDefenders(db.castle, db.characters)
  resolveRaids(db.castle, now)
  return db.castle
}

/** 다른 핸들러(읽음 확정·퀴즈·메모)에서 호출: 포인트 적립 + 망각곡선 재시작 */
export function castleStudy(amount: number, reason: string) {
  study(castle(), amount, reason, Date.now())
}

export const castleHandlers = [
  http.get('/api/me/castle', () => {
    const s = castle()
    visit(s, Date.now())
    persist()
    return HttpResponse.json(withNextRaid(s))
  }),

  http.post('/api/me/castle/actions', async ({ request }) => {
    const s = castle()
    const err = applyAction(s, (await request.json()) as CastleAction, Date.now())
    if (err) return HttpResponse.json({ message: err }, { status: 400 })
    persist()
    return HttpResponse.json(withNextRaid(s))
  }),

  /** 데모 전용: 다음 습격 시각까지 시간을 건너뜀 */
  http.post('/api/me/castle/skip', () => {
    const now = Date.now()
    const s = castle(now)
    skipToNextRaid(s, now)
    resolveRaids(s, now)
    persist()
    return HttpResponse.json(withNextRaid(s))
  }),
]
