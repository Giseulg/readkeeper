import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { IconButton } from './ui'

interface Props {
  title: string
  subtitle?: string
  /** 뒤로가기 대상. 없으면 history back */
  backTo?: string
  right?: ReactNode
}

/** 탭바 숨김 화면 상단 바 (목업 .subbar) */
export function SubBar({ title, subtitle, backTo, right }: Props) {
  const navigate = useNavigate()
  return (
    <header className="subbar">
      <IconButton icon="i_back" label="뒤로" onClick={() => (backTo ? navigate(backTo) : navigate(-1))} />
      <div className="ttl">
        <b>{title}</b>
        {subtitle && <small>{subtitle}</small>}
      </div>
      {right}
    </header>
  )
}
