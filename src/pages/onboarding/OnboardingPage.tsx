import { useState } from 'react'
import { useNavigate } from 'react-router'
import { PixelSprite } from '@/components/pixel/PixelSprite'
import { useCompleteOnboarding } from '@/hooks/queries'
import type { Category } from '@/domain/types'
import { CATEGORY_LABEL } from '@/domain/labels'
import { Button, Panel } from '@/components/ui'

const OPTIONS: Category[] = ['major', 'paper', 'novel', 'poetry', 'cs_book', 'general']

/** 0.1 온보딩 */
export function OnboardingPage() {
  const navigate = useNavigate()
  const [nickname, setNickname] = useState('')
  const [interests, setInterests] = useState<Category[]>([])
  const complete = useCompleteOnboarding()

  const toggle = (c: Category) => setInterests((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]))

  return (
    <main className="app-content" style={{ justifyContent: 'center', gap: 16 }}>
      <div className="col" style={{ alignItems: 'center', gap: 12 }}>
        <span className="pedestal" style={{ width: 144, height: 120 }}><PixelSprite name="d_node" fit={96} /></span>
        <h1 className="h" style={{ fontSize: 40, color: 'var(--green-d)', lineHeight: 1 }}>읽기의 재미</h1>
        <p className="lbl" style={{ fontSize: 14 }}>읽은 개념이 캐릭터가 되는 서재</p>
      </div>
      <Panel tone="white" stack gap={8}>
        <label className="lbl" htmlFor="nick">닉네임</label>
        <input id="nick" className="input" value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="닉네임" />
        <span className="lbl" style={{ marginTop: 8 }}>관심 분야</span>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          {OPTIONS.map((c) => (
            <button key={c} type="button" className={interests.includes(c) ? 'chip on' : 'chip'} onClick={() => toggle(c)}>
              {CATEGORY_LABEL[c]}
            </button>
          ))}
        </div>
      </Panel>
      <Button
        full
        disabled={!nickname || interests.length === 0 || complete.isPending}
        onClick={() => complete.mutate({ nickname, interests }, { onSuccess: () => navigate('/', { replace: true }) })}
      >
        시작하기
      </Button>
    </main>
  )
}
