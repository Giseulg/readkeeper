/**
 * 인간형 SD(마스코트) 캐릭터 생성기 (규격 docs/pixel-character-spec.md §10)
 *
 * - 원본 격자 32x32(S). 화면에서는 PixelSprite 가 정수배로 확대한다.
 *   정의 좌표는 1칸 = 4단위(128 = 32칸)로 적어 칸 안 위치를 세밀하게 잡는다. M·L·XL 래스터화 코드는 남겨 두되 등록하지 않는다.
 * - 캐릭터 = 요소(머리카락·피부·상의·하의·신발·소품 …) 목록. 32칸에서는 요소마다 기본·그림자 2톤.
 * - 색 수: 규격 v0.1 S 등급(총 16색 이하, 램프 3단 이하). 넘치면 limitColors 가 가까운 색부터 합친다.
 * - 요소 사이 경계는 아래쪽 요소의 그림자색 1px 내부선으로 나눠 명도로 분리한다. 외곽선색은 실루엣에만.
 * - 팔·다리는 포즈(손·발 위치)로 그려서, 드래그 바둥거림 때 위치만 바꿔 다시 생성한다.
 */
import type { ContentId } from './contentStyles'
import type { BuiltSprite } from './diagramCharacter'

export type Pt = [number, number]
export type Hex = `#${string}`

export type Shape =
  | { t: 'ell'; cx: number; cy: number; rx: number; ry: number }
  | { t: 'rect'; x: number; y: number; w: number; h: number; r?: number }
  | { t: 'poly'; pts: Pt[] }
  /** 두께 2r 막대(팔·다리·끈) */
  | { t: 'cap'; a: Pt; b: Pt; r: number }
  | { t: 'ring'; cx: number; cy: number; r: number; w: number }

export interface Elem {
  /** 요소 이름. clip 대상으로 씀 */
  name: string
  /** 색 수를 세는 단위(규격의 '요소'). 생략 시 name */
  group?: string
  /** 밝음 → 어두움, 3~6색. 마지막 색은 내부선·아래쪽 테두리 전용 */
  ramp: Hex[]
  add: Shape[]
  cut?: Shape[]
  /** 이 요소가 앞서 그린 요소(name)의 영역 안에서만 보임. 줄무늬·단추 등 */
  clip?: string
  /** 이 요소 아래에 깔린 요소에 그리는 경계선. dark = 아래 요소의 가장 어두운 색(기본), k = 외곽선색, none = 없음 */
  line?: 'dark' | 'k' | 'none'
}

export interface Pose {
  /** 손 위치(왼쪽·오른쪽, 화면 기준) */
  hands: [Pt, Pt]
  /** 발 위치 */
  feet: [Pt, Pt]
  face: 'normal' | 'squint' | 'thinking' | 'surprised' | 'bright' | 'smiling' | 'gentle'
}

export interface HumanCharacterDef {
  key: string
  name: string
  /** 소속 콘텐츠(책). 색 계열·실루엣 유형 기준(contentStyles.ts, 문서 §13). 없으면 공용(중립색) */
  content?: ContentId
  matureFace?: boolean
  /** 기본 포즈의 손·발 위치(128 좌표) */
  hands: [Pt, Pt]
  feet: [Pt, Pt]
  build: (pose: Pose) => Elem[]
}

export type HumanTier = 'S' | 'M' | 'L' | 'XL'
export const HUMAN_TIERS: Record<HumanTier, number> = { S: 32, M: 64, L: 96, XL: 128 }

/* ───── 공통 고정색 ───── */
export const OUTLINE: Hex = '#34190C'
const FIXED: Record<string, Hex> = {
  k: OUTLINE, w: '#FFFFFF',
  K: '#1F4F86', J: '#3B8FBF', I: '#7FC8E8', // 홍채 그라데이션(어두움 → 밝음)
  p: '#FF9EB5', R: '#B8362C', r: '#F28B9A', // 홍조·입 안·혀
}
const POOL = 'abcdefghijlmnoqstuvxyzABCDEFGHLMNOPQSTUVWXYZ0123456789'

