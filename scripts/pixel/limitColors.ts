/**
 * 이미지용 색 수 제한(양자화). 브라우저·Node 의존 없는 순수 함수.
 *
 * 앱의 인간형 생성기(humanCharacter.ts limitColors)와 같은 규칙을 이미지 입력에 맞게 옮김.
 * - 가장 가까운 두 색(RGB 유클리드 거리)부터 합침. 적게 쓴 색을 많이 쓴 색으로 합쳐 원래 색을 유지(평균색을 만들지 않음).
 * - 요소(그룹) 정보는 선택. 주면 그룹당 상한을 먼저 맞추고, 전체 단계에서 같은 그룹 색끼리는 늦게 합침(가중 1.6).
 *   주지 않으면 이미지 전체를 한 묶음으로 보고 전체 상한만 맞춤.
 * - 보호색(외곽선 등)은 지워지지 않고, 다른 색이 보호색으로 합쳐질 수는 있음. 전체 색 수에 포함.
 * - 고유 색이 많으면(사진·안티에일리어싱) median cut 으로 후보 수를 먼저 줄인 뒤 위 규칙 적용.
 * - 알파가 기준 미만인 픽셀은 투명, 이상은 불투명으로 처리(반투명 제거).
 */

export type Rgba = Uint8Array | Uint8ClampedArray

export type LimitOptions = {
  /** 전체 색 상한(투명 제외, 보호색 포함). 기본 16 = 규격 S 등급 */
  maxColors?: number
  /** 이 값 미만 알파는 투명. 기본 128 */
  alphaThreshold?: number
  /** 지워지지 않는 색(#RRGGBB). 기본 [] */
  protect?: string[]
  /** 픽셀별 그룹 번호(요소 정보). -1 = 그룹 없음. 길이 = width*height */
  groups?: Int16Array | Int32Array | number[]
  /** groups 를 줬을 때 그룹당 색 상한. 기본 3 = 규격 S 등급 램프 3단 */
  perGroup?: number
  /** 이 수를 넘는 고유 색은 median cut 으로 먼저 줄임. 기본 64 */
  maxCandidates?: number
}

export type LimitResult = {
  width: number
  height: number
  /** 팔레트(#RRGGBB, 사용량 많은 순) */
  palette: string[]
  /** 픽셀별 팔레트 번호, -1 = 투명 */
  indices: Int16Array
  /** 팔레트별 사용 픽셀 수 */
  counts: number[]
  /** 입력의 고유 불투명 색 수 */
  sourceColors: number
}

export const S_LIMIT = { total: 16, perGroup: 3 }
const GROUP_PENALTY = 1.6

const toHex = (c: number) => '#' + c.toString(16).padStart(6, '0').toUpperCase()
const fromHex = (h: string) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(h.trim())
  if (!m) throw new Error(`색 형식 오류: ${h} (#RRGGBB)`)
  return parseInt(m[1], 16)
}
const rgbOf = (c: number) => [(c >> 16) & 255, (c >> 8) & 255, c & 255]
const dist = (a: number, b: number) => {
  const p = rgbOf(a), q = rgbOf(b)
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2])
}

