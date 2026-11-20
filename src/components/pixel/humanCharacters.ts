/**
 * 인간형 SD 캐릭터 정의. 규격: docs/pixel-character-spec.md §10
 *
 * 원본 32x32 격자. 좌표는 1칸 = 4단위(0~128)로 적음.
 * 공통 체형(sdBody): 머리 14칸 : 몸 12.5칸 ≒ 1:0.9 (2등신 마스코트).
 * 램프는 3~5단으로 적고, 32칸에서는 생성기가 기본·그림자 2톤만 씀(총 16색 이하). 인접 요소는 명도 차이를 두고 고른다.
 *
 * 콘텐츠별 구별(문서 §13): content 의 색 계열 램프를 주 의상에 쓰고, 나머지는 같은 계열 또는 중립색
 * (피부·자연 머리색·가죽·크림·회갈·금속 소품)만 쓴다. 다른 콘텐츠 계열 색은 작은 소품에도 쓰지 않는다.
 * 실루엣 유형(모자형·A라인형·망토형)은 contentStyles.ts CONTENT_STYLES 참고. 독자(기본 아바타)는 콘텐츠가 없어 중립색.
 */
import type { Elem, HumanCharacterDef, Hex, Pose, Pt, Shape } from './humanCharacter'

/* ───── 램프 (밝음 → 어두움, 마지막 = 내부선) ───── */
const R = {
  skin: ['#FFF1DE', '#FFE0C2', '#F5C99B', '#D99A66'],
  hairBrown: ['#B0743B', '#874B28', '#6A3A1E', '#4A2311'],
  hairInk: ['#6E7392', '#4C5070', '#353852', '#1F2136'],
  hairChestnut: ['#C98A52', '#A0612F', '#7A4520', '#4F2A12'],
  cream: ['#FFFBF2', '#F3E2C0', '#D6B98A', '#A8865A'],
  navy: ['#6F8FD0', '#4A69AC', '#344E86', '#253A66', '#162544'],
  navyLight: ['#A9C4F0', '#7397DA', '#4F72B6', '#34508A'],
  stone: ['#ECE6DC', '#BFB4A4', '#8F8474', '#5E5448'],
  roseDress: ['#FFF7FB', '#FBE6F1', '#EBC3D8', '#C793B0'],
  rose: ['#FFD3EC', '#F08CC8', '#CC559C', '#8E3468'],
  gold: ['#FFF2C2', '#F7C948', '#D49A2A', '#9A6A1F'],
  glow: ['#FFFDE8', '#FFF0A0', '#FFD95A'],
  pantsBrown: ['#7C6A64', '#5B4B46', '#433632', '#2A1F1C'],
  leather: ['#E0AE6C', '#B7803F', '#8A5A3B', '#5A3A22'],
  parch: ['#FFFBF2', '#F8E0B3', '#E3C189', '#B0743B'],
  denim: ['#7A8FB8', '#566C99', '#3E5179', '#283656'],
  forest: ['#BFEBB0', '#5DBB63', '#3A8A42', '#24592A', '#163A1A'],
  hairHoney: ['#F8DFA4', '#E2B867', '#B88838', '#7C5520'],
  bread: ['#F6CE8C', '#DE9D4F', '#B06E2C', '#76441A'],
  greenDark: ['#4C9E58', '#2F7A3A', '#1F5A28', '#123A18'],
  berry: ['#F7C2EC', '#D58ACB', '#A85BA0', '#7A3B74', '#4D1F4A'],
} satisfies Record<string, Hex[]>

const ell = (cx: number, cy: number, rx: number, ry: number): Shape => ({ t: 'ell', cx, cy, rx, ry })
const rect = (x: number, y: number, w: number, h: number, r = 0): Shape => ({ t: 'rect', x, y, w, h, r })
const poly = (...pts: Pt[]): Shape => ({ t: 'poly', pts })
const cap = (a: Pt, b: Pt, r: number): Shape => ({ t: 'cap', a, b, r })
const ring = (cx: number, cy: number, r: number, w: number): Shape => ({ t: 'ring', cx, cy, r, w })

/** 어깨·엉덩이(고정 관절) */
const SHOULDER: [Pt, Pt] = [[50, 75], [78, 75]]
const HIP: [Pt, Pt] = [[56, 99], [72, 99]]
const HEAD = ell(64, 47, 31, 28)

