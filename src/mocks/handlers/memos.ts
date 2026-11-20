import { http, HttpResponse } from 'msw'
import type { CreateMemoInput, HypothesisRevision, Memo } from '@/domain/types'
import { advance } from '@/domain/location'
import { db, persist, uid } from '../data/db'
import { EARN } from '@/domain/castle'
import { castleStudy } from './castle'

export const memoHandlers = [
  http.get('/api/books/:id/memos/due', ({ params }) =>
    HttpResponse.json(db.memos.filter((m) => m.bookId === params.id && m.hypothesis?.reviewStatus === 'due')),
  ),

  http.get('/api/books/:id/memos', ({ params, request }) => {
    const type = new URL(request.url).searchParams.get('type')
    return HttpResponse.json(db.memos.filter((m) => m.bookId === params.id && (!type || m.type === type)))
  }),

  http.get('/api/books/:id/memos/:memoId', ({ params }) => {
    const memo = db.memos.find((m) => m.id === params.memoId)
    return memo ? HttpResponse.json(memo) : HttpResponse.json({ message: 'not found' }, { status: 404 })
  }),

  http.post('/api/books/:id/memos', async ({ request }) => {
    const input = (await request.json()) as CreateMemoInput
    const content = db.contents.find((c) => c.bookId === input.bookId)
    const memo: Memo = {
      id: uid('m'),
      bookId: input.bookId,
      type: input.type,
      content: input.content,
      quote: input.quote,
      createdAt: new Date().toISOString(),
      hypothesis: input.hypothesis && {
        ...input.hypothesis,
        // 관련 구간을 지정하지 않으면 3문단 뒤를 재검토 지점으로 둠 (실제 서버는 본문 분석으로 결정)
        reviewAt: input.hypothesis.reviewAt ?? (content ? advance(content, input.quote.location, 3) : undefined),
        reviewStatus: 'waiting',
        revisions: [],
      },
    }
    db.memos.unshift(memo)
    castleStudy(EARN.memo, memo.type === 'hypothesis' ? '가설 메모 작성' : '메모 작성')
    persist()
    return HttpResponse.json(memo, { status: 201 })
  }),

  http.delete('/api/books/:id/memos/:memoId', ({ params }) => {
    db.memos = db.memos.filter((m) => m.id !== params.memoId)
    persist()
    return new HttpResponse(null, { status: 204 })
  }),

  http.post('/api/books/:id/memos/:memoId/revisions', async ({ params, request }) => {
    const memo = db.memos.find((m) => m.id === params.memoId)
    if (!memo?.hypothesis) return HttpResponse.json({ message: 'not a hypothesis' }, { status: 400 })
    const rev = (await request.json()) as Omit<HypothesisRevision, 'createdAt'>
    memo.hypothesis.revisions.push({ ...rev, createdAt: new Date().toISOString() })
    memo.hypothesis.reviewStatus = 'revised'
    persist()
    return HttpResponse.json(memo)
  }),
]
