import { http, HttpResponse } from 'msw'
import { mergeSettings, withDefaults } from '@/domain/settings'
import type { User, UserSettingsPatch, UserStats } from '@/domain/types'
import { db, persist } from '../data/db'

export const userHandlers = [
  http.get('/api/me', () => HttpResponse.json(db.user)),

  http.patch('/api/me', async ({ request }) => {
    Object.assign(db.user, (await request.json()) as Partial<User>)
    persist()
    return HttpResponse.json(db.user)
  }),

  http.get('/api/me/stats', () => {
    const stats: UserStats = {
      bookCount: db.books.length,
      memoCount: db.memos.length,
      quizCount: db.sessions.filter((s) => s.finishedAt).length,
      characterCount: db.characters.length,
    }
    return HttpResponse.json(stats)
  }),

  http.get('/api/me/settings', () => HttpResponse.json(withDefaults(db.settings))),

  http.patch('/api/me/settings', async ({ request }) => {
    const patch = (await request.json()) as UserSettingsPatch
    db.settings = mergeSettings(withDefaults(db.settings), patch)
    persist()
    return HttpResponse.json(db.settings)
  }),
]