interface BodyOpts {
  /** 머리 뒤(뒷머리·후드·배낭) */
  back?: Elem[]
  pants: Hex[]
  shoes: Hex[]
  top: Hex[]
  /** 몸통 모양 덮어쓰기(망토 등) */
  torso?: Shape[]
  sleeve?: Hex[]
  /** 몸통 위 장식(단추·끈 등). 팔보다 뒤 */
  torsoDetail?: Elem[]
  /** 손에 든 소품. 손보다 뒤에 그림 */
  held?: Elem[]
  /** 목 장식(목도리). 머리보다 뒤 */
  neck?: Elem[]
  /** 머리 위(앞머리·모자) */
  front: Elem[]
}

/** 공통 SD 체형. 그리기 순서: 뒤 → 다리 → 신발 → 몸통 → 장식 → 소품 → 팔 → 손 → 목 → 귀 → 머리 → 앞 */
function sdBody(p: Pose, o: BodyOpts): Elem[] {
  const [hl, hr] = p.hands
  const [fl, fr] = p.feet
  return [
    ...(o.back ?? []),
    { name: 'legs', group: 'bottom', ramp: o.pants, add: [cap(HIP[0], [fl[0], fl[1] - 5], 6.5), cap(HIP[1], [fr[0], fr[1] - 5], 6.5)] },
    { name: 'shoes', ramp: o.shoes, add: [ell(fl[0] - 1, fl[1], 9.5, 6.5), ell(fr[0] + 1, fr[1], 9.5, 6.5)] },
    { name: 'torso', group: 'top', ramp: o.top, add: o.torso ?? [poly([49, 68], [79, 68], [86, 101], [42, 101]), rect(46, 95, 36, 8, 3)] },
    ...(o.torsoDetail ?? []),
    ...(o.held ?? []),
    { name: 'sleeves', group: 'top', ramp: o.sleeve ?? o.top, add: [cap(SHOULDER[0], hl, 6), cap(SHOULDER[1], hr, 6)], line: 'dark' },
    { name: 'hands', group: 'skin', ramp: R.skin, add: [ell(hl[0], hl[1] + 1, 6, 6), ell(hr[0], hr[1] + 1, 6, 6)], line: 'k' },
    ...(o.neck ?? []),
    { name: 'ears', group: 'skin', ramp: R.skin, add: [ell(34, 54, 5.5, 7), ell(94, 54, 5.5, 7)], line: 'k' },
    { name: 'head', group: 'skin', ramp: R.skin, add: [HEAD], line: 'k' },
    ...o.front,
  ]
}

/** 손이 움직이면 소품도 따라감 */
const at = (h: Pt, dx: number, dy: number): Pt => [h[0] + dx, h[1] + dy]

/* ───── 캐릭터 ───── */

/** 등대지기 노윤(등대지기의 편지, 남색 계열·모자형): 밝은 남색 줄무늬 털모자 + 방울, 진한 남색 코트, 크림 목도리, 등불 */
const keeper: HumanCharacterDef = {
  key: 'h_keeper',
  name: '등대지기 노윤',
  content: 'b_lighthouse',
  hands: [[40, 94], [88, 92]],
  feet: [[54, 117], [74, 117]],
  build: (p) => {
    const lh = p.hands[1]
    return sdBody(p, {
      back: [{ name: 'hairBack', group: 'hair', ramp: R.hairBrown, add: [ell(64, 50, 32, 24)] }],
      pants: R.hairBrown, // 32칸 16색 제한: 머리카락과 같은 램프
      shoes: R.leather,
      top: R.navy,
      torsoDetail: [
        { name: 'buttons', group: 'gold', ramp: R.gold, add: [ell(64, 82, 2.6, 2.6), ell(64, 91, 2.6, 2.6)], clip: 'torso', line: 'none' },
        { name: 'belt', group: 'leather', ramp: R.leather, add: [rect(40, 94, 48, 5)], clip: 'torso' },
      ],
      held: [
        { name: 'lanternHandle', group: 'gold', ramp: R.gold, add: [ring(lh[0], lh[1] + 5, 6, 2)], cut: [rect(lh[0] - 8, lh[1] + 5, 16, 8)] },
        { name: 'lantern', group: 'gold', ramp: R.gold, add: [rect(lh[0] - 8, lh[1] + 5, 16, 4, 1), rect(lh[0] - 7, lh[1] + 8, 14, 15, 2), rect(lh[0] - 8, lh[1] + 22, 16, 4, 1)], line: 'k' },
        { name: 'glow', group: 'gold', ramp: R.glow, add: [rect(lh[0] - 4, lh[1] + 11, 8, 9, 1)], clip: 'lantern' },
      ],
      neck: [
        { name: 'scarf', group: 'cream', ramp: R.cream, add: [rect(44, 66, 40, 10, 5), rect(68, 70, 9, 18, 3)], line: 'k' },
        { name: 'scarfStripe', group: 'hat', ramp: [R.navyLight[1], R.navyLight[2], R.navyLight[3]], add: [rect(68, 80, 9, 3)], clip: 'scarf', line: 'none' },
      ],
      front: [
        { name: 'sideHair', group: 'hair', ramp: R.hairBrown, add: [poly([33, 40], [42, 40], [40, 60], [34, 58]), poly([86, 40], [95, 40], [94, 58], [88, 60])], line: 'k' },
        { name: 'hat', group: 'hat', ramp: R.navyLight, add: [ell(64, 36, 33, 25)], cut: [rect(0, 41, 128, 40)], line: 'k' },
        { name: 'hatStripe', group: 'cream', ramp: R.cream, add: [rect(0, 25, 128, 4), rect(0, 33, 128, 3)], clip: 'hat', line: 'none' },
        { name: 'hatBand', group: 'cream', ramp: R.cream, add: [rect(30, 36, 68, 10, 5)], line: 'k' },
        { name: 'pompom', group: 'cream', ramp: R.cream, add: [ell(64, 9, 8, 7.5)], line: 'k' },
      ],
    })
  },
}

