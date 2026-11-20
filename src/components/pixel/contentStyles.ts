/**
 * 콘텐츠(책)별 캐릭터 구별 규칙 (규격 docs/pixel-character-spec.md §13)
 *
 * 콘텐츠마다 색 계열 1개 + 실루엣 유형 1개를 배정하고, 다른 콘텐츠와 겹치지 않게 한다.
 *  - 색: 계열 대표 색상(H)끼리 30° 이상 차이. H 15~55°는 피부·머리·가죽(공용 중립) 대역이라 계열로 배정하지 않음.
 *    캐릭터의 주 램프 = 계열 램프, 보조 램프 = 같은 계열 보조 또는 중립 램프.
 *  - 실루엣: 개념 도식 캐릭터는 몸통 상자 비율·머리 장식(줄기·지붕)·팔다리 모양이 콘텐츠마다 다름.
 *    인간형은 머리 장식·몸통 외곽(일자·A라인·망토) 유형이 콘텐츠마다 다름.
 *  - 같은 콘텐츠 안에서는 계열을 공유하고, 도식 모양·보조 램프·소품으로 개별 구분한다.
 * 규칙 검사: `npm run check:chars` (scripts/check-characters.mjs)
 */
import type { RampId } from './characterSpec'
import type { DiagramCharacterDef, DiagramPrim, DiagramRig, Pt } from './diagramCharacter'

export type ContentId = 'b_os' | 'b_kant' | 'b_attention' | 'b_lighthouse' | 'b_werther' | 's_hash' | 's_wind'

/** 개념 도식 캐릭터 실루엣. 몸통 도식을 box 에 맞춰 늘이고 줄인 뒤 장식·팔다리를 붙인다 */
export interface ConceptSilhouette {
  /** 몸통 도식을 맞춰 넣을 상자 [x0, y0, x1, y1] (x1·y1 은 끝 칸 다음, S 좌표) */
  box: [number, number, number, number]
  /** 몸통 밖 장식(지붕·머리 공 등). 절대 좌표 */
  crest?: DiagramPrim[]
  stems?: DiagramRig['stems']
  legs: { xs: number[]; footY: number; style: NonNullable<DiagramRig['legStyle']> }
  /** 팔: fromY 행의 몸통 가장자리 → to. 없으면 팔 없음 */
  arms?: { fromY: number; to: [Pt, Pt] }
}

export interface ContentStyle {
  id: ContentId
  title: string
  /** 색 계열 이름과 대표 색상(HSV H, 도) */
  family: string
  hue: number
  /** 계열 주 램프(모든 캐릭터의 주 램프) */
  ramp: RampId
  /** 같은 계열 보조 램프. 보조 램프는 이것 또는 NEUTRAL_RAMPS 에서 고름 */
  companions: RampId[]
  silhouette: { id: string; name: string; desc: string; concept?: ConceptSilhouette }
}

/** 어느 콘텐츠 계열에도 속하지 않는 중립 램프. 모든 콘텐츠가 보조색으로 쓸 수 있음 */
export const NEUTRAL_RAMPS: RampId[] = ['clothParch', 'stone', 'leather']

