// 캐릭터 아틀라스 생성: 8열 × 9행, 셀 192 × 208 px (규격 docs/pixel-character-spec.md §11)
// 사용: npm run atlas  →  public/sprites/characters.png, public/sprites/characters.json
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync } from 'node:zlib'
import { runnerImport } from 'vite'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const { module: atlas } = await runnerImport(resolve(root, 'src/components/pixel/atlas.ts'))
const { ATLAS, ATLAS_SIZE, atlasLayout, SPRITES, SPRITE_COLORS, PALETTE } = atlas

const { w: W, h: H } = ATLAS_SIZE
const rgba = new Uint8Array(W * H * 4) // 투명으로 시작
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))

const layout = atlasLayout()
const entries = {}
for (const e of layout) {
  const rows = SPRITES[e.sprite]
  if (!rows) throw new Error(`스프라이트 없음: ${e.sprite}`)
  const pal = { ...PALETTE, ...SPRITE_COLORS[e.sprite] }
  const sw = Math.max(...rows.map((r) => r.length)) * e.scale
  const sh = rows.length * e.scale
  if (sw > ATLAS.cellW || sh > ATLAS.cellH - ATLAS.baseline) throw new Error(`셀보다 큼: ${e.name} ${sw}x${sh}`)
  // 가로 가운데, 아래 기준선에 맞춤
  const ox = e.col * ATLAS.cellW + Math.floor((ATLAS.cellW - sw) / 2)
  const oy = e.row * ATLAS.cellH + ATLAS.cellH - ATLAS.baseline - sh
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === '.' || ch === ' ') return
    const [r, g, b] = hex(pal[ch])
    for (let dy = 0; dy < e.scale; dy++) for (let dx = 0; dx < e.scale; dx++) {
      const i = ((oy + y * e.scale + dy) * W + ox + x * e.scale + dx) * 4
      rgba[i] = r; rgba[i + 1] = g; rgba[i + 2] = b; rgba[i + 3] = 255
    }
  }))
  entries[e.name] = { frame: { x: e.col * ATLAS.cellW, y: e.row * ATLAS.cellH, w: ATLAS.cellW, h: ATLAS.cellH }, scale: e.scale, sprite: e.sprite }
}

/* PNG (RGBA 8bit) */
const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 })
const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type), data])
  const c = Buffer.alloc(4); c.writeUInt32BE(crc(td))
  return Buffer.concat([len, td, c])
}
const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6
const raw = Buffer.alloc((W * 4 + 1) * H)
for (let y = 0; y < H; y++) Buffer.from(rgba.buffer, y * W * 4, W * 4).copy(raw, y * (W * 4 + 1) + 1)
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))])

const out = resolve(root, 'public/sprites')
mkdirSync(out, { recursive: true })
writeFileSync(resolve(out, 'characters.png'), png)
// Aseprite JSON(Hash) 형식(규격 §12.2-8). 동작 범위 = frameTags, 피벗 = 셀 하단 가운데 기준선
const names = Object.keys(entries)
const frames = Object.fromEntries(names.map((n) => [n, {
  frame: entries[n].frame,
  rotated: false,
  trimmed: false,
  spriteSourceSize: { x: 0, y: 0, w: ATLAS.cellW, h: ATLAS.cellH },
  sourceSize: { w: ATLAS.cellW, h: ATLAS.cellH },
  duration: n.includes('~flail') ? 110 : 125,
}]))
const frameTags = []
names.forEach((n, i) => {
  const [key, act] = n.split('~')
  const action = act ? act.replace(/\d+$/, '') : 'idle'
  const tag = `${key}/${action}`
  const last = frameTags[frameTags.length - 1]
  if (last && last.name === tag) last.to = i
  else frameTags.push({ name: tag, from: i, to: i, direction: 'forward' })
})
writeFileSync(resolve(out, 'characters.json'), JSON.stringify({
  frames,
  meta: {
    app: 'reading-fun scripts/build-atlas.mjs',
    image: 'characters.png',
    format: 'RGBA8888',
    size: { w: W, h: H },
    scale: '1',
    frameTags,
    // 아래는 Aseprite 표준 밖 추가 정보
    grid: { cols: ATLAS.cols, rows: ATLAS.rows, cellW: ATLAS.cellW, cellH: ATLAS.cellH },
    pivot: { x: ATLAS.cellW / 2, y: ATLAS.cellH - ATLAS.baseline },
    used: layout.length,
    sprites: Object.fromEntries(names.map((n) => [n, { sprite: entries[n].sprite, scale: entries[n].scale }])),
  },
}, null, 2) + '\n')
console.log(`characters.png ${W}x${H}, ${layout.length}/${ATLAS.cols * ATLAS.rows}칸`)
process.exit(0)
