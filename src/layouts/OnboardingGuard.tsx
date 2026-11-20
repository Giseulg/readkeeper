import { Navigate, Outlet } from 'react-router'
import { useMe } from '@/hooks/queries'
import { auth } from '@/api/auth'
import { hasSelectedAccount } from '@/domain/demoAccount'

/** 온보딩 미완료 시 /onboarding 으로 보냄 */
export function OnboardingGuard() {
  const { data: me, isLoading, error, refetch } = useMe()
  if (!auth && !hasSelectedAccount()) return <Navigate to="/login" replace />
  if (isLoading) return null
  if (error) return <p role="alert">{error.message} <button onClick={() => void refetch()}>다시 시도</button></p>
  if (me && !me.onboarded) return <Navigate to="/onboarding" replace />
  return <Outlet />
}