export const CONTENT_STYLES: Record<ContentId, ContentStyle> = {
  b_os: {
    id: 'b_os', title: '운영체제: CPU 스케줄링', family: '청록', hue: 170, ramp: 'famTeal', companions: ['famTealDeep'],
    silhouette: {
      id: 'terminal', name: '단말기형(가로 블록)',
      desc: '가로로 넓고 낮은 몸통, 가운데 안테나 1개, 팔 없음, 다리 4개(네모 발 핀)',
      concept: {
        box: [2, 9, 30, 23],
        stems: [{ x: 16, toY: 5 }],
        crest: [{ kind: 'disc', cx: 16.5, cy: 3.5, r: 2, tone: 2 }],
        legs: { xs: [6, 12, 20, 26], footY: 28, style: 'pin' },
      },
    },
  },
  b_kant: {
    id: 'b_kant', title: '순수이성비판', family: '보라', hue: 262, ramp: 'famViolet', companions: ['famVioletDeep'],
    silhouette: {
      id: 'temple', name: '신전형(세로 기둥)',
      desc: '세로로 긴 몸통 위 삼각 지붕, 두 팔로 지붕 처마를 받침, 굵은 기둥 다리 2개 + 받침',
      concept: {
        box: [8, 9, 24, 25],
        crest: [{ kind: 'poly', pts: [[4, 8], [16, 1], [28, 8]], tone: 2 }],
        legs: { xs: [11, 21], footY: 29, style: 'pillar' },
        arms: { fromY: 13, to: [[4, 10], [28, 10]] },
      },
    },
  },
  b_attention: {
    id: 'b_attention', title: 'Attention Is All You Need', family: '진홍', hue: 3, ramp: 'famCrimson', companions: ['famCrimsonDeep'],
    silhouette: {
      id: 'multihead', name: '다두형(머리 3개)',
      desc: '정사각에 가까운 몸통, 위로 뻗은 줄기 3개 끝에 둥근 머리(멀티헤드), 팔은 옆으로, 다리 2개',
      concept: {
        box: [6, 10, 26, 26],
        stems: [{ x: 9, toY: 5 }, { x: 16, toY: 4 }, { x: 23, toY: 5 }],
        crest: [
          { kind: 'disc', cx: 9.5, cy: 3.5, r: 2, tone: 2 },
          { kind: 'disc', cx: 16.5, cy: 2.5, r: 2, tone: 2 },
          { kind: 'disc', cx: 23.5, cy: 3.5, r: 2, tone: 2 },
        ],
        legs: { xs: [11, 21], footY: 29, style: 'line' },
        arms: { fromY: 17, to: [[1, 13], [30, 13]] },
      },
    },
  },
  b_lighthouse: {
    id: 'b_lighthouse', title: '등대지기의 편지', family: '남색', hue: 220, ramp: 'famNavy', companions: ['famNavyLight'],
    silhouette: { id: 'tall-hat', name: '모자형(세로로 긴 머리 장식 + 일자 코트)', desc: '모자 꼭대기 장식이 머리 위로 솟고, 상의는 허리까지 일자' },
  },
  b_werther: {
    id: 'b_werther', title: '젊은 베르테르의 슬픔', family: '장미', hue: 323, ramp: 'famRose', companions: ['famRoseDeep'],
    silhouette: { id: 'a-line', name: 'A라인형(넓게 퍼지는 아래)', desc: '머리 위 올림머리, 상의 아래가 넓게 퍼져 몸통이 삼각형' },
  },
  s_hash: {
    id: 's_hash', title: '해시 테이블 한 권으로 끝내기(스토어)', family: '연두', hue: 85, ramp: 'famLime', companions: [],
    silhouette: { id: 'hanging', name: '현수형(매달린 체인)', desc: '위쪽 넓은 버킷 배열에서 체인 노드가 다리처럼 매달림. 정의 좌표 그대로 사용' },
  },
  s_wind: {
    id: 's_wind', title: '바람의 지도(스토어)', family: '초록', hue: 123, ramp: 'famGreen', companions: [],
    silhouette: { id: 'cloak', name: '망토형(후드 + 배낭)', desc: '후드와 배낭이 머리·어깨 뒤로 넓게 퍼짐' },
  },
}

export const CONTENT_IDS = Object.keys(CONTENT_STYLES) as ContentId[]

/** 앱 데이터의 책·스토어 id → 콘텐츠 스타일. 등록 안 된 콘텐츠(사용자 업로드 등)는 null = 중립 공용 */
const ALIAS: Record<string, ContentId> = { s_attn: 'b_attention', s_rr: 'b_os' }
export function contentStyle(id: string | undefined): ContentStyle | null {
  if (!id) return null
  return CONTENT_STYLES[(ALIAS[id] ?? id) as ContentId] ?? null
}

/* ───── 개념 도식 실루엣 적용: 몸통을 상자에 맞춤 ───── */

