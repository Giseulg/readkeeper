import type { ReactNode } from 'react'
import { PixelSprite } from './pixel/PixelSprite'
import { Panel } from './ui'

interface Props {
  /** IA 화면 ID. 화면에는 표시하지 않음 */
  id: string
  title: string
  /** IA 문서의 구성 요소 목록 */
  todo?: string[]
  children?: ReactNode
}

/** 골격 단계 임시 화면. 구현 예정 항목은 접힌 목록으로 표시 */
export function ScreenStub({ id, title, todo, children }: Props) {
  return (
    <Panel tone="white" stack data-screen={id}>
      <div className="row" style={{ gap: 12 }}>
        <PixelSprite name="d_node" fit={48} />
        <div className="col" style={{ gap: 0 }}>
          <b className="h" style={{ fontSize: 20 }}>{title}</b>
          <span className="lbl">준비 중인 화면</span>
        </div>
      </div>
      {children}
      {todo && (
        <details className="lbl">
          <summary style={{ cursor: 'pointer' }}>구현 예정 {todo.length}개</summary>
          <ul style={{ listStyle: 'none', marginTop: 8, display: 'grid', gap: 4 }}>
            {todo.map((t) => (
              <li key={t}>· {t}</li>
            ))}
          </ul>
        </details>
      )}
    </Panel>
  )
}
