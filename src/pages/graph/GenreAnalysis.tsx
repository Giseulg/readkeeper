import type { ReactNode } from 'react'
import { PixelSprite } from '@/components/pixel/PixelSprite'
import { SubBar } from '@/components/SubBar'
import { Button, Panel } from '@/components/ui'
import { stringifyLocation } from '@/domain/location'
import type { AnalysisSection, BookGraph, Quote } from '@/domain/types'

const FLOW = { prerequisite: '선행 개념', concept: '핵심 개념', operation: '동작 단계', tradeoff: '장단점' }
const LOGIC = { problem: '연구 문제', limitation: '기존 한계', method: '제안 방법', evaluation: '실험 설계', result: '실험 결과', open_question: '남은 질문' }

function Evidence({ quotes, bookId }: { quotes: Quote[]; bookId: string }) {
  return (
    <details>
      <summary>원문 근거</summary>
      {quotes.map((quote, index) => (
        <div key={index} className="col" style={{ gap: 6, marginBlock: 8 }}>
          <blockquote className="quote">{quote.text}</blockquote>
          <Button size="sm" to={`/library/${bookId}/read?loc=${stringifyLocation(quote.location)}`}>본문으로 이동</Button>
        </div>
      ))}
    </details>
  )
}

export function AnalysisProfiles({ sections, bookId }: { sections: AnalysisSection[]; bookId: string }) {
  const summaries = sections.flatMap((section) => section.summary)
  const personas = [...new Map(sections.flatMap((section) => section.personas).map((item) => [item.id, item])).values()]
  if (!summaries.length && !personas.length) return null
  return (
    <details>
      <summary>{personas.length ? '읽은 곳 요약과 캐릭터' : '작품 핵심 정리'}</summary>
      <div className="col" style={{ gap: 12, marginBlock: 8 }}>
        {summaries.map((item, index) => (
          <Panel key={index} title={item.title} stack gap={8}>
            <p>{item.description}</p>
            <Evidence quotes={item.evidence} bookId={bookId} />
          </Panel>
        ))}
        {personas.map((item) => (
          <Panel key={item.id} title={item.name} stack gap={8}>
            <PixelSprite name={item.sprite} fit={48} />
            <p><b>성격</b> {item.personality}</p>
            <p><b>말투</b> {item.voice}</p>
            <p><b>동기</b> {item.motivation}</p>
            <p><b>상징</b> {item.emblem}</p>
            <p><b>외형</b> {item.appearance}</p>
            <Evidence quotes={item.evidence} bookId={bookId} />
          </Panel>
        ))}
      </div>
    </details>
  )
}

function PoetryView({ sections, bookId }: { sections: AnalysisSection[]; bookId: string }) {
  return sections.flatMap((section) => (section.imagery ?? []).map((item) => (
    <Panel key={`${section.id}:${item.index}`} title={item.term} stack gap={8}>
      <details><summary>의미와 독해 포인트 펼치기</summary>
      <div className="col" style={{ gap: 10, marginBlockStart: 10 }}>
      <p><b>기본 뜻</b> {item.literal_meaning}</p>
      <p><b>문맥 속 의미</b> {item.contextual_meaning}</p>
      <p><b>심상</b> {item.imagery}</p>
      <p><b>화자의 정서</b> {item.emotion}</p>
      {item.technique && <p><b>표현과 효과</b> {item.technique}</p>}
      {item.reading_point && <p><b>독해 포인트</b> {item.reading_point}</p>}
      {item.caution && <p className="quote"><b>해석할 때 주의</b> {item.caution}</p>}
      </div></details>
      <Evidence quotes={item.evidence} bookId={bookId} />
    </Panel>
  )))
}

