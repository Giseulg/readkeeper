import type { BookGraph, ID } from '@/domain/types'
import { http } from './client'

export const graphApi = {
  /** 서버가 확정 범위 이내로 잘라서 반환함 (스포 방지는 서버 책임) */
  get: (bookId: ID) => http<BookGraph>(`/books/${bookId}/graph`),
  retry: (bookId: ID) => http<{ status: 'queued' | 'ready' }>(`/books/${bookId}/analysis/retry`, { method: 'POST' }),
}
