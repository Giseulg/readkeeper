import { useCallback, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Navigate, useParams } from 'react-router'
import { api } from '@/api'
import { QueryState } from '@/components/QueryState'
import { SubBar } from '@/components/SubBar'
import { Button, Panel } from '@/components/ui'
import { formatLocation, stringifyLocation } from '@/domain/location'
import type { CaseSolution, CaseSlot, ReadingCase } from '@/domain/types'
import { qk, useBook, useSettings } from '@/hooks/queries'
import { useGameAudio } from '@/hooks/useGameAudio'
import { CaseVerdict, CaseCast } from './CaseVerdict'

export function ReadingCasePage() {
  const { bookId = '' } = useParams()
  const book = useBook(bookId)
  const completed = book.data?.progress.percent === 100
  const story = bookId === 'rain-return-box'
  const playable = book.data?.caseAvailable ?? story
  const base = `/library/${bookId}`
  const game = useQuery({
    queryKey: ['reading-case', bookId],
    queryFn: () => api.books.readingCase(bookId),
    enabled: playable && completed,
  })
  if (book.data && (!playable || !completed)) return <Navigate replace to={`${base}/complete`} />

  return (
    <>
      <SubBar title={story ? '빗속의 단서 수첩' : '완독 수수께끼'} backTo={`${base}/complete`} />
      <main className="app-content">
        <QueryState isLoading={book.isLoading || game.isLoading} error={book.error ?? game.error}>
          {game.data && <CaseBoard key={bookId} bookId={bookId} game={game.data} />}
        </QueryState>
      </main>
    </>
  )
}

