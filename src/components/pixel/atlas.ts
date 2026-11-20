/**
 * 캐릭터 아틀라스 격자 규격 (docs/pixel-character-spec.md §11)
 *
 * 시트 1장 = 8열 × 9행 격자, 셀 192 × 208 px → 1536 × 1872 px.
 * 셀 1개에 캐릭터 1컷(대기 또는 바둥 프레임)을 정수배로 넣는다.
 *  - 인간형·개념 도식 모두 32x32 원본 → 6배(192x192)
 * 셀 안에서 가로 가운데, 아래쪽 여백 8px(발 기준선 = 셀 위에서 200px).
 * 생성: `npm run atlas` → public/sprites/characters.png + characters.json(Aseprite JSON Hash, §12)
 */
import { CONCEPT_CHARACTERS } from './conceptCharacters'
import { HUMAN_CHARACTERS } from './humanCharacters'
import { FLAIL_FRAMES, flailSprite } from './sprites'

/** 생성 스크립트가 같은 모듈 인스턴스의 스프라이트 표를 쓰도록 다시 내보냄 */
export { PALETTE, SPRITES, SPRITE_COLORS } from './sprites'

export const ATLAS = {
  cols: 8,
  rows: 9,
  cellW: 192,
  cellH: 208,
  /** 셀 아래쪽 여백(px). 캐릭터 발이 닿는 기준선 = cellH - baseline */
  baseline: 8,
} as const

export const ATLAS_SIZE = { w: ATLAS.cols * ATLAS.cellW, h: ATLAS.rows * ATLAS.cellH }

export interface AtlasEntry {
  /** 아틀라스 안 프레임 이름. 대기 = '<key>~idle0', 바둥 = '<key>~flail<n>' (규격 §12) */
  name: string
  /** 그릴 스프라이트(SPRITES 키, 등급 접미사 포함) */
  sprite: string
  col: number
  row: number
  /** 셀 안 확대 배율(정수) */
  scale: number
}

/**
 * 배치 순서(왼쪽 위부터 행 우선):
 *  1. 인간형: 캐릭터마다 대기 1칸 + 바둥 4칸
 *  2. 개념 도식: 대기 1칸씩
 * 남는 칸은 비워 둠(새 캐릭터용). 72칸을 넘으면 오류.
 */
export function atlasLayout(): AtlasEntry[] {
  const cuts: Array<Omit<AtlasEntry, 'col' | 'row'>> = []
  for (const h of HUMAN_CHARACTERS) {
    cuts.push({ name: `${h.key}~idle0`, sprite: h.key, scale: 6 })
    for (let f = 0; f < FLAIL_FRAMES; f++) {
      const name = flailSprite(h.key, f)
      cuts.push({ name, sprite: name, scale: 6 })
    }
  }
  for (const c of CONCEPT_CHARACTERS) cuts.push({ name: `${c.key}~idle0`, sprite: c.key, scale: 6 })
  const cap = ATLAS.cols * ATLAS.rows
  if (cuts.length > cap) throw new Error(`아틀라스 칸 부족: ${cuts.length} > ${cap}`)
  return cuts.map((c, i) => ({ ...c, col: i % ATLAS.cols, row: Math.floor(i / ATLAS.cols) }))
}