/** 우체부 하람(등대지기의 편지, 남색 계열·모자형): 밝은 남색 높은 제모·제복, 가죽 가방, 금색 봉인 편지 */
const postman: HumanCharacterDef = {
  key: 'h_postman',
  name: '우체부 하람',
  content: 'b_lighthouse',
  hands: [[40, 94], [90, 86]],
  feet: [[54, 117], [74, 117]],
  build: (p) => {
    const rh = p.hands[1]
    return sdBody(p, {
      back: [{ name: 'hairBack', group: 'hair', ramp: R.hairInk, add: [ell(64, 50, 33, 26)] }],
      pants: R.denim,
      shoes: R.leather,
      top: R.navyLight,
      torsoDetail: [
        { name: 'strap', group: 'leather', ramp: R.leather, add: [cap([77, 70], [47, 95], 3)], clip: 'torso' },
        { name: 'bag', group: 'leather', ramp: R.leather, add: [rect(28, 88, 24, 17, 4)], line: 'k' },
        { name: 'bagFlap', group: 'leather', ramp: [R.leather[1], R.leather[2], R.leather[3]], add: [rect(28, 88, 24, 8, 4)], clip: 'bag' },
        { name: 'bagClasp', group: 'gold', ramp: R.gold, add: [rect(38, 94, 4, 4)], clip: 'bag', line: 'none' },
      ],
      held: [
        { name: 'letter', group: 'parch', ramp: R.parch, add: [rect(rh[0] - 4, rh[1] - 12, 18, 12)], line: 'k' },
        { name: 'seal', group: 'gold', ramp: R.gold, add: [ell(rh[0] + 5, rh[1] - 5, 2.6, 2.6)], clip: 'letter', line: 'none' },
      ],
      front: [
        { name: 'bangs', group: 'hair', ramp: R.hairInk, add: [ell(64, 44, 32, 20)], cut: [ell(64, 64, 25, 17), poly([50, 70], [54, 46], [58, 70]), poly([70, 70], [74, 46], [78, 70])], line: 'k' },
        // 높은 제모(모자형 실루엣): 위가 넓고 높게 솟은 크라운
        { name: 'cap', group: 'hat', ramp: R.navyLight, add: [ell(64, 30, 34, 21)], cut: [rect(0, 34, 128, 40)], line: 'k' },
        { name: 'capBand', group: 'capBand', ramp: R.navy, add: [rect(33, 31, 62, 9, 2)], line: 'k' },
        { name: 'visor', group: 'capBand', ramp: R.navy, add: [ell(64, 41, 34, 5)], cut: [rect(0, 0, 128, 40)], line: 'k' },
        { name: 'badge', group: 'gold', ramp: R.gold, add: [ell(64, 22, 4.5, 4.5)], line: 'k' },
      ],
    })
  },
}

