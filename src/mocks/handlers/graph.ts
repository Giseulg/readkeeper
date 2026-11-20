import { http, HttpResponse } from 'msw'
import type { BookGraph } from '@/domain/types'
import { isWithin } from '@/domain/location'
import { db } from '../data/db'

export const graphHandlers = [
  http.get('/api/books/:id/graph', ({ params }) => {
    const book = db.books.find((b) => b.id === params.id)
    if (!book) return HttpResponse.json({ message: 'not found' }, { status: 404 })
    const until = book.progress.confirmed
    const nodes = db.nodes.filter((n) => n.bookId === book.id && isWithin(n.firstSeen, until))
    const ids = new Set(nodes.map((n) => n.id))
    const edges = db.edges
      .filter((e) => e.bookId === book.id && ids.has(e.source) && ids.has(e.target) && isWithin(e.firstSeen, until))
      .map((e) => ({ ...e, quotes: e.quotes.filter((q) => isWithin(q.location, until)) }))
    const graph: BookGraph = { bookId: book.id, until, nodes, edges }
    return HttpResponse.json(graph)
  }),
]
