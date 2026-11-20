import type { QuizAttempt, QuizGrading, QuizQuestion } from '@/domain/types'
import { answerKeys } from '../data/answerKeys'
import { bestMatch } from './similarity'

/**
 * mock 채점: 정답 후보와의 유사도 최댓값으로 판정.
 * 기준선은 문자 n-gram 기준으로 맞춘 값. 서버 임베딩으로 바꾸면 분포가 달라지므로 다시 잡아야 함.
 */
export const THRESHOLDS = { correct: 0.45, partial: 0.2 } as const
/** 기준선 ±REVIEW_BAND 이내면 needsReview (서버에서는 이 구간만 LLM 확인) */
export const REVIEW_BAND = 0.06

const FEEDBACK: Record<'correct' | 'partial' | 'wrong', string> = {
  correct: '핵심을 잘 짚었어요.',
  partial: '방향은 맞았어요. 정답과 비교해 빠진 부분을 확인해 보세요.',
  wrong: '정답과 근거 문장을 다시 확인해 보세요.',
}

export function grade(q: QuizQuestion, response: string): Pick<QuizAttempt, 'result' | 'feedback' | 'grading'> {
  const candidates = [q.answer ?? '', ...(answerKeys[q.id] ?? [])]
  const { score, matched } = bestMatch(response, candidates)
  const result = score >= THRESHOLDS.correct ? 'correct' : score >= THRESHOLDS.partial ? 'partial' : 'wrong'
  const needsReview = Object.values(THRESHOLDS).some((t) => Math.abs(score - t) < REVIEW_BAND)
  const grading: QuizGrading = {
    method: 'char-ngram',
    score: Math.round(score * 1000) / 1000,
    matchedCandidate: matched,
    needsReview,
    thresholds: { ...THRESHOLDS },
  }
  return { result, feedback: FEEDBACK[result], grading }
}
