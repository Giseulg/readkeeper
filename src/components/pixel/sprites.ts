/**
 * 픽셀 스프라이트 데이터. 목업 mockups/source/sprites.js 에서 이식.
 * 문자 1개 = 1px, '.' = 투명. i_ 로 시작하는 아이콘은 'k'를 currentColor 로 칠함.
 * d_ 로 시작하는 개념 도식 캐릭터는 conceptCharacters.ts 정의에서 생성
 * (32x32 원본 1벌. 큰 화면은 PixelSprite 가 정수배로 확대).
 * h_ 로 시작하는 인간형 SD 캐릭터는 humanCharacters.ts 정의에서 생성(32x32 원본 1벌, 화면에서는 정수배 확대).
 */
/* eslint-disable */
import type { RampId } from './characterSpec'
import { CONCEPT_CHARACTERS } from './conceptCharacters'
import { applyContentStyle, contentStyle, NEUTRAL_RAMPS } from './contentStyles'
import { buildDiagramSprite } from './diagramCharacter'
import { buildHumanSprite, type HumanCharacterDef, type Pt } from './humanCharacter'
import { HUMAN_CHARACTERS } from './humanCharacters'
import { CASTLE_SPRITES } from './castleSprites'
export const PALETTE: Record<string, string> = {k:'#34190C',G:'#3fa34d',g:'#22702f',w:'#ffffff',p:'#ff9eb5',o:'#D97B29',O:'#f2b45a',
  b:'#8a5a3b',B:'#6b4226',y:'#f7d154',r:'#c4423a',R:'#e0674f',c:'#7fc8e8',s:'#e8b974',t:'#f6e6c4',
  v:'#883E82',V:'#c57abd',S:'#f5c99b',H:'#4a2f1d',C:'#2f6fb0',n:'#5a8f3a',e:'#9fd36b',q:'#d9a35f',Q:'#b7803f',u:'#5fb3d9',U:'#3b8fbf',z:'#9a8a7a'};
