/**
 * 이미지 색 수 줄이기 CLI.
 *
 *   npm run pixel:limit -- <입력.png> [옵션]
 *   node scripts/pixel/limit-colors.ts <입력.png> [옵션]     (Node 22.18 이상, TS 직접 실행)
 *
 * 옵션
 *   -o, --out <경로>        출력 접두어. 기본 = 입력 파일명(확장자 제외) + '.limited'
 *                           → <접두어>.png(색 줄인 원본 크기), <접두어>.json(sprites.ts 형식)
 *   -c, --colors <n>        전체 색 상한(투명 제외). 기본 16
 *   --protect <#hex,...>    지워지지 않는 색. 예: --protect '#34190C'
 *   --alpha <0-255>         이 값 미만 알파는 투명. 기본 128
 *   --downscale <n>         n배로 확대된 픽셀아트를 블록 최빈색으로 1배로 되돌린 뒤 처리
 *   --candidates <n>        고유 색이 이보다 많으면 median cut 으로 먼저 줄임. 기본 64
 *   --preview <n>           <접두어>.preview.png 를 n배 확대로 함께 저장
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, extname, join } from 'node:path'
import { parseArgs } from 'node:util'
import { downsampleMode, limitImageColors, toRgba, toSprite } from './limitColors.ts'
import { decodePng, encodePng } from './png.ts'

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    out: { type: 'string', short: 'o' },
    colors: { type: 'string', short: 'c' },
    protect: { type: 'string' },
    alpha: { type: 'string' },
    downscale: { type: 'string' },
    candidates: { type: 'string' },
    preview: { type: 'string' },
    help: { type: 'boolean', short: 'h' },
  },
})

if (values.help || positionals.length !== 1) {
  console.log('사용법: npm run pixel:limit -- <입력.png> [-c 16] [--protect "#34190C"] [--downscale 4] [--preview 8] [-o 출력접두어]')
  process.exit(values.help ? 0 : 1)
}

const int = (v: string | undefined, name: string) => {
  if (v === undefined) return undefined
  const n = Number(v)
  if (!Number.isInteger(n) || n < 0) throw new Error(`${name} 는 0 이상 정수: ${v}`)
  return n
}

const input = positionals[0]
const prefix = values.out ?? join(dirname(input), basename(input, extname(input)) + '.limited')
const alpha = int(values.alpha, '--alpha') ?? 128

let img = decodePng(readFileSync(input))
const factor = int(values.downscale, '--downscale')
if (factor && factor > 1) img = downsampleMode(img.rgba, img.width, img.height, factor, alpha)

const res = limitImageColors(img.rgba, img.width, img.height, {
  maxColors: int(values.colors, '--colors'),
  alphaThreshold: alpha,
  protect: values.protect?.split(',').map((s) => s.trim()).filter(Boolean),
  maxCandidates: int(values.candidates, '--candidates'),
})
const rgba = toRgba(res)
writeFileSync(prefix + '.png', encodePng({ width: res.width, height: res.height, rgba }))
writeFileSync(prefix + '.json', JSON.stringify(toSprite(res), null, 2) + '\n')
const pv = int(values.preview, '--preview')
if (pv && pv > 0) writeFileSync(prefix + '.preview.png', encodePng({ width: res.width, height: res.height, rgba }, pv))

console.log(`${input}: ${res.width}x${res.height}, 고유 색 ${res.sourceColors} → ${res.palette.length}`)
console.log(`  ${prefix}.png, ${prefix}.json${pv ? `, ${prefix}.preview.png` : ''}`)