/* ───── 도형 판정 (128 좌표) ───── */
function inside(s: Shape, X: number, Y: number): boolean {
  switch (s.t) {
    case 'ell': {
      const dx = (X - s.cx) / s.rx, dy = (Y - s.cy) / s.ry
      return dx * dx + dy * dy <= 1
    }
    case 'rect': {
      if (X < s.x || Y < s.y || X > s.x + s.w || Y > s.y + s.h) return false
      const r = s.r ?? 0
      if (!r) return true
      const qx = Math.max(s.x + r - X, 0, X - (s.x + s.w - r)), qy = Math.max(s.y + r - Y, 0, Y - (s.y + s.h - r))
      return qx * qx + qy * qy <= r * r
    }
    case 'poly': {
      let inn = false
      for (let i = 0, j = s.pts.length - 1; i < s.pts.length; j = i++) {
        const [xi, yi] = s.pts[i], [xj, yj] = s.pts[j]
        if (yi > Y !== yj > Y && X < ((xj - xi) * (Y - yi)) / (yj - yi) + xi) inn = !inn
      }
      return inn
    }
    case 'cap': {
      const [ax, ay] = s.a, [bx, by] = s.b
      const vx = bx - ax, vy = by - ay
      const L2 = vx * vx + vy * vy
      const t = L2 ? Math.max(0, Math.min(1, ((X - ax) * vx + (Y - ay) * vy) / L2)) : 0
      return Math.hypot(X - (ax + t * vx), Y - (ay + t * vy)) <= s.r
    }
    case 'ring': {
      const d = Math.hypot(X - s.cx, Y - s.cy)
      return d <= s.r && d > s.r - s.w
    }
  }
}

/* ───── 얼굴 템플릿 (등급별 손그림) ───── */
// 세로 타원 눈: 왼쪽 위 흰 하이라이트, 검은자, 아래 파랑 그라데이션
const EYE: Record<HumanTier, string[]> = {
  // 검은자(k·K·J) / 외곽선 안쪽 칸: XL 43/80(54%), L 25/45(56%), M 10/18(56%)
  XL: [
    '..kkkkk..',
    '.kwwwkkk.',
    'kwwwwwkkk',
    'kwwwwwkkk',
    'kwwwwkkkk',
    'kwwwkkkkk',
    'kwwkkkkkk',
    'kkkkkkkkk',
    'kKKKKKKKk',
    'kKJJJJJKk',
    'kJJIIIJJk',
    'kIIIIIIIk',
    '.kIIIIIk.',
    '..kkkkk..',
  ],
  L: [
    '.kkkkk.',
    'kwwwkkk',
    'kwwwwkk',
    'kwwwkkk',
    'kwwkkkk',
    'kkkkkkk',
    'kKKKKKk',
    'kJJJJJk',
    'kJIIIJk',
    'kIIIIIk',
    '.kkkkk.',
  ],
  M: ['.kkk.', 'kwwkk', 'kwwkk', 'kkkkk', 'kKKKk', 'kJIJk', 'kIIIk', '.kkk.'],
  S: ['wk', 'kk', 'JJ'],
}
const MOUTH: Record<HumanTier, string[]> = {
  XL: ['k......k', '.k....k.', '..kkkk..'],
  L: ['k....k', '.kkkk.'],
  M: ['k..k', '.kk.'],
  S: ['kk'],
}
// 찡그린 얼굴용 벌린 입(물결)
const MOUTH_OPEN: Record<HumanTier, string[]> = {
  XL: ['.kkkkkkkk.', 'kRRRRRRRRk', 'kRRrrrrRRk', '.kkkkkkkk.'],
  L: ['.kkkkkk.', 'kRRrrRRk', '.kkkkkk.'],
  M: ['.kkkk.', 'kRrrRk', '.kkkk.'],
  S: ['kk'],
}