export const SPRITES: Record<string, string[]> = {
// A steaming bowl for an object card. It has no face or limbs.
object_soup:[
  ".......tt.....tt........", "......tt.....tt.........", ".......tt.....tt........",
  "........tt.....tt.......", "........................", "....kkkkkkkkkkkkkkkk....",
  "..kkqqqqqqqqqqqqqqqqkk..", ".kqqttqqttqqqqttqqttqqk.", "kqqqqqqqqqqqqqqqqqqqqqqk",
  "kkkkkkkkkkkkkkkkkkkkkkkk", ".kCCCCCCCCCCCCCCCCCCCCk.", "..kcccccccccccccccccck..",
  "...kCCCCCCCCCCCCCCCCk...", "....kkCCCCCCCCCCCCkk....", "......kkkkkkkkkkkk......",
],
tree:["....kkkk....","..kkGGGGkk..",".kGGGgGGGGk.","kGGgGGGGgGGk","kGGGGGGGGGGk","kgGGGgGGGGgk","kGGGGGGgGGGk",".kgGGGGGGgk.","..kkkggkkk..",".....kbk....",".....kbk....","....kkbkk..."],
house:["......kkkk......","....kkrrrrkk....","..kkrrRrrRrrkk..",".krrrrrrrrrrrrk.","kkkkkkkkkkkkkkkk",".kttttttttttttk.",".ktkkktttkkkkttk",".ktkcktttkbbkttk",".ktkkktttkbbkttk",".kttttttkbbbkttk",".kttttttkbbbkttk",".kkkkkkkkkkkkkk."],
bush:["..kkkk..",".kGGGGk.","kGGeGGGk","kGgGGgGk",".kkkkkk."],
flowerv:[".v.","vyv",".v.",".n."],
flowery:[".y.","yoy",".y.",".n."],
sign:["kkkkkkkk","kttttttk","ktkkkktk","kttttttk","kkkkkkkk","...kk...","...kk..."],
fence:["k.k.k.k.","bkbkbkbk","bbbbbbbb","bkbkbkbk","b.b.b.b."],
lamp:[".kkk.",".kyk.",".kyk.",".kkk.","..k..","..k..","..k..",".kkk."],
// 마을 꾸미기 해금 소품(domain/decor.ts DECOR_CATALOG)
bench:[".kkkkkkkkkkkk.",".kbbbbbbbbbbk.",".kkkkkkkkkkkk.",".kBk......kBk.","kkkkkkkkkkkkkk","kqqqqqqqqqqqqk","kkkkkkkkkkkkkk",".kBk......kBk.",".kBk......kBk.",".kkk......kkk."],
mailbox:["..kkkkk.",".krrrrrk","kRrrrrrk","krrkkkrk","krrrrrrk","kkkkkkkk","...kbk..","...kbk..","...kbk..","..kkkkk."],
rock:["..kkkk..",".kzwzzk.","kzzzzzzk","kzzzzzkk",".kkkkkk."],
well:["kkkkkkkkkkkk","kRrrRrrRrrRk",".kkkkkkkkkk.","..kB....Bk..","..kB.kk.Bk..","..kB.kb.Bk..","kkkkkkkkkkkk","kzzkzzzkzzzk","kkkkkkkkkkkk","kzzzkzzzkzzk","kzzzzkzzzzzk","kkkkkkkkkkkk"],
// 8x8 icons (k = currentColor)
i_home:["...kk...","..kkkk..",".kkkkkk.","kkkkkkkk",".k....k.",".k.kk.k.",".k.kk.k.",".kkkkkk."],
i_book:["kk.kk.k.","kk.kk.k.","kk.kk.kk","kk.kk.kk","kk.kk.kk","kk.kk.kk","kk.kk.kk","kkkkkkkk"],
i_compass:["..kkkk..",".k...kk.","k...kk.k","k..kkk.k","k.kkk..k","k.kk...k",".k....k.","..kkkk.."],
i_person:["..kkkk..","..kkkk..","..kkkk..","...kk...",".kkkkkk.","kkkkkkkk","kkkkkkkk","kkkkkkkk"],
i_back:["...k....","..kk....",".kkkkkkk","kkkkkkkk",".kkkkkkk","..kk....","...k....","........"],
i_graph:["kk....kk","kkk..kkk","..k..k..","...kk...","...kk...","..k..k..","kkk..kkk","kk....kk"],
i_memo:["kkkkkk..","k....kk.","k.kkk.kk","k......k","k.kkkk.k","k......k","k.kkkk.k","kkkkkkkk"],
i_quiz:["..kkkk..",".kk..kk.",".....kk.","....kk..","...kk...","...kk...","........","...kk..."],
i_gear:["...kk...",".k.kk.k.","..kkkk..","kkk..kkk","kkk..kkk","..kkkk..",".k.kk.k.","...kk..."],
i_plus:["...kk...","...kk...","...kk...","kkkkkkkk","kkkkkkkk","...kk...","...kk...","...kk..."],
i_minus:["........","........","........","kkkkkkkk","kkkkkkkk","........","........","........"],
i_chev:["..k.....","..kk....","...kk...","....kk..","...kk...","..kk....","..k.....","........"],
i_menu:["kkkkkkkk","kkkkkkkk","........","kkkkkkkk","kkkkkkkk","........","kkkkkkkk","kkkkkkkk"],
i_toc:["kk.kkkkk","........","kk.kkkkk","........","kk.kkkkk","........","kk.kkkkk","........"],
i_search:[".kkkk...","k....k..","k....k..","k....k..",".kkkkk..",".....kk.","......kk",".......k"],
i_refresh:["..kkkk.k",".k....kk","k....kkk","k.......",".......k","kkk....k","kk....k.","k.kkkk.."],
i_star:["...kk...","...kk...","kkkkkkkk",".kkkkkk.","..kkkk..",".kkkkkk.",".kk..kk.","k......k"],
i_check:["........",".......k","......kk","k....kk.","kk..kk..",".kkkk...","..kk....","........"],
i_x:["k......k","kk....kk",".kk..kk.","..kkkk..","..kkkk..",".kk..kk.","kk....kk","k......k"],
i_tri:["...kk...","...kk...","..kkkk..","..k..k..",".kk..kk.",".k....k.","kkkkkkkk","kkkkkkkk"],
i_pencil:["......kk",".....kkk","....kkk.","...kkk..","..kkk...",".kkk....","kkk.....","kk......"],
i_heart:[".kk..kk.","kkkkkkkk","kkkkkkkk","kkkkkkkk",".kkkkkk.","..kkkk..","...kk...","........"],
i_leaf:[".....kkk","...kkkkk","..kkkkkk",".kkkkkk.",".kkkkk..",".kkkk...","k.......","........"],
i_bell:["...kk...","..kkkk..",".kkkkkk.",".kkkkkk.",".kkkkkk.","kkkkkkkk","........","...kk..."],
i_up:["...kk...","..kkkk..",".kkkkkk.","...kk...","...kk...","...kk...","k......k","kkkkkkkk"],
i_flag:["kkkkkk..","kkkkkkk.","kkkkkk..","k.......","k.......","k.......","k.......","k......."],
i_pin:["..kkkk..",".kkkkkk.",".kk..kk.",".kkkkkk.","..kkkk..","...kk...","...kk...","...k...."],
i_edit:["kkkk.kk.","k...kkk.","k..kkk..","k.kkk..k","k.kk...k","k......k","k......k","kkkkkkkk"],
i_lock:["..kkkk..",".k....k.",".k....k.","kkkkkkkk","kkk..kkk","kkk..kkk","kkkkkkkk","kkkkkkkk"],
i_eye:["........","..kkkk..",".k....k.","k..kk..k","k..kk..k",".k....k.","..kkkk..","........"],
i_down:["...kk...","...kk...","...kk...","kk.kk.kk",".kkkkkk.","..kkkk..","...kk...","kkkkkkkk"],
i_dl:["...kk...","...kk...","...kk...","kk.kk.kk",".kkkkkk.","..kkkk..","...kk...","kkkkkkkk"],
i_sun:["k..k..k.",".k...k..","..kkk...","kkkkkkk.","..kkk...",".k...k..","k..k..k.","........"],
i_trash:["..kkkk..","kkkkkkkk",".k....k.",".k.kk.k.",".k.kk.k.",".k.kk.k.",".k....k.",".kkkkkk."],
i_tri_down:["kkkkkkkk","k......k",".k....k.",".k....k.","..k..k..","..k..k..","...kk...","........"],
i_tri_up:["........","...kk...","..k..k..","..k..k..",".k....k.",".k....k.","k......k","kkkkkkkk"],
i_ff:["k...k...","kk..kk..","kkk.kkk.","kkkkkkkk","kkk.kkk.","kk..kk..","k...k...","........"],
i_sort:["...k....","..kkk...",".kkkkk..","...k....","...k.kk.","...k.kk.",".....kk.","...kkkkk"],
};

