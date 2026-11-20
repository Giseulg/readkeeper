import { useState } from 'react'
import { Button, Modal } from '@/components/ui'
import { formatLocation } from '@/domain/location'
import type { HypothesisRevision, Memo, ReadingLocation } from '@/domain/types'
import { useReviseMemo } from '@/hooks/queries'

const outcomes = {
  changed: '생각이 바뀌었어',
  same: '그대로야',
  unsure: '아직 모르겠어',
} as const

/** 2.5c 가설 재검토 알림. 관련 구간을 확정했을 때 표시 */
export function ReviewModal({ memo, confirmed, onClose }: { memo: Memo; confirmed: ReadingLocation; onClose: () => void }) {
  const [text, setText] = useState('')
  const [outcome, setOutcome] = useState<HypothesisRevision['outcome']>()
  const revise = useReviseMemo(memo.bookId)
  const h = memo.hypothesis!
  const ev = h.reviewEvidence ?? { for: [], against: [] }

  return (
    <Modal title="단서 수첩" icon="i_bell" onClose={onClose}>
      <p style={{ fontSize: 15, lineHeight: 1.6 }}>
        {formatLocation(confirmed)}까지 읽었어요. <b>{formatLocation(memo.quote.location)}</b>에서 남긴 가설을 후속 원문과 함께 살펴보세요.
      </p>
      <div className="panel accent sm col" style={{ gap: 6 }}>
        <div className="row">
          <span className="tag v">처음 생각</span>
          <span className="lbl" style={{ marginLeft: 'auto' }}>확신도 <b className="num">{h.confidence * 20}%</b></span>
        </div>
        <b style={{ fontSize: 16, lineHeight: 1.5 }}>{memo.content}</b>
      </div>
      {ev.for.length > 0 && (
        <div className="col" style={{ gap: 6 }}>
          <span className="tag g" style={{ alignSelf: 'flex-start' }}>{ev.against.length ? '지지 근거' : '새로 읽은 원문'}</span>
          {ev.for.map((q, i) => <div key={i} className="quote">{q.text}</div>)}
        </div>
      )}
      {ev.against.length > 0 && (
        <div className="col" style={{ gap: 6 }}>
          <span className="tag" style={{ alignSelf: 'flex-start', background: 'var(--err)', color: '#fff' }}>반대 근거</span>
          {ev.against.map((q, i) => <div key={i} className="quote">{q.text}</div>)}
        </div>
      )}
      <fieldset className="col quiz-options">
        <legend className="lbl">지금은 어떻게 생각해요?</legend>
        {(Object.keys(outcomes) as Array<keyof typeof outcomes>).map((choice) => (
          <label key={choice} className={`quiz-option${outcome === choice ? ' selected' : ''}`}>
            <input type="radio" name="clue-outcome" checked={outcome === choice} onChange={() => setOutcome(choice)} />
            {outcomes[choice]}
          </label>
        ))}
      </fieldset>
      <label className="col" style={{ gap: 4 }}>
        <span className="lbl">지금 생각 (선택)</span>
        <textarea className="input area" value={text} onChange={(e) => setText(e.target.value)} placeholder="지금 이해한 내용으로 다시 설명해 보세요" />
      </label>
      {revise.isError && <p role="alert">{revise.error.message}</p>}
      <div className="row">
        <Button variant="ghost" className="grow" onClick={onClose}>나중에</Button>
        <Button
          className="grow"
          disabled={!outcome || revise.isPending}
          onClick={() => outcome && revise.mutate({ memoId: memo.id, revision: {
            outcome, content: text.trim() || outcomes[outcome], evidenceFor: ev.for, evidenceAgainst: ev.against,
          } }, { onSuccess: onClose })}
        >
          수첩에 기록
        </Button>
      </div>
    </Modal>
  )
}
