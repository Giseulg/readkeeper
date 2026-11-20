import type { CSSProperties } from 'react'
import { PixelSprite } from '@/components/pixel/PixelSprite'
import { CATEGORY_LABEL } from '@/domain/labels'
import type { Book, ReadingMode } from '@/domain/types'

const CATEGORY_ICON: Record<Book['category'], string> = { major: 'i_gear', paper: 'i_eye', novel: 'i_heart', poetry: 'i_leaf', cs_book: 'i_gear', general: 'i_leaf' }

/**
 * Reader 첫 쪽 표지. 실제 출판 표지 대신 책등 색 + 대표 캐릭터 픽셀아트로 그림.
 * 페이지 모드에서는 0쪽 한 장을 채우고, 스크롤 모드에서는 본문 위 첫 화면이 됨.
 */
export function BookCover({ book, mode }: { book: Book; mode: ReadingMode }) {
  return (
    <section className="book-cover" aria-label={`${book.title} 표지`} style={{ '--c': `var(--${book.coverColor})` } as CSSProperties}>
      <div className="bc-board">
        <span className="bc-corner tl" />
        <span className="bc-corner tr" />
        <span className="bc-corner bl" />
        <span className="bc-corner br" />
        <span className="bc-cat">{CATEGORY_LABEL[book.category]}</span>
        <h1 className="bc-title">{book.title}</h1>
        <div className="bc-art">
          {book.coverSprite ? (
            <PixelSprite name={book.coverSprite} fit={128} />
          ) : (
            <span className="bc-emb"><PixelSprite name={CATEGORY_ICON[book.category]} scale={6} /></span>
          )}
        </div>
        {book.author && <p className="bc-author">{book.author}</p>}
        <span className="bc-band num">{book.chapterCount}장</span>
      </div>
      <p className="bc-hint">
        <PixelSprite name={mode === 'page' ? 'i_chev' : 'i_down'} scale={2} color="currentColor" />
        {mode === 'page' ? '오른쪽을 누르거나 밀어서 넘기기' : '아래로 내려 읽기'}
      </p>
    </section>
  )
}
