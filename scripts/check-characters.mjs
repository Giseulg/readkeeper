// 콘텐츠별 캐릭터 구별 규칙 검사 (규격 docs/pixel-character-spec.md §13)
// 사용: npm run check:chars   → 위반이 있으면 목록을 출력하고 종료 코드 1
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runnerImport } from 'vite'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const load = async (p) => (await runnerImport(resolve(root, p))).module
const { CONTENT_STYLES, CONTENT_IDS, NEUTRAL_RAMPS } = await load('src/components/pixel/contentStyles.ts')
const { CONCEPT_CHARACTERS } = await load('src/components/pixel/conceptCharacters.ts')
const { HUMAN_CHARACTERS } = await load('src/components/pixel/humanCharacters.ts')
const { RAMPS } = await load('src/components/pixel/characterSpec.ts')
const { SPRITES, SPRITE_COLORS, PALETTE } = await load('src/components/pixel/sprites.ts')

const errs = []
const MIN_HUE_GAP = 30
/** 피부·자연 머리색·가죽·금속 소품 대역. 콘텐츠 계열로 배정하지 않고 모든 캐릭터가 공용으로 씀 */
const NEUTRAL_HUE = [15, 55]
const hsv = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn
  let h = 0
  if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4
  return { h: (h * 60 + 360) % 360, s: mx ? d / mx : 0, v: mx }
}
const hueGap = (a, b) => { const d = Math.abs(a - b) % 360; return Math.min(d, 360 - d) }

/* 1. 콘텐츠 계열 색상 간격 + 실루엣 유형 중복 */
for (let i = 0; i < CONTENT_IDS.length; i++) for (let j = i + 1; j < CONTENT_IDS.length; j++) {
  const a = CONTENT_STYLES[CONTENT_IDS[i]], b = CONTENT_STYLES[CONTENT_IDS[j]]
  // 선언값이 아니라 계열 램프 중간색의 실제 색상으로 잼
  const ha = hsv(RAMPS[a.ramp].steps[1]).h, hb = hsv(RAMPS[b.ramp].steps[1]).h
  if (hueGap(ha, hb) < MIN_HUE_GAP) errs.push(`색 계열 겹침: ${a.id}(${ha.toFixed(0)}°) ↔ ${b.id}(${hb.toFixed(0)}°) < ${MIN_HUE_GAP}°`)
  if (a.silhouette.id === b.silhouette.id) errs.push(`실루엣 유형 중복: ${a.id} ↔ ${b.id} (${a.silhouette.id})`)
}
for (const c of CONTENT_IDS) {
  const st = CONTENT_STYLES[c]
  const h = hsv(RAMPS[st.ramp].steps[1]).h
  if (h >= NEUTRAL_HUE[0] && h <= NEUTRAL_HUE[1]) errs.push(`${c}: 계열 색상 ${h.toFixed(0)}° 가 공용 중립 대역(${NEUTRAL_HUE.join('~')}°) 안`)
  const d = Math.abs(hueGap(hsv(RAMPS[st.ramp].steps[1]).h, st.hue))
  if (d > 15) errs.push(`${c}: 선언 색상 ${st.hue}° 와 램프 실제 색상 차이 ${d.toFixed(0)}°`)
}

/* 2. 개념 도식 캐릭터: 주 램프 = 계열, 보조 램프 = 같은 계열 보조·중립 */
for (const def of CONCEPT_CHARACTERS) {
  const st = def.content && CONTENT_STYLES[def.content]
  const sub = def.ramp2 ?? def.ramp
  if (!st) {
    if (![def.ramp, sub].every((r) => NEUTRAL_RAMPS.includes(r))) errs.push(`${def.key}: 콘텐츠 없음 → 중립 램프만 허용(${def.ramp}, ${sub})`)
    continue
  }
  if (def.ramp !== st.ramp) errs.push(`${def.key}: 주 램프 ${def.ramp} ≠ ${def.content} 계열 ${st.ramp}`)
  if (![st.ramp, ...st.companions, ...NEUTRAL_RAMPS].includes(sub)) errs.push(`${def.key}: 보조 램프 ${sub} 는 ${def.content} 계열·중립이 아님`)
}

/* 3. 인간형: 채도 높은 색(S≥0.35)은 자기 계열 색상 ±25° 또는 공용 중립 대역만 */
const FACE = new Set(['#34190C', '#FFFFFF', '#1F4F86', '#3B8FBF', '#7FC8E8', '#FF9EB5', '#B8362C', '#F28B9A'].map((h) => h.toUpperCase()))
for (const def of HUMAN_CHARACTERS) {
  const st = def.content && CONTENT_STYLES[def.content]
  const colors = SPRITE_COLORS[def.key]
  const count = new Map()
  for (const row of SPRITES[def.key]) for (const ch of row) if (ch !== '.') count.set(ch, (count.get(ch) ?? 0) + 1)
  let family = 0
  for (const [ch, n] of count) {
    const hex = (colors[ch] ?? PALETTE[ch]).toUpperCase()
    if (FACE.has(hex)) continue
    const { h, s } = hsv(hex)
    if (s < 0.35) continue
    const own = st && hueGap(h, st.hue) <= 25
    if (own) { family += n; continue }
    const neutral = h >= NEUTRAL_HUE[0] && h <= NEUTRAL_HUE[1]
    if (!neutral) errs.push(`${def.key}: ${hex}(H ${h.toFixed(0)}°, ${n}칸)는 ${def.content ?? '중립'} 계열·공용 중립 대역이 아님`)
  }
  if (st && family < 40) errs.push(`${def.key}: ${def.content} 계열 색이 ${family}칸뿐(40칸 이상 필요)`)
}

/* 4. 색 수 16 이하 */
for (const def of [...CONCEPT_CHARACTERS, ...HUMAN_CHARACTERS]) {
  const used = new Set()
  for (const row of SPRITES[def.key]) for (const ch of row) if (ch !== '.') used.add((SPRITE_COLORS[def.key][ch] ?? PALETTE[ch]).toUpperCase())
  if (used.size > 16) errs.push(`${def.key}: 색 ${used.size}개 > 16`)
}

if (errs.length) {
  console.error(`캐릭터 구별 규칙 위반 ${errs.length}건\n- ${errs.join('\n- ')}`)
  process.exit(1)
}
const n = CONCEPT_CHARACTERS.length + HUMAN_CHARACTERS.length
console.log(`캐릭터 구별 규칙 통과: 콘텐츠 ${CONTENT_IDS.length}개, 캐릭터 ${n}개`)
