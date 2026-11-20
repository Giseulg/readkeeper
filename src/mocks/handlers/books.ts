import { delay, http, HttpResponse } from 'msw'
import type { Book, Category, ReadingLocation } from '@/domain/types'
import { compareLocation, paragraphAt, percentAt } from '@/domain/location'
import { db, persist, uid } from '../data/db'
import { EARN } from '@/domain/castle'
import { castleStudy } from './castle'

const notFound = () => HttpResponse.json({ message: 'not found' }, { status: 404 })

function percentOf(bookId: string, loc: ReadingLocation) {
  const content = db.contents.find((c) => c.bookId === bookId)
  return content ? percentAt(content, loc) : 0
}

/** 확정 범위가 가설 관련 구간을 넘으면 재검토(2.5c) 대상으로 바꾸고 관련 근거를 채움 */
function markDueHypotheses(bookId: string, confirmed: ReadingLocation) {
  const content = db.contents.find((c) => c.bookId === bookId)
  for (const m of db.memos) {
    const h = m.hypothesis
    if (m.bookId !== bookId || h?.reviewStatus !== 'waiting' || !h.reviewAt) continue
    if (compareLocation(confirmed, h.reviewAt) < 0) continue
    h.reviewStatus = 'due'
    if (!h.reviewEvidence && content) {
      h.reviewEvidence = { for: [{ text: paragraphAt(content, h.reviewAt), location: h.reviewAt }], against: [] }
    }
  }
}

export const bookHandlers = [
  http.post('/api/books/:id/progress/restart', ({ params }) => {
    const book = db.books.find((b) => b.id === params.id)
    if (!book) return notFound()
    book.progress = { current: { chapter: 0, paragraph: 0 }, confirmed: { chapter: 0, paragraph: -1 }, percent: 0 }
    for (const memo of db.memos) {
      const hypothesis = memo.hypothesis
      if (memo.bookId !== book.id || hypothesis?.reviewStatus !== 'due') continue
      hypothesis.reviewStatus = 'waiting'
      delete hypothesis.reviewEvidence
    }
    persist()
    return HttpResponse.json(book)
  }),
  http.get('/api/books', async () => {
    await delay(150)
    return HttpResponse.json(db.books)
  }),

  http.get('/api/books/:id', ({ params }) => {
    const book = db.books.find((b) => b.id === params.id)
    return book ? HttpResponse.json(book) : notFound()
  }),

  http.get('/api/books/:id/content', async ({ params }) => {
    await delay(200)
    const content = db.contents.find((c) => c.bookId === params.id)
    return content ? HttpResponse.json(content) : notFound()
  }),

  http.post('/api/books', async ({ request }) => {
    const form = await request.formData()
    const file = form.get('file')
    const name = file instanceof File ? file.name : ''
    const book: Book = {
      id: uid('b'),
      title: String(form.get('title') || name || '제목 없음'),
      category: (form.get('category') as Category) || 'general',
      fileType: name.toLowerCase().endsWith('.pdf') ? 'pdf' : 'txt',
      status: 'processing',
      coverColor: 'wood',
      chapterCount: 0,
      progress: { current: { chapter: 0, paragraph: 0 }, confirmed: { chapter: 0, paragraph: 0 }, percent: 0 },
      createdAt: new Date().toISOString(),
    }
    // txt 파일은 문단 단위로 바로 분리. pdf 분석은 백엔드 연결 후 처리
    if (file instanceof File && book.fileType === 'txt') {
      const text = await file.text()
      const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
      db.contents.push({ bookId: book.id, chapters: [{ title: book.title, paragraphs }] })
      book.chapterCount = 1
      book.status = 'ready'
    }
    db.books.unshift(book)
    persist()
    await delay(400)
    return HttpResponse.json(book, { status: 201 })
  }),

  http.delete('/api/books/:id', ({ params }) => {
    const id = String(params.id)
    db.books = db.books.filter((b) => b.id !== id)
    // 구매한 책을 지워도 구매 내역은 유지. 상세에서 결제 없이 다시 추가 가능
    for (const c of db.store) if (c.libraryBookId === id) c.libraryBookId = undefined
    db.contents = db.contents.filter((c) => c.bookId !== id)
    db.memos = db.memos.filter((m) => m.bookId !== id)
    db.sessions = db.sessions.filter((x) => x.bookId !== id)
    persist()
    return new HttpResponse(null, { status: 204 })
  }),

  http.put('/api/books/:id/progress/current', async ({ params, request }) => {
    const book = db.books.find((b) => b.id === params.id)
    if (!book) return notFound()
    book.progress.current = (await request.json()) as ReadingLocation
    book.progress.lastReadAt = new Date().toISOString()
    persist()
    return HttpResponse.json(book)
  }),

  http.put('/api/books/:id/progress/confirmed', async ({ params, request }) => {
    const book = db.books.find((b) => b.id === params.id)
    if (!book) return notFound()
    const loc = (await request.json()) as ReadingLocation
    if (compareLocation(loc, book.progress.confirmed) > 0) {
      book.progress.confirmed = loc
      book.progress.percent = percentOf(book.id, loc)
      markDueHypotheses(book.id, loc)
      castleStudy(EARN.confirmRead, `「${book.title}」 읽음 확정`)
    }
    persist()
    return HttpResponse.json(book)
  }),
]
