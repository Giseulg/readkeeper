/**
 * 개념 도식 캐릭터 생성기 (규격 docs/pixel-character-spec.md §8)
 *
 * 개념 캐릭터의 몸통은 그 개념을 설명하는 도식(그래프·자료구조 그림·타임라인)이다.
 * 정의(DiagramCharacterDef)는 도식의 선·면을 S 격자(32x32) 좌표로 적고,
 * 생성기가 1px 외곽선(#34190C)·좌상단 광원 음영·눈·팔다리를 붙여 PixelSprite용 행 문자열로 바꾼다.
 * 인간형과 같이 32x32 원본 1벌만 쓰고, 큰 화면은 PixelSprite 가 정수배로 확대한다(규격 §8, §10).
 * 색: 주·보조 램프 각 3단계 + 외곽선·흰자·눈·강조·홍조 = 최대 11색(인간형 상한 16색 이내).
 */
import { RAMPS, TIERS, type Hex, type RampId, type Tier } from './characterSpec'
import type { ContentId } from './contentStyles'

export type Pt = [number, number]
/** 1 = 주 램프, 2 = 보조 램프 */
type Tone = 1 | 2

export type DiagramPrim =
  /** 꺾은선(두께 2). 도식의 선·화살표 몸체 */
  | { kind: 'line'; pts: Pt[]; tone?: Tone; w?: 1 | 2 }
  /** 채운 사각형. 막대·칸·블록 */
  | { kind: 'rect'; x: number; y: number; w: number; h: number; tone?: Tone }
  /** 원판 / 고리. rx·ry 를 주면 타원(콘텐츠 실루엣 상자에 맞출 때 생김) */
  | { kind: 'disc'; cx: number; cy: number; r: number; rx?: number; ry?: number; tone?: Tone }
  | { kind: 'ring'; cx: number; cy: number; r: number; rx?: number; ry?: number; w: number; tone?: Tone }
  /** 채운 다각형. 화살촉·레이더 영역 */
  | { kind: 'poly'; pts: Pt[]; tone?: Tone }
  /** 칸 비우기. 칸 사이 구분(외곽선이 생김) */
  | { kind: 'clear'; x: number; y: number; w: number; h: number }

export interface DiagramRig {
  /** 눈 중심. 도식의 꼭짓점·노드·칸 위에 둔다. look = 동공 방향 */
  eyes: Array<{ x: number; y: number; look?: -1 | 0 | 1 }>
  /** 팔: from(몸통 가장자리) → to(손 위치). from 생략 시 fromY 행에서 손 쪽 몸통 가장자리를 찾아 붙임 */
  arms?: Array<{ from?: Pt; fromY?: number; to: Pt }>
  /** 다리: from → to(발 위치). from 생략 시 발 위 열에서 가장 아래 몸통 칸 바로 밑에서 시작 */
  legs?: Array<{ from?: Pt; to: Pt }>
  /**
   * 다리 모양(콘텐츠 실루엣, 문서 §13). line = 외곽선색 1px 선(기본),
   * pin = 보조 램프 1칸 기둥 + 네모 발, pillar = 보조 램프 2칸 기둥 + 받침
   */
  legStyle?: 'line' | 'pin' | 'pillar'
  /** 몸통 맨 위 칸에서 toY 까지 세로로 솟는 줄기(안테나·머리). 보조 램프 1칸 */
  stems?: Array<{ x: number; toY: number }>
  mouth?: { x: number; y: number; w: number }
  /** 도식 안의 강조점(예: FCFS의 현재 헤드 위치) */
  markers?: Pt[]
  blush?: boolean
}

export interface DiagramCharacterDef {
  key: string
  /** 소속 콘텐츠(책). 색 계열·실루엣 유형을 정함(contentStyles.ts, 문서 §13). 없으면 공용(중립) */
  content?: ContentId
  /** 도식 이름과 출처 개념 */
  diagram: string
  ramp: RampId
  ramp2?: RampId
  body: DiagramPrim[]
  rig: DiagramRig
}

