import { useState } from 'react'
import { useParams } from 'react-router'
import { PixelSprite } from '@/components/pixel/PixelSprite'
import { QueryState } from '@/components/QueryState'
import { CATEGORY_LABEL, formatPrice } from '@/domain/labels'
import { useExploreDetail } from '@/hooks/queries'
import { Button, Panel } from '@/components/ui'
import { PurchaseSheet } from './PurchaseSheet'

/** 3.1 저자 등록 콘텐츠 상세. 구매(mock 결제) 후 내 서재에 추가됨 */
export function ExploreDetailPage() {
  const { contentId = '' } = useParams()
  const { data: c, isLoading, error } = useExploreDetail(contentId)
  const [buying, setBuying] = useState(false)

  return (
    <QueryState isLoading={isLoading} error={error}>
      {c && (
        <div className="store-detail">
          <Panel tone="white" stack gap={12}>
            <span className="pedestal" style={{ height: 160 }}><PixelSprite name={c.character.sprite} fit={128} /></span>
            <div className="col" style={{ gap: 6 }}>
              <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                {c.authorVerified && <span className="tag g"><PixelSprite name="i_check" scale={1} /> 저자 인증</span>}
                <span className="tag">{CATEGORY_LABEL[c.category]}</span>
                <span className="tag mono">{c.chapterCount}장</span>
              </div>
              <b className="h" style={{ fontSize: 24 }}>{c.title}</b>
              <span className="lbl">저자 {c.authorName} · 대표 캐릭터 {c.character.name}</span>
            </div>
            <p style={{ fontSize: 14, lineHeight: 1.6 }}>{c.description}</p>
          </Panel>

          <Panel stack gap={12} title="구매 안내">
            <div className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
              <PixelSprite name="i_lock" scale={2} color="var(--ink2)" />
              <span className="lbl" style={{ lineHeight: 1.5 }}>{c.license}</span>
            </div>
            <div className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
              <PixelSprite name="i_book" scale={2} color="var(--ink2)" />
              <span className="lbl" style={{ lineHeight: 1.5 }}>구매하면 내 서재에 책으로 추가되고 관계도·점검·메모를 그대로 쓸 수 있음</span>
            </div>
            {c.purchased && c.libraryBookId ? (
              <Button full icon="i_book" to={`/library/${c.libraryBookId}/read`}>서재에서 읽기</Button>
            ) : c.purchased ? (
              <Button full variant="wood" icon="i_plus" onClick={() => setBuying(true)}>서재에 다시 추가 (구매 내역 있음)</Button>
            ) : (
              <Button full variant="secondary" icon="i_star" trailing={formatPrice(c.price)} onClick={() => setBuying(true)}>구매하기</Button>
            )}
          </Panel>

          {buying && <PurchaseSheet content={c} onClose={() => setBuying(false)} />}
        </div>
      )}
    </QueryState>
  )
}
