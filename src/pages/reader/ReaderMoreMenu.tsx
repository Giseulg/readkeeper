import { useEffect, useState } from 'react'
import { PixelSprite } from '@/components/pixel/PixelSprite'

export interface MoreItem {
  key: string
  icon: string
  label: string
  /** 비활성 사유 또는 보조 설명 */
  hint?: string
  disabled?: boolean
  onSelect: () => void
}

/** Reader 우측 하단 더보기 버튼 + 읽기 도구 메뉴 */
export function ReaderMoreMenu({ items }: { items: MoreItem[] }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      {open && <button type="button" className="more-scrim" aria-label="메뉴 닫기" onClick={() => setOpen(false)} />}
      {open && (
        <ul className="more-menu" id="reader-more" aria-label="읽기 도구">
          {items.map((it) => (
            <li key={it.key}>
              <button
                type="button"
                className="more-item"
                disabled={it.disabled}
                onClick={() => {
                  setOpen(false)
                  it.onSelect()
                }}
              >
                <span className="ic"><PixelSprite name={it.icon} scale={3} /></span>
                <span className="col" style={{ gap: 0 }}>
                  <b>{it.label}</b>
                  {it.hint && <small>{it.hint}</small>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        className={open ? 'fab on' : 'fab'}
        aria-label={open ? '읽기 도구 닫기' : '읽기 도구 더보기'}
        aria-expanded={open}
        aria-controls="reader-more"
        onClick={() => setOpen((v) => !v)}
      >
        <PixelSprite name={open ? 'i_x' : 'i_menu'} scale={3} />
      </button>
    </>
  )
}
