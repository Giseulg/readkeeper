/**
 * 성 모드 스프라이트: 지식의 성(castle), 망각닌자(e_ninja), 기억도둑(e_thief).
 * 규격(docs/pixel-character-spec.md): 32x32 원본 1벌, 16색 이하, 실루엣 외곽선 1px #34190C.
 * 도형을 칠한 뒤 바깥 둘레에 외곽선을 자동으로 두름. 화면에서는 PixelSprite 가 정수배로 확대함.
 *
 * - castle~bitten: HP 50% 이하. 불투명 칸의 약 30%를 2x2 블록 단위로 지워 비트가 갉아먹힌 모양을 만들고,
 *   새로 생긴 가장자리에도 외곽선을 다시 두름.
 * - e_*~run: 달리기 2번째 프레임(다리 교차)
 */
/* eslint-disable */

const N = 32
const OUT = 'k'
type Grid = string[][]

const blank = (): Grid => Array.from({ length: N }, () => Array<string>(N).fill('.'))
const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < N && y < N

function px(g: Grid, x: number, y: number, c: string) {
  if (inside(x, y)) g[y][x] = c
}
function rect(g: Grid, x: number, y: number, w: number, h: number, c: string) {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) px(g, i, j, c)
}
function ellipse(g: Grid, cx: number, cy: number, rx: number, ry: number, c: string) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry
      if (dx * dx + dy * dy <= 1) px(g, x, y, c)
    }
}
function hline(g: Grid, x0: number, x1: number, y: number, c: string) {
  for (let x = x0; x <= x1; x++) px(g, x, y, c)
}
function vline(g: Grid, x: number, y0: number, y1: number, c: string) {
  for (let y = y0; y <= y1; y++) px(g, x, y, c)
}
/** 흰 알 + 1px 테(안경) */
function ring(g: Grid, cx: number, cy: number, rx: number, ry: number) {
  const inE = (x: number, y: number) => ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      if (!inE(x, y)) continue
      const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !inE(x + dx, y + dy))
      px(g, x, y, edge ? 'k' : 'w')
    }
}
/** 칠해진 칸만 다른 색으로 바꿈(음영용) */
function shade(g: Grid, from: string, to: string, test: (x: number, y: number) => boolean) {
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (g[y][x] === from && test(x, y)) g[y][x] = to
}
/** 투명 칸 중 상하좌우에 칠한 칸이 있으면 외곽선 */
function outline(g: Grid) {
  const add: Array<[number, number]> = []
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      if (g[y][x] !== '.') continue
      const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => inside(x + dx, y + dy) && g[y + dy][x + dx] !== '.' && g[y + dy][x + dx] !== OUT)
      if (near) add.push([x, y])
    }
  for (const [x, y] of add) g[y][x] = OUT
}
const rows = (g: Grid) => g.map((r) => r.join(''))

export interface BuiltSprite {
  rows: string[]
  colors: Record<string, string>
}

/* ───── 지식의 성 ───── */
const CASTLE_COLORS: Record<string, string> = {
  k: '#34190C', // 외곽선
  a: '#efe3c6', // 돌 밝음
  A: '#c9b48c', // 돌 그림자
  m: '#30325e', // 학사모
  M: '#4f5496', // 학사모 밝음
  y: '#f7d154', // 술(태슬)
  Y: '#d9962b', // 술 그림자
  p: '#f6a9bd', // 두뇌
  P: '#d9728f', // 두뇌 주름·볼
  r: '#c4423a', // 책 빨강
  g: '#3fa34d', // 책 초록
  b: '#2f6fb0', // 책 파랑
  t: '#f6e6c4', // 책장(종이)
  d: '#6b4226', // 문
  c: '#7fc8e8', // 창 불빛
}

