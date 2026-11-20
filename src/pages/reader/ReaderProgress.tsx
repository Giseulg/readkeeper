import { formatLocation } from '@/domain/location'
import type { ReadingLocation } from '@/domain/types'

interface Props {
  confirmed: ReadingLocation
  confirmedPct: number
  current: ReadingLocation
  currentPct: number
}

/** 진도 바: 읽음 확정(초록)과 현재 위치(주황 표식)를 구분해 표시 */
export function ReaderProgress({ confirmed, confirmedPct, current, currentPct }: Props) {
  return (
    <div className="rprog">
      <div className="rprog-track" role="img" aria-label={`읽음 확정 ${confirmedPct}%, 현재 위치 ${currentPct}%`}>
        <i className="done" style={{ width: `${confirmedPct}%` }} />
        {currentPct > confirmedPct && <i className="ahead" style={{ left: `${confirmedPct}%`, width: `${currentPct - confirmedPct}%` }} />}
        <i className="here" style={{ left: `${currentPct}%` }} />
      </div>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="rprog-lbl"><i className="sw done" />읽음 확정 {formatLocation(confirmed)} · {confirmedPct}%</span>
        <span className="rprog-lbl"><i className="sw here" />현재 {formatLocation(current)} · {currentPct}%</span>
      </div>
    </div>
  )
}