/** 여행자(바람의 지도, 초록 계열·망토형): 초록 후드 망토, 크림 튜닉, 배낭, 지도 */
const traveler: HumanCharacterDef = {
  key: 'h_traveler',
  name: '여행자',
  content: 's_wind',
  hands: [[40, 92], [88, 94]],
  feet: [[54, 117], [74, 117]],
  build: (p) => {
    const lh = p.hands[0]
    return sdBody(p, {
      back: [
        { name: 'pack', group: 'leather', ramp: R.leather, add: [rect(34, 62, 60, 34, 8)] },
        { name: 'hood', group: 'cloak', ramp: R.forest, add: [ell(64, 46, 36, 33)] },
      ],
      pants: R.pantsBrown,
      shoes: R.leather,
      top: R.forest,
      sleeve: R.forest,
      torso: [poly([47, 66], [81, 66], [91, 105], [37, 105]), rect(42, 98, 44, 8, 3)],
      torsoDetail: [
        { name: 'tunic', group: 'tunic', ramp: R.cream, add: [poly([57, 68], [71, 68], [74, 106], [54, 106])], clip: 'torso' },
        { name: 'sash', group: 'leather', ramp: R.leather, add: [rect(40, 92, 48, 5)], clip: 'tunic' },
      ],
      held: [
        { name: 'map', group: 'parch', ramp: R.parch, add: [rect(lh[0] - 14, lh[1] - 3, 16, 14, 1)], line: 'k' },
        { name: 'mapMark', group: 'cloak', ramp: [R.forest[2], R.forest[3], R.forest[4]], add: [cap(at(lh, -10, 1), at(lh, -6, 6), 1), cap(at(lh, -6, 1), at(lh, -10, 6), 1)], clip: 'map', line: 'none' },
      ],
      front: [
        { name: 'bangs', group: 'hair', ramp: R.hairChestnut, add: [ell(64, 42, 29, 20)], cut: [ell(64, 61, 25, 16), poly([56, 64], [61, 44], [65, 64])], line: 'k' },
        { name: 'hoodRim', group: 'cloak', ramp: R.forest, add: [ell(64, 44, 36, 31)], cut: [ell(64, 54, 29, 27)], line: 'k' },
      ],
    })
  },
}

/** 독자(기본 아바타, 콘텐츠 없음 → 중립색): 갈색 단발, 회갈 스웨터, 두 손에 가죽 표지 책 */
const reader: HumanCharacterDef = {
  key: 'h_reader',
  name: '독자',
  hands: [[53, 92], [75, 92]],
  feet: [[54, 117], [74, 117]],
  build: (p) => {
    const [a, b] = p.hands
    const m: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
    return sdBody(p, {
      back: [{ name: 'hairBack', group: 'hair', ramp: R.hairBrown, add: [ell(64, 49, 35, 27), rect(30, 50, 68, 22, 8)] }],
      pants: R.pantsBrown,
      shoes: R.leather,
      top: R.stone,
      torsoDetail: [
        { name: 'collar', group: 'parch', ramp: R.parch, add: [poly([52, 68], [76, 68], [70, 77], [64, 73], [58, 77])], clip: 'torso', line: 'k' },
      ],
      held: [
        { name: 'book', group: 'book', ramp: R.leather, add: [rect(m[0] - 15, m[1] - 15, 30, 21, 2)], line: 'k' },
        { name: 'pages', group: 'parch', ramp: R.parch, add: [rect(m[0] - 13, m[1] - 15, 26, 4)], clip: 'book' },
        { name: 'bookmark', group: 'gold', ramp: R.gold, add: [rect(m[0] + 6, m[1] - 15, 3, 10)], clip: 'book', line: 'none' },
      ],
      front: [
        {
          name: 'bangs', group: 'hair', ramp: R.hairBrown,
          add: [ell(64, 42, 34, 23), rect(30, 44, 9, 26, 4), rect(89, 44, 9, 26, 4)],
          cut: [ell(64, 63, 26, 18), poly([48, 70], [53, 47], [58, 70]), poly([68, 70], [74, 46], [80, 70])],
          line: 'k',
        },
        { name: 'hairPin', group: 'gold', ramp: R.gold, add: [rect(84, 34, 9, 4, 2)], line: 'k' },
      ],
    })
  },
}

/**
 * 로테(『젊은 베르테르의 슬픔』, 장미 계열·A라인형): 꿀빛 머리 올림머리, 장미빛이 도는 흰 드레스, 분홍 리본(가슴·허리·머리), 동생들에게 나눠 줄 빵.
 * 흰 드레스와 분홍 리본은 원작 묘사(무도회 장면, 리본 선물)에서 가져온 요소이며 특정 삽화·영상의 외형은 쓰지 않음.
 */