function drawCastle(): Grid {
  const g = blank()
  // 가운데 탑(돌)
  rect(g, 11, 12, 10, 19, 'a')
  rect(g, 10, 26, 12, 5, 'a')
  // 학사모: 머리띠 부분 + 마름모 판
  rect(g, 11, 9, 10, 4, 'm')
  hline(g, 10, 21, 3, 'M'); hline(g, 8, 23, 4, 'M'); hline(g, 6, 25, 5, 'M')
  hline(g, 5, 26, 6, 'm'); hline(g, 7, 24, 7, 'm'); hline(g, 10, 21, 8, 'm')
  px(g, 15, 2, 'm'); px(g, 16, 2, 'm') // 꼭지 단추
  // 술: 단추에서 오른쪽으로 늘어져 두뇌 앞까지
  hline(g, 17, 22, 4, 'y')
  vline(g, 23, 4, 11, 'y')
  rect(g, 22, 12, 3, 3, 'y')
  px(g, 24, 13, 'Y'); px(g, 23, 14, 'Y'); px(g, 24, 14, 'Y')
  // 탑 돌 무늬·그림자(오른쪽 면)
  shade(g, 'a', 'A', (x) => x >= 19)
  hline(g, 12, 18, 17, 'A'); hline(g, 13, 20, 21, 'A')
  px(g, 14, 15, 'A'); px(g, 17, 19, 'A'); px(g, 12, 23, 'A')
  // 창(불빛)
  rect(g, 14, 13, 4, 3, 'c'); hline(g, 14, 17, 13, 'k'); vline(g, 13, 13, 15, 'k'); vline(g, 18, 13, 15, 'k'); px(g, 15, 14, 'a')
  // 아치 문
  rect(g, 14, 25, 4, 6, 'd'); hline(g, 15, 16, 24, 'd')
  hline(g, 15, 16, 23, 'k'); px(g, 14, 24, 'k'); px(g, 17, 24, 'k'); vline(g, 13, 25, 30, 'k'); vline(g, 18, 25, 30, 'k')
  vline(g, 16, 25, 30, 'k'); px(g, 15, 28, 'y')

  // 왼쪽: 쌓인 책(아래가 넓음)
  const books: Array<[number, number, number, string]> = [
    // x, y, w, 표지색 (높이 3)
    [1, 27, 10, 'r'],
    [2, 24, 9, 'b'],
    [1, 21, 9, 'g'],
    [3, 18, 7, 'r'],
  ]
  for (const [x, y, w, c] of books) {
    rect(g, x, y, w, 3, c)
    hline(g, x + 1, x + w - 2, y + 1, 't') // 책장 단면
    px(g, x, y + 1, c)
    hline(g, x, x + w - 1, y + 2, c)
  }
  // 책 사이 구분선
  for (const y of [26, 23, 20]) hline(g, 2, 10, y, 'k')
  hline(g, 1, 9, 23, 'k'); hline(g, 2, 9, 20, 'k')
  // 맨 위 펼친 책
  rect(g, 4, 16, 6, 2, 't'); px(g, 6, 16, 'k'); px(g, 7, 16, 'k'); hline(g, 4, 9, 15, '.')

  // 오른쪽: 귀여운 두뇌
  ellipse(g, 26, 20.5, 5.4, 7, 'p')
  px(g, 26, 14, 'P'); px(g, 26, 15, 'P'); px(g, 25, 16, 'P') // 좌우 반구 가르는 홈
  // 주름(곡선 몇 줄)
  px(g, 23, 16, 'P'); px(g, 28, 16, 'P'); px(g, 29, 17, 'P')
  px(g, 29, 18, 'P'); px(g, 28, 19, 'P'); px(g, 29, 20, 'P')
  px(g, 22, 19, 'P'); px(g, 23, 20, 'P')
  px(g, 26, 25, 'P'); px(g, 27, 26, 'P'); px(g, 28, 25, 'P')
  px(g, 22, 25, 'P'); px(g, 23, 26, 'P')
  // 얼굴: 눈·볼·입
  px(g, 24, 21, 'k'); px(g, 24, 22, 'k'); px(g, 28, 21, 'k'); px(g, 28, 22, 'k')
  px(g, 23, 23, 'P'); px(g, 29, 23, 'P')
  px(g, 26, 23, 'k')
  // 두뇌 받침돌
  rect(g, 22, 28, 9, 3, 'A'); hline(g, 22, 30, 28, 'a'); px(g, 26, 29, 'a')
  outline(g)
  return g
}

/** 결정적 의사난수(같은 성 모양이 매번 같은 자리에서 갉아먹힘) */
function rng(seed: number) {
  let s = seed >>> 0
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32)
}

/**
 * 갉아먹힌 성: 2x2 블록을 가장자리(외곽선과 닿은 블록)부터 지워 나가 불투명 칸의 ratio 만큼 없앰.
 * 지운 뒤 생긴 가장자리에 외곽선을 다시 두르고, 끊긴 낱칸 몇 개를 흩뿌려 비트 부스러기를 표현함.
 */
