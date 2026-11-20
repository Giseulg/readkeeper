import { PixelSprite } from '@/components/pixel/PixelSprite'
import { Sheet } from '@/components/ui'
import type { BookContent, ReadingLocation } from '@/domain/types'
import type { PageAnchor } from './usePagination'

/** 목차. current 가 null 이면 표지를 보는 중 */
export function TocSheet({ content, current, onPick, onClose }: { content: BookContent; current: ReadingLocation | null; onPick: (loc: PageAnchor) => void; onClose: () => void }) {
  return (
    <Sheet title="목차" onClose={onClose}>
      <nav className="menu">
        <button type="button" className="menu-row" style={{ width: '100%' }} aria-current={!current} onClick={() => onPick('cover')}>
          <PixelSprite name="i_book" scale={2} color="var(--wood)" />
          <span className="grow" style={{ textAlign: 'left', fontWeight: !current ? 700 : 500 }}>표지</span>
        </button>
        {content.chapters.map((ch, i) => (
          <button key={i} type="button" className="menu-row" style={{ width: '100%' }} aria-current={i === current?.chapter} onClick={() => onPick({ chapter: i, paragraph: 0 })}>
            <span className="grow" style={{ textAlign: 'left', fontWeight: i === current?.chapter ? 700 : 500 }}>{ch.title}</span>
            <span className="lbl">{ch.paragraphs.length}문단</span>
          </button>
        ))}
      </nav>
    </Sheet>
  )
}
