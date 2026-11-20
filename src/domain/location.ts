import type { BookContent, ReadingLocation } from './types'

/** a가 b보다 앞이면 음수, 같으면 0, 뒤면 양수 */
export function compareLocation(a: ReadingLocation, b: ReadingLocation) {
  return a.chapter - b.chapter || a.paragraph - b.paragraph
}

/** 스포 방지 판정: loc이 확정 범위(until) 이내인지 */
export const isWithin = (loc: ReadingLocation, until: ReadingLocation) => compareLocation(loc, until) <= 0

export const formatLocation = (loc: ReadingLocation) =>
  loc.paragraph < 0 ? '읽기 전' : `${loc.chapter + 1}장 ${loc.paragraph + 1}문단`

export function parseLocation(s: string | null): ReadingLocation | undefined {
  if (!s) return undefined
  const [c, p] = s.split('.').map(Number)
  return Number.isInteger(c) && Number.isInteger(p) ? { chapter: c, paragraph: p } : undefined
}

export const stringifyLocation = (loc: ReadingLocation) => `${loc.chapter}.${loc.paragraph}`

/** 본문 기준 진도(%). loc 문단까지 읽었을 때 */
export function percentAt(content: BookContent, loc: ReadingLocation) {
  const total = content.chapters.reduce((n, ch) => n + ch.paragraphs.length, 0)
  if (!total) return 0
  const done = content.chapters.slice(0, loc.chapter).reduce((n, ch) => n + ch.paragraphs.length, 0) + loc.paragraph + 1
  return Math.min(100, Math.floor((done / total) * 100))
}

/** loc 에서 n 문단 뒤 위치. 책 끝을 넘으면 마지막 문단 */
export function advance(content: BookContent, loc: ReadingLocation, n: number): ReadingLocation {
  let { chapter, paragraph } = loc
  paragraph += n
  while (chapter < content.chapters.length - 1 && paragraph >= content.chapters[chapter].paragraphs.length) {
    paragraph -= content.chapters[chapter].paragraphs.length
    chapter++
  }
  const last = content.chapters[chapter]?.paragraphs.length ?? 1
  return { chapter, paragraph: Math.min(paragraph, last - 1) }
}

export function paragraphAt(content: BookContent, loc: ReadingLocation) {
  return content.chapters[loc.chapter]?.paragraphs[loc.paragraph] ?? ''
}
