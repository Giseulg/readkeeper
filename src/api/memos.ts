import type { CreateMemoInput, HypothesisRevision, ID, Memo, MemoType } from '@/domain/types'
import { http, requestKeyHeaders } from './client'

export const memosApi = {
  list: (bookId: ID, type?: MemoType) => http<Memo[]>(`/books/${bookId}/memos`, { query: { type } }),
  get: (bookId: ID, memoId: ID) => http<Memo>(`/books/${bookId}/memos/${memoId}`),
  create: (input: CreateMemoInput) => http<Memo>(`/books/${input.bookId}/memos`, {
    method: 'POST', body: input, headers: requestKeyHeaders(),
  }),
  remove: (bookId: ID, memoId: ID) => http<void>(`/books/${bookId}/memos/${memoId}`, { method: 'DELETE' }),
  /** 가설 재검토(2.5c) 후 수정 설명 저장 */
  revise: (bookId: ID, memoId: ID, revision: Omit<HypothesisRevision, 'createdAt'>) =>
    http<Memo>(`/books/${bookId}/memos/${memoId}/revisions`, { method: 'POST', body: revision }),
  /** 확정 범위가 넘어서 재검토 대상이 된 가설 */
  dueReviews: (bookId: ID) => http<Memo[]>(`/books/${bookId}/memos/due`),
}
