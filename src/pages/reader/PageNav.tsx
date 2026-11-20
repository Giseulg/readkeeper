import { PixelSprite } from '@/components/pixel/PixelSprite'

/** 페이지 모드 하단 왼쪽: 이전·다음 버튼과 쪽 번호 (오른쪽은 더보기 버튼) */
export function PageNav({ page, pages, onCover, onTurn }: { page: number; pages: number; onCover: boolean; onTurn: (d: 1 | -1) => void }) {
  return (
    <div className="page-nav" role="group" aria-label="쪽 넘기기">
      <button type="button" className="page-btn prev" aria-label="이전 쪽" disabled={page === 0} onClick={() => onTurn(-1)}>
        <PixelSprite name="i_chev" scale={3} color="currentColor" />
      </button>
      <span className="page-no num" aria-live="polite">
        {onCover ? '표지' : `${page} / ${pages - 1}`}
      </span>
      <button type="button" className="page-btn" aria-label="다음 쪽" disabled={page >= pages - 1} onClick={() => onTurn(1)}>
        <PixelSprite name="i_chev" scale={3} color="currentColor" />
      </button>
    </div>
  )
}
