import { useState } from 'react'
import { PixelSprite } from '@/components/pixel/PixelSprite'
import { Button, Segmented, Sheet } from '@/components/ui'
import { formatPrice, PAYMENT_METHOD_LABEL } from '@/domain/labels'
import type { AuthorContent, PaymentMethod } from '@/domain/types'
import { usePurchaseContent } from '@/hooks/queries'

const METHODS = (Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]).map((value) => ({ value, label: PAYMENT_METHOD_LABEL[value] }))

/** 3.2 구매 확인 시트. 실제 결제 연동 전이라 mock 결제로 처리함 */
export function PurchaseSheet({ content: c, onClose }: { content: AuthorContent; onClose: () => void }) {
  const purchase = usePurchaseContent(c.id)
  const [method, setMethod] = useState<PaymentMethod>('card')
  const [agreed, setAgreed] = useState(false)
  // 구매 내역이 있고 서재에서만 지운 경우: 결제 없이 다시 추가
  const readd = c.purchased && !c.libraryBookId
  const done = purchase.data

  if (done) {
    return (
      <Sheet title={readd ? '서재에 다시 추가함' : '구매 완료'} onClose={onClose}>
        <div className="col" style={{ gap: 12, alignItems: 'center', textAlign: 'center' }}>
          <span className="pedestal" style={{ height: 120 }}><PixelSprite name={c.character.sprite} fit={88} /></span>
          <b style={{ fontSize: 16 }}>{c.title}</b>
          <span style={{ fontSize: 14 }}>내 서재에 추가함</span>
          <span className="lbl">주문번호 {done.orderId}</span>
          <Button full icon="i_book" to={`/library/${done.book.id}/read`}>바로 읽기</Button>
        </div>
      </Sheet>
    )
  }

  return (
    <Sheet title={readd ? '서재에 다시 추가' : '구매 확인'} aside={<span className="tag d">데모 결제</span>} onClose={onClose}>
      <div className="col" style={{ gap: 14 }}>
        <div className="row" style={{ gap: 12 }}>
          <span className="pedestal" style={{ width: 72, height: 72, paddingBottom: 6 }}><PixelSprite name={c.character.sprite} fit={48} /></span>
          <div className="col grow" style={{ gap: 2 }}>
            <b style={{ fontSize: 16 }}>{c.title}</b>
            <span className="lbl">저자 {c.authorName}</span>
          </div>
          <b className="price">{readd ? '0원' : formatPrice(c.price)}</b>
        </div>

        {!readd && <Segmented label="결제 수단" options={METHODS} value={method} onChange={setMethod} />}

        <label className="row agree" style={{ gap: 8, alignItems: 'flex-start' }}>
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
          <span className="lbl" style={{ lineHeight: 1.5 }}>
            이용 범위에 동의함: {c.license}
          </span>
        </label>

        <span className="lbl">실제 결제는 일어나지 않음. 결제 연동 전까지 mock으로 처리함</span>

        {purchase.error && <span className="lbl" style={{ color: 'var(--berry)' }}>처리하지 못함: {purchase.error.message}</span>}

        <Button
          full
          variant="secondary"
          disabled={!agreed || purchase.isPending}
          onClick={() => purchase.mutate({ method, agreed: true })}
          trailing={readd ? undefined : formatPrice(c.price)}
        >
          {purchase.isPending ? '처리 중…' : readd ? '서재에 추가' : '결제하기'}
        </Button>
      </div>
    </Sheet>
  )
}
