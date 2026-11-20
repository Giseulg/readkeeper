import { http, HttpResponse } from 'msw'
import { spend } from '@/domain/castle'
import { DECOR, freshLayout, sanitizeItems } from '@/domain/decor'
import type { DecorItem, DecorKind, VillageLayout } from '@/domain/types'
import { db, persist } from '../data/db'
import { castle } from './castle'

function layout(): VillageLayout {
  db.village ??= freshLayout()
  return db.village
}

export const decorHandlers = [
  http.get('/api/me/village/decor', () => HttpResponse.json(layout())),

  http.put('/api/me/village/decor', async ({ request }) => {
    const v = layout()
    const items = sanitizeItems((await request.json()) as DecorItem[], v.unlocked, v.items)
    if (typeof items === 'string') return HttpResponse.json({ message: items }, { status: 400 })
    v.items = items
    persist()
    return HttpResponse.json(v)
  }),

  /** 지식 포인트로 소품 종류 해금 */
  http.post('/api/me/village/decor/unlock', async ({ request }) => {
    const { kind } = (await request.json()) as { kind: DecorKind }
    const def = DECOR[kind]
    if (!def) return HttpResponse.json({ message: '없는 소품' }, { status: 400 })
    const v = layout()
    if (v.unlocked.includes(kind)) return HttpResponse.json(v)
    const err = spend(castle(), def.cost, `마을 꾸미기: ${def.name} 해금`, Date.now())
    if (err) return HttpResponse.json({ message: err }, { status: 400 })
    v.unlocked.push(kind)
    persist()
    return HttpResponse.json(v)
  }),
]