const lotte: HumanCharacterDef = {
  key: 'h_lotte',
  name: '로테',
  content: 'b_werther',
  hands: [[41, 94], [88, 90]],
  feet: [[55, 117], [73, 117]],
  build: (p) => {
    const rh = p.hands[1]
    return sdBody(p, {
      back: [
        { name: 'hairBack', group: 'hair', ramp: R.hairHoney, add: [ell(64, 49, 34, 27), rect(31, 50, 66, 26, 10)] },
        { name: 'bun', group: 'hair', ramp: R.hairHoney, add: [ell(64, 17, 13, 10)] },
      ],
      pants: R.roseDress,
      shoes: R.rose,
      top: R.roseDress,
      torso: [poly([49, 67], [79, 67], [92, 107], [36, 107]), rect(37, 100, 54, 9, 4)],
      torsoDetail: [
        { name: 'hemLace', group: 'ribbon', ramp: R.rose, add: [rect(0, 104, 128, 2)], clip: 'torso', line: 'none' },
        { name: 'sash', group: 'ribbon', ramp: R.rose, add: [rect(0, 85, 128, 6)], clip: 'torso' },
        { name: 'sashBow', group: 'ribbon', ramp: R.rose, add: [poly([53, 82], [64, 88], [53, 95]), poly([75, 82], [64, 88], [75, 95])], line: 'k' },
        { name: 'sashTail', group: 'ribbon', ramp: R.rose, add: [poly([61, 89], [65, 89], [60, 101], [56, 99]), poly([63, 89], [67, 89], [72, 99], [68, 101])], line: 'k' },
        { name: 'sashKnot', group: 'ribbon', ramp: R.rose, add: [ell(64, 88, 3.5, 3.5)], line: 'k' },
      ],
      held: [
        { name: 'loaf', group: 'bread', ramp: R.bread, add: [ell(rh[0] + 7, rh[1] - 3, 14, 8)], line: 'k' },
        { name: 'loafScore', group: 'bread', ramp: [R.bread[2], R.bread[3], R.bread[3]], add: [cap(at(rh, 2, -8), at(rh, 4, -2), 1), cap(at(rh, 8, -9), at(rh, 10, -3), 1), cap(at(rh, 14, -8), at(rh, 16, -3), 1)], clip: 'loaf', line: 'none' },
      ],
      front: [
        {
          name: 'bangs', group: 'hair', ramp: R.hairHoney,
          add: [ell(64, 42, 33, 22), rect(30, 44, 9, 24, 4), rect(89, 44, 9, 24, 4)],
          cut: [ell(64, 63, 26, 18), poly([60, 70], [64, 40], [68, 70])],
          line: 'k',
        },
        { name: 'hairBow', group: 'ribbon', ramp: R.rose, add: [poly([74, 20], [83, 25], [74, 31]), poly([92, 20], [83, 25], [92, 31])], line: 'k' },
        { name: 'hairKnot', group: 'ribbon', ramp: R.rose, add: [ell(83, 25, 3, 3)], line: 'k' },
      ],
    })
  },
}

const luckKim: HumanCharacterDef = {
  key: 'h_luck_kim', name: '김 첨지', hands: [[39, 90], [88, 91]], feet: [[52, 117], [76, 117]],
  build: (p) => sdBody(p, {
    top: R.greenDark, pants: R.pantsBrown, shoes: R.leather,
    front: [
      { name: 'headcloth', ramp: R.parch, add: [ell(64, 35, 32, 14)], cut: [rect(29, 41, 70, 11)], line: 'k' },
      { name: 'headclothTie', ramp: R.parch, add: [cap([90, 36], [99, 49], 3)], line: 'k' },
    ],
  }),
}

const luckWife: HumanCharacterDef = {
  key: 'h_luck_wife', name: '김 첨지의 아내', hands: [[41, 92], [87, 92]], feet: [[54, 117], [74, 117]],
  build: (p) => sdBody(p, {
    back: [{ name: 'hairBack', group: 'hair', ramp: R.hairInk, add: [ell(64, 46, 35, 31), ell(91, 57, 12, 12)] }],
    top: R.parch, pants: R.berry, shoes: R.leather,
    torsoDetail: [{ name: 'tie', ramp: R.berry, add: [poly([62, 78], [73, 74], [71, 88])], line: 'k' }],
    front: [
      { name: 'hair', group: 'hair', ramp: R.hairInk, add: [ell(64, 39, 33, 21)], cut: [ell(64, 55, 27, 16)], line: 'k' },
    ],
  }),
}

export const HUMAN_CHARACTERS: HumanCharacterDef[] = [keeper, postman, traveler, reader, lotte, luckKim, luckWife]
