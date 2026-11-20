import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router'
import { http } from '@/api/client'
import { PixelSprite } from '@/components/pixel/PixelSprite'
import { registerCharacterRecipe, verdictSprite, type CharacterRecipe, type VerdictPose } from '@/components/pixel/sprites'
import { QueryState } from '@/components/QueryState'
import { SubBar } from '@/components/SubBar'
import { Button, Panel } from '@/components/ui'
import { stringifyLocation } from '@/domain/location'
import type { Quote } from '@/domain/types'

interface Preview {
  reason: string
  recipe: CharacterRecipe
  character: {
    subject: string
    atmosphere: string
    appearance: string
    color: string
    expression: string
    props: string
    interpretation: string
    evidence: Quote[]
  }
}

const poses: { name: string; pose?: VerdictPose }[] = [
  { name: '기본' }, { name: '생각', pose: 'think' }, { name: '가리키기', pose: 'point' },
  { name: '깨달음', pose: 'realize' }, { name: '기쁨', pose: 'cheer' },
]

export function CharacterDesignPage() {
  const { bookId = '' } = useParams()
  const query = useQuery({ queryKey: ['character-design', bookId],
    queryFn: () => http<Preview>(`/books/${bookId}/character-design`), retry: false })
  const data = query.data
  const sprite = data ? registerCharacterRecipe(data.recipe) : undefined
  return <>
    <SubBar title="캐릭터 설계 미리보기" backTo={`/library/${bookId}/complete`} />
    <main className="app-content col" style={{ gap: 14 }}>
      <QueryState isLoading={query.isLoading} error={query.error}>
        {data && sprite && <>
          <Panel title={data.character.subject} tone="white" stack gap={12}>
            <p>검토 중인 캐릭터 초안입니다.</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {poses.map(({ name, pose }) => <figure key={name} style={{ margin: 0 }}>
                <PixelSprite name={pose ? verdictSprite(sprite, pose) : sprite} fit={96} title={name} />
                <figcaption>{name}</figcaption>
              </figure>)}
            </div>
            <p>{data.reason}</p>
          </Panel>
          <Panel title="작품에 맞춘 외형" stack gap={8}>
            <p>{data.character.appearance}</p><p>{data.character.atmosphere}</p>
            <p>{data.character.expression}</p><p>{data.character.props}</p>
            <b>그림으로 해석한 부분</b><p>{data.character.interpretation}</p>
            {!!data.recipe.missing_features.length && <>
              <b>추가 부품이 필요한 특징</b>
              <ul>{data.recipe.missing_features.map((feature) => <li key={feature}>{feature}</li>)}</ul>
            </>}
            <details><summary>원문 근거 확인</summary>
              {data.character.evidence.map((proof, index) => <div key={index} style={{ marginBlock: 12 }}>
                <blockquote className="quote">{proof.text}</blockquote>
                <Button size="sm" to={`/library/${bookId}/read?loc=${stringifyLocation(proof.location)}`}>본문으로 이동</Button>
              </div>)}
            </details>
          </Panel>
        </>}
      </QueryState>
    </main>
  </>
}