function bite(src: Grid, ratio = 0.3): Grid {
  const g = src.map((r) => [...r])
  const rand = rng(7)
  const solid = () => g.flat().filter((c) => c !== '.').length
  const total = solid()
  const target = total * (1 - ratio)
  // 갉아먹기 시작점: 학사모 왼쪽 끝, 책 더미 위, 두뇌 오른쪽 위, 탑 오른쪽
  const seeds: Array<[number, number]> = [[5, 5], [2, 18], [30, 14], [26, 4]]
  const front = seeds.map(([x, y]) => [x & ~1, y & ~1] as [number, number])
  const seen = new Set<string>()
  let guard = 0
  while (solid() > target && front.length && guard++ < 2000) {
    const i = Math.floor(rand() * front.length)
    const [bx, by] = front.splice(i, 1)[0]
    const key = `${bx},${by}`
    if (seen.has(key)) continue
    seen.add(key)
    rect(g, bx, by, 2, 2, '.')
    for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) {
      const nx = bx + dx, ny = by + dy
      if (!inside(nx, ny) || seen.has(`${nx},${ny}`)) continue
      // 아래쪽(땅에 닿은 기단)은 덜 갉아먹힘
      if (ny >= 22 && rand() < 0.75) continue
      front.push([nx, ny])
    }
  }
  // 남은 외곽선 중 안쪽 칸이 사라진 고립 외곽선 정리
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      if (g[y][x] !== OUT) continue
      const fill = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => inside(x + dx, y + dy) && g[y + dy][x + dx] !== '.' && g[y + dy][x + dx] !== OUT)
      if (!fill) g[y][x] = '.'
    }
  outline(g)
  // 비트 부스러기: 지워진 영역 가장자리에 낱칸 몇 개
  const crumbs = [[3, 6], [8, 2], [1, 15], [30, 12], [27, 11], [21, 8]]
  for (const [x, y] of crumbs) if (g[y][x] === '.') g[y][x] = rand() < 0.5 ? 'A' : 'M'
  return g
}

/* ───── 적: 망각닌자 / 기억도둑 ───── */
const NINJA_COLORS: Record<string, string> = {
  k: '#34190C',
  v: '#b8b2f2', // 복면·두건 밝은 보라
  V: '#7d74cf', // 보라 그림자
  w: '#ffffff', // 눈 흰자
  s: '#f2c9a0', // 피부
  e: '#dff5c8', // 망각 연기 밝음
  E: '#a8d88a', // 연기 그림자
  n: '#3d3a6b', // 복면 그물
}

const THIEF_COLORS: Record<string, string> = {
  k: '#34190C',
  h: '#eeeef4', // 비니
  H: '#bdbdcf', // 비니 그림자
  w: '#ffffff', // 안경알
  s: '#f7dcc0', // 피부
  S: '#c97b7b', // 볼
  r: '#e0484a', // 입
  l: '#d8d4f4', // 옷 연보라
  L: '#a39cdb', // 옷 그림자
  e: '#dff5c8', // 기억 보따리
  E: '#8fcf6e', // 보따리 그림자
  y: '#f7d154', // 보따리 속 기억 조각
}

/** 쪼그려 달리는 몸통·팔·다리. run=true 면 다리를 바꿔 디딤 */
function crouchBody(g: Grid, body: string, bodyD: string, foot: string, run: boolean) {
  // 몸통
  rect(g, 8, 17, 12, 6, body)
  shade(g, body, bodyD, (x, y) => y >= 21 || x >= 18)
  hline(g, 11, 15, 19, bodyD) // 허리띠 주름
  // 주먹(앞으로 내민 손)
  ellipse(g, 20.5, 19, 2.6, 2.4, 'w')
  // 다리
  if (!run) {
    rect(g, 6, 23, 5, 4, body); rect(g, 17, 23, 5, 4, body)
    rect(g, 3, 27, 6, 2, foot); rect(g, 19, 27, 7, 2, foot)
  } else {
    rect(g, 10, 23, 5, 4, body); rect(g, 16, 22, 5, 3, body)
    rect(g, 8, 27, 6, 2, foot); rect(g, 19, 23, 6, 2, foot)
  }
  shade(g, body, bodyD, (x, y) => y >= 25 || (run && x >= 16 && y >= 22))
}