function ConceptFlow({ sections, bookId }: { sections: AnalysisSection[]; bookId: string }) {
  return (
    <ol className="col" style={{ gap: 12, paddingInlineStart: 24 }}>
      {sections.flatMap((section) => (section.flow ?? []).map((item) => (
        <li key={`${section.id}:${item.index}`}>
          <Panel stack gap={8}>
            <details>
              <summary style={{ cursor: 'pointer' }}><span className="tag">{FLOW[item.stage]}</span> <b>{item.title}</b></summary>
              <div className="col" style={{ gap: 10, marginBlockStart: 10 }}>
                <p>{item.explanation}</p>
                {item.purpose && <div><b>왜 필요할까요?</b><p>{item.purpose}</p></div>}
                {item.operation && <div><b>어떻게 동작할까요?</b><p>{item.operation}</p></div>}
                {item.distinction && <div><b>헷갈리는 개념과 비교</b><p>{item.distinction}</p></div>}
                <div><b>일상 비유</b><p>{item.analogy}</p></div>
                {item.analogy_limit && <p className="lbl">{item.analogy_limit}</p>}
                {item.example && <div className="quote"><b>상황에 적용하기</b><p>{item.example}</p></div>}
                {!!item.prior_stage_indexes?.length && <div>
                  <b>앞 개념과의 연결</b>
                  <p>{item.prior_stage_indexes.map((index) => section.flow?.find((step) => step.index === index)?.title).join(' → ')} → {item.title}</p>
                  <p>{item.connection_reason}</p>
                </div>}
                <Evidence quotes={item.evidence} bookId={bookId} />
              </div>
            </details>
          </Panel>
        </li>
      )))}
    </ol>
  )
}

function ResearchMap({ sections, bookId }: { sections: AnalysisSection[]; bookId: string }) {
  const overview = sections.filter((section) => section.wholeWork && section.logic?.length)
  return (
    <ol className="col" style={{ gap: 12, paddingInlineStart: 24 }}>
      {(overview.length ? overview : sections).flatMap((section) => (section.logic ?? []).map((item) => (
        <li key={`${section.id}:${item.index}`}>
          <Panel stack gap={8}>
            <details>
              <summary style={{ cursor: 'pointer' }}>
                <span className="tag">{LOGIC[item.stage]}</span> <strong>{item.title}</strong>
              </summary>
              <div className="col" style={{ gap: 12, marginBlockStart: 10 }}>
                <p>{item.explanation}</p>
                {item.prior_stage_indexes.map((index) => {
                  const prior = section.logic?.find((step) => step.index === index)
                  const link = item.connections?.find((connection) => connection.prior_index === index)
                  if (!prior) return null
                  return (
                    <div key={index} className="col" style={{ gap: 6 }}>
                      <b>← {prior.title}</b>
                      {link && <><p>{link.reason}</p><Evidence quotes={link.evidence} bookId={bookId} /></>}
                    </div>
                  )
                })}
                {item.comparisons?.map((comparison, index) => (
                  <Panel key={index} title={comparison.metric} tone="white" stack gap={8}>
                    <dl className="col" style={{ gap: 6, margin: 0 }}>
                      {[[comparison.first_label, comparison.first_value], [comparison.second_label, comparison.second_value]].map(([label, value]) => (
                        <div key={label} className="row" style={{ justifyContent: 'space-between', gap: 12 }}>
                          <dt>{label}</dt><dd style={{ margin: 0 }}><strong>{value}</strong></dd>
                        </div>
                      ))}
                    </dl>
                    <p>{comparison.interpretation}</p>
                    {comparison.reference && <span className="lbl">{comparison.reference}</span>}
                    <Evidence quotes={comparison.evidence} bookId={bookId} />
                  </Panel>
                ))}
                <Evidence quotes={item.evidence} bookId={bookId} />
              </div>
            </details>
          </Panel>
        </li>
      )))}
    </ol>
  )
}

export function GenreAnalysis({ graph, title, bookTitle }: { graph: BookGraph; title: string; bookTitle?: string }) {
  const { bookId, analysis } = graph
  if (!analysis) return null
  const { sections, category } = analysis
  const views: Record<'poetry' | 'cs_book' | 'paper', ReactNode> = {
    poetry: <PoetryView sections={sections} bookId={bookId} />,
    cs_book: <ConceptFlow sections={sections} bookId={bookId} />,
    paper: <ResearchMap sections={sections} bookId={bookId} />,
  }
  if (category === 'novel') return null
  return (
    <>
      <SubBar title={title} subtitle={bookTitle} />
      <main className="app-content col" style={{ gap: 12 }}>
        <p className="lbl">읽음으로 확인한 범위까지만 보여요.</p>
        {category === 'poetry' && <AnalysisProfiles sections={sections} bookId={bookId} />}
        {graph.researchMapPending ? <p>이 논문의 AI 분석 결과가 아직 준비되지 않았어요.</p>
          : !sections.some((section) => (section.imagery?.length ?? 0) + (section.flow?.length ?? 0) + (section.logic?.length ?? 0) > 0)
          ? <p>책에서 ‘여기까지 읽음’을 눌러 분석을 열어 보세요.</p>
          : views[category]}
        {category !== 'poetry' && <AnalysisProfiles sections={sections} bookId={bookId} />}
      </main>
    </>
  )
}