function plotLine(a: Pt, b: Pt, put: (x: number, y: number) => void) {
  let [x0, y0] = a
  const [x1, y1] = b
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

/* ───── 래스터화 ───── */
export function buildHumanSprite(def: HumanCharacterDef, tier: HumanTier, pose?: Partial<Pose>): BuiltSprite {
  const N = HUMAN_TIERS[tier]
  const s = N / 128
  const P: Pose = { hands: def.hands, feet: def.feet, face: 'normal', ...pose }
  const elems = def.build(P)
  const idx = (x: number, y: number) => y * N + x
  const inb = (x: number, y: number) => x >= 0 && y >= 0 && x < N && y < N

  // 1. 요소별 덮는 영역(가려지기 전) + 맨 위 요소
  const cover: Uint8Array[] = []
  const owner = new Int16Array(N * N).fill(-1)
  const byName: Record<string, number> = {}
  elems.forEach((el, e) => {
    const m = new Uint8Array(N * N)
    const clip = el.clip !== undefined ? cover[byName[el.clip]] : undefined
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = idx(x, y)
      if (clip && !clip[i]) continue
      const X = (x + 0.5) / s, Y = (y + 0.5) / s
      if (!el.add.some((sh) => inside(sh, X, Y))) continue
      if (el.cut?.some((sh) => inside(sh, X, Y))) continue
      m[i] = 1
      owner[i] = e
    }
    cover.push(m)
    byName[el.name] = e
  })

  // 2. 색 문자 배정(같은 hex 는 같은 문자)
  const letterOf: Record<string, string> = {}
  const colors: Record<string, string> = { ...FIXED }
  for (const [ch, hex] of Object.entries(FIXED)) letterOf[hex.toUpperCase()] ??= ch
  let pi = 0
  const letter = (hex: Hex) => {
    const H = hex.toUpperCase()
    if (!letterOf[H]) {
      const ch = POOL[pi++]
      letterOf[H] = ch
      colors[ch] = hex
    }
    return letterOf[H]
  }

  // 3. 음영: 좌상단 광원. 같은 요소 영역 안에서 위·왼쪽 가장자리와의 거리 대 아래·오른쪽 거리 비
  const out: string[][] = Array.from({ length: N }, () => Array<string>(N).fill('.'))
  const C = Math.max(2, Math.round(14 * s))
  const run = (m: Uint8Array, x: number, y: number, dx: number, dy: number) => {
    let d = 0
    while (d < C && inb(x + dx * (d + 1), y + dy * (d + 1)) && m[idx(x + dx * (d + 1), y + dy * (d + 1))]) d++
    return d
  }
  const dither = N >= 96
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const e = owner[idx(x, y)]
    if (e < 0) continue
    const el = elems[e], m = cover[e], ramp = el.ramp
    const dU = run(m, x, y, 0, -1), dD = run(m, x, y, 0, 1), dL = run(m, x, y, -1, 0), dR = run(m, x, y, 1, 0)
    if (N <= 32) {
      // 32칸: 재질당 기본 + 그림자 1단(픽셀아트 크기 가이드 32x32 기준). 아래·오른쪽 끝과 아래쪽 1/4 = 그림자
      const [base, shade] = tone2(ramp)
      const a = dU + 0.6 * dL + 0.5, b = dD + 0.6 * dR + 0.5
      out[y][x] = letter(dD === 0 || (dR === 0 && dD <= 1) || a / (a + b) > 0.78 ? shade : base)
      continue
    }
    const steps = ramp.length - 1 // 마지막 색은 내부선·바닥 테두리 전용
    // 바닥·오른쪽 끝 1칸 = 가장 어두운 색
    if ((dD === 0 || (dR === 0 && dD <= 1)) && ramp.length >= 4) { out[y][x] = letter(ramp[steps]); continue }
    const a = dU + 0.6 * dL + 0.5, b = dD + 0.6 * dR + 0.5
    let v = a / (a + b)
    if (dither && (x + y) % 2 === 0) {
      // 띠 경계 근처만 바둑판 디더
      const f = v * steps, near = f - Math.round(f)
      if (Math.abs(near) < 0.06) v += near < 0 ? 0.08 / steps : -0.08 / steps
    }
    out[y][x] = letter(ramp[Math.max(0, Math.min(steps - 1, Math.floor(v * steps)))])
  }

  // 4. 내부선: 위에 그린 요소와 맞닿은 아래 요소 칸
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const e = owner[idx(x, y)]
    if (e < 0) continue
    let line: string | null = null
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]] as const) {
      if (!inb(x + dx, y + dy)) continue
      const u = owner[idx(x + dx, y + dy)]
      if (u <= e) continue
      const kind = elems[u].line ?? 'dark'
      if (kind === 'none') continue
      // 32칸에서는 내부선을 모두 아래 요소의 그림자색으로(외곽선색은 실루엣에만). 얼굴·눈 주변이 검게 뭉치는 것을 막음
      const useK = kind === 'k' && N > 32
      line = useK ? 'k' : letter(N <= 32 ? tone2(elems[e].ramp)[1] : elems[e].ramp[elems[e].ramp.length - 1])
      if (useK) break
    }
    if (line) out[y][x] = line
  }

  // 5. 외곽선: XL·L·M 2px(1겹째 4방향 + 2겹째 4방향), S 1px 8방향(32칸은 2px면 얼굴·손이 묻힘)
  const N4 = [[0, -1], [-1, 0], [1, 0], [0, 1]]
  const N8 = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]]
  const ring1 = new Uint8Array(N * N)
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (owner[idx(x, y)] >= 0) continue
    if ((N <= 32 ? N8 : N4).some(([dx, dy]) => inb(x + dx, y + dy) && owner[idx(x + dx, y + dy)] >= 0)) { out[y][x] = 'k'; ring1[idx(x, y)] = 1 }
  }
  if (N > 32)
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = idx(x, y)
      if (owner[i] >= 0 || ring1[i]) continue
      if (N4.some(([dx, dy]) => inb(x + dx, y + dy) && ring1[idx(x + dx, y + dy)])) out[y][x] = 'k'
    }
  // 캔버스 가장자리 2칸 안에 닿은 몸은 바깥에 선 그릴 자리가 없으므로 안쪽으로 2px 선
  if (N > 32)
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++)
      if ((x < 2 || y < 2 || x >= N - 2 || y >= N - 2) && owner[idx(x, y)] >= 0) out[y][x] = 'k'

  // 6. 얼굴
  const stamp = (cx: number, cy: number, tpl: string[], flip = false) => {
    const w = tpl[0].length, h = tpl.length
    const ox = Math.round(cx * s - w / 2), oy = Math.round(cy * s - h / 2)
    tpl.forEach((row, y) => [...row].forEach((_, x) => {
      const ch = row[flip ? w - 1 - x : x]
      if (ch !== '.' && inb(ox + x, oy + y)) out[oy + y][ox + x] = ch
    }))
  }
  const F = FACE
  if (def.matureFace) {
    const eye = P.face === 'gentle' || P.face === 'smiling' ? ['kkk', 'k.k'] : ['kkk', '.k.'];
    for (const [x, y] of F.eyes) stamp(x, y, eye)
    stamp(F.mouth[0], F.mouth[1], P.face === 'smiling' ? ['k.k', '.k.'] : ['kkk'])
  } else if (P.face === 'squint') {
    // >_< : 굵기 2(XL·L) / 1(M·S) 꺾쇠
    const t = N >= 96 ? 2 : 1
    const hw = Math.max(1, Math.round(5 * s)), hh = Math.max(1, Math.round(5 * s))
    const put = (x: number, y: number) => { for (let o = 0; o < t; o++) if (inb(x, y + o)) out[y + o][x] = 'k' }
    F.eyes.forEach(([ex, ey], i) => {
      const cx = Math.round(ex * s), cy = Math.round(ey * s) - (t - 1)
      const d = i === 0 ? 1 : -1 // 왼눈 '>', 오른눈 '<' (꼭짓점이 얼굴 안쪽)
      plotLine([cx - d * hw, cy - hh], [cx + d * hw, cy], put)
      plotLine([cx + d * hw, cy], [cx - d * hw, cy + hh], put)
    })
    stamp(F.mouth[0], F.mouth[1] + 1, MOUTH_OPEN[tier])
  } else if (P.face === 'thinking') {
    stamp(F.eyes[0][0] - 3, F.eyes[0][1] + 3, EYE[tier])
    stamp(F.eyes[1][0] - 3, F.eyes[1][1] - 2, EYE[tier])
    stamp(F.mouth[0] - 3, F.mouth[1], ['kk'])
  } else if (P.face === 'bright' || P.face === 'smiling' || P.face === 'gentle') {
    const eye = P.face === 'gentle' ? ['.kk.', 'k..k'] : ['.kk.', 'kwkk', '.kk.']
    for (const [x, y] of F.eyes) stamp(x, y + (P.face === 'gentle' ? 2 : 0), eye)
    stamp(F.mouth[0], F.mouth[1], P.face === 'bright' ? ['.kk.', '.kk.'] : ['k..k', '.kk.'])
  } else if (P.face === 'surprised') {
    for (const [x, y] of F.eyes) stamp(x, y, ['.k.', 'kkk', 'kkk', '.k.'])
    stamp(F.mouth[0], F.mouth[1], MOUTH_OPEN[tier])
  } else {
    stamp(F.eyes[0][0], F.eyes[0][1], EYE[tier])
    stamp(F.eyes[1][0], F.eyes[1][1], EYE[tier])
    stamp(F.mouth[0], F.mouth[1], MOUTH[tier])
  }
  // 홍조: 피부 칸에만, 눈 바깥쪽 아래
  const skinIdx = elems.findIndex((el) => el.name === 'head')
  if (!def.matureFace && N <= 32 && skinIdx >= 0) {
    // 32칸: 눈 바깥쪽 아래 2칸
    for (const [bx, by] of F.blush) {
      const y = Math.floor(by * s), x0 = Math.round(bx * s) - 1
      for (let x = x0; x < x0 + 2; x++) if (inb(x, y) && owner[idx(x, y)] === skinIdx && out[y][x] !== 'k') out[y][x] = 'p'
    }
  } else if (!def.matureFace && skinIdx >= 0) {
    for (const [bx, by] of F.blush) {
      const rx = 5.5 * s, ry = 2.6 * s
      for (let y = Math.floor((by - 4) * s); y <= Math.ceil((by + 4) * s); y++)
        for (let x = Math.floor((bx - 7) * s); x <= Math.ceil((bx + 7) * s); x++) {
          if (!inb(x, y) || owner[idx(x, y)] !== skinIdx || out[y][x] === 'k') continue
          const dx = (x + 0.5 - bx * s) / rx, dy = (y + 0.5 - by * s) / ry
          if (dx * dx + dy * dy <= 1) out[y][x] = 'p'
        }
    }
  }

  // 색 수 제한(S 32 등급, 규격 §3·§10): 요소당 램프 3단, 전체 16색 이하
  if (N <= 32) limitColors(out, owner, elems, colors, N)

  // 사용한 문자만 남김
  const rows = out.map((r) => r.join(''))
  const used = new Set(rows.join(''))
  for (const ch of Object.keys(colors)) if (!used.has(ch)) delete colors[ch]
  return { rows, colors }
}

