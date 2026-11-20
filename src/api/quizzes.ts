import type { ID, QuizAnswerInput, QuizSession } from '@/domain/types'
import { http } from './client'

export const quizzesApi = {
  start: (bookId: ID, mode: QuizSession['mode'], count?: number) =>
    http<QuizSession>(`/books/${bookId}/quiz-sessions`, { method: 'POST', body: { mode, count } }),
  /** 채점은 서버 책임. 응답의 attempts 에 result·feedback 포함 */
  answer: (sessionId: ID, input: QuizAnswerInput) =>
    http<QuizSession>(`/quiz-sessions/${sessionId}/attempts`, { method: 'POST', body: input }),
  finish: (sessionId: ID) => http<QuizSession>(`/quiz-sessions/${sessionId}/finish`, { method: 'POST' }),
  get: (sessionId: ID) => http<QuizSession>(`/quiz-sessions/${sessionId}`),
}
