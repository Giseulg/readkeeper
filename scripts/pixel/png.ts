/**
 * 최소 PNG 입출력(node:zlib 만 사용, 외부 패키지 없음).
 * 읽기: 비인터레이스, 색 형식 0(회색)·2(RGB)·3(팔레트)·4(회색+알파)·6(RGBA), 비트 깊이 8·16(팔레트·회색은 1·2·4도).
 * 쓰기: 8비트 RGBA.
 */
import { deflateSync, inflateSync } from 'node:zlib'

const SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

export type Image = { width: number; height: number; rgba: Uint8Array }

export function decodePng(buf: Uint8Array): Image {
  const b = Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength)
  if (!b.subarray(0, 8).equals(SIG)) throw new Error('PNG 파일이 아님')
  let pos = 8, width = 0, height = 0, depth = 0, type = 0, interlace = 0
  let plte: Buffer | null = null, trns: Buffer | null = null
  const idat: Buffer[] = []
  while (pos < b.length) {
    const len = b.readUInt32BE(pos), name = b.toString('latin1', pos + 4, pos + 8)
    const data = b.subarray(pos + 8, pos + 8 + len)
    if (name === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4); depth = data[8]; type = data[9]; interlace = data[12] }
    else if (name === 'PLTE') plte = data
    else if (name === 'tRNS') trns = data
    else if (name === 'IDAT') idat.push(data)
    else if (name === 'IEND') break
    pos += 12 + len
  }
  if (interlace) throw new Error('인터레이스 PNG 는 지원하지 않음')
  const channels = ({ 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 } as Record<number, number>)[type]
  if (!channels) throw new Error(`지원하지 않는 PNG 색 형식: ${type}`)
  const bpp = Math.max(1, (channels * depth) >> 3) // 필터 단위(바이트)
  const stride = Math.ceil((width * channels * depth) / 8)
  const raw = inflateSync(Buffer.concat(idat))
  const img = Buffer.alloc(stride * height)
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)], src = y * (stride + 1) + 1, dst = y * stride
    for (let x = 0; x < stride; x++) {
      const v = raw[src + x]
      const a = x >= bpp ? img[dst + x - bpp] : 0
      const up = y > 0 ? img[dst - stride + x] : 0
      const ul = y > 0 && x >= bpp ? img[dst - stride + x - bpp] : 0
      let r: number
      if (f === 0) r = v
      else if (f === 1) r = v + a
      else if (f === 2) r = v + up
      else if (f === 3) r = v + ((a + up) >> 1)
      else if (f === 4) { const p = a + up - ul, pa = Math.abs(p - a), pb = Math.abs(p - up), pc = Math.abs(p - ul); r = v + (pa <= pb && pa <= pc ? a : pb <= pc ? up : ul) }
      else throw new Error(`PNG 필터 오류: ${f}`)
      img[dst + x] = r & 255
    }
  }
  // 샘플 읽기(16비트는 상위 바이트, 1·2·4비트는 비트 단위)
  const sample = (y: number, i: number): number => {
    if (depth === 8) return img[y * stride + i]
    if (depth === 16) return img[y * stride + i * 2]
    const bit = i * depth, byte = img[y * stride + (bit >> 3)]
    return (byte >> (8 - depth - (bit & 7))) & ((1 << depth) - 1)
  }
  const scale = depth < 8 && type !== 3 ? 255 / ((1 << depth) - 1) : 1
  const out = new Uint8Array(width * height * 4)
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const o = (y * width + x) * 4, s = x * channels
    if (type === 3) {
      const p = sample(y, s)
      if (!plte) throw new Error('PLTE 없음')
      out[o] = plte[p * 3]; out[o + 1] = plte[p * 3 + 1]; out[o + 2] = plte[p * 3 + 2]
      out[o + 3] = trns && p < trns.length ? trns[p] : 255
    } else if (type === 0 || type === 4) {
      const g = Math.round(sample(y, s) * scale)
      out[o] = out[o + 1] = out[o + 2] = g
      out[o + 3] = type === 4 ? sample(y, s + 1) : trns && depth === 8 && trns.readUInt16BE(0) === g ? 0 : 255
    } else {
      out[o] = sample(y, s); out[o + 1] = sample(y, s + 1); out[o + 2] = sample(y, s + 2)
      out[o + 3] = type === 6 ? sample(y, s + 3) : 255
    }
  }
  return { width, height, rgba: out }
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0 }
  return t
})()
const crc32 = (buf: Buffer) => { let c = 0xffffffff; for (const v of buf) c = CRC_TABLE[(c ^ v) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
const chunk = (name: string, data: Buffer) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(name, 'latin1'), data])
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

/** RGBA → PNG. scale 은 정수배 확대(미리보기용, 최근접) */
export function encodePng(img: Image, scale = 1): Buffer {
  const w = img.width * scale, h = img.height * scale
  const raw = Buffer.alloc((w * 4 + 1) * h)
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0
    for (let x = 0; x < w; x++) {
      const s = (Math.floor(y / scale) * img.width + Math.floor(x / scale)) * 4, d = y * (w * 4 + 1) + 1 + x * 4
      raw[d] = img.rgba[s]; raw[d + 1] = img.rgba[s + 1]; raw[d + 2] = img.rgba[s + 2]; raw[d + 3] = img.rgba[s + 3]
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6
  return Buffer.concat([SIG, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}