function drawNinja(run: boolean): Grid {
  const g = blank()
  // 망각 연기(등 뒤 오른쪽)
  ellipse(g, 25, 12, 5, 4.5, 'e')
  ellipse(g, 28, 17, 3, 3, 'e')
  shade(g, 'e', 'E', (x, y) => y >= 14 && x >= 25)
  crouchBody(g, 'v', 'V', 'n', run)
  // 머리(얼굴형)
  ellipse(g, 13, 11, 8, 7, 's')
  // 두건
  ellipse(g, 13, 7, 8, 4.5, 'v')
  rect(g, 5, 7, 16, 2, 'v')
  hline(g, 5, 20, 9, 'V')
  // 두건 매듭 꼬리(오른쪽 뒤)
  rect(g, 20, 6, 3, 2, 'V'); px(g, 23, 5, 'V'); px(g, 23, 8, 'V')
  // 눈(흰자 + 눈동자, 매서운 눈썹)
  rect(g, 7, 10, 4, 2, 'w'); rect(g, 14, 10, 4, 2, 'w')
  px(g, 9, 11, 'k'); px(g, 15, 11, 'k')
  hline(g, 6, 9, 9, 'k'); px(g, 10, 10, 'k')
  hline(g, 16, 18, 9, 'k'); px(g, 14, 10, 'k')
  // 복면(그물 무늬)
  ellipse(g, 12.5, 15, 7, 3.5, 'v')
  rect(g, 6, 13, 14, 2, 'v')
  for (let x = 6; x <= 19; x++) for (let y = 13; y <= 18; y++) if (g[y][x] === 'v' && (x + y) % 3 === 0) g[y][x] = 'n'
  shade(g, 'v', 'V', (_x, y) => y === 17 || y === 18)
  // 주먹 색: 피부
  shade(g, 'w', 's', (x, y) => y >= 16 && y <= 22 && x >= 17)
  outline(g)
  return g
}

function drawThief(run: boolean): Grid {
  const g = blank()
  // 기억 보따리(등 뒤)
  ellipse(g, 25, 13, 5.5, 5, 'e')
  shade(g, 'e', 'E', (x, y) => y >= 15 || x >= 28)
  px(g, 24, 11, 'y'); px(g, 26, 13, 'y'); px(g, 23, 14, 'y'); px(g, 25, 9, 'k'); px(g, 24, 9, 'k')
  crouchBody(g, 'l', 'L', 'H', run)
  // 얼굴
  ellipse(g, 13, 12, 8, 6.5, 's')
  // 비니
  ellipse(g, 13, 7, 8, 5, 'h')
  rect(g, 5, 8, 16, 2, 'h')
  hline(g, 5, 20, 9, 'H')
  shade(g, 'h', 'H', (x, y) => x >= 18 && y <= 7)
  // 동그란 안경(웃는 눈)
  for (const cx of [9, 17]) {
    ring(g, cx, 12.5, 3.4, 3.1)
    px(g, cx - 2, 13, 'k'); px(g, cx - 1, 12, 'k'); px(g, cx, 12, 'k'); px(g, cx + 1, 13, 'k') // 웃으며 감은 눈
  }
  hline(g, 12, 14, 12, 'k') // 안경 다리
  // 볼·입
  px(g, 6, 16, 'S'); px(g, 7, 16, 'S'); px(g, 19, 16, 'S'); px(g, 20, 16, 'S')
  rect(g, 11, 16, 4, 2, 'r'); hline(g, 11, 14, 16, 'k')
  // 주먹·발
  shade(g, 'w', 's', (x, y) => y >= 16 && y <= 22 && x >= 17 && !(y <= 15))
  outline(g)
  return g
}

const castle = drawCastle()

export const CASTLE_SPRITES: Record<string, BuiltSprite> = {
  castle: { rows: rows(castle), colors: CASTLE_COLORS },
  'castle~bitten': { rows: rows(bite(castle)), colors: CASTLE_COLORS },
  e_ninja: { rows: rows(drawNinja(false)), colors: NINJA_COLORS },
  'e_ninja~run': { rows: rows(drawNinja(true)), colors: NINJA_COLORS },
  e_thief: { rows: rows(drawThief(false)), colors: THIEF_COLORS },
  'e_thief~run': { rows: rows(drawThief(true)), colors: THIEF_COLORS },
}
