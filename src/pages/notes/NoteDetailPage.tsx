import { useParams } from 'react-router'
import { QueryState } from '@/components/QueryState'
import { SubBar } from '@/components/SubBar'
import { formatLocation, stringifyLocation } from '@/domain/location'
import { useMemoDetail } from '@/hooks/queries'
import { Button, Panel } from '@/components/ui'

/** 2.8a 메모 상세 · 가설 비교 */
export function NoteDetailPage() {
  const { bookId = '', noteId = '' } = useParams()
  const { data: m, isLoading, error } = useMemoDetail(bookId, noteId)
  return (
    <>
      <SubBar title="메모 상세" />
      <main className="app-content">
        <QueryState isLoading={isLoading} error={error}>
          {m && (
            <Panel tone="white" stack>
              <div className="quote">{m.quote.text}</div>
              <p>{m.content}</p>
              {m.hypothesis && (
                <>
                  <p className="lbl">{m.hypothesis.revisions.length ? '다시 확인한 단서' : '단서 수첩'}</p>
                  {m.hypothesis.revisions.map((entry, index) => (
                    <div className="col" key={index}>
                      <b>다시 읽고 남긴 생각</b>
                      <p>{entry.content}</p>
                      {[...entry.evidenceFor, ...entry.evidenceAgainst].map((quote, i) => (
                        <p className="quote" key={i}>{quote.text}</p>
                      ))}
                    </div>
                  ))}
                </>
              )}
              <Button size="sm" full to={`/library/${bookId}/read?loc=${stringifyLocation(m.quote.location)}`}>
                원문 위치로 ({formatLocation(m.quote.location)})
              </Button>
            </Panel>
          )}
        </QueryState>
      </main>
    </>
  )
}
