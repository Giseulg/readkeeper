import { http, HttpResponse } from 'msw'
import type { QuizAnswerInput, QuizAttempt, QuizSession } from '@/domain/types'
import { isWithin } from '@/domain/location'
import { db, persist, uid } from '../data/db'
import { grade } from '../grading/grade'
import { EARN } from '@/domain/castle'
import { castleStudy } from './castle'

const notFound = () => HttpResponse.json({ message: 'not found' }, { status: 404 })
const withinProgress = (session: QuizSession) => {
  const book = db.books.find((item) => item.id === session.bookId)
  return !!book && session.questions.every((q) => !q.evidence || isWithin(q.evidence.location, book.progress.confirmed))
}
const outOfScope = () => HttpResponse.json({ message: '지금까지 읽은 범위에서 새 퀴즈를 시작해 주세요.' }, { status: 409 })

const distractors: Record<string, [string, string]> = {
  q1: ['두 방식 모두 실행 중 CPU를 회수할 수 있음', '비선점형만 실행 중 CPU를 회수할 수 있음'],
  q2: ['준비 큐가 CPU의 실제 연산을 대신함', '스케줄러는 준비 큐와 관계없이 완료된 작업만 조회함'],
  q4: ['짧은 작업부터 시작해서 평균 대기 시간이 줄어듦', '대기 시간에는 변화가 없음'],
  q5: ['FCFS는 항상 평균 대기 시간이 가장 짧음', 'SJF와 FCFS는 언제나 평균 대기 시간이 같음'],
  qk1: ['분석 판단만 주어에 없던 내용을 추가함', '둘 다 경험을 통해서만 알 수 있음'],
  qk2: ['둘 다 반복 경험 속에서 배운 습관임', '공간은 내감, 시간은 외감의 형식임'],
  qk3: ['감성만으로 모든 인식이 완성됨', '지성은 대상을 받아들이고 감성은 개념을 만듦'],
  qk4: ['사례가 충분히 많이 반복된다는 사실에서 찾음', '인과성은 개인의 취향에 따라 정해짐'],
  qk5: ['이성이 경험 가능한 것만 생각하기 때문', '감각이 언제나 정확하게 들어오기 때문'],
  q3: ['산 너머 마을', '마을 우체국'],
}

export const quizHandlers = [
  http.post('/api/books/:id/quiz-sessions', async ({ params, request }) => {
    const book = db.books.find((b) => b.id === params.id)
    if (!book) return notFound()
    const { mode, count } = (await request.json()) as { mode: QuizSession['mode']; count?: number }
    // 확정 범위 이내 근거를 가진 문항만 출제
    const pool = db.questions.filter((q) => q.bookId === book.id && q.evidence && isWithin(q.evidence.location, book.progress.confirmed))
    const session: QuizSession = {
      id: uid('qs'),
      bookId: book.id,
      mode,
      questions: pool.slice(0, count ?? (mode === 'recall' ? 2 : 5)).map((question, index) => {
        const alternatives = distractors[question.id]
        if (!question.answer || !alternatives) return question
        const choices = [...alternatives]
        choices.splice(index % (choices.length + 1), 0, question.answer)
        return { ...question, choices }
      }),
      attempts: [],
      confusedNodeIds: [],
      startedAt: new Date().toISOString(),
    }
    db.sessions.push(session)
    persist()
    return HttpResponse.json(session, { status: 201 })
  }),

  http.get('/api/quiz-sessions/:sid', ({ params }) => {
    const s = db.sessions.find((x) => x.id === params.sid)
    if (!s) return notFound()
    return withinProgress(s) ? HttpResponse.json(s) : outOfScope()
  }),

  http.post('/api/quiz-sessions/:sid/attempts', async ({ params, request }) => {
    const s = db.sessions.find((x) => x.id === params.sid)
    if (!s) return notFound()
    if (!withinProgress(s)) return outOfScope()
    const input = (await request.json()) as QuizAnswerInput
    const q = s.questions.find((x) => x.id === input.questionId)
    if (!q) return notFound()
    const attempt: QuizAttempt = input.giveUp
      ? { questionId: q.id, response: '', result: input.giveUp }
      : { questionId: q.id, response: input.response, ...(q.choices
        ? { result: input.response === q.answer ? 'correct' : 'wrong' }
        : grade(q, input.response)) }
    // 문항당 첫 답변만 포인트 적립(다시 답해도 중복 적립 없음)
    const first = !s.attempts.some((a) => a.questionId === attempt.questionId)
    s.attempts = [...s.attempts.filter((a) => a.questionId !== attempt.questionId), attempt]
    if (first && attempt.result === 'correct') castleStudy(EARN.quizCorrect, '점검 문항 정답')
    if (first && attempt.result === 'partial') castleStudy(EARN.quizPartial, '점검 문항 부분 정답')
    if (attempt.result === 'wrong' || attempt.result === 'forgot') {
      s.confusedNodeIds = [...new Set([...s.confusedNodeIds, ...q.relatedNodeIds])]
    }
    persist()
    return HttpResponse.json(s)
  }),

  http.post('/api/quiz-sessions/:sid/finish', ({ params }) => {
    const s = db.sessions.find((x) => x.id === params.sid)
    if (!s) return notFound()
    if (!withinProgress(s)) return outOfScope()
    if (!s.finishedAt) castleStudy(EARN.quizFinish, '이전 내용 점검 완료')
    s.finishedAt = new Date().toISOString()
    persist()
    return HttpResponse.json(s)
  }),
]