/** 스프라이트별 팔레트(PALETTE 위에 덮어씀). 도식 캐릭터는 램프 색을 여기에 둔다 */
export const SPRITE_COLORS: Record<string, Record<string, string>> = {};

type Def = (typeof CONCEPT_CHARACTERS)[number];
/** 등록된 이름 → 정의. 변형(~ramp)도 포함 */
const DEFS: Record<string, Def> = {};

function register(raw: Def) {
  // 콘텐츠 실루엣(몸통 상자·장식·팔다리)을 입힌 정의를 등록. 바둥 프레임도 이 정의에서 만듦(문서 §13)
  const def = applyContentStyle(raw);
  DEFS[def.key] = def;
  // 인간형과 같은 32x32 원본 1벌만 등록(M·L 등급 없음)
  const built = buildDiagramSprite(def, 'S');
  SPRITES[def.key] = built.rows;
  SPRITE_COLORS[def.key] = built.colors;
}
CONCEPT_CHARACTERS.forEach(register);

/**
 * 같은 도식 캐릭터를 다른 콘텐츠의 색 계열·실루엣으로 등록하고 이름('<key>~<콘텐츠>~<보조 램프>')을 돌려줌.
 * 관계도에서 전용 도식이 없는 개념 노드용: 책 계열을 따르고, 노드마다 보조 램프로 구분(문서 §13).
 * 등록 안 된 콘텐츠면 중립 기본형. pick = 노드별 고정 정수(해시)
 */
export function contentVariant(key: string, contentId: string | undefined, pick = 0): string {
  const def = CONCEPT_CHARACTERS.find((d) => d.key === key);
  const st = contentStyle(contentId);
  if (!def || !st) return key;
  const subs: RampId[] = [...st.companions, ...NEUTRAL_RAMPS];
  const ramp2 = subs[((pick % subs.length) + subs.length) % subs.length];
  const name = `${key}~${st.id}~${ramp2}`;
  if (!SPRITES[name]) register({ ...def, key: name, content: st.id, ramp: st.ramp, ramp2 });
  return name;
}

