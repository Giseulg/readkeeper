import type { CSSProperties, ReactNode } from 'react'
import { Link } from 'react-router'
import { cx } from './cx'

/** parch=기본 양피지, white=밝은 종이, sticky=포스트잇(메모), accent=보라(가설) */
export type PanelTone = 'parch' | 'white' | 'sticky' | 'accent'

interface Props {
  tone?: PanelTone
  /** md=16px(기본), sm=12px */
  padding?: 'md' | 'sm'
  /** 나무 헤더 바 제목 */
  title?: ReactNode
  /** 헤더 바 오른쪽 */
  titleRight?: ReactNode
  /** 내부를 세로 스택(.col)으로 배치 */
  stack?: boolean
  gap?: number
  /** 있으면 라우터 Link로 렌더링 (카드 전체 클릭) */
  to?: string
  as?: 'section' | 'div' | 'article' | 'aside'
  className?: string
  style?: CSSProperties
  children?: ReactNode
  'data-screen'?: string
}

/** 픽셀 테두리 패널 (목업 .panel / .panel-h) */
export function Panel({ tone = 'parch', padding = 'md', title, titleRight, stack, gap, to, as: Tag = 'section', className, style, children, ...rest }: Props) {
  const cls = cx('panel', tone !== 'parch' && tone, padding === 'sm' && 'sm', stack && 'col', className)
  const mergedStyle = gap !== undefined ? { gap, ...style } : style
  const body = (
    <>
      {title !== undefined && (
        <div className="panel-h">
          <span>{title}</span>
          {titleRight !== undefined && <span className="r">{titleRight}</span>}
        </div>
      )}
      {children}
    </>
  )

  if (to !== undefined) {
    return (
      <Link to={to} className={cls} style={mergedStyle} {...rest}>
        {body}
      </Link>
    )
  }
  return (
    <Tag className={cls} style={mergedStyle} {...rest}>
      {body}
    </Tag>
  )
}
