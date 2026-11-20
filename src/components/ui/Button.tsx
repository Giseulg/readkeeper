import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react'
import { Link } from 'react-router'
import { PixelSprite } from '../pixel/PixelSprite'
import { cx } from './cx'

/** primary=초록(주요 행동), secondary=주황, wood=중립, accent=보라(메모·가설), ghost=종이 */
export type ButtonVariant = 'primary' | 'secondary' | 'wood' | 'accent' | 'ghost'
export type ButtonSize = 'md' | 'sm'

const VARIANT_CLASS: Record<ButtonVariant, string | undefined> = {
  primary: undefined,
  secondary: 'amber',
  wood: 'wood',
  accent: 'berry',
  ghost: 'ghost',
}

interface BaseProps {
  variant?: ButtonVariant
  size?: ButtonSize
  /** 가로 100% */
  full?: boolean
  /** 왼쪽 픽셀 아이콘 (sprites.ts 이름) */
  icon?: string
  /** 오른쪽 보조 텍스트 */
  trailing?: ReactNode
  className?: string
  children?: ReactNode
}

type AsButton = BaseProps & Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof BaseProps> & { to?: undefined }
type AsLink = BaseProps & { to: string; replace?: boolean; style?: CSSProperties; 'aria-label'?: string }

export type ButtonProps = AsButton | AsLink

/** 픽셀 버튼. `to`가 있으면 라우터 Link로 렌더링 */
export function Button(props: ButtonProps) {
  const { variant = 'primary', size = 'md', full, icon, trailing, className, children } = props
  const cls = cx('btn', VARIANT_CLASS[variant], size === 'sm' && 'sm', full && 'full', className)
  const content = (
    <>
      {icon && <PixelSprite name={icon} scale={size === 'sm' ? 2 : 3} />}
      {children}
      {trailing && <span className="k">{trailing}</span>}
    </>
  )

  if (props.to !== undefined) {
    const { to, replace, style } = props
    return (
      <Link to={to} replace={replace} className={cls} style={style} aria-label={props['aria-label']}>
        {content}
      </Link>
    )
  }

  const { variant: _v, size: _s, full: _f, icon: _i, trailing: _t, className: _c, children: _ch, to: _to, type = 'button', ...rest } = props
  return (
    <button type={type} className={cls} {...rest}>
      {content}
    </button>
  )
}
