import { memo, type ReactNode } from 'react'
import { PALETTE, SPRITES, SPRITE_COLORS, resolveRecipeSprite } from './sprites'

interface Props {
  name: string
  /** 1px 당 화면 픽셀 수 */
  scale?: number
  /** 이 크기(px) 안에 들어가는 최대 정수 배율로 그림. scale 보다 우선.
   *  캐릭터는 32x32 원본 1벌이라 확대는 정수배·최근접 이웃만 함 */
  fit?: number
  /** 팔레트 문자 덮어쓰기. 예: { G: '#c57abd' } */
  colors?: Record<string, string>
  /** 아이콘(i_*)의 선 색. 기본 currentColor */
  color?: string
  cropHeight?: number
  title?: string
  className?: string
  /** 장면(마을·성 필드) 요소: 화면 크기에 따라 늘고 주는 크기. 크기 = 원본 칸 수 × scale × var(--px).
   *  --px 는 필드 크기에서 정한 기준 1px(village.css). 정수배 아님 */
  fluid?: boolean
}

function PixelSpriteBase({ name, scale: baseScale = 3, fit, colors, color, cropHeight, title, className, fluid }: Props) {
  name = resolveRecipeSprite(name)
  const rows = SPRITES[name]
  if (!rows) return null
  const own = SPRITE_COLORS[name]
  const pal = own || colors ? { ...PALETTE, ...own, ...colors } : PALETTE
  const isIcon = name.startsWith('i_')
  const w = Math.max(...rows.map((r) => r.length))
  const h = Math.min(cropHeight ?? rows.length, rows.length)
  const scale = fit ? Math.max(1, Math.floor(fit / Math.max(w, h))) : baseScale

  const rects: ReactNode[] = []
  rows.forEach((row, y) => {
    // 같은 문자가 가로로 이어지면 rect 1개로 합침(96x96 등급의 DOM 수 감소)
    for (let x = 0; x < row.length; ) {
      const ch = row[x]
      let n = 1
      while (row[x + n] === ch) n++
      const fill = ch === '.' || ch === ' ' ? null : isIcon && ch === 'k' ? (color ?? 'currentColor') : pal[ch]
      if (fill) rects.push(<rect key={`${x}-${y}`} x={x} y={y} width={n + 0.02} height={1.02} fill={fill} />)
      x += n
    }
  })

  return (
    <svg
      className={['px', className].filter(Boolean).join(' ')}
      width={w * scale}
      height={h * scale}
      style={fluid ? { width: `calc(var(--px) * ${w * scale})`, height: `calc(var(--px) * ${h * scale})` } : undefined}
      viewBox={`0 0 ${w} ${h}`}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {rects}
    </svg>
  )
}

export const PixelSprite = memo(PixelSpriteBase)
