import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { MOCK_MODE } from '@/appMode'
import { PixelSprite } from '@/components/pixel/PixelSprite'
import { Feedback, QuestionCard, ResultIcon } from '@/components/quiz'
import { AnswerField } from '@/components/quiz/AnswerField'
import { SubBar } from '@/components/SubBar'
import { Button, Panel } from '@/components/ui'
import { QUIZ_KIND_LABEL, QUIZ_RESULT_LABEL } from '@/domain/labels'
import { formatLocation, stringifyLocation } from '@/domain/location'
import type { QuizResult, QuizSession } from '@/domain/types'
import { useAnswerQuiz, useBook, useFinishQuiz, useGraph, useSettings, useStartQuiz } from '@/hooks/queries'
import { useGameAudio } from '@/hooks/useGameAudio'

type Step = 'question' | 'feedback' | 'result'

/** 문항 수 이해도 추정: 정답 1, 부분 0.5 */
function understanding(s: QuizSession) {
  if (!s.questions.length) return 0
  const score = s.attempts.reduce((n, a) => n + (a.result === 'correct' ? 1 : a.result === 'partial' ? 0.5 : 0), 0)
  return Math.round((score / s.questions.length) * 100)
}

/** 2.7 이전 내용 점검 · 2.7a 문항 피드백 · 2.7b 점검 결과 */
export function QuizPage() {
  const { bookId = '' } = useParams()
  const navigate = useNavigate()
  const book = useBook(bookId)
  const graph = useGraph(bookId)
  const settings = useSettings()
  const start = useStartQuiz(bookId)
  const answer = useAnswerQuiz()
  const finish = useFinishQuiz()
  const [session, setSession] = useState<QuizSession | null>(null)
  const [idx, setIdx] = useState(0)
  const [step, setStep] = useState<Step>('question')
  const [text, setText] = useState('')
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const audio = useGameAudio(settings.data?.learning.gameSound ?? false, settings.data?.learning.gameMusic ?? false, playing && step !== 'result')
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    start.mutate({ mode: 'check', count: 5 }, { onSuccess: setSession })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const until = book.data ? formatLocation(book.data.progress.confirmed) : ''
  const completed = book.data?.progress.percent === 100
  const returnPath = `/library/${bookId}/${completed ? 'complete' : 'read'}`
  const returnLabel = completed ? '완독 기록 보기' : '이어 읽기'
  const nameOf = (id: string) => graph.data?.nodes.find((n) => n.id === id)?.name
  const names = (ids: string[]) => ids.map(nameOf).filter(Boolean) as string[]
  const total = session?.questions.length ?? 0
  const q = session?.questions[idx]
  const attempt = q && session?.attempts.find((a) => a.questionId === q.id)

  const submit = (giveUp?: 'forgot' | 'skipped') => {
    if (!session || !q) return
    answer.mutate(
      { sessionId: session.id, input: { questionId: q.id, response: giveUp ? '' : text, giveUp } },
      {
        onSuccess: (s) => {
          setSession(s)
          const outcome = s.attempts.find((item) => item.questionId === q.id)?.result
          if (outcome === 'correct') audio.play('correct')
          if (outcome === 'wrong' || outcome === 'partial') audio.play('wrong')
          if (giveUp === 'skipped') next(s)
          else setStep('feedback')
        },
      },
    )
  }
  const next = (s = session) => {
    if (!s) return
    if (idx < s.questions.length - 1) {
      setIdx(idx + 1)
      setText('')
      setStep('question')
    } else {
      finish.mutate(s.id, { onSuccess: setSession })
      setStep('result')
    }
  }
  const quit = () => {
    if (session?.attempts.length) {
      finish.mutate(session.id, { onSuccess: setSession })
      setStep('result')
    } else navigate(-1)
  }
  const retry = () => start.mutate({ mode: 'check', count: 5 }, {
    onSuccess: (newSession) => {
      setSession(newSession)
      setIdx(0)
      setText('')
      setExpandedQuestion(null)
      setStep('question')
      setPlaying(false)
    },
  })

  const header = (
    <SubBar
      title={step === 'result' ? '점검 결과' : '이전 내용 점검'}
      subtitle={step === 'result' ? `${book.data?.title ?? ''} · ${until}까지` : `${until}까지 · ${total}문항`}
      backTo={`/library`}
      right={step !== 'result' && session && total > 0 ? <button type="button" className="subbar-link" onClick={quit}>그만하기</button> : undefined}
    />
  )

  if (start.isError) {
    return <>{header}<main className="app-content">
      <p role="alert">{start.error.message}</p>
      <Button onClick={retry}>다시 시도</Button>
      <Button variant="ghost" to={returnPath}>{returnLabel}</Button>
    </main></>
  }

  if (start.isPending || !session) {
    return (<>{header}<main className="app-content"><p className="lbl">문항을 준비하는 중…</p></main></>)
  }

  if (total === 0) {
    return (
      <>
        {header}
        <main className="app-content">
          <Panel tone="white" stack gap={12}>
            <div className="row" style={{ gap: 12 }}>
              <PixelSprite name="d_node" fit={64} />
              <p style={{ fontSize: 15, lineHeight: 1.6 }}>아직 점검할 내용이 없어요. 조금 더 읽고 ‘여기까지 읽음’을 눌러 주세요.</p>
            </div>
            <Button full to={returnPath}>{returnLabel}</Button>
          </Panel>
        </main>
      </>
    )
  }

  if (!playing) return <>{header}<main className="app-content">
    <Panel tone="white" title="잠깐 놀기" stack gap={12}>
      <p>읽은 내용으로 퀴즈를 풀어봐요.</p>
      <Button full disabled={settings.isLoading} onClick={() => { audio.unlock(); setPlaying(true) }}>퀴즈 시작</Button>
      <Button full variant="ghost" to={returnPath}>{returnLabel}</Button>
    </Panel>
  </main></>

  if (step === 'result') {
    const count = (r: QuizResult[]) => session.attempts.filter((a) => r.includes(a.result)).length
    const correct = count(['correct']), partial = count(['partial']), missed = count(['wrong', 'forgot'])
    const confused = names(session.confusedNodeIds)
    const pct = understanding(session)
    const summary = `${total}문항 중 ${correct}개 정답${partial ? `, ${partial}개 부분 정답` : ''}.${confused.length ? ` ${confused.slice(0, 2).join('·')}을(를) 다시 보면 좋겠어요.` : ' 잘 기억하고 있어요!'}`
    return (
      <>
        {header}
        <main className="app-content">
          <div className="row" style={{ gap: 12, alignItems: 'flex-start' }}>
            <PixelSprite name="d_criteria" fit={64} />
            <div className="bubble grow" style={{ fontSize: 14 }}>{summary}</div>
          </div>
          {finish.isError && <Button size="sm" onClick={() => finish.mutate(session.id, { onSuccess: setSession })}>결과 저장 다시 시도</Button>}
          <div className="score-row">
            <div><b className="num" style={{ color: 'var(--green)' }}>{correct}</b><span>정답</span></div>
            <div><b className="num" style={{ color: 'var(--amber)' }}>{partial}</b><span>부분 정답</span></div>
            <div><b className="num" style={{ color: 'var(--err)' }}>{missed}</b><span>오답·기억 안 남</span></div>
          </div>
          <div id="question-results">
          <Panel tone="white" title="문항별 결과" padding="sm">
            <ul className="qlist">
              {session.questions.map((x, i) => {
                const a = session.attempts.find((y) => y.questionId === x.id)
                return (
                  <li key={x.id} className="quiz-result-item">
                    <button type="button" className="quiz-result-toggle" aria-expanded={expandedQuestion === x.id}
                      onClick={() => setExpandedQuestion(expandedQuestion === x.id ? null : x.id)}>
                      {a ? <ResultIcon result={a.result} /> : <span className="result-icon skip" />}
                      <span className="grow"><b>Q{i + 1}</b> {x.prompt}</span>
                      <span className="tag">{QUIZ_KIND_LABEL[x.kind].slice(0, 2)}</span>
                      <span className="sr-only">{a ? QUIZ_RESULT_LABEL[a.result] : '미응답'} · 정답과 근거</span>
                      <span aria-hidden="true">{expandedQuestion === x.id ? '⌄' : '›'}</span>
                    </button>
                    {expandedQuestion === x.id && (
                      <div className="col quiz-result-detail">
                        {a?.response && <p>내 답변 · {a.response}</p>}
                        {x.answer && <p><b>정답</b> · {x.answer}</p>}
                        {x.explanation && <p>{x.explanation}</p>}
                        {x.evidence && <>
                          <p className="quote">{x.evidence.text}</p>
                          <Button size="sm" variant="ghost" to={`/library/${bookId}/read?loc=${stringifyLocation(x.evidence.location)}`}>근거 문단 보기</Button>
                        </>}
                        {!x.answer && <p>{finish.isError ? '정답을 불러오지 못했어요.' : '정답을 불러오는 중이에요.'}</p>}
                        {finish.isError && !x.answer && <Button size="sm" onClick={() => finish.mutate(session.id, { onSuccess: setSession })}>다시 시도</Button>}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </Panel>
          </div>
          {MOCK_MODE && confused.length > 0 && (
            <div className="col" style={{ gap: 6 }}>
              <span className="lbl">혼동한 개념</span>
              <div className="row" style={{ flexWrap: 'wrap' }}>
                {session.confusedNodeIds.map((id) => nameOf(id) && (
                  <button key={id} type="button" className="chip berry-chip" onClick={() => navigate(`/library/${bookId}/graph?focus=${id}`)}>{nameOf(id)}</button>
                ))}
              </div>
            </div>
          )}
          <Panel tone="white" stack gap={10}>
            <div className="row"><span className="lbl" style={{ width: 72 }}>읽기 진도</span><span className="bar grow"><i style={{ width: `${book.data?.progress.percent ?? 0}%` }} /></span><span className="num" style={{ width: 40, textAlign: 'right' }}>{book.data?.progress.percent ?? 0}%</span></div>
            <div className="row"><span className="lbl" style={{ width: 72 }}>이해도 추정</span><span className="bar grow"><i className="a" style={{ width: `${pct}%` }} /></span><span className="num" style={{ width: 40, textAlign: 'right' }}>{pct}%</span></div>
          </Panel>
          <div style={{ flex: 1 }} />
          <div className="row">
            <Button variant="wood" className="grow" disabled={finish.isPending || start.isPending} onClick={retry}>다시 도전</Button>
            <Button className="grow" to={returnPath}>{returnLabel}</Button>
          </div>
          <Button full variant="ghost" onClick={() => {
              const question = session.questions.find((item) => session.attempts.find((a) => a.questionId === item.id)?.result !== 'correct')
              setExpandedQuestion(question?.id ?? session.questions[0]?.id ?? null)
              document.getElementById('question-results')?.scrollIntoView({ block: 'nearest' })
          }}>정답과 단서 확인</Button>
        </main>
      </>
    )
  }

  return (
    <>
      {header}
      <main className="app-content">
        {answer.isError && <p role="alert">{answer.error.message}</p>}
        <div className="qsteps" aria-label={`${idx + 1}/${total}번째 문항`}>
          {session.questions.map((x, i) => {
            const a = session.attempts.find((y) => y.questionId === x.id)
            const cls = i === idx ? 'cur' : a ? (a.result === 'correct' ? 'ok' : a.result === 'partial' ? 'part' : 'done') : ''
            return <i key={x.id} className={cls} />
          })}
        </div>
        {step === 'feedback' && q && attempt ? (
          <>
            <Feedback question={q} attempt={attempt} index={idx} conceptNames={names(q.relatedNodeIds)} bookId={bookId} />
            <div style={{ flex: 1 }} />
            <Button full trailing="›" onClick={() => next()}>{idx < total - 1 ? '다음 문항' : '결과 보기'}</Button>
          </>
        ) : (
          q && (
            <>
              <QuestionCard question={q} index={idx} conceptNames={names(q.relatedNodeIds)} />
              <AnswerField question={q} value={text} onChange={(value) => { if (q.choices?.length) audio.play('select'); setText(value) }} />
              <div style={{ flex: 1 }} />
              <Button full disabled={!text.trim() || answer.isPending} onClick={() => submit()}>제출하기</Button>
              <div className="row">
                <Button variant="ghost" className="grow" disabled={answer.isPending} onClick={() => submit('forgot')}>기억 안 남</Button>
                <Button variant="ghost" className="grow" disabled={answer.isPending} onClick={() => submit('skipped')}>건너뛰기</Button>
              </div>
            </>
          )
        )}
      </main>
    </>
  )
}
