import type { ReactNode } from 'react'

interface Props {
  isLoading: boolean
  error: unknown
  children: ReactNode
}

export function QueryState({ isLoading, error, children }: Props) {
  if (isLoading) return <p className="lbl">불러오는 중…</p>
  if (error) return <p className="lbl" style={{ color: 'var(--color-danger)' }}>불러오기 실패: {String((error as Error).message ?? error)}</p>
  return <>{children}</>
}
