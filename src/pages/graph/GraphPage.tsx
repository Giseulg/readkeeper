import { useLayoutEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { useParams, useSearchParams } from 'react-router'
import { useMutation } from '@tanstack/react-query'
import { api } from '@/api'
import { PixelSprite } from '@/components/pixel/PixelSprite'
import { DEFAULT_CONCEPT_SPRITE, contentVariant } from '@/components/pixel/sprites'
import { QueryState } from '@/components/QueryState'
import { SubBar } from '@/components/SubBar'
import { Button, IconButton } from '@/components/ui'
import { formatLocation, stringifyLocation } from '@/domain/location'
import { ANALYSIS_LABEL } from '@/domain/labels'
import type { BookGraph, GraphEdge, GraphNode } from '@/domain/types'
import { useBook, useGraph } from '@/hooks/queries'
import { layoutGraph } from './layout'
import { AnalysisProfiles, GenreAnalysis } from './GenreAnalysis'

const WORLD = 560
/** 노드 id 기준으로 고정된 정수(보조 램프 선택용) */
function nodeHash(id: string): number {
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return h
}

/** 노드 캐릭터: 전용 도식 > 인물 기본형 > 개념 기본형(관계도 노드 도식, 책의 색 계열·실루엣 + 노드별 보조색) */
const nodeSprite = (n: GraphNode, bookId: string) =>
  n.sprite ?? (n.kind === 'person' ? 'h_reader' : contentVariant(DEFAULT_CONCEPT_SPRITE, bookId, nodeHash(n.id)))

const KIND_LABEL: Record<GraphNode['kind'], string> = {
  person: '인물', concept: '개념', object: '물건', theme: '주제', event: '사건',
}

type Pick = { kind: 'node'; node: GraphNode } | { kind: 'edge'; edge: GraphEdge } | null

/** 2.6 관계도: 읽음 확정 범위까지의 개념·인물 그래프 */
export function GraphPage() {
  const { bookId = '' } = useParams()
  const [params] = useSearchParams()
  const book = useBook(bookId)
  const { data, isLoading, error, refetch } = useGraph(bookId)
  const retry = useMutation({ mutationFn: () => api.graph.retry(bookId), onSuccess: () => refetch() })
  const title = book.data ? ANALYSIS_LABEL[book.data.category] : '분석'
  const status = data?.analysisStatus
  const statusText = status === 'queued' ? '분석을 기다리고 있어요.'
    : status === 'running' ? '원문을 분석하고 있어요.'
    : status === 'failed' ? '분석을 마치지 못했어요.' : undefined

  return (
    <>
      <QueryState isLoading={isLoading} error={error}>
        {data && (data.analysis && data.analysis.category !== 'novel'
          ? <GenreAnalysis graph={data} title={title} bookTitle={book.data?.title} />
          : <GraphView key={`${data.until.chapter}:${data.until.paragraph}:${params.get('focus') ?? ''}`} graph={data} title={title} bookId={bookId} bookTitle={book.data?.title} percent={book.data?.progress.percent ?? 0} focusId={params.get('focus')}>
              {statusText && <p role="status">{statusText}</p>}
              {status === 'failed' && <Button disabled={retry.isPending} onClick={() => retry.mutate()}>분석 다시 요청</Button>}
              {retry.isError && <p role="alert">{retry.error.message}</p>}
            </GraphView>)}
      </QueryState>
      {!data && <SubBar title={title} subtitle={book.data?.title} />}
    </>
  )
}

function GraphView({ graph, title, bookId, bookTitle, percent, focusId, children }: { graph: BookGraph; title: string; bookId: string; bookTitle?: string; percent: number; focusId: string | null; children?: React.ReactNode }) {
  const pos = useMemo(() => layoutGraph(graph.nodes, graph.edges, WORLD), [graph])
  const initial = graph.nodes.find((n) => n.id === focusId)
  const [pick, setPick] = useState<Pick>(initial ? { kind: 'node', node: initial } : null)
  const [scale, setScale] = useState(0.7)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [searching, setSearching] = useState(false)
  const [query, setQuery] = useState('')
  const stageRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; y: number; ox: number; oy: number; moved: boolean } | null>(null)
  const nameOf = (id: string) => graph.nodes.find((n) => n.id === id)?.name ?? ''

  const stageSize = () => {
    const r = stageRef.current?.getBoundingClientRect()
    return { w: r?.width ?? 358, h: r?.height ?? 420 }
  }

  /** 노드를 화면 위쪽 1/3 지점(팝업에 가리지 않는 곳)에 오도록 */
  const centerOn = (p: { x: number; y: number }, s: number) => {
    const { w, h } = stageSize()
    return { x: w / 2 - p.x * s, y: h * 0.3 - p.y * s }
  }

  // 처음 열 때 전체가 보이도록 맞춤. focus 가 있으면 그 노드로
  useLayoutEffect(() => {
    const { w, h } = stageSize()
    if (initial) {
      const s = 0.9
      // DOM 크기를 잰 뒤 초기 시점을 정하는 경우라 effect 안에서 상태 설정
      // eslint-disable-next-line react/set-state-in-effect
      setScale(s)
      setOffset(centerOn(pos.get(initial.id)!, s))
      return
    }
    const pts = [...pos.values()]
    if (!pts.length) return
    const pad = 56
    const minX = Math.min(...pts.map((p) => p.x)) - pad, maxX = Math.max(...pts.map((p) => p.x)) + pad
    const minY = Math.min(...pts.map((p) => p.y)) - pad, maxY = Math.max(...pts.map((p) => p.y)) + pad
    const s = Math.min(1.2, Math.max(0.4, Math.min(w / (maxX - minX), h / (maxY - minY))))
    setScale(s)
    setOffset({ x: (w - (maxX + minX) * s) / 2, y: (h - (maxY + minY) * s) / 2 })
  }, [pos]) // eslint-disable-line react-hooks/exhaustive-deps

  const zoom = (d: number) => {
    const s = Math.min(1.6, Math.max(0.4, +(scale + d).toFixed(2)))
    const { w, h } = stageSize()
    const cx = w / 2, cy = h / 2
    setOffset({ x: cx - ((cx - offset.x) / scale) * s, y: cy - ((cy - offset.y) / scale) * s })
    setScale(s)
  }

  const selectNode = (n: GraphNode) => {
    setPick({ kind: 'node', node: n })
    setOffset(centerOn(pos.get(n.id)!, scale))
  }

  const onDown = (e: PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return
    drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y, moved: false }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onMove = (e: PointerEvent) => {
    const d = drag.current
    if (!d) return
    const dx = e.clientX - d.x, dy = e.clientY - d.y
    if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true
    setOffset({ x: d.ox + dx, y: d.oy + dy })
  }
  const onUp = () => {
    if (drag.current && !drag.current.moved) setPick(null)
    drag.current = null
  }

  const matches = query.trim() ? graph.nodes.filter((n) => (n.name + (n.originalName ?? '')).toLowerCase().includes(query.trim().toLowerCase())) : []
  const pickedNodeId = pick?.kind === 'node' ? pick.node.id : null
  const pickedEdge = pick?.kind === 'edge' ? pick.edge : null

  return (
    <>
      <SubBar
        title={title}
        subtitle={bookTitle}
        right={<IconButton icon={searching ? 'i_x' : 'i_search'} label={searching ? '검색 닫기' : '노드 검색'} onClick={() => { setSearching(!searching); setQuery('') }} />}
      />
      <main className="app-content" style={{ overflow: graph.analysis ? 'auto' : 'hidden', gap: 8 }}>
        {children}
        {searching ? (
          <div className="col" style={{ gap: 6 }}>
            <input className="input" autoFocus placeholder="개념·인물 이름" value={query} onChange={(e) => setQuery(e.target.value)} />
            {matches.length > 0 && (
              <div className="row" style={{ flexWrap: 'wrap' }}>
                {matches.slice(0, 6).map((n) => (
                  <button key={n.id} type="button" className="chip" onClick={() => { selectNode(n); setSearching(false) }}>{n.name}</button>
                ))}
              </div>
            )}
            {query.trim() && matches.length === 0 && <span className="lbl">읽은 범위에 해당 이름이 없어요</span>}
          </div>
        ) : (
          <div className="spoiler-banner">
            <PixelSprite name="i_lock" scale={3} />
            <span><b>스포 방지</b> 읽음 확정한 <b>{formatLocation(graph.until)}({percent}%)</b>까지만 표시</span>
          </div>
        )}

        <div ref={stageRef} className="graph-stage" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
          {graph.nodes.length === 0 ? (
            <p className="lbl" style={{ padding: 24, textAlign: 'center' }}>아직 읽은 범위에 나온 인물이나 개념이 없어요. 책에서 ‘여기까지 읽음’을 눌러 보세요.</p>
          ) : (
            <div className="graph-world" style={{ width: WORLD, height: WORLD, transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})` }}>
              <svg width={WORLD} height={WORLD} className="graph-edges" aria-hidden>
                {graph.edges.map((e) => {
                  const a = pos.get(e.source)!, b = pos.get(e.target)!
                  const on = pickedEdge?.id === e.id || pickedNodeId === e.source || pickedNodeId === e.target
                  return <line key={e.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={on ? 'on' : ''} />
                })}
              </svg>
              {graph.edges.map((e) => {
                const a = pos.get(e.source)!, b = pos.get(e.target)!
                return (
                  <button
                    key={e.id}
                    type="button"
                    className={`edge-lbl${pickedEdge?.id === e.id ? ' on' : ''}`}
                    style={{ left: (a.x + b.x) / 2, top: (a.y + b.y) / 2 }}
                    onClick={() => setPick({ kind: 'edge', edge: e })}
                    aria-label={`${nameOf(e.source)}와 ${nameOf(e.target)}의 관계: ${e.relation}`}
                  >
                    {e.relation}
                  </button>
                )
              })}
              {graph.nodes.map((n) => {
                const p = pos.get(n.id)!
                const dim = query.trim() && !matches.includes(n)
                return (
                  <button
                    key={n.id}
                    type="button"
                    className={`gnode${pickedNodeId === n.id ? ' on' : ''}${dim ? ' faded' : ''}`}
                    style={{ left: p.x, top: p.y }}
                    onClick={() => selectNode(n)}
                  >
                    <span className="gnode-tile"><PixelSprite name={nodeSprite(n, bookId)} fit={64} /></span>
                    <span className="gnode-name">{n.name}</span>
                  </button>
                )
              })}
            </div>
          )}
          <div className="zoom-ctl">
            <button type="button" aria-label="확대" onClick={() => zoom(0.15)}><PixelSprite name="i_plus" scale={3} /></button>
            <button type="button" aria-label="축소" onClick={() => zoom(-0.15)}><PixelSprite name="i_minus" scale={3} /></button>
          </div>
        </div>

        {pick?.kind === 'node' && <NodePopup node={pick.node} bookId={bookId} onClose={() => setPick(null)} />}
        {pick?.kind === 'edge' && <EdgePopup edge={pick.edge} bookId={bookId} source={nameOf(pick.edge.source)} target={nameOf(pick.edge.target)} onClose={() => setPick(null)} />}
        {graph.analysis && <AnalysisProfiles sections={graph.analysis.sections} bookId={bookId} />}
      </main>
    </>
  )
}

/** 2.6a 노드 팝업 */
function NodePopup({ node, bookId, onClose }: { node: GraphNode; bookId: string; onClose: () => void }) {
  return (
    <section className="graph-pop" aria-label={`${node.name} 정보`}>
      <div className="row" style={{ gap: 12, alignItems: 'flex-start' }}>
        <span className="gnode-tile lg"><PixelSprite name={nodeSprite(node, bookId)} fit={64} /></span>
        <div className="col grow" style={{ gap: 4 }}>
          <b className="h" style={{ fontSize: 24 }}>{node.name}</b>
          {node.originalName && <span className="mono" style={{ fontSize: 12, color: 'var(--ink2)' }}>{node.originalName}</span>}
          <span className="row" style={{ gap: 4 }}>
            <span className="tag g">{KIND_LABEL[node.kind]}</span>
            <span className="tag">첫 등장 {formatLocation(node.firstSeen)}</span>
          </span>
        </div>
        <button type="button" className="x" aria-label="닫기" onClick={onClose}><PixelSprite name="i_x" scale={2} color="var(--sand)" /></button>
      </div>
      <dl className="attr">
        {Object.entries(node.attributes).map(([k, v]) => (
          <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
        ))}
      </dl>
      <Button full icon="i_pin" to={`/library/${bookId}/read?loc=${stringifyLocation(node.firstSeen)}`}>
        본문 위치로 이동 · {formatLocation(node.firstSeen)}
      </Button>
    </section>
  )
}

/** 2.6b 관계선 팝업: 읽은 지점 이전 인용구 */
function EdgePopup({ edge, bookId, source, target, onClose }: { edge: GraphEdge; bookId: string; source: string; target: string; onClose: () => void }) {
  return (
    <section className="graph-pop" aria-label="관계 정보">
      <div className="row">
        <div className="col grow" style={{ gap: 4 }}>
          <span className="lbl">관계</span>
          <b className="h" style={{ fontSize: 20 }}>{source} — {target}</b>
          <span className="tag a" style={{ alignSelf: 'flex-start' }}>{edge.relation}</span>
        </div>
        <button type="button" className="x" aria-label="닫기" onClick={onClose}><PixelSprite name="i_x" scale={2} color="var(--sand)" /></button>
      </div>
      {edge.explanation && <p>{edge.explanation}</p>}
      <span className="lbl">인용구 {edge.quotes.length}개</span>
      <div className="col" style={{ gap: 8, maxHeight: 200, overflowY: 'auto' }}>
        {edge.quotes.map((q, i) => (
          <div key={i} className="col" style={{ gap: 4 }}>
            <div className="quote">{q.text}</div>
            <Button variant="wood" size="sm" icon="i_pin" to={`/library/${bookId}/read?loc=${stringifyLocation(q.location)}`}>
              {formatLocation(q.location)}로 이동
            </Button>
          </div>
        ))}
      </div>
    </section>
  )
}