/** 전용 도식이 없는 개념 노드의 기본 캐릭터 */
export const DEFAULT_CONCEPT_SPRITE = 'd_node';


/* ───── 인간형 SD 캐릭터 (32x32) ───── */
const HUMANS: Record<string, HumanCharacterDef> = {};
for (const def of HUMAN_CHARACTERS) {
  HUMANS[def.key] = def;
  // 32x32 원본 1벌만 등록. 큰 화면은 PixelSprite 가 정수배로 확대(최근접 이웃)
  const built = buildHumanSprite(def, 'S');
  SPRITES[def.key] = built.rows;
  SPRITE_COLORS[def.key] = built.colors;
}
export type VerdictPose = 'think' | 'point' | 'realize' | 'cheer' | 'nod';

export interface CharacterRecipe {
  template: 'adult_person' | 'overlapping_blocks' | 'sun' | 'book' | 'process_states'
  primary: string
  secondary: string
  face: 'neutral' | 'weathered'
  beard?: boolean
  missing_features: string[]
}

const recipePalettes: Record<string, Record<string, string>> = {};
const shade = (hex: string, factor: number) => '#' + [1, 3, 5].map((offset) =>
  Math.round(parseInt(hex.slice(offset, offset + 2), 16) * factor).toString(16).padStart(2, '0')).join('');

export function registerCharacterRecipe(recipe: CharacterRecipe): string {
  const key = 'recipe_' + encodeURIComponent(JSON.stringify(recipe));
  if (SPRITES[key]) return key;
  if (recipe.template === 'adult_person') {
    const base = HUMANS.h_luck_kim;
    const def: HumanCharacterDef = { ...base, key, matureFace: true, build: (pose) => {
      const parts = base.build(pose).map((part) => ({
        ...part,
        ramp: part.group === 'top'
          ? [recipe.primary, shade(recipe.primary, .8), shade(recipe.primary, .6)] as `#${string}`[]
          : part.group === 'bottom'
            ? [recipe.secondary, shade(recipe.secondary, .8), shade(recipe.secondary, .6)] as `#${string}`[]
            : part.ramp,
      }));
      if (recipe.face === 'weathered') parts.push({
        name: 'faceLines', ramp: ['#79513B', '#79513B', '#79513B'],
        add: [
          { t: 'rect', x: 43, y: 56, w: 9, h: 3 },
          { t: 'rect', x: 76, y: 56, w: 9, h: 3 },
        ], clip: 'head', line: 'none',
      });
      if (recipe.beard) parts.push({
        name: 'chinBeard', ramp: ['#44382E', '#332A23', '#231E19'],
        add: [{ t: 'poly', pts: [[49, 67], [56, 70], [64, 68], [73, 70], [79, 67], [72, 77], [64, 81], [56, 77]] }],
        clip: 'head', line: 'none',
      });
      return parts;
    }};
    HUMANS[key] = def;
    const built = buildHumanSprite(def, 'S');
    SPRITES[key] = built.rows;
    SPRITE_COLORS[key] = built.colors;
  } else {
    const body: Def['body'] = recipe.template === 'process_states'
      ? [
          { kind: 'line', pts: [[8, 16], [14, 10]], w: 1 },
          { kind: 'poly', pts: [[11, 10], [15, 9], [14, 13]] },
          { kind: 'line', pts: [[20, 11], [25, 17]], w: 1, tone: 2 },
          { kind: 'poly', pts: [[22, 16], [26, 18], [27, 14]], tone: 2 },
          { kind: 'line', pts: [[23, 22], [10, 22]], w: 1 },
          { kind: 'poly', pts: [[11, 20], [8, 22], [11, 24]] },
          { kind: 'rect', x: 3, y: 16, w: 8, h: 7 },
          { kind: 'rect', x: 12, y: 5, w: 10, h: 9, tone: 2 },
          { kind: 'rect', x: 23, y: 17, w: 7, h: 7 },
        ]
      : recipe.template === 'overlapping_blocks'
      ? [{ kind: 'rect', x: 5, y: 10, w: 14, h: 12 },
         { kind: 'rect', x: 14, y: 7, w: 13, h: 12, tone: 2 },
         { kind: 'line', pts: [[14, 10], [19, 10], [19, 19]], w: 1 }]
      : recipe.template === 'sun'
        ? [{ kind: 'disc', cx: 16, cy: 13, r: 9 },
           { kind: 'line', pts: [[16, 1], [16, 3]], w: 2 },
           { kind: 'line', pts: [[2, 13], [4, 13]], w: 2 },
           { kind: 'line', pts: [[28, 13], [30, 13]], w: 2 }]
        : [{ kind: 'rect', x: 5, y: 7, w: 22, h: 15 },
           { kind: 'line', pts: [[16, 8], [16, 21]], w: 1, tone: 2 }];
    register({ key, diagram: recipe.template, ramp: 'clothSky', ramp2: 'clothAmber', body,
      rig: { eyes: recipe.template === 'process_states' ? [{ x: 15, y: 8 }, { x: 19, y: 8 }] : [{ x: 11, y: 13 }, { x: 21, y: 13 }],
        mouth: recipe.template === 'process_states' ? { x: 17, y: 11, w: 1 } : { x: 15, y: 17, w: 2 },
        arms: [{ from: [5, 16], to: [2, 19] }, { from: [27, 16], to: [30, 19] }],
        legs: [{ from: [11, 23], to: [10, 28] }, { from: [22, 23], to: [23, 28] }] } });
    recipePalettes[key] = { a: recipe.primary, m: shade(recipe.primary, .8), d: shade(recipe.primary, .6),
      e: recipe.secondary, f: shade(recipe.secondary, .8), g: shade(recipe.secondary, .6) };
    SPRITE_COLORS[key] = { ...SPRITE_COLORS[key], ...recipePalettes[key] };
  }
  return key;
}

