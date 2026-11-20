import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import { PixelSprite } from '@/components/pixel/PixelSprite'
import { QueryState } from '@/components/QueryState'
import { SubBar } from '@/components/SubBar'
import { Button, Panel } from '@/components/ui'
import { useBook, useRestartReading } from '@/hooks/queries'
import { verdictSprite } from '@/components/pixel/sprites'
import type { Collectible } from '@/domain/types'

const REWARD_POSES = [undefined, 'think', 'point', 'realize', 'cheer'] as const

function CompletionReward({ reward }: { reward: Collectible }) {
  const [frame, setFrame] = useState(0)
  useEffect(() => {
    if (!reward.earnedAt) return
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    let timer: number | undefined
    const update = () => {
      window.clearInterval(timer)
      if (!preference.matches) timer = window.setInterval(() => setFrame((value) => (value + 1) % REWARD_POSES.length), 950)
      else setFrame(0)
    }
    update()
    preference.addEventListener('change', update)
    return () => { window.clearInterval(timer); preference.removeEventListener('change', update) }
  }, [reward.earnedAt])
  const pose = reward.earnedAt ? REWARD_POSES[frame] : undefined
  return <figure className="completion-reward" data-frame={frame} data-earned={!!reward.earnedAt}>
    <PixelSprite name={pose ? verdictSprite(reward.sprite, pose) : reward.sprite} fit={128}
      title={reward.earnedAt ? reward.name : '아직 만나지 않은 캐릭터'}
      className={reward.earnedAt ? undefined : 'completion-reward-locked'} />
    <figcaption>{reward.earnedAt ? reward.name : '수수께끼를 풀면 만날 수 있어요'}</figcaption>
  </figure>
}

export function ReadingCompletePage() {
  const { bookId = '' } = useParams()
  const book = useBook(bookId)
  const navigate = useNavigate()
  const restart = useRestartReading(bookId)
  const base = `/library/${bookId}`
  if (book.data && book.data.progress.percent < 100 && !restart.isPending) return <Navigate to={`${base}/read`} replace />

  return (
    <>
      <SubBar title="완독" backTo="/library" />
      <main className="app-content">
        <QueryState isLoading={book.isLoading} error={book.error}>
          {book.data && (
            <Panel tone="white" title="끝까지 다 읽었어요!" stack gap={14}>
              {!!book.data.completionRewards?.length && <div className="completion-rewards">
                {book.data.completionRewards.map((reward) => <CompletionReward key={reward.id} reward={reward} />)}
              </div>}
              <p>「{book.data.title}」 완독 · 100%</p>
              {(book.data.caseAvailable ?? bookId === 'rain-return-box') && <Button full to={`${base}/case`}>{bookId === 'rain-return-box' ? '완독 미니게임 · 사건 풀기' : '완독 수수께끼 풀기'}</Button>}
              <Button full variant="wood" to={`${base}/notes`}>내 메모·추론 다시 보기</Button>
              <Button full variant="ghost" to={`${base}/read?loc=0.0`}>첫페이지부터 보기</Button>
              <Button full variant="secondary" disabled={restart.isPending} onClick={() => restart.mutate(undefined, {
                onSuccess: () => navigate(`${base}/read?loc=0.0`, { replace: true }),
              })}>{restart.isPending ? '진도 초기화 중…' : '읽은 기록 초기화'}</Button>
              <small>읽음 진도와 퀴즈 공개 범위가 초기화돼요. 메모와 이전 풀이 기록은 남아요.</small>
              {restart.isError && <p role="alert">{restart.error.message}</p>}
              <Button full variant="ghost" to="/library">서재로 돌아가기</Button>
            </Panel>
          )}
        </QueryState>
      </main>
    </>
  )
}