type Bounds = [number, number, number, number]
function primBounds(p: DiagramPrim): Bounds | null {
  switch (p.kind) {
    case 'rect': return [p.x, p.y, p.x + p.w, p.y + p.h]
    case 'clear': return null
    case 'line': {
      const w = p.w ?? 2
      const xs = p.pts.map((q) => q[0]), ys = p.pts.map((q) => q[1])
      return [Math.min(...xs), Math.min(...ys), Math.max(...xs) + w, Math.max(...ys) + w]
    }
    case 'disc': case 'ring': return [p.cx - p.r, p.cy - p.r, p.cx + p.r, p.cy + p.r]
    case 'poly': {
      const xs = p.pts.map((q) => q[0]), ys = p.pts.map((q) => q[1])
      return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]
    }
  }
}

/**
 * 콘텐츠 실루엣을 입힌 정의를 돌려줌. 몸통 도식은 상자에 가로·세로 따로 맞춰 늘이고 줄인다
 * (1칸짜리 칸 구분선은 1칸 유지). 눈·입은 같은 비율로 옮기고, 팔다리는 실루엣 것으로 바꾼다.
 * 콘텐츠가 없거나 실루엣에 concept 이 없으면(현수형 등) 색만 바꾸고 모양은 그대로.
 */
export function applyContentStyle(def: DiagramCharacterDef): DiagramCharacterDef {
  const st = contentStyle(def.content)
  if (!st) return def
  const sil = st.silhouette.concept
  if (!sil) return def
  const bs = def.body.map(primBounds).filter((b): b is Bounds => b !== null)
  const [nx0, ny0, nx1, ny1] = [Math.min(...bs.map((b) => b[0])), Math.min(...bs.map((b) => b[1])), Math.max(...bs.map((b) => b[2])), Math.max(...bs.map((b) => b[3]))]
  const [bx0, by0, bx1, by1] = sil.box
  const sx = (bx1 - bx0) / (nx1 - nx0), sy = (by1 - by0) / (ny1 - ny0)
  const X = (v: number) => bx0 + (v - nx0) * sx
  const Y = (v: number) => by0 + (v - ny0) * sy
  const span = (a: number, len: number, f: (v: number) => number): [number, number] => {
    const s0 = Math.round(f(a))
    return [s0, Math.max(1, Math.round(f(a + len)) - s0)]
  }
  const body: DiagramPrim[] = def.body.map((p): DiagramPrim => {
    switch (p.kind) {
      case 'rect': case 'clear': {
        const [x, w] = span(p.x, p.w, X), [y, h] = span(p.y, p.h, Y)
        return { ...p, x, y, w, h }
      }
      case 'line': return { ...p, pts: p.pts.map(([a, b]) => [X(a), Y(b)] as Pt) }
      case 'poly': return { ...p, pts: p.pts.map(([a, b]) => [X(a), Y(b)] as Pt) }
      case 'disc': return { ...p, cx: X(p.cx), cy: Y(p.cy), rx: (p.rx ?? p.r) * sx, ry: (p.ry ?? p.r) * sy }
      // 고리 두께는 짧은 축 비율로 줄임(1칸 이상)
      case 'ring': return { ...p, cx: X(p.cx), cy: Y(p.cy), rx: (p.rx ?? p.r) * sx, ry: (p.ry ?? p.r) * sy, w: Math.max(1, Math.round(p.w * Math.min(1, sx, sy))) }
    }
  })
  const rig = def.rig
  return {
    ...def,
    body: [...body, ...(sil.crest ?? [])],
    rig: {
      ...rig,
      eyes: rig.eyes.map((e) => ({ ...e, x: Math.round(X(e.x)), y: Math.round(Y(e.y)) })),
      mouth: rig.mouth && { ...rig.mouth, x: Math.round(X(rig.mouth.x)), y: Math.round(Y(rig.mouth.y)) },
      markers: rig.markers?.map(([a, b]) => [Math.round(X(a)), Math.round(Y(b))] as Pt),
      stems: sil.stems,
      legStyle: sil.legs.style,
      legs: sil.legs.xs.map((x) => ({ to: [x, sil.legs.footY] as Pt })),
      arms: sil.arms ? sil.arms.to.map((to) => ({ fromY: sil.arms!.fromY, to })) : [],
    },
  }
}
