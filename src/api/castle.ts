import type { CastleAction, CastleState } from '@/domain/types'
import { http, requestKeyHeaders } from './client'

export const castleApi = {
  get: () => http<CastleState>('/me/castle'),
  act: (action: CastleAction) => http<CastleState>('/me/castle/actions', {
    method: 'POST', body: action, headers: requestKeyHeaders(),
  }),
  /** 데모(mock) 전용: 다음 습격까지 시간 건너뛰기 */
  skip: () => http<CastleState>('/me/castle/skip', { method: 'POST' }),
}
