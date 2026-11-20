import type { ReactNode } from 'react'
import { QUIZ_KIND_LABEL } from '@/domain/labels'
import type { QuizQuestion } from '@/domain/types'
import { Panel } from '../ui'

interface Props {
  question: QuizQuestion
  index: number
  total?: number
  /** 관련 개념 이름 (관계도 노드) */
  conceptNames?: string[]
  aside?: string
  children?: ReactNode
}

/** 문항 카드 (2.5a·2.7·2.7a 공통) */
export function QuestionCard({ question, index, total, conceptNames, aside, children }: Props) {
  return (
    <Panel tone="white" stack gap={10} className="qcard">
      <div className="row" style={{ gap: 6 }}>
        <span className="tag a mono">Q{index + 1}{total ? ` / ${total}` : ''}</span>
        <span className="tag">{QUIZ_KIND_LABEL[question.kind]}</span>
        {aside && <span className="lbl" style={{ marginLeft: 'auto' }}>{aside}</span>}
      </div>
      <p className="qcard-prompt">{question.prompt}</p>
      {conceptNames && conceptNames.length > 0 && <span className="lbl">관련 개념: {conceptNames.join(' · ')}</span>}
      {children}
    </Panel>
  )
}