/* ───── 팔레트 문자 ───── */
// k 외곽선, a/m/d 주 램프 밝음·중간·어두움, e/f/g 보조 램프, w 흰자, x 강조점, p 홍조
const ACCENT = '#E0674F'
const BLUSH = RAMPS.blush.steps[0]

function rampColors(id: RampId): [Hex, Hex, Hex] {
  const s = RAMPS[id].steps
  // S 등급 램프 3단계: 밝음(0)·중간(1)·어두움(2)
  return [s[0], s[1], s[Math.min(2, s.length - 1)]]
}

type Cell = { tone: Tone; fill: boolean } | null

export interface BuiltSprite {
  rows: string[]
  colors: Record<string, string>
}

/** 표정. squint = 드래그 중 찡그린 얼굴(>_<): 눈을 > < 모양으로, 입은 물결, 홍조 항상 표시 */
export type DiagramFace = 'normal' | 'squint'

export function buildDiagramSprite(def: DiagramCharacterDef, tier: Tier = 'S', face: DiagramFace = 'normal'): BuiltSprite {
  const { w: W, h: H } = TIERS[tier].canvas
  const k = tier === 'M' ? 2 : 1
  const core: Cell[][] = Array.from({ length: H }, () => Array<Cell>(W).fill(null))
  const out: string[][] = Array.from({ length: H }, () => Array<string>(W).fill('.'))
  const inb = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H
  const set = (x: number, y: number, c: Cell) => { if (inb(x, y)) core[y][x] = c }

  const plotLine = (a: Pt, b: Pt, put: (x: number, y: number) => void) => {
    let [x0, y0] = [Math.round(a[0]), Math.round(a[1])]
    const [x1, y1] = [Math.round(b[0]), Math.round(b[1])]
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0)
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1
    let err = dx + dy
    for (;;) {
      put(x0, y0)
      if (x0 === x1 && y0 === y1) break
      const e2 = 2 * err
      if (e2 >= dy) { err += dy; x0 += sx }
      if (e2 <= dx) { err += dx; y0 += sy }
    }
  }
  const sc = (p: Pt): Pt => [p[0] * k, p[1] * k]
  const insidePoly = (pts: Pt[], x: number, y: number) => {
    let inside = false
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j]
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
    }
    return inside
  }

  /* 1. 도식 몸통 */
  for (const p of def.body) {
    const tone = ('tone' in p && p.tone) || 1
    switch (p.kind) {
      case 'line': {
        const t = (p.w ?? 2) * k
        for (let i = 1; i < p.pts.length; i++)
          plotLine(sc(p.pts[i - 1]), sc(p.pts[i]), (x, y) => {
            for (let oy = 0; oy < t; oy++) for (let ox = 0; ox < t; ox++) set(x + ox, y + oy, { tone, fill: false })
          })
        break
      }
      case 'rect':
        for (let y = p.y * k; y < (p.y + p.h) * k; y++) for (let x = p.x * k; x < (p.x + p.w) * k; x++) set(x, y, { tone, fill: true })
        break
      case 'clear':
        for (let y = p.y * k; y < (p.y + p.h) * k; y++) for (let x = p.x * k; x < (p.x + p.w) * k; x++) set(x, y, null)
        break
      case 'disc':
      case 'ring': {
        const rx = (p.rx ?? p.r) * k, ry = (p.ry ?? p.r) * k
        const w = p.kind === 'ring' ? p.w * k : 0
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          const dx = x + 0.5 - p.cx * k, dy = y + 0.5 - p.cy * k
          const out = Math.hypot(dx / rx, dy / ry) <= 1
          const inner = p.kind === 'ring' && rx > w && ry > w && Math.hypot(dx / (rx - w), dy / (ry - w)) <= 1
          if (out && !inner) set(x, y, { tone, fill: p.kind === 'disc' })
        }
        break
      }
      case 'poly': {
        const pts = p.pts.map(sc)
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (insidePoly(pts, x + 0.5, y + 0.5)) set(x, y, { tone, fill: true })
        break
      }
    }
  }

  /* 1-1. 팔다리 시작점 자동 계산(콘텐츠 실루엣처럼 몸통 모양을 모르고 위치만 정한 경우) */
  const coreAt = (x: number, y: number) => inb(x, y) && core[y][x] !== null
  const legs = (def.rig.legs ?? []).map((l) => {
    if (l.from) return { from: l.from, to: l.to }
    const x = Math.round(l.to[0] * k)
    for (let y = Math.round(l.to[1] * k) - 1; y >= 0; y--) if (coreAt(x, y)) return { from: [l.to[0], (y + 1) / k] as Pt, to: l.to }
    return null
  }).filter((l): l is { from: Pt; to: Pt } => l !== null)
  const arms = (def.rig.arms ?? []).map((a) => {
    if (a.from) return { from: a.from, to: a.to }
    const y = Math.round((a.fromY ?? a.to[1]) * k)
    const left = a.to[0] * k < W / 2
    for (let i = 0; i < W; i++) {
      const x = left ? i : W - 1 - i
      if (coreAt(x, y)) return { from: [(left ? x - 1 : x + 1) / k, y / k] as Pt, to: a.to }
    }
    return null
  }).filter((a): a is { from: Pt; to: Pt } => a !== null)
  // 줄기(안테나): 몸통 맨 위 칸 바로 위부터 toY 까지
  for (const st of def.rig.stems ?? []) {
    const x = Math.round(st.x * k)
    let top = -1
    for (let y = 0; y < H; y++) if (coreAt(x, y)) { top = y; break }
    if (top < 0) continue
    for (let y = Math.round(st.toY * k); y < top; y++) set(x, y, { tone: 2, fill: false })
  }
  // 기둥형 다리: 보조 램프 몸통 칸으로 그림(외곽선이 둘러쌈)
  const legStyle = def.rig.legStyle ?? 'line'
  if (legStyle !== 'line')
    for (const l of legs) {
      const t = (legStyle === 'pillar' ? 2 : 1) * k
      const [x0] = sc(l.from)
      for (let y = Math.round(l.from[1] * k); y <= Math.round(l.to[1] * k); y++)
        for (let o = 0; o < t; o++) set(x0 + o - (t > k ? Math.floor(t / 2) : 0), y, { tone: 2, fill: true })
    }

  /* 2. 손·발(몸통과 같은 램프 덩어리. 기둥형 다리의 받침은 보조 램프) */
  const blob = (c: Pt, w: number, h: number, tone: Tone = 1) => {
    const [cx, cy] = sc(c)
    const bw = w * k, bh = h * k
    for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) set(cx - Math.floor(bw / 2) + x, cy - Math.floor(bh / 2) + y, { tone, fill: true })
  }
  arms.forEach((a) => blob(a.to, 2, 2))
  legs.forEach((l) => blob(l.to, legStyle === 'pillar' ? 5 : legStyle === 'pin' ? 3 : 4, 2, legStyle === 'line' ? 1 : 2))

  /* 3. 음영: 좌상단 광원. 면은 위 가장자리 밝음, 아래·오른쪽 가장자리 어두움 / 선은 아래 가장자리 어두움 */
  const isCore = (x: number, y: number) => inb(x, y) && core[y][x] !== null
  const L = { 1: ['a', 'm', 'd'], 2: ['e', 'f', 'g'] } as const
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = core[y][x]
    if (!c) continue
    const [lt, md, dk] = L[c.tone]
    const up = !isCore(x, y - 1), down = !isCore(x, y + 1), right = !isCore(x + 1, y), left = !isCore(x - 1, y)
    if (c.fill) out[y][x] = up || (left && !down) ? lt : down || right ? dk : md
    else out[y][x] = down ? dk : up && left ? lt : md
  }

  /* 4. 1px 외곽선(8방향) */
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (core[y][x]) continue
    let near = false
    for (let oy = -1; oy <= 1 && !near; oy++) for (let ox = -1; ox <= 1; ox++) if ((ox || oy) && isCore(x + ox, y + oy)) { near = true; break }
    if (near) out[y][x] = 'k'
  }

  /* 5. 팔다리: 외곽선 색 1px 선. 몸통 위는 덮지 않음 */
  const limb = (a: Pt, b: Pt) =>
    plotLine(sc(a), sc(b), (x, y) => {
      for (let o = 0; o < k; o++) if (inb(x + o, y) && !core[y][x + o]) out[y][x + o] = 'k'
    })
  arms.forEach((a) => limb(a.from, a.to))
  if (legStyle === 'line') legs.forEach((l) => limb(l.from, l.to))

  /* 6. 얼굴·강조점: 템플릿 덮어쓰기 */
  const stamp = (cx: number, cy: number, tpl: string[]) => {
    const ox = cx - Math.floor(tpl[0].length / 2), oy = cy - Math.floor(tpl.length / 2)
    tpl.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.' && inb(ox + x, oy + y)) out[oy + y][ox + x] = ch }))
  }
  // 세로 타원 눈: 위 흰 하이라이트 2칸 + 검정 + 아래 파랑. 검은자 = 안쪽 4칸 중 2칸(50%)
  const EYE_S = (_l: number) => ['.k.', 'kwk', 'kwk', 'kkk', 'kJk', '.k.']
  // M: 2x2 동공 + 좌상단 하이라이트 1칸
  const EYE_M = (l: number) => {
    const c = l < 0 ? 3 : l > 0 ? 5 : 4
    const row = (top: boolean) => [...'kwwwwwk'].map((ch, i) => (i === c - 1 ? (top ? 'w' : 'k') : i === c ? 'k' : ch)).join('')
    // 행 3: 동공 윗줄(왼쪽 칸 = 하이라이트), 행 4: 동공 아랫줄
    return ['..kkk..', '.kwwwk.', 'kwwwwwk', row(true), row(false), '.kwwwk.', '..kkk..']
  }
  const squint = face === 'squint'
  // 찡그린 눈: 왼쪽 눈 >, 오른쪽 눈 < (눈이 1개면 >)
  const SQUINT_S = ['k..', '.k.', '..k', '.k.', 'k..']
  const eyesByX = [...def.rig.eyes].sort((p, q) => p.x - q.x)
  for (const e of def.rig.eyes) {
    const [x, y] = sc([e.x, e.y])
    if (squint) {
      const right = eyesByX.length > 1 && eyesByX.indexOf(e) === eyesByX.length - 1
      stamp(x, y, right ? SQUINT_S.map((r) => [...r].reverse().join('')) : SQUINT_S)
    } else stamp(x, y, tier === 'M' ? EYE_M(e.look ?? 0) : EYE_S(e.look ?? 0))
  }
  for (const m of def.rig.markers ?? []) {
    const [x, y] = sc(m)
    stamp(x, y, tier === 'M' ? ['.kkkk.', 'kxxxxk', 'kxwxxk', 'kxxxxk', 'kxxxxk', '.kkkk.'] : ['.kk.', 'kxxk', 'kxxk', '.kk.'])
  }
  if (def.rig.mouth) {
    const [x, y] = sc([def.rig.mouth.x, def.rig.mouth.y])
    const n = Math.max(squint ? 3 : 1, def.rig.mouth.w * k)
    // 찡그린 입: 위아래로 꺾이는 물결선 2줄
    for (let i = 0; i < n; i++) {
      const yy = squint ? y + (i % 2) : y
      if (inb(x + i, yy)) out[yy][x + i] = 'k'
    }
  }
  if (def.rig.blush || squint)
    for (const e of def.rig.eyes) {
      const [x, y] = sc([e.x, e.y + 3])
      for (let i = 0; i < k; i++) for (const dx of [-2 * k, 2 * k - 1]) if (inb(x + dx + i, y) && out[y][x + dx + i] !== 'k' && out[y][x + dx + i] !== 'w') out[y][x + dx + i] = 'p'
    }

  const [a, m, d] = rampColors(def.ramp)
  const [e, f, g] = rampColors(def.ramp2 ?? def.ramp)
  return {
    rows: out.map((r) => r.join('')),
    colors: { k: RAMPS.outline.steps[1], a, m, d, e, f, g, w: '#FFFFFF', x: ACCENT, p: BLUSH, J: '#3B8FBF' },
  }
}
