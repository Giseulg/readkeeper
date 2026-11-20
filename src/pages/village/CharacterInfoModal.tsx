import { PixelSprite } from '@/components/pixel/PixelSprite'
import { Button, Modal } from '@/components/ui'
import { formatLocation } from '@/domain/location'
import type { Character } from '@/domain/types'
import { useGraph } from '@/hooks/queries'

const date = (iso: string) => iso.slice(0, 10).replaceAll('-', '.')

/** 1.1 캐릭터 정보: [x]·바깥 누름·Esc로 닫음 */
export function CharacterInfoModal({ char, onClose }: { char: Character; onClose: () => void }) {
  const human = char.sprite.startsWith('h_')
  const graph = useGraph(char.bookId)
  const node = char.nodeId ? graph.data?.nodes.find((n) => n.id === char.nodeId) : undefined
  return (
    <Modal title="캐릭터 정보" icon="i_star" onClose={onClose}>
      <div className="char-info">
        <span className="pic">
          <PixelSprite name={char.sprite} fit={96} title={char.name} />
        </span>
        <div className="col grow" style={{ gap: 8, minWidth: 0 }}>
          <b className="h" style={{ fontSize: 22 }}>{char.name}</b>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            <span className="tag g">{human ? '인물' : '개념'}</span>
            <span className="tag">{char.bookTitle}</span>
          </div>
          {node?.summary && <p className="char-info-sum">{node.summary}</p>}
        </div>
      </div>
      <div className="char-info-why">
        <span className="lbl">등장</span>
        <p>
          {char.bookTitle}
          {node && <> · {formatLocation(node.firstSeen)}</>}
        </p>
        <span className="lbl">획득 사유</span>
        <p>{char.acquiredReason}</p>
        <span className="lbl num">{date(char.acquiredAt)}</span>
      </div>
      <div className="row" style={{ gap: 12 }}>
        <Button to={`/library/${char.bookId}/read`} full icon="i_book">이 책 열기</Button>
      </div>
    </Modal>
  )
}
