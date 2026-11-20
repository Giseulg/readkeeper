import type { ButtonHTMLAttributes } from 'react'
import { Link } from 'react-router'
import { PixelSprite } from '../pixel/PixelSprite'
import { cx } from './cx'

interface BaseProps {
  /** sprites.ts 아이콘 이름 */
  icon: string
  /** 접근성 라벨 (필수) */
  label: string
  /** wood=상단 바용(기본), light=밝은 배경용 */
  tone?: 'wood' | 'light'
  /** 아이콘 배율. 기본 3 */
  iconScale?: number
  className?: string
}

type AsButton = BaseProps & Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof BaseProps | 'children'> & { to?: undefined }
type AsLink = BaseProps & { to: string }

/** 정사각 아이콘 버튼 (목업 .ibtn) */
export function IconButton(props: AsButton | AsLink) {
  const { icon, label, tone = 'wood', iconScale = 3, className } = props
  const cls = cx('ibtn', tone === 'light' && 'light', className)
  const sprite = <PixelSprite name={icon} scale={iconScale} />

  if (props.to !== undefined) {
    return (
      <Link to={props.to} className={cls} aria-label={label} title={label}>
        {sprite}
      </Link>
    )
  }
  const { icon: _i, label: _l, tone: _t, iconScale: _s, className: _c, to: _to, type = 'button', ...rest } = props
  return (
    <button type={type} className={cls} aria-label={label} title={label} {...rest}>
      {sprite}
    </button>
  )
}
