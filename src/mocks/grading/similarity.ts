/**
 * 문자 n-gram 코사인 유사도. 서버의 문장 임베딩 유사도를 브라우저에서 흉내내기 위한 mock 전용 구현.
 * 띄어쓰기·조사 차이에 덜 민감하도록 공백을 지운 문자열의 2·3-gram을 사용함.
 * 1-gram은 같은 분야 답변끼리 점수를 부풀려서 짧은 답 비교에만 씀.
 */

/** 짧은 답(예: '섬')은 2-gram이 거의 없어 1-gram도 사용 */
const SHORT = 4

export function normalize(text: string): string {
  return text
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '')
}

function ngrams(text: string, withUnigram: boolean): Map<string, number> {
  const t = normalize(text)
  const v = new Map<string, number>()
  for (const n of withUnigram ? [1, 2, 3] : [2, 3]) {
    for (let i = 0; i + n <= t.length; i++) {
      const g = t.slice(i, i + n)
      v.set(g, (v.get(g) ?? 0) + 1)
    }
  }
  return v
}

export function cosine(a: string, b: string): number {
  const short = Math.min(normalize(a).length, normalize(b).length) <= SHORT
  const va = ngrams(a, short)
  const vb = ngrams(b, short)
  if (!va.size || !vb.size) return 0
  let dot = 0
  for (const [g, x] of va) dot += x * (vb.get(g) ?? 0)
  const norm = (v: Map<string, number>) => Math.sqrt([...v.values()].reduce((s, x) => s + x * x, 0))
  return dot / (norm(va) * norm(vb))
}

/** 후보 중 최댓값과 그 후보 */
export function bestMatch(response: string, candidates: string[]): { score: number; matched: string } {
  let best = { score: 0, matched: candidates[0] ?? '' }
  for (const c of candidates) {
    const s = cosine(response, c)
    if (s > best.score) best = { score: s, matched: c }
  }
  return best
}
