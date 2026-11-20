import type { DecorItem, DecorKind, VillageLayout } from '@/domain/types'
import { http } from './client'

/** 마을 꾸미기: 소품 배치·해금(해금 비용은 지식 포인트에서 차감) */
export const decorApi = {
  get: () => http<VillageLayout>('/me/village/decor'),
  save: (items: DecorItem[]) => http<VillageLayout>('/me/village/decor', { method: 'PUT', body: items }),
  unlock: (kind: DecorKind) => http<VillageLayout>('/me/village/decor/unlock', { method: 'POST', body: { kind } }),
}
