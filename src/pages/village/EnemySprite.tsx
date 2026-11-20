import { ENEMY_IMG } from '@/domain/castle'
import type { EnemyKind } from '@/domain/types'

/** 적 PNG 스프라이트. fluid = 필드 --px 기준 크기, 아니면 size(px) 고정 */
export function EnemySprite({ kind, frame = 'idle', size, fluid, className = '' }: { kind: EnemyKind; frame?: 'idle' | 'run' | 0 | 1 | 2; size?: number; fluid?: boolean; className?: string }) {
  const src = typeof frame === 'number' ? ENEMY_IMG[kind].atk[frame] : ENEMY_IMG[kind][frame]
  return <img className={`enemy-img${fluid ? ' fluid' : ''} ${className}`} src={src} alt="" draggable={false} style={size ? { width: size, height: size } : undefined} />
}
