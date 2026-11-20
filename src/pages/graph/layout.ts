import type { GraphEdge, GraphNode } from '@/domain/types'

export interface Point { x: number; y: number }

/**
 * 간단한 힘 기반 배치. 노드 id 순서로 원형 초기 배치 후 반복 계산 → 같은 입력이면 같은 결과.
 * 노드 수십 개 규모 가정. 커지면 d3-force 등으로 교체.
 */
export function layoutGraph(nodes: GraphNode[], edges: GraphEdge[], size = 560, iterations = 300): Map<string, Point> {
  const n = nodes.length
  const pos = new Map<string, Point>()
  const c = size / 2
  nodes.forEach((node, i) => {
    const a = (2 * Math.PI * i) / Math.max(n, 1)
    pos.set(node.id, { x: c + Math.cos(a) * c * 0.6, y: c + Math.sin(a) * c * 0.6 })
  })
  if (n < 2) return pos

  const ideal = size / Math.sqrt(n) * 0.9
  for (let it = 0; it < iterations; it++) {
    const t = 1 - it / iterations
    const disp = new Map<string, Point>(nodes.map((nd) => [nd.id, { x: 0, y: 0 }]))
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++) {
        const a = pos.get(nodes[i].id)!, b = pos.get(nodes[j].id)!
        const dx = a.x - b.x, dy = a.y - b.y
        const d = Math.max(Math.hypot(dx, dy), 1)
        const f = (ideal * ideal) / d
        const da = disp.get(nodes[i].id)!, db = disp.get(nodes[j].id)!
        da.x += (dx / d) * f; da.y += (dy / d) * f
        db.x -= (dx / d) * f; db.y -= (dy / d) * f
      }
    for (const e of edges) {
      const a = pos.get(e.source), b = pos.get(e.target)
      if (!a || !b) continue
      const dx = a.x - b.x, dy = a.y - b.y
      const d = Math.max(Math.hypot(dx, dy), 1)
      const f = (d * d) / ideal
      const da = disp.get(e.source)!, db = disp.get(e.target)!
      da.x -= (dx / d) * f; da.y -= (dy / d) * f
      db.x += (dx / d) * f; db.y += (dy / d) * f
    }
    for (const nd of nodes) {
      const p = pos.get(nd.id)!, d = disp.get(nd.id)!
      const len = Math.max(Math.hypot(d.x, d.y), 1)
      const step = Math.min(len, 24 * t + 1)
      p.x += (d.x / len) * step + (c - p.x) * 0.01
      p.y += (d.y / len) * step + (c - p.y) * 0.01
      p.x = Math.min(size - 50, Math.max(50, p.x))
      p.y = Math.min(size - 50, Math.max(50, p.y))
    }
  }
  return pos
}