/** 32칸용 2톤(기본·그림자). 램프 4단 이상 = [1, n-2], 3단 = [0, 1] */
function tone2(r: Hex[]): [Hex, Hex] {
  return r.length >= 4 ? [r[1], r[r.length - 2]] : r.length === 3 ? [r[0], r[1]] : [r[0], r[r.length - 1]]
}

/** S 등급 색 수 상한(규격 v0.1 §3 S: 램프 ≤3단, 총 ≤16색). 32칸은 재질당 2톤으로 그려 요소당 상한은 안전장치 */
export const S_LIMIT = { perElement: 3, total: 16 }

/**
 * 비슷한 색끼리 합쳐 색 수를 줄임. 같은 요소 안의 가까운 두 색부터 합치고(요소 간 명도 분리 유지),
 * 요소당 1색까지 줄어도 넘치면 요소 사이에서 가장 가까운 색을 합침. 고정색(외곽선·눈·홍조·입)은 그대로.
 */
function limitColors(out: string[][], owner: Int16Array, elems: Elem[], colors: Record<string, string>, N: number) {
  const fixed = new Set(Object.keys(FIXED))
  const use: Record<string, number> = {}
  const groupVotes: Record<string, Record<string, number>> = {}
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const ch = out[y][x]
    if (ch === '.' || fixed.has(ch)) continue
    use[ch] = (use[ch] ?? 0) + 1
    const e = owner[y * N + x]
    const g = e >= 0 ? (elems[e].group ?? elems[e].name) : '_'
    ;(groupVotes[ch] ??= {})[g] = (groupVotes[ch][g] ?? 0) + 1
  }
  const groupOf = (ch: string) => Object.entries(groupVotes[ch]).sort((a, b) => b[1] - a[1])[0][0]
  const rgb = (ch: string) => [1, 3, 5].map((i) => parseInt(colors[ch].slice(i, i + 2), 16))
  const dist = (a: string, b: string) => { const p = rgb(a), q = rgb(b); return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) }
  const merge = (a: string, b: string) => { // 적게 쓴 색을 많이 쓴 색으로
    const [from, to] = use[a] < use[b] ? [a, b] : [b, a]
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (out[y][x] === from) out[y][x] = to
    use[to] += use[from]
    delete use[from]
  }
  const closest = (sameGroupOnly: boolean, group?: string): [string, string] | null => {
    const ls = Object.keys(use).filter((c) => !group || groupOf(c) === group)
    let best: [string, string] | null = null, bd = Infinity
    for (let i = 0; i < ls.length; i++) for (let j = i + 1; j < ls.length; j++) {
      const same = groupOf(ls[i]) === groupOf(ls[j])
      if (sameGroupOnly && !same) continue
      // 요소 간 합치기에서는 같은 요소의 기본·그림자를 합치지 않도록 가중
      const d = dist(ls[i], ls[j]) * (!sameGroupOnly && same ? 1.6 : 1)
      if (d < bd) { bd = d; best = [ls[i], ls[j]] }
    }
    return best
  }
  // 1) 요소당 3단
  for (;;) {
    const counts: Record<string, number> = {}
    for (const c of Object.keys(use)) counts[groupOf(c)] = (counts[groupOf(c)] ?? 0) + 1
    const over = Object.keys(counts).find((g) => counts[g] > S_LIMIT.perElement)
    if (!over) break
    const pair = closest(true, over)
    if (!pair) break
    merge(...pair)
  }
  // 2) 전체 16색(고정색 포함)
  const fixedUsed = () => { const u = new Set<string>(); for (const r of out) for (const ch of r) if (fixed.has(ch)) u.add(colors[ch].toUpperCase()); return u.size }
  const fu = fixedUsed()
  while (Object.keys(use).length + fu > S_LIMIT.total) {
    const pair = closest(false)
    if (!pair) break
    merge(...pair)
  }
}

/** 얼굴 위치(128 좌표). 모든 SD 캐릭터 공통 */
export const FACE = {
  eyes: [[51, 53], [77, 53]] as Pt[],
  mouth: [64, 65] as Pt,
  blush: [[42, 62], [86, 62]] as Pt[],
}

/** 요소별 고유 색 수(group 기준). 규격 검사용 */
export function colorsByGroup(def: HumanCharacterDef, tier: HumanTier = 'S'): Record<string, number> {
  const built = buildHumanSprite(def, tier)
  const elems = def.build({ hands: def.hands, feet: def.feet, face: 'normal' })
  const res: Record<string, Set<string>> = {}
  const inv: Record<string, string> = {}
  for (const [ch, hex] of Object.entries(built.colors)) inv[ch] = hex.toUpperCase()
  const usedHex = new Set(Object.values(inv))
  for (const el of elems) {
    const g = el.group ?? el.name
    res[g] ??= new Set()
    for (const h of el.ramp) if (usedHex.has(h.toUpperCase())) res[g].add(h.toUpperCase())
  }
  return Object.fromEntries(Object.entries(res).map(([g, set]) => [g, set.size]))
}
