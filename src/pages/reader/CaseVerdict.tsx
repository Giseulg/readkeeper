import { useEffect, useRef, useState } from 'react'
import { PixelSprite } from '@/components/pixel/PixelSprite'
import { verdictSprite, type VerdictPose } from '@/components/pixel/sprites'
import { Button } from '@/components/ui'
import type { ReadingCase } from '@/domain/types'

const beats = [
  { caption: '이 단서가 맞을까…', sound: 'count3' },
  { caption: '두 번째 단서를 살펴봐요', sound: 'count2' },
  { caption: '세 단서가 이어졌어요', sound: 'count1' },
  { caption: '정답입니다!', sound: 'verdict' },
] as const
const beatTime = [0, 950, 1900, 2850]
const poses = ['think', 'point', 'realize', 'cheer'] as const
type BeatSound = typeof beats[number]['sound']

export function CaseCast({ cast, size = 76, pose, closeUp = false }: { cast: ReadingCase['cast']; size?: number; pose?: VerdictPose; closeUp?: boolean }) {
  return (
    <div className="case-cast" data-count={cast.length}>
      {cast.map((person) => (
        <span key={person.id} className="case-cast-person">
          <PixelSprite name={pose ? verdictSprite(person.sprite, pose) : person.sprite} title={person.name} fit={size} cropHeight={closeUp && person.sprite.startsWith('h_') ? 25 : undefined} />
          <span>{person.name}</span>
        </span>
      ))}
    </div>
  )
}

export function CaseVerdict({ cast, mood, play, onFinish }: {
  cast: ReadingCase['cast']
  mood?: ReadingCase['verdictMood']
  play: (sound: BeatSound) => void
  onFinish: () => void
}) {
  const finale = cast.length === 3 ? [cast[0], cast[2], cast[1]] : cast
  const [frame, setFrame] = useState(0)
  const [acting, setActing] = useState(false)
  const screen = useRef<HTMLDialogElement>(null)
  const timers = useRef<number[]>([])
  const celebrated = useRef(false)

  useEffect(() => {
    const dialog = screen.current
    dialog?.showModal()
    return () => dialog?.close()
  }, [])

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    timers.current = reduced ? [
      window.setTimeout(() => { play('verdict'); onFinish() }, 0),
    ] : [
      ...beats.map((beat, index) => window.setTimeout(() => {
        setActing(index === 3)
        setFrame(index)
        if (beat.sound === 'verdict') celebrated.current = true
        play(beat.sound)
      }, beatTime[index])),
      ...beatTime.slice(0, 3).map((start) => window.setTimeout(() => setActing(true), start + 155)),
      window.setTimeout(onFinish, 4700),
    ]
    return () => timers.current.forEach((timer) => window.clearTimeout(timer))
  }, [onFinish, play])

  const skip = () => {
    timers.current.forEach((timer) => window.clearTimeout(timer))
    if (!celebrated.current) play('verdict')
    onFinish()
  }

  return (
    <dialog ref={screen} className={`case-verdict${frame === 3 ? ' case-verdict-solved' : ''}`} aria-label="정답 확인 연출"
      onCancel={(event) => { event.preventDefault(); skip() }}>
      <div className="case-verdict-art" data-frame={frame} key={frame}><CaseCast cast={frame === 3 ? finale : cast.length ? [cast[frame % cast.length]] : []} size={384} closeUp pose={acting ? (frame === 3 && mood === 'gentle' ? 'nod' : poses[frame]) : undefined} /></div>
      <div className="case-verdict-beats" aria-hidden="true">
        {[3, 2, 1].map((count, i) => <span key={count} className={i <= frame ? 'lit' : ''}>{count}</span>)}
      </div>
      {frame === 3 ? <strong role="status">정답입니다!</strong> : <p>{beats[frame].caption}</p>}
      <Button size="sm" variant="ghost" onClick={skip}>바로 결과 보기</Button>
    </dialog>
  )
}
