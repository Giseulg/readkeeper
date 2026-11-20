import { http, HttpResponse } from 'msw'
import type { Character, Collectible } from '@/domain/types'
import { compareLocation, formatLocation } from '@/domain/location'
import { db, persist } from '../data/db'

export const characterHandlers = [
  http.get('/api/me/characters', () => HttpResponse.json(db.characters)),
  http.get('/api/me/collectibles', () => HttpResponse.json(collectibles())),

  http.patch('/api/me/characters/:id', async ({ params, request }) => {
    const c = db.characters.find((x) => x.id === params.id)
    if (!c) return HttpResponse.json({ message: 'not found' }, { status: 404 })
    Object.assign(c, (await request.json()) as Partial<Character>)
    persist()
    return HttpResponse.json(c)
  }),

  http.put('/api/me/village', async ({ request }) => {
    const positions = (await request.json()) as Array<Pick<Character, 'id' | 'villagePosition'>>
    for (const p of positions) {
      const c = db.characters.find((x) => x.id === p.id)
      if (c) c.villagePosition = p.villagePosition
    }
    persist()
    return HttpResponse.json(db.characters)
  }),

]

/**
 * 수집 도감: 내 서재 책마다 캐릭터가 될 수 있는 항목(스프라이트가 있는 관계도 노드 + 이미 얻은 캐릭터)을
 * 해금 여부와 함께 돌려줌. 미해금 항목은 이름을 숨기고 등장 위치만 알려 줌(스포 방지).
 */
function collectibles(): Collectible[] {
  const out: Collectible[] = []
  for (const book of db.books) {
    const owned = db.characters.filter((c) => c.bookId === book.id)
    const nodes = db.nodes
      .filter((n) => n.bookId === book.id && n.sprite)
      .sort((a, b) => compareLocation(a.firstSeen, b.firstSeen))
    for (const n of nodes) {
      const c = owned.find((x) => x.nodeId === n.id)
      out.push(c
        ? { id: c.id, characterId: c.id, nodeId: n.id, kind: n.kind, name: c.name, sprite: c.sprite, bookId: book.id, reason: c.acquiredReason, earnedAt: c.acquiredAt }
        : { id: n.id, nodeId: n.id, kind: n.kind, name: '???', sprite: n.sprite!, bookId: book.id, reason: `${formatLocation(n.firstSeen)}부터 등장`, earnedAt: null })
    }
    // 노드와 연결되지 않은 캐릭터(사건 보상 등)
    for (const c of owned.filter((x) => !x.nodeId || !nodes.some((n) => n.id === x.nodeId))) {
      out.push({ id: c.id, characterId: c.id, name: c.name, sprite: c.sprite, bookId: book.id, reason: c.acquiredReason, earnedAt: c.acquiredAt })
    }
  }
  return out
}