export function limitImageColors(rgba: Rgba, width: number, height: number, opts: LimitOptions = {}): LimitResult {
  const n = width * height
  if (rgba.length < n * 4) throw new Error(`픽셀 데이터 길이 부족: ${rgba.length} < ${n * 4}`)
  const maxColors = opts.maxColors ?? S_LIMIT.total
  const alphaTh = opts.alphaThreshold ?? 128
  const maxCand = Math.max(maxColors, opts.maxCandidates ?? 64)
  const protect = new Set((opts.protect ?? []).map(fromHex))
  const groups = opts.groups
  const perGroup = opts.perGroup ?? S_LIMIT.perGroup
  if (groups && groups.length < n) throw new Error('groups 길이가 픽셀 수보다 짧음')

  // 1) 픽셀 → 고유 색(24bit). -1 = 투명
  const px = new Int32Array(n)
  const uses = new Map<number, number>()
  for (let i = 0; i < n; i++) {
    if (rgba[i * 4 + 3] < alphaTh) { px[i] = -1; continue }
    const c = (rgba[i * 4] << 16) | (rgba[i * 4 + 1] << 8) | rgba[i * 4 + 2]
    px[i] = c
    uses.set(c, (uses.get(c) ?? 0) + 1)
  }
  const sourceColors = uses.size

  // 2) 후보가 많으면 median cut 으로 축소(보호색은 그대로 둠)
  const remap = new Map<number, number>() // 원래 색 → 후보 색
  for (const c of uses.keys()) remap.set(c, c)
  if (uses.size > maxCand) {
    const free = [...uses.entries()].filter(([c]) => !protect.has(c))
    const slots = Math.max(1, maxCand - (uses.size - free.length))
    for (const [from, to] of medianCut(free, slots)) remap.set(from, to)
  }

  // 3) 후보 색별 사용량·그룹 표
  type Cand = { color: number; use: number; votes: Map<number, number>; group: number; locked: boolean }
  const cands = new Map<number, Cand>()
  for (let i = 0; i < n; i++) {
    if (px[i] < 0) continue
    const c = remap.get(px[i])!
    let e = cands.get(c)
    if (!e) cands.set(c, (e = { color: c, use: 0, votes: new Map(), group: -1, locked: protect.has(c) }))
    e.use++
    if (groups) { const g = groups[i]; e.votes.set(g, (e.votes.get(g) ?? 0) + 1) }
  }
  for (const e of cands.values()) {
    let best = -1, bv = -1
    for (const [g, v] of e.votes) if (v > bv) { bv = v; best = g }
    e.group = best
  }

  // 합친 결과 추적: 후보 색 → 최종 색
  const target = new Map<number, number>()
  const merge = (a: Cand, b: Cand) => {
    // 보호색은 남김. 아니면 적게 쓴 색을 많이 쓴 색으로
    const [from, to] = a.locked ? [b, a] : b.locked ? [a, b] : a.use < b.use ? [a, b] : [b, a]
    to.use += from.use
    for (const [g, v] of from.votes) to.votes.set(g, (to.votes.get(g) ?? 0) + v)
    cands.delete(from.color)
    target.set(from.color, to.color)
  }
  const closest = (sameGroupOnly: boolean, group?: number): [Cand, Cand] | null => {
    const ls = [...cands.values()].filter((c) => group === undefined || c.group === group)
    let best: [Cand, Cand] | null = null, bd = Infinity
    for (let i = 0; i < ls.length; i++) for (let j = i + 1; j < ls.length; j++) {
      if (ls[i].locked && ls[j].locked) continue
      const same = ls[i].group === ls[j].group
      if (sameGroupOnly && !same) continue
      const d = dist(ls[i].color, ls[j].color) * (!sameGroupOnly && same && groups ? GROUP_PENALTY : 1)
      if (d < bd) { bd = d; best = [ls[i], ls[j]] }
    }
    return best
  }

  // 4) 그룹당 상한(요소 정보가 있을 때만)
  if (groups) {
    for (;;) {
      const count = new Map<number, number>()
      for (const c of cands.values()) if (c.group >= 0) count.set(c.group, (count.get(c.group) ?? 0) + 1)
      const over = [...count.entries()].find(([, k]) => k > perGroup)
      if (!over) break
      const pair = closest(true, over[0])
      if (!pair) break
      merge(...pair)
    }
  }
  // 5) 전체 상한
  while (cands.size > maxColors) {
    const pair = closest(false)
    if (!pair) break // 보호색만 남은 경우
    merge(...pair)
  }

  // 6) 결과 조립
  const resolve = (c: number) => { while (target.has(c)) c = target.get(c)!; return c }
  const final = [...cands.values()].sort((a, b) => b.use - a.use)
  const indexOf = new Map(final.map((c, i) => [c.color, i]))
  const indices = new Int16Array(n)
  for (let i = 0; i < n; i++) indices[i] = px[i] < 0 ? -1 : indexOf.get(resolve(remap.get(px[i])!))!
  return { width, height, palette: final.map((c) => toHex(c.color)), indices, counts: final.map((c) => c.use), sourceColors }
}

