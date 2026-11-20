import { PixelSprite } from '../pixel/PixelSprite'
import { QUIZ_RESULT_LABEL } from '@/domain/labels'
import type { QuizResult } from '@/domain/types'

const META: Record<QuizResult, { icon: string; cls: string }> = {
  correct: { icon: 'i_check', cls: 'ok' },
  partial: { icon: 'i_tri', cls: 'part' },
  wrong: { icon: 'i_x', cls: 'bad' },
  forgot: { icon: 'i_x', cls: 'bad' },
  skipped: { icon: 'i_chev', cls: 'skip' },
}

/** 채점 결과 배너 (2.7a 상단) */
export function ResultBanner({ result, feedback }: { result: QuizResult; feedback?: string }) {
  const m = META[result]
  return (
    <div className={`result-banner ${m.cls}`} role="status">
      <PixelSprite name={m.icon} scale={4} color="#fff" />
      <div className="col" style={{ gap: 2 }}>
        <b>{QUIZ_RESULT_LABEL[result]}</b>
        {feedback && <span>{feedback}</span>}
        {result === 'forgot' && <span>근거 문장을 보고 다시 떠올려 보세요.</span>}
      </div>
    </div>
  )
}

/** 결과별 작은 아이콘 칸 (2.7b 목록) */
export function ResultIcon({ result }: { result: QuizResult }) {
  const m = META[result]
  return (
    <span className={`result-icon ${m.cls}`} aria-label={QUIZ_RESULT_LABEL[result]} title={QUIZ_RESULT_LABEL[result]}>
      <PixelSprite name={m.icon} scale={3} color="#fff" />
    </span>
  )
}