function CaseBoard({ bookId, game }: { bookId: string; game: ReadingCase }) {
  const poetry = game.mode === 'poetry_exam'
  const settings = useSettings()
  const query = useQueryClient()
  const [started, setStarted] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [slots, setSlots] = useState<CaseSolution>({ situation: '', reason: '', action: '' })
  const [openEvidence, setOpenEvidence] = useState(false)
  const [hint, setHint] = useState('')
  const [checks, setChecks] = useState<Partial<Record<CaseSlot, boolean>>>({})
  const [verdictFinished, setVerdictFinished] = useState(false)
  const finishVerdict = useCallback(() => setVerdictFinished(true), [])
  const effectsOn = settings.data?.learning.gameSound ?? false
  const solve = useMutation({
    mutationFn: (solution: CaseSolution) => api.books.solveReadingCase(bookId, solution),
    onSuccess: (data) => {
      if (data.solved) {
        void query.invalidateQueries({ queryKey: qk.book(bookId) })
        void query.invalidateQueries({ queryKey: ['me', 'collectibles'] })
        void query.invalidateQueries({ queryKey: qk.myCharacters })
        void query.invalidateQueries({ queryKey: qk.castle })
        void query.invalidateQueries({ queryKey: qk.stats })
      }
    },
  })
  const result = solve.data?.solved ? solve.data : undefined
  const audio = useGameAudio(effectsOn, settings.data?.learning.gameMusic ?? false, started && !result)
  const cardText = (id: string) => game.cards.find((card) => card.id === id)?.text
  const placed = Object.values(slots)

  const place = (slot: CaseSlot) => {
    if (!selected && !slots[slot]) return
    setSlots({ ...slots, [slot]: selected ?? '' })
    setChecks((previous) => ({ ...previous, [slot]: undefined }))
    setSelected(null)
    setHint('')
    audio.play(selected ? 'pickup' : 'select')
  }

  const submit = () => {
    setHint('')
    solve.mutate(slots, { onSuccess: (data) => {
      if (data.solved && !game.cast.length) audio.play('success')
      if (!data.solved) {
        audio.play('wrong')
        setChecks(data.checks)
        setHint(data.hint)
      }
    } })
  }

  if (!started) return (
    <Panel title={game.title ?? '반납함에 남겨진 쪽지'} tone="white" stack gap={12}>
      <CaseCast cast={game.cast} size={52} />
      <p>{game.prompt}</p>
      <p>{poetry ? '문제마다 가장 적절한 보기 하나를 고르세요. 세 문제를 모두 맞히면 캐릭터를 얻어요.' : '단서 카드를 골라 알맞은 칸에 놓고, 왜 맞는지 원문에서 확인해 봐요.'}</p>
      <Button full onClick={() => { audio.unlock(); setStarted(true) }} disabled={settings.isLoading}>{game.title ? '수수께끼 시작' : '사건 풀기 시작'}</Button>
    </Panel>
  )

  if (result) {
    if (game.cast.length && !verdictFinished) return <CaseVerdict cast={game.cast} mood={game.verdictMood} play={audio.play} onFinish={finishVerdict} />
    return (
      <div className="col case-report">
        <Panel title={game.title ? '수수께끼를 풀었어요!' : '사건을 해결했어요!'} tone="white" stack gap={12}>
          <div className="case-report-score">
            <CaseCast cast={game.cast} size={44} />
            <div className="col"><span>정답입니다!</span><b>{poetry ? '정답' : '단서'} {result.score} / {result.maxScore}</b></div>
          </div>
          <h2>왜 정답일까요?</h2>
          <p>{result.explanation}</p>
          <ol className="case-report-chain">
            {game.slots.map((slot, index) => (
              <li key={slot.id}>
                <div className="col"><b>{slot.label}</b><span>{cardText(slots[slot.id])}</span></div>
                {result.slotExplanations?.[slot.id] && <p style={{ whiteSpace: 'pre-line' }}>{result.slotExplanations[slot.id]}</p>}
                {(game.slotEvidence?.[slot.id] ?? (game.evidence[index] ? [game.evidence[index]] : [])).map((proof, proofIndex) => (
                  <details key={proofIndex}>
                    <summary>원문 보기 · {formatLocation(proof.location)}</summary>
                    <p className="quote">{proof.text}</p>
                      <Button size="sm" variant="ghost" to={`/library/${bookId}/read?loc=${stringifyLocation(proof.location)}`}>근거 문단으로 이동</Button>
                  </details>
                ))}
              </li>
            ))}
          </ol>
          {result.rewards.some((item) => item.newlyEarned) && (
            <b>새 친구를 만났어요 · {result.rewards.filter((item) => item.newlyEarned).map((item) => item.name).join(' · ')}</b>
          )}
          {result.rewards.length > 0 && <Button full to="/collection">수집에서 얻은 캐릭터 보기</Button>}
          <Button full variant="ghost" to={`/library/${bookId}/complete`}>완독 기록 보기</Button>
        </Panel>
      </div>
    )
  }

  return (
    <div className="col" style={{ gap: 14 }}>
      <div className="case-intro">
        <CaseCast cast={game.cast} size={40} />
        <h2>{game.prompt}</h2>
      </div>
      {poetry ? <div className="col" style={{ gap: 16 }}>
        {game.slots.map((slot, index) => <Panel key={slot.id} title={`${index + 1}. ${slot.label}`} stack gap={10}>
          <div role="radiogroup" aria-label={slot.label} className="col" style={{ gap: 8 }}>
            {slot.choiceIds?.map((id, choiceIndex) => <button key={id} type="button" role="radio"
              tabIndex={slots[slot.id] === id || (!slots[slot.id] && choiceIndex === 0) ? 0 : -1}
              aria-checked={slots[slot.id] === id} className="case-card" disabled={solve.isPending}
              onKeyDown={(event) => {
                if (!['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft'].includes(event.key)) return
                event.preventDefault()
                const step = ['ArrowDown', 'ArrowRight'].includes(event.key) ? 1 : -1
                const next = (choiceIndex + step + 5) % 5
                const nextId = slot.choiceIds?.[next]
                if (nextId) {
                  setSlots({ ...slots, [slot.id]: nextId })
                  setChecks(previous => ({ ...previous, [slot.id]: undefined }))
                  setHint('')
                  event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('button')[next]?.focus()
                }
              }}
              onClick={() => { setSlots({ ...slots, [slot.id]: id }); setChecks(previous => ({ ...previous, [slot.id]: undefined })); setHint(''); audio.play('select') }}>
              {slots[slot.id] === id ? '●' : '○'} {choiceIndex + 1}. {cardText(id)}
            </button>)}
          </div>
          {checks[slot.id] !== undefined && <p role="status">{checks[slot.id] ? '맞았어요' : '원문을 살펴보고 다시 골라 보세요.'}</p>}
        </Panel>)}
      </div> : <>
      <p className="lbl">카드를 고르고 위의 칸을 눌러 놓으세요. 칸을 다시 누르면 카드를 뺄 수 있어요.</p>
      <div className="col case-slots" aria-label="사건 연결 칸">
        {game.slots.map((slot) => {
          const correct = checks[slot.id]
          const mark = correct === undefined ? undefined : correct ? 'correct' : 'wrong'
          return (
            <button key={slot.id} type="button" className="case-slot" data-mark={mark} onClick={() => place(slot.id)}
              disabled={solve.isPending || (!selected && !slots[slot.id])}>
              <span className="case-slot-heading">
                <b>{slot.label}</b>
                {mark && <span className="case-slot-mark"><span aria-hidden="true">{correct ? '○' : '×'}</span> {correct ? '맞았어요' : '다시 확인'}</span>}
              </span>
              <span key={slots[slot.id]} className={slots[slot.id] ? 'case-card-place' : ''}>{cardText(slots[slot.id]) ?? '단서를 놓을 자리'}</span>
            </button>
          )
        })}
      </div>
      <Panel title="단서 카드" tone="white" stack gap={8}>
        {game.cards.map((card) => (
          <button key={card.id} type="button" className="case-card" aria-pressed={selected === card.id}
            disabled={solve.isPending || placed.includes(card.id)} onClick={() => {
              audio.play('select')
              setSelected(selected === card.id ? null : card.id)
            }}>{card.text}</button>
        ))}
      </Panel>
      </>}
      {hint && <p role="status" className="quote">{hint}</p>}
      {solve.isError && <p role="alert">{solve.error.message}</p>}
      <Button full onClick={submit} disabled={placed.some((id) => !id) || solve.isPending}>{poetry ? '정답 확인' : '단서 연결 확인'}</Button>
      <Button full variant="ghost" aria-expanded={openEvidence} onClick={() => setOpenEvidence(!openEvidence)}>
        {openEvidence ? '원문 접기' : '원문에서 힌트 보기'}
      </Button>
      {openEvidence && (
        <Panel title="다시 읽을 장면" tone="white" stack gap={10}>
          {game.evidence.map((quote, index) => (
            <div key={index} className="col">
              <span className="lbl">{formatLocation(quote.location)}</span>
              <p className="quote">{quote.text}</p>
            </div>
          ))}
        </Panel>
      )}
    </div>
  )
}