export function verdictSprite(key: string, pose: VerdictPose): string {
  key = resolveRecipeSprite(key);
  const human = HUMANS[key];
  const name = `${key}~${pose}`;
  if (SPRITES[name]) return name;

  if (!human) {
    const diagram = DEFS[key];
    if (!diagram) return key;
    const hands: Record<VerdictPose, [Pt, Pt]> = {
      think: [[9, 14], [29, 18]], point: [[3, 18], [28, 5]],
      realize: [[3, 8], [28, 8]], cheer: [[3, 3], [28, 3]], nod: [[6, 16], [27, 12]],
    };
    const arms = diagram.rig.arms?.map((arm, index) => ({ ...arm, to: hands[pose][index] }));
    const built = buildDiagramSprite({ ...diagram, rig: { ...diagram.rig, arms } }, 'S', pose === 'think' || pose === 'cheer' ? 'squint' : 'normal');
    SPRITES[name] = built.rows;
    SPRITE_COLORS[name] = { ...built.colors, ...recipePalettes[key] };
    return name;
  }

  const poses = {
    think: { hands: [[45, 69], [86, 88]], face: 'thinking' },
    point: { hands: [[39, 91], [104, 53]], face: 'bright' },
    realize: { hands: [[25, 63], [103, 60]], face: 'bright' },
    cheer: { hands: [[24, 48], [104, 47]], face: 'smiling' },
    nod: { hands: [[39, 86], [89, 70]], face: 'gentle' },
  } as const;
  const chosen = poses[pose];
  const def: HumanCharacterDef = {
    ...human,
    build: (p) => human.build(p).filter((part) =>
      !['map', 'mapMark', 'lantern', 'lanternHandle', 'glow', 'book', 'pages', 'bookmark'].includes(part.name)),
  };
  const [left, right] = chosen.hands;
  const built = buildHumanSprite(def, 'S', {
    hands: [[...left], [...right]],
    face: chosen.face,
  });
  SPRITES[name] = built.rows;
  SPRITE_COLORS[name] = built.colors;
  return name;
}

/** Saved recipe names let every existing sprite consumer use the same artwork. */
export function resolveRecipeSprite(key: string): string {
  if (!key.startsWith('recipe:')) return key;
  try {
    const recipe = JSON.parse(key.slice(7)) as CharacterRecipe;
    if (!['adult_person', 'overlapping_blocks', 'sun', 'book', 'process_states'].includes(recipe.template)
      || !/^#[0-9a-fA-F]{6}$/.test(recipe.primary) || !/^#[0-9a-fA-F]{6}$/.test(recipe.secondary)
      || !['neutral', 'weathered'].includes(recipe.face)) return 'd_node';
    return registerCharacterRecipe(recipe);
  } catch {
    return 'd_node';
  }
}

