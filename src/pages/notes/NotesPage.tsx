import { useParams } from 'react-router'
import { Panel } from '@/components/ui'
import { QueryState } from '@/components/QueryState'
import { SubBar } from '@/components/SubBar'
import { MEMO_TYPE_LABEL } from '@/domain/labels'
import { useMemos } from '@/hooks/queries'

/** 2.8 나의 메모 · 포스트잇 보드 */
export function NotesPage() {
  const { bookId = '' } = useParams()
  const { data, isLoading, error } = useMemos(bookId)
  return (
    <>
      <SubBar title="나의 메모" />
      <main className="app-content">
        <QueryState isLoading={isLoading} error={error}>
          <div className="card-grid">
            {data?.map((m) => (
              <Panel
                key={m.id}
                to={m.id}
                tone={m.type === 'hypothesis' ? 'accent' : 'sticky'}
                padding="sm"
                style={{ fontSize: 14, lineHeight: 1.5 }}
              >
                <span className={m.type === 'hypothesis' ? 'tag v' : 'tag'}>{MEMO_TYPE_LABEL[m.type]}</span>
                <p style={{ marginTop: 8 }}>{m.content}</p>
              </Panel>
            ))}
          </div>
        </QueryState>
      </main>
    </>
  )
}
