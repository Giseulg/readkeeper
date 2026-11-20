import { useEffect, type ReactNode } from 'react'
import { PixelSprite } from '../pixel/PixelSprite'

interface SheetProps {
  title: ReactNode
  /** 제목 오른쪽 (태그 등) */
  aside?: ReactNode
  onClose: () => void
  children: ReactNode
  /** .bsheet 에 덧붙일 클래스 */
  className?: string
}

function useEscape(onClose: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
}

/** 바텀시트 (목업 .dim + .bsheet). 바깥 클릭·Esc로 닫힘 */
export function Sheet({ title, aside, onClose, children, className }: SheetProps) {
  useEscape(onClose)
  return (
    <>
      <div className="dim" onClick={onClose} />
      <div className={className ? `bsheet ${className}` : 'bsheet'} role="dialog" aria-modal="true">
        <div className="grip" />
        <div className="bh">
          <b className="h grow" style={{ fontSize: 22 }}>{title}</b>
          {aside}
          <button type="button" className="x" aria-label="닫기" onClick={onClose}>
            <PixelSprite name="i_x" scale={2} color="var(--sand)" />
          </button>
        </div>
        <div className="bb">{children}</div>
      </div>
    </>
  )
}

interface ModalProps {
  title: ReactNode
  /** 제목 왼쪽 아이콘 */
  icon?: string
  onClose: () => void
  children: ReactNode
}

/** 가운데 모달 (목업 .modal). 확인·재검토 등 결정이 필요한 경우 */
export function Modal({ title, icon, onClose, children }: ModalProps) {
  useEscape(onClose)
  return (
    <>
      <div className="dim" onClick={onClose} />
      <div className="modal" role="dialog" aria-modal="true" style={{ top: '50%', transform: 'translateY(-50%)', maxHeight: 'calc(100% - 32px)', overflowY: 'auto' }}>
        <div className="mh">
          {icon && <PixelSprite name={icon} scale={3} color="var(--gold)" />}
          <span className="grow">{title}</span>
          <button type="button" className="x" aria-label="닫기" onClick={onClose}>
            <PixelSprite name="i_x" scale={2} color="var(--sand)" />
          </button>
        </div>
        <div className="mb">{children}</div>
      </div>
    </>
  )
}
