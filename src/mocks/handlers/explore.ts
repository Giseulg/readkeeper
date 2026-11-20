import { delay, http, HttpResponse } from 'msw'
import type { Book, PurchaseInput, PurchaseResult } from '@/domain/types'
import { seedStoreContents } from '../data/seed'
import { db, persist, uid } from '../data/db'

/**
 * Explore: 저자 등록 콘텐츠 스토어(mock). 실제 결제는 일어나지 않음.
 * 서버 계약: 저자 인증(authorVerified)된 항목만 반환하고, 본문은 구매자 서재 책으로만 전달함.
 */
export const exploreHandlers = [
  http.get('/api/explore/contents', async () => {
    await delay(150)
    const interests = db.user.interests
    const list = db.store.filter((c) => c.authorVerified)
    // 관심 분야를 앞에, 그 안에서는 최근 등록 순
    const rank = (cat: string) => (interests.includes(cat as never) ? 0 : 1)
    return HttpResponse.json([...list].sort((a, b) => rank(a.category) - rank(b.category) || b.registeredAt.localeCompare(a.registeredAt)))
  }),

  http.get('/api/explore/contents/:id', ({ params }) => {
    const c = db.store.find((x) => x.id === params.id && x.authorVerified)
    return c ? HttpResponse.json(c) : HttpResponse.json({ message: 'not found' }, { status: 404 })
  }),

  http.post('/api/explore/contents/:id/purchase', async ({ params, request }) => {
    const c = db.store.find((x) => x.id === params.id && x.authorVerified)
    if (!c) return HttpResponse.json({ message: 'not found' }, { status: 404 })
    const input = (await request.json()) as PurchaseInput
    if (!input.agreed) return HttpResponse.json({ message: '이용 범위 동의가 필요함' }, { status: 400 })
    if (c.libraryBookId && db.books.some((b) => b.id === c.libraryBookId)) {
      return HttpResponse.json({ message: '이미 서재에 있음' }, { status: 409 })
    }
    const template = seedStoreContents.find((x) => x.bookId === c.id)
    if (!template) return HttpResponse.json({ message: 'content missing' }, { status: 500 })

    await delay(700) // 결제 처리 대기 연출
    const now = new Date().toISOString()
    // 이미 구매한 콘텐츠를 서재에서 지웠다면 결제 없이 다시 추가(mock은 주문 id만 새로 발급)
    const orderId = uid('o')
    const book: Book = {
      id: uid('b'),
      title: c.title,
      author: c.authorName,
      category: c.category,
      fileType: 'txt',
      status: 'ready',
      coverColor: c.coverColor,
      chapterCount: template.chapters.length,
      progress: { current: { chapter: 0, paragraph: 0 }, confirmed: { chapter: 0, paragraph: 0 }, percent: 0 },
      createdAt: now,
      purchase: { contentId: c.id, orderId, purchasedAt: now },
    }
    db.books.unshift(book)
    db.contents.push({ bookId: book.id, chapters: structuredClone(template.chapters) })
    c.purchased = true
    c.libraryBookId = book.id
    persist()
    const res: PurchaseResult = { orderId, content: c, book }
    return HttpResponse.json(res, { status: 201 })
  }),
]