/** 예전 이름(저장 데이터 호환): person → 독자, hatman → 등대지기 */
const ALIASES: Record<string, string> = { person: 'h_reader', hatman: 'h_keeper' };
for (const [old, key] of Object.entries(ALIASES))
  {
    SPRITES[old] = SPRITES[key];
    SPRITE_COLORS[old] = SPRITE_COLORS[key];
  }

/* ───── 드래그 중 바둥거림 프레임 ───── */
/** 바둥 프레임 수. 팔다리 끝이 위 → 오른쪽 → 아래 → 왼쪽 순으로 돈다 */
export const FLAIL_FRAMES = 4;
const DIRS: Array<[number, number]> = [[0, -1], [1, 0], [0, 1], [-1, 0]];
/** 팔다리별 시작 방향(위상). 왼팔·오른팔·왼다리·오른다리가 서로 다른 방향으로 흔들림 */
const PHASE = { arms: [0, 2], legs: [1, 3] };
const AMP = { arms: 3, legs: 2 }; // S 좌표 정수(소수면 부츠·장갑 래스터가 빠짐)
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * 개념 도식 캐릭터의 바둥 프레임 이름('<key>~flail<n>')을 돌려줌. 처음 요청 때 생성·등록.
 * 팔다리 끝(손·발) 위치만 S 좌표 기준으로 상하좌우 이동, 표정은 찡그림(>_<).
 * 도식 캐릭터가 아니면 원래 이름을 돌려줌(CSS 흔들기만 적용).
 */
export function flailSprite(key: string, frame: number): string {
  const f = ((frame % FLAIL_FRAMES) + FLAIL_FRAMES) % FLAIL_FRAMES;
  const human = HUMANS[ALIASES[key] ?? key];
  if (human) return flailHuman(human, f);
  const def = DEFS[key];
  if (!def) return key;
  const name = `${key}~flail${f}`;
  if (SPRITES[name]) return name;
  const move = (part: 'arms' | 'legs') =>
    def.rig[part]?.map((l, i) => {
      const [dx, dy] = DIRS[(f + PHASE[part][i % 2] + Math.floor(i / 2)) % 4];
      // 발은 캔버스 아래로 나가지 않게, 손은 가장자리 1칸 안쪽까지
      const to: [number, number] = [clamp(l.to[0] + dx * AMP[part], 1, 30), clamp(l.to[1] + dy * AMP[part], 1, part === 'legs' ? 29 : 30)];
      return { from: l.from, to };
    });
  const posed: Def = { ...def, key: name, rig: { ...def.rig, arms: move('arms'), legs: move('legs') } };
  const built = buildDiagramSprite(posed, 'S', 'squint');
  SPRITES[name] = built.rows;
  SPRITE_COLORS[name] = built.colors;
  return name;
}

/** 인간형 바둥 프레임: 손 2칸·발 1.25칸(32 격자, 정의 좌표로 8·5)씩 상하좌우로 이동, 표정 >_< */
const HUMAN_AMP = { arms: 8, legs: 5 };
function flailHuman(def: HumanCharacterDef, f: number): string {
  const name = `${def.key}~flail${f}`;
  if (SPRITES[name]) return name;
  const move = (pts: [Pt, Pt], part: 'arms' | 'legs'): [Pt, Pt] =>
    pts.map((p, i) => {
      const [dx, dy] = DIRS[(f + PHASE[part][i]) % 4];
      // 발은 위로만 들고 아래로는 내려가지 않음(캔버스 밖 방지)
      return [p[0] + dx * HUMAN_AMP[part], Math.min(part === 'legs' ? p[1] : 120, p[1] + dy * HUMAN_AMP[part])] as Pt;
    }) as [Pt, Pt];
  const pose = { hands: move(def.hands, 'arms'), feet: move(def.feet, 'legs'), face: 'squint' as const };
  const built = buildHumanSprite(def, 'S', pose);
  SPRITES[name] = built.rows;
  SPRITE_COLORS[name] = built.colors;
  return name;
}

/* ───── 성 모드: 지식의 성·적(망각닌자·기억도둑), 32x32 ───── */
for (const [key, built] of Object.entries(CASTLE_SPRITES)) {
  SPRITES[key] = built.rows;
  SPRITE_COLORS[key] = built.colors;
}
