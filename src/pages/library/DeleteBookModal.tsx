import { Button, Modal } from '@/components/ui'
import type { Book } from '@/domain/types'
import { useDeleteBook } from '@/hooks/queries'

/** 2.2 삭제 확인 */
export function DeleteBookModal({ book, onClose }: { book: Book; onClose: () => void }) {
  const remove = useDeleteBook()
  return (
    <Modal title="책 삭제" icon="i_trash" onClose={onClose}>
      <p style={{ fontSize: 15, lineHeight: 1.6 }}>
        <b>{book.title}</b>을(를) 서재에서 삭제할까요?
      </p>
      <p className="lbl">이 책의 메모·가설·점검 기록도 함께 삭제되며 되돌릴 수 없어요.</p>
      {remove.isError && <p className="lbl" style={{ color: 'var(--color-danger)' }}>삭제하지 못했어요. 다시 시도해 주세요.</p>}
      <div className="row">
        <Button variant="ghost" className="grow" onClick={onClose}>
          취소
        </Button>
        <Button className="grow danger" disabled={remove.isPending} onClick={() => remove.mutate(book.id, { onSuccess: onClose })}>
          삭제
        </Button>
      </div>
    </Modal>
  )
}