/** median cut: [색, 사용량] 목록을 slots 개 상자로 나눠 각 색 → 상자 평균색(사용량 가중) */
function medianCut(entries: [number, number][], slots: number): Map<number, number> {
  type Box = { items: [number, number][] }
  const range = (b: Box) => {
    let best = 0, ch = 0
    for (let k = 0; k < 3; k++) {
      let lo = 255, hi = 0
      for (const [c] of b.items) { const v = rgbOf(c)[k]; if (v < lo) lo = v; if (v > hi) hi = v }
      if (hi - lo > best) { best = hi - lo; ch = k }
    }
    return { best, ch }
  }
  const boxes: Box[] = [{ items: entries }]
  while (boxes.length < slots) {
    let bi = -1, br = 0, bch = 0
    boxes.forEach((b, i) => {
      if (b.items.length < 2) return
      const r = range(b)
      if (r.best > br) { br = r.best; bi = i; bch = r.ch }
    })
    if (bi < 0) break
    const items = boxes[bi].items.sort((a, b) => rgbOf(a[0])[bch] - rgbOf(b[0])[bch])
    const total = items.reduce((s, [, u]) => s + u, 0)
    let acc = 0, cut = 1
    for (let i = 0; i < items.length - 1; i++) { acc += items[i][1]; if (acc >= total / 2) { cut = i + 1; break } }
    boxes.splice(bi, 1, { items: items.slice(0, cut) }, { items: items.slice(cut) })
  }
  const out = new Map<number, number>()
  for (const b of boxes) {
    let r = 0, g = 0, bl = 0, w = 0
    for (const [c, u] of b.items) { const p = rgbOf(c); r += p[0] * u; g += p[1] * u; bl += p[2] * u; w += u }
    const rep = (Math.round(r / w) << 16) | (Math.round(g / w) << 8) | Math.round(bl / w)
    for (const [c] of b.items) out.set(c, rep)
  }
  return out
}

/**
 * 정수배로 확대된 픽셀아트를 원래 크기로 되돌림. 블록마다 가장 많이 쓴 색(투명 포함)을 고름.
 * 예: 128x128(4배) → factor 4 → 32x32. 일반 그림의 축소(리샘플링)는 범위 밖.
 */
export function downsampleMode(rgba: Rgba, width: number, height: number, factor: number, alphaThreshold = 128) {
  if (!Number.isInteger(factor) || factor < 1) throw new Error('factor 는 1 이상 정수')
  const w = Math.floor(width / factor), h = Math.floor(height / factor)
  const out = new Uint8Array(w * h * 4)
  for (let by = 0; by < h; by++) for (let bx = 0; bx < w; bx++) {
    const votes = new Map<number, number>()
    for (let y = by * factor; y < (by + 1) * factor; y++) for (let x = bx * factor; x < (bx + 1) * factor; x++) {
      const i = (y * width + x) * 4
      const key = rgba[i + 3] < alphaThreshold ? -1 : (rgba[i] << 16) | (rgba[i + 1] << 8) | rgba[i + 2]
      votes.set(key, (votes.get(key) ?? 0) + 1)
    }
    let best = -1, bv = -1
    for (const [k, v] of votes) if (v > bv) { bv = v; best = k }
    const o = (by * w + bx) * 4
    if (best >= 0) { out[o] = (best >> 16) & 255; out[o + 1] = (best >> 8) & 255; out[o + 2] = best & 255; out[o + 3] = 255 }
  }
  return { rgba: out, width: w, height: h }
}

/** 결과 → RGBA(투명 = 0,0,0,0) */
export function toRgba(res: LimitResult): Uint8Array {
  const out = new Uint8Array(res.width * res.height * 4)
  const pal = res.palette.map(fromHex)
  res.indices.forEach((ix, i) => {
    if (ix < 0) return
    const c = pal[ix]
    out[i * 4] = (c >> 16) & 255; out[i * 4 + 1] = (c >> 8) & 255; out[i * 4 + 2] = c & 255; out[i * 4 + 3] = 255
  })
  return out
}

/** 외곽선 기본색(규격 §2). 이 색은 sprites.ts 관례대로 'k' 로 씀 */
export const OUTLINE = '#34190C'
const CHAR_POOL = 'abcdefghijlmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

/**
 * sprites.ts 형식으로 변환: rows(문자 1개 = 1px, '.' = 투명) + colors(문자 → #RRGGBB).
 * SPRITES[name] = rows, SPRITE_COLORS[name] = colors 로 그대로 등록 가능.
 */
export function toSprite(res: LimitResult): { width: number; height: number; rows: string[]; colors: Record<string, string> } {
  if (res.palette.length > CHAR_POOL.length + 1) throw new Error(`색이 너무 많음: ${res.palette.length}`)
  const pool = [...CHAR_POOL]
  const chars = res.palette.map((hex) => (hex === OUTLINE ? 'k' : pool.shift()!))
  const rows: string[] = []
  for (let y = 0; y < res.height; y++) {
    let r = ''
    for (let x = 0; x < res.width; x++) { const ix = res.indices[y * res.width + x]; r += ix < 0 ? '.' : chars[ix] }
    rows.push(r)
  }
  return { width: res.width, height: res.height, rows, colors: Object.fromEntries(chars.map((ch, i) => [ch, res.palette[i]])) }
}
