import { PALETTE, SPRITES } from '@/components/pixel/sprites'

/** 숲 타일 크기(장면 기준 1px 단위, village.css --px 와 같은 기준). 나무 1그루 = 12칸 × 4배 = 48 */
export const FOREST_W = 1200
export const FOREST_H = 560
/** 위쪽으로 삐져나오는 높이: 숲 윗선이 나무 윤곽으로 들쭉날쭉하게 보임 */
export const FOREST_OVERHANG = 24

const TREE = 4
let cached: string | null = null

/** 같은 시드면 항상 같은 숲 */
function mulberry32(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * 마을 나무 스프라이트를 무작위로 빽빽하게 심은 숲 타일(SVG 데이터 주소, CSS url() 값).
 * 격자 칸마다 위치를 흔들고 일부는 비우며 좌우를 뒤집어 규칙이 보이지 않게 함. 위쪽 줄부터 그려 앞줄이 뒤를 가림.
 */
export function forestTile(): string {
  if (cached) return cached
  const rows = SPRITES.tree
  const w = Math.max(...rows.map((r) => r.length))
  const h = rows.length
  const rects: string[] = []
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; ) {
      const ch = row[x]
      let n = 1
      while (x + n < row.length && row[x + n] === ch) n++
      if (ch !== '.' && PALETTE[ch]) rects.push(`<rect x="${x}" y="${y}" width="${n}" height="1" fill="${PALETTE[ch]}"/>`)
      x += n
    }
  })

  const rand = mulberry32(20261120)
  const stepX = 40
  const stepY = 20
  const uses: string[] = []
  const treeW = w * TREE
  const treeH = h * TREE
  const totalH = FOREST_H + FOREST_OVERHANG
  // 위·왼쪽 가장자리 줄은 더 많이 비워 윗선·왼쪽 선이 나무 모양으로 들쭉날쭉하게 함
  // 나무는 타일 안에 온전히 들어오게 함(타일 가장자리에서 잘리면 숲 가장자리가 잘려 보임). 아래쪽은 장면 가장자리가 자름
  const maxX = FOREST_W - treeW
  for (let y = 0, row = 0; y < totalH + treeH; y += stepY, row++) {
    for (let x = 0, col = 0; x <= maxX; x += stepX, col++) {
      const edge = row === 0 ? 0.5 : row === 1 ? 0.25 : col === 0 ? 0.4 : 0.1
      if (rand() < edge) continue
      const px = Math.min(maxX, Math.max(0, Math.round(x + (rand() - 0.5) * 24)))
      const py = Math.max(0, Math.round(y + (rand() - 0.5) * 10))
      const flip = rand() < 0.5
      const tf = flip ? ` transform="translate(${px + treeW} ${py}) scale(-1 1)"` : ` x="${px}" y="${py}"`
      uses.push(`<use href="#t" width="${treeW}" height="${treeH}"${tf}/>`)
    }
  }
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${FOREST_W}" height="${totalH}" viewBox="0 0 ${FOREST_W} ${totalH}" shape-rendering="crispEdges">` +
    `<defs><symbol id="t" viewBox="0 0 ${w} ${h}">${rects.join('')}</symbol></defs>${uses.join('')}</svg>`
  cached = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
  return cached
}
