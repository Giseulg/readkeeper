import { useState } from 'react'
import { Button, Sheet } from '@/components/ui'
import { formatLocation } from '@/domain/location'
import type { MemoType, Quote } from '@/domain/types'
import { useCreateMemo } from '@/hooks/queries'

const LEVELS = [1, 2, 3, 4, 5] as const

/** 2.5b 메모·가설 작성. 위치는 선택한 문장 기준으로 자동 기록 */
export function MemoSheet({ bookId, quote, percent, onClose, clue = false, onSaved = onClose }: {
  bookId: string; quote: Quote; percent: number; onClose: () => void; clue?: boolean; onSaved?: () => void
}) {
  const [type, setType] = useState<MemoType>(clue ? 'hypothesis' : 'memo')
  const [content, setContent] = useState('')
  const [evidence, setEvidence] = useState('')
  const [confidence, setConfidence] = useState<1 | 2 | 3 | 4 | 5>(3)
  const create = useCreateMemo()
  const isHyp = type === 'hypothesis'

  const save = () =>
    create.mutate(
      { bookId, type, content, quote, hypothesis: isHyp ? { evidence: clue ? quote.text : evidence, confidence } : undefined },
      { onSuccess: onSaved },
    )

  return (
    <Sheet title={clue ? '단서 남기기' : '메모 · 가설 작성'} aside={<span className="tag mono">{formatLocation(quote.location)} · {percent}%</span>} onClose={onClose}>
      <div className="sheet-scroll col" style={{ gap: 12 }}>
        <div className="quote">“{quote.text}”</div>
        {!clue && <div className="seg" role="radiogroup" aria-label="유형">
          <button type="button" role="radio" aria-checked={!isHyp} className={!isHyp ? 'on' : ''} onClick={() => setType('memo')}>메모</button>
          <button type="button" role="radio" aria-checked={isHyp} className={isHyp ? 'on accent' : ''} onClick={() => setType('hypothesis')}>질문 · 가설</button>
        </div>}
        <label className="col" style={{ gap: 4 }}>
          <span className="lbl">{clue ? '이 문장에서 뭐가 궁금했어요?' : '내용'}</span>
          <textarea className="input area" value={content} onChange={(e) => setContent(e.target.value)} placeholder={isHyp ? '이후 내용에서 확인하고 싶은 질문이나 예상' : '떠오른 생각'} />
        </label>
        {isHyp && !clue && (
          <>
            <label className="col" style={{ gap: 4 }}>
              <span className="lbl">근거</span>
              <input className="input" value={evidence} onChange={(e) => setEvidence(e.target.value)} placeholder="왜 그렇게 생각했나요?" />
            </label>
            <div className="row">
              <span className="lbl" style={{ width: 48 }}>확신도</span>
              <div className="meter grow" role="radiogroup" aria-label="확신도">
                {LEVELS.map((l) => (
                  <button key={l} type="button" role="radio" aria-checked={confidence === l} aria-label={`${l * 20}%`} className={l <= confidence ? 'on' : ''} onClick={() => setConfidence(l)} />
                ))}
              </div>
              <span className="num" style={{ width: 40, textAlign: 'right' }}>{confidence * 20}%</span>
            </div>
            <p className="lbl">관련 구간까지 읽음을 확정하면 이 가설을 다시 검토하도록 알려드려요.</p>
          </>
        )}
      </div>
      {create.isError && <p role="alert">{create.error.message}</p>}
      <div className="row">
        <Button variant="ghost" className="grow" onClick={onClose}>취소</Button>
        <Button variant={isHyp ? 'accent' : 'primary'} className="grow" disabled={!content.trim() || (isHyp && !clue && !evidence.trim()) || create.isPending} onClick={save}>
          {clue ? '수첩에 넣기' : '저장'}
        </Button>
      </div>
    </Sheet>
  )
}
