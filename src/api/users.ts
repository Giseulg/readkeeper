import { withDefaults } from '@/domain/settings'
import type { Category, User, UserSettings, UserSettingsPatch, UserStats } from '@/domain/types'
import { http } from './client'

export const usersApi = {
  me: () => http<User>('/me'),
  update: (patch: Partial<Pick<User, 'nickname' | 'interests' | 'onboarded'>>) =>
    http<User>('/me', { method: 'PATCH', body: patch }),
  completeOnboarding: (nickname: string, interests: Category[]) =>
    http<User>('/me', { method: 'PATCH', body: { nickname, interests, onboarded: true } }),
  stats: () => http<UserStats>('/me/stats'),
  // 응답에 없는 설정 그룹은 기본값으로 채움(백엔드가 새 필드를 아직 모를 때 대비)
  settings: () => http<UserSettings>('/me/settings').then(withDefaults),
  updateSettings: (patch: UserSettingsPatch) =>
    http<UserSettings>('/me/settings', { method: 'PATCH', body: patch }).then(withDefaults),
}
