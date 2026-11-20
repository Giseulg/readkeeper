import { useState } from 'react'
import { MOCK_MODE } from '@/appMode'
import { Button } from '../ui'
import { formatLocation, stringifyLocation } from '@/domain/location'
import type { QuizAttempt, QuizGrading, QuizQuestion } from '@/domain/types'
import { QuestionCard } from './QuestionCard'
import { ResultBanner } from './ResultBanner'

interface Props {
  question: QuizQuestion
  attempt: QuizAttempt
  index: number
  conceptNames?: string[]
  /** 본문 위치 이동 링크 기준 책 */
  bookId: string
}

/** 2.7a 문항 피드백: 결과·내 답변·정답·근거·원문 이동·오류 신고 */
export function Feedback({ question, attempt, index, conceptNames, bookId }: Props) {
  const [reported, setReported] = useState(false)
  const evidence = question.evidence
  return (
    <div className="col" style={{ gap: 12 }}>
      <ResultBanner result={attempt.result} feedback={attempt.feedback} />
      {attempt.grading && <GradingMeter grading={attempt.grading} />}
      <QuestionCard question={question} index={index} conceptNames={conceptNames}>
        {attempt.response && (
          <>
            <div className="hr dashed" />
            <span className="lbl">내 답변</span>
            <p style={{ fontSize: 15, lineHeight: 1.6 }}>{attempt.response}</p>
          </>
        )}
      </QuestionCard>
      {question.answer !== undefined && <div className="panel sm col" style={{ gap: 6 }}>
        <span className="lbl">정답</span>
        <p style={{ fontSize: 15, lineHeight: 1.6 }}>{question.answer}</p>
        {question.explanation && <p>{question.explanation}</p>}
        {attempt.grading && attempt.grading.matchedCandidate !== question.answer && (
          <>
            <div className="hr dashed" />
            <span className="lbl">내 답변과 가장 가까운 정답 표현</span>
            <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--ink2)' }}>{attempt.grading.matchedCandidate}</p>
          </>
        )}
      </div>}
      {evidence && <>
      <div className="row">
        <span className="lbl grow">근거 · {formatLocation(evidence.location)}</span>
        {MOCK_MODE && <button type="button" className="link-btn" disabled={reported} onClick={() => setReported(true)}>
          {reported ? '신고 접수됨' : '오류 신고'}
        </button>}
      </div>
      <div className="quote">{evidence.text}</div>
      <Button variant="wood" size="sm" full icon="i_pin" to={`/library/${bookId}/read?loc=${stringifyLocation(evidence.location)}`}>
        본문 위치로 이동
      </Button>
      </>}
    </div>
  )
}

const pct = (v: number) => `${Math.round(v * 100)}%`

/** 정답 후보 유사도와 판정 기준선 */
function GradingMeter({ grading: g }: { grading: QuizGrading }) {
  return (
    <div className="panel sm col" style={{ gap: 6 }}>
      <div className="row" style={{ gap: 6 }}>
        <span className="lbl grow">정답 후보와의 유사도</span>
        {g.needsReview && <span className="tag a" title="판정 기준선 근처라 서버에서는 추가 확인함">경계 구간</span>}
        <b className="num" style={{ fontSize: 15 }}>{pct(g.score)}</b>
      </div>
      <div className="sim-meter" role="img" aria-label={`유사도 ${pct(g.score)}, 정답 기준 ${pct(g.thresholds.correct)}, 부분 정답 기준 ${pct(g.thresholds.partial)}`}>
        <span className="bar mark"><i style={{ width: pct(Math.min(g.score, 1)) }} /></span>
        <i className="tick" style={{ left: pct(g.thresholds.partial) }} />
        <i className="tick" style={{ left: pct(g.thresholds.correct) }} />
      </div>
      <span className="lbl">부분 정답 {pct(g.thresholds.partial)} · 정답 {pct(g.thresholds.correct)} 이상</span>
    </div>
  )
}
