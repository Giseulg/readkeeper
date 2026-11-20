import { useState } from 'react'
import { MOCK_MODE } from '@/appMode'
import { CATEGORY_LABEL } from '@/domain/labels'
import type { Category } from '@/domain/types'
import { useCreateBook } from '@/hooks/queries'
import { Button, Sheet } from '@/components/ui'

/** 2.1 콘텐츠 추가. 저자 공식 콘텐츠 스토어(/explore) 진입점 포함 */
export function AddBookSheet({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<'choose' | 'upload'>('choose')
  const [file, setFile] = useState<File | null>(null)
  const [activities, setActivities] = useState<File>()
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<Category>('major')
  const create = useCreateBook()

  return (
    <Sheet title={mode === 'choose' ? '콘텐츠 추가' : '내 파일 추가'} onClose={onClose}>
      {mode === 'choose' ? (
        <>
          <p>서재에 추가할 방법을 선택해 주세요.</p>
          <Button full icon="i_plus" onClick={() => setMode('upload')}>내 파일 추가하기</Button>
          <span className="lbl">내 파일을 서재에서 읽어요.</span>
          <Button full variant="ghost" icon="i_book" to="/library/create">내 자료에 맞는 책 만들기</Button>
          <span className="lbl">공식 무료 콘텐츠로 맞춤 책을 만드는 흐름을 미리 살펴봐요.</span>
          {MOCK_MODE && <Button variant="secondary" full icon="i_search" to="/explore">저자 공식 콘텐츠 둘러보기</Button>}
        </>
      ) : (
        <>
      <input
        type="file"
        accept={import.meta.env.VITE_USE_MOCK === 'false' ? '.txt' : '.txt,.pdf'}
        className="input"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null
          setFile(f)
          if (f && !title) setTitle(f.name.replace(/\.(txt|pdf)$/i, ''))
        }}
      />
      <input className="input" placeholder="제목" value={title} onChange={(e) => setTitle(e.target.value)} />
      <div className="row" style={{ flexWrap: 'wrap' }}>
        {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => (
          <button key={c} type="button" className={category === c ? 'chip on' : 'chip'} onClick={() => setCategory(c)}>
            {CATEGORY_LABEL[c]}
          </button>
        ))}
      </div>
      {!MOCK_MODE && (
        <details>
          <summary>활동 파일 추가 (선택)</summary>
          <label className="col">
            관계도와 퀴즈가 담긴 JSON
            <input type="file" accept=".json" className="input" onChange={(e) => setActivities(e.target.files?.[0])} />
          </label>
        </details>
      )}
      {create.isError && <p className="lbl" role="alert" style={{ color: 'var(--color-danger)' }}>{create.error.message}</p>}
      <Button
        full
        disabled={!file || create.isPending}
        onClick={() => file && create.mutate({ file, title, category, activities }, { onSuccess: onClose })}
      >
        {create.isPending ? '분석 중…' : '추가'}
      </Button>
      <Button variant="ghost" full onClick={() => setMode('choose')}>이전으로</Button>
        </>
      )}
    </Sheet>
  )
}
