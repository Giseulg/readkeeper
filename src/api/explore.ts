import type { AuthorContent, ID, PurchaseInput, PurchaseResult } from '@/domain/types'
import { http } from './client'

/** Explore: 저자 등록 콘텐츠 목록·상세·구매. 실제 결제 연동 전까지 mock 결제 */
export const exploreApi = {
  list: () => http<AuthorContent[]>('/explore/contents'),
  get: (id: ID) => http<AuthorContent>(`/explore/contents/${id}`),
  purchase: (id: ID, input: PurchaseInput) =>
    http<PurchaseResult>(`/explore/contents/${id}/purchase`, { method: 'POST', body: input }),
}
