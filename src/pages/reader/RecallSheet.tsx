import { ANALYSIS_LABEL } from '@/domain/labels'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { MOCK_MODE } from '@/appMode'
import { Feedback, QuestionCard } from '@/components/quiz'
import { AnswerField } from '@/components/quiz/AnswerField'
import { PixelSprite } from '@/components/pixel/PixelSprite'
import { Button, Sheet } from '@/components/ui'
import { formatLocation } from '@/domain/location'
import type { Book, QuizSession } from '@/domain/types'
import { useAnswerQuiz, useFinishQuiz, useGraph, useStartQuiz } from '@/hooks/queries'

type Step = 'ask' | 'write' | 'feedback'

function daysAgo(iso?: string) {
  if (!iso) return ''
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  return d <= 0 ? '오늘' : `${d}일 전`
}

/** 2.5a 회상 질문 제안 시트. 선택 사항이며 바로 읽기로 언제든 닫을 수 있음 */
export function RecallSheet({ book, count, onClose }: { book: Book; count: number; onClose: () => void }) {
  const navigate = useNavigate()
  const start = useStartQuiz(book.id)
  const answer = useAnswerQuiz()
  const finish = useFinishQuiz()
  const graph = useGraph(book.id)
  const [session, setSession] = useState<QuizSession | null>(null)
  const [idx, setIdx] = useState(0)
  const [step, setStep] = useState<Step>('ask')
  const [text, setText] = useState('')
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    try {
      sessionStorage.setItem(`rf-recall-shown-${book.id}`, '1')
    } catch {
      /* ignore */
    }
    start.mutate(
      { mode: 'recall', count },
      { onSuccess: (s) => (s.questions.length ? setSession(s) : onClose()), onError: onClose },
    )
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!session) return null
  const q = session.questions[idx]
  const attempt = session.attempts.find((a) => a.questionId === q.id)
  const names = q.relatedNodeIds.map((id) => graph.data?.nodes.find((n) => n.id === id)?.name).filter(Boolean) as string[]
  const isLast = idx === session.questions.length - 1

  const submit = (giveUp?: 'forgot') =>
    answer.mutate(
      { sessionId: session.id, input: { questionId: q.id, response: giveUp ? '' : text, giveUp } },
      { onSuccess: (s) => { setSession(s); setStep('feedback') } },
    )
  const close = () => {
    if (session.attempts.length) finish.mutate(session.id)
    onClose()
  }
  const next = () => {
    if (isLast) return close()
    setIdx(idx + 1)
    setText('')
    setText('')
    setStep('ask')
  }

  return (
    <Sheet
      title={
        <span className="row" style={{ gap: 12 }}>
          <PixelSprite name="d_node" fit={64} />
          <span className="col" style={{ gap: 2 }}>
            <span>다시 오셨네요!</span>
            <span className="lbl" style={{ fontSize: 13 }}>
              지난번 {formatLocation(book.progress.confirmed)}까지 읽음 · {daysAgo(book.progress.lastReadAt)}
            </span>
          </span>
        </span>
      }
      onClose={close}
    >
      <div className="sheet-scroll">
        {step === 'feedback' && attempt ? (
          <Feedback question={q} attempt={attempt} index={idx} conceptNames={names} bookId={book.id} />
        ) : (
          <QuestionCard question={q} index={idx} total={session.questions.length} aside="선택 사항">
            {step === 'write' && (
              <AnswerField question={q} value={text} onChange={setText} />
            )}
          </QuestionCard>
        )}
      </div>

      {step === 'ask' && (
        <>
          <Button full icon="i_pencil" onClick={() => setStep('write')}>답변하기</Button>
          <div className="row">
            <Button variant="ghost" className="grow" disabled={answer.isPending} onClick={() => submit('forgot')}>기억나지 않음</Button>
            <Button variant="wood" className="grow" trailing="›" onClick={close}>바로 읽기</Button>
          </div>
        </>
      )}
      {step === 'write' && (
        <div className="row">
          <Button variant="ghost" className="grow" onClick={() => setStep('ask')}>뒤로</Button>
          <Button className="grow" disabled={!text.trim() || answer.isPending} onClick={() => submit()}>제출</Button>
        </div>
      )}
      {step === 'feedback' && (
        <div className="row">
          {MOCK_MODE && attempt?.result !== 'correct' && q.relatedNodeIds[0] && (
            <Button variant="wood" className="grow" icon="i_graph" onClick={() => navigate(`/library/${book.id}/graph?focus=${q.relatedNodeIds[0]}`)}>
              {ANALYSIS_LABEL[book.category]}
            </Button>
          )}
          <Button className="grow" onClick={next}>{isLast ? '읽기 시작' : '다음 질문'}</Button>
        </div>
      )}
      <p className="lbl" style={{ textAlign: 'center' }}>회상 질문은 내 정보 › 읽기·학습 설정에서 끌 수 있어요</p>
    </Sheet>
  )
}
