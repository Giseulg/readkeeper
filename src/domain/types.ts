/**
 * 도메인 타입. 화면·hooks·api 어댑터가 공유하는 기준 모델.
 * 백엔드 응답 형태(DTO)가 달라져도 이 타입은 유지하고, 변환은 src/api 어댑터에서 처리함.
 */

export type ID = string
/** ISO 8601 문자열 */
export type ISODate = string

/* ───────── 공통 ───────── */

export type AnalysisGenre = 'novel' | 'poetry' | 'cs_book' | 'paper'
export type Category = AnalysisGenre | 'major' | 'general'

/** 본문 위치. 챕터 index + 문단 index */
export interface ReadingLocation {
  chapter: number
  paragraph: number
}

/* ───────── User ───────── */

export interface User {
  id: ID
  nickname: string
  interests: Category[]
  onboarded: boolean
  createdAt: ISODate
}

export interface UserStats {
  bookCount: number
  memoCount: number
  quizCount: number
  characterCount: number
}

/** 읽기 방식: 세로 스크롤 / 쪽 단위로 눌러 넘기기 */
export type ReadingMode = 'scroll' | 'page'

export interface ReaderSettings {
  fontSize: number
  lineHeight: number
  theme: 'parchment' | 'light' | 'dark'
  mode: ReadingMode
}

export interface LearningSettings {
  gameSound: boolean
  gameMusic: boolean
  /** 재개 시 회상 질문 제안(2.5a) */
  recallPrompt: boolean
  recallCount: 1 | 2
}

export type LibraryView = 'list' | 'shelf'

export interface LibrarySettings {
  /** 서재 보기 방식: 목록형 / 책장형(2.0 목업) */
  view: LibraryView
}

/** 화면 모드: 자동(화면 폭 기준) / 모바일 고정 / 태블릿 고정 */
export type LayoutMode = 'auto' | 'mobile' | 'tablet'

export interface DisplaySettings {
  layout: LayoutMode
}

export interface UserSettings {
  reader: ReaderSettings
  learning: LearningSettings
  library: LibrarySettings
  display: DisplaySettings
}

/** PATCH 본문: 그룹 단위 부분 갱신 */
export type UserSettingsPatch = { [K in keyof UserSettings]?: Partial<UserSettings[K]> }

/* ───────── Book ───────── */

export type BookFileType = 'txt' | 'pdf'
export type BookStatus = 'processing' | 'ready' | 'failed'

export interface BookProgress {
  /** 마지막으로 보던 화면 위치 */
  current: ReadingLocation
  /** "여기까지 읽음"으로 확정한 범위의 끝. 스포 방지 기준 */
  confirmed: ReadingLocation
  /** 확정 범위 기준 진도 0~100 */
  percent: number
  lastReadAt?: ISODate
}

export interface Book {
  graphAvailable?: boolean
  caseAvailable?: boolean
  characterDesignAvailable?: boolean
  completionRewards?: Collectible[]
  id: ID
  title: string
  author?: string
  category: Category
  fileType: BookFileType
  status: BookStatus
  /** 표지 대신 쓰는 책등 색 (토큰 이름) */
  coverColor: 'green' | 'amber' | 'berry' | 'wood' | 'sky'
  /** Reader 표지 가운데 그릴 대표 캐릭터 스프라이트. 없으면 분류 아이콘 */
  coverSprite?: SpriteKey
  chapterCount: number
  progress: BookProgress
  createdAt: ISODate
  /** 구매로 추가된 책이면 Explore 콘텐츠·주문 정보. 직접 업로드한 책은 undefined */
  purchase?: { contentId: ID; orderId: ID; purchasedAt: ISODate }
}

export interface Chapter {
  title: string
  paragraphs: string[]
  layout?: ({ group: number; separator: string; kind: 'text' | 'code' } | null)[]
}

export interface BookContent {
  bookId: ID
  chapters: Chapter[]
}

export interface CreateBookInput {
  title: string
  category: Category
  file: File
  activities?: File
}

/* ───────── Graph (관계도) ───────── */

export type GraphNodeKind = 'person' | 'concept' | 'object' | 'theme' | 'event'

export interface GraphNode {
  id: ID
  bookId: ID
  kind: GraphNodeKind
  name: string
  originalName?: string
  /** 인물: 나이·역할·행적 / 개념: 정의·부연·활용 사례 */
  attributes: Record<string, string>
  firstSeen: ReadingLocation
  sprite?: SpriteKey
  /** 캐릭터 팝업용 한 줄 설명(한글 20자 이내, 공백 포함). 캐릭터 노드에만 씀 */
  summary?: string
}

export interface Quote {
  text: string
  location: ReadingLocation
}

export interface GraphEdge {
  id: ID
  bookId: ID
  source: ID
  target: ID
  relation: string
  explanation?: string
  quotes: Quote[]
  firstSeen: ReadingLocation
}

/** 확정 범위(confirmed) 이내만 담긴 그래프 */
export interface BookGraph {
  bookId: ID
  until: ReadingLocation
  nodes: GraphNode[]
  edges: GraphEdge[]
  analysisStatus?: 'queued' | 'running' | 'ready' | 'failed' | null
  researchMapPending?: boolean
  analysis?: { category: AnalysisGenre; sections: AnalysisSection[] }
}

interface AnalysisEntry {
  index: number
  evidence: Quote[]
}

export interface AnalysisSection {
  id: number
  wholeWork?: boolean
  summary: (AnalysisEntry & { title: string; description: string })[]
  personas: (AnalysisEntry & { id: ID; name: string; sprite: SpriteKey; personality: string; voice: string; motivation: string; emblem: string; appearance: string })[]
  imagery?: (AnalysisEntry & { term: string; literal_meaning: string; contextual_meaning: string; imagery: string; emotion: string; technique?: string; reading_point?: string; caution?: string })[]
  flow?: (AnalysisEntry & {
    stage: 'prerequisite' | 'concept' | 'operation' | 'tradeoff'
    title: string
    explanation: string
    analogy: string
    purpose?: string
    operation?: string
    distinction?: string
    analogy_limit?: string
    example?: string
    prior_stage_indexes?: number[]
    connection_reason?: string
  })[]
  logic?: (AnalysisEntry & {
    stage: 'problem' | 'limitation' | 'method' | 'evaluation' | 'result' | 'open_question'
    title: string
    explanation: string
    prior_stage_indexes: number[]
    connections?: { prior_index: number; reason: string; evidence: Quote[] }[]
    comparisons?: {
      reference: string
      metric: string
      first_label: string
      first_value: string
      second_label: string
      second_value: string
      interpretation: string
      evidence: Quote[]
    }[]
  })[]
}

/* ───────── Memo / Hypothesis ───────── */

export type MemoType = 'memo' | 'hypothesis'

export interface HypothesisRevision {
  outcome?: 'changed' | 'same' | 'unsure'
  content: string
  evidenceFor: Quote[]
  evidenceAgainst: Quote[]
  createdAt: ISODate
}

export interface Memo {
  id: ID
  bookId: ID
  type: MemoType
  content: string
  /** 선택한 문장 */
  quote: Quote
  createdAt: ISODate
  /** type === 'hypothesis' 일 때만 */
  hypothesis?: {
    evidence: string
    /** 확신도 1~5 */
    confidence: 1 | 2 | 3 | 4 | 5
    /** 관련 구간 위치. 확정 범위가 이 위치를 넘으면 재검토(2.5c) 대상 */
    reviewAt?: ReadingLocation
    reviewStatus: 'waiting' | 'due' | 'revised'
    /** 재검토 대상이 되었을 때 서버가 채우는 관련 근거 (확정 범위 이내) */
    reviewEvidence?: { for: Quote[]; against: Quote[] }
    revisions: HypothesisRevision[]
  }
}

export type CreateMemoInput = Pick<Memo, 'bookId' | 'type' | 'content' | 'quote'> & {
  hypothesis?: Pick<NonNullable<Memo['hypothesis']>, 'evidence' | 'confidence' | 'reviewAt'>
}

/* ───────── Quiz (이전 내용 점검) ───────── */

export type QuizKind = 'recall' | 'relation' | 'application'

export interface QuizQuestion {
  id: ID
  bookId: ID
  kind: QuizKind
  prompt: string
  choices?: string[]
  answer?: string
  explanation?: string
  evidence?: Quote
  relatedNodeIds: ID[]
}

export type QuizResult = 'correct' | 'partial' | 'wrong' | 'forgot' | 'skipped'

export interface QuizAttempt {
  questionId: ID
  response: string
  result: QuizResult
  /** 채점 코멘트 (예: "핵심은 맞았지만 비용 측면이 빠짐") */
  feedback?: string
  /** 유사도 채점 상세. 기억 안 남/건너뛰기는 없음 */
  grading?: QuizGrading
}

/**
 * 정답 후보와의 유사도 채점 결과.
 * mock: 문자 n-gram 코사인 / 서버: 문장 임베딩 코사인 + 경계 구간 LLM 확인
 */
export interface QuizGrading {
  method: 'char-ngram' | 'embedding' | 'embedding+llm'
  /** 정답 후보들과의 유사도 최댓값 (0~1) */
  score: number
  /** score를 낸 정답 후보 */
  matchedCandidate: string
  /** 판정 기준선(correct·partial) 근처라 추가 확인이 필요한지 */
  needsReview: boolean
  thresholds: { correct: number; partial: number }
  /** needsReview 구간을 LLM 등이 다시 판정했는지 (서버 전용) */
  reviewed?: boolean
}

/** 답변 제출. giveUp 이 있으면 response 없이 기억 안 남/건너뛰기로 기록 */
export interface QuizAnswerInput {
  questionId: ID
  response: string
  giveUp?: 'forgot' | 'skipped'
}

export interface QuizSession {
  id: ID
  bookId: ID
  /** 'recall' = 재개 시 제안(2.5a), 'check' = 액션 시트 진입(2.7) */
  mode: 'recall' | 'check'
  questions: QuizQuestion[]
  attempts: QuizAttempt[]
  confusedNodeIds: ID[]
  startedAt: ISODate
  finishedAt?: ISODate
}

export interface Collectible {
  id: ID
  name: string
  sprite: SpriteKey
  bookId: ID
  reason: string
  earnedAt: ISODate | null
  /** 수집 도감용: 관계도 노드에서 나온 캐릭터면 노드 id */
  nodeId?: ID
  /** 해금된 경우 내 캐릭터 id(캐릭터 정보 팝업 연결) */
  characterId?: ID
  /** 인물·개념 구분 */
  kind?: GraphNodeKind
}

export type CaseSlot = 'situation' | 'reason' | 'action'
export type CaseSolution = Record<CaseSlot, string>

export interface ReadingCase {
  mode?: 'poetry_exam'
  verdictMood?: 'gentle'
  title?: string
  prompt: string
  cast: Array<Pick<Collectible, 'id' | 'name' | 'sprite'>>
  cards: Array<{ id: string; text: string }>
  slots: Array<{ id: CaseSlot; label: string; choiceIds?: string[] }>
  evidence: Quote[]
  slotEvidence?: Partial<Record<CaseSlot, Quote[]>>
}

export type CaseResult =
  | { solved: false; hint: string; checks: Record<CaseSlot, boolean> }
  | { solved: true; explanation: string; score: number; maxScore: number; slotExplanations?: Partial<Record<CaseSlot, string>>; rewards: Array<Collectible & { newlyEarned: boolean }> }

/* ───────── Character ───────── */

/** src/components/pixel/sprites.ts 의 스프라이트 이름 */
export type SpriteKey = string

export interface Character {
  id: ID
  name: string
  sprite: SpriteKey
  /** 출처 책 */
  bookId: ID
  bookTitle: string
  /** 관계도 노드에서 나온 캐릭터인 경우 */
  nodeId?: ID
  acquiredReason: string
  acquiredAt: ISODate
  isPublic: boolean
  ownerId: ID
  ownerNickname?: string
  /** Village 배치 좌표(타일 단위). 미배치면 undefined */
  villagePosition?: { x: number; y: number }
}

/* ───────── Explore (저자 등록 콘텐츠 스토어) ─────────
 * 저작권 정책(docs/explore-content-policy.md): Explore에는 책의 저자(권리자)가 직접 등록하고
 * 권리 확인을 마친 콘텐츠만 노출하며, 구매를 통해서만 받을 수 있음. 이용자 업로드 콘텐츠는 노출·공유하지 않음.
 */

export interface AuthorContent {
  id: ID
  title: string
  /** 등록한 저자(권리자) 이름 */
  authorName: string
  /** 저자 본인 등록·권리 확인 완료 여부. 서버는 true인 항목만 반환함 */
  authorVerified: boolean
  category: Category
  /** 저자가 쓴 소개 */
  description: string
  chapterCount: number
  /** 판매가(원) */
  price: number
  /** 저자가 지정한 대표 캐릭터 */
  character: { name: string; sprite: SpriteKey }
  coverColor: Book['coverColor']
  /** 이용 범위 안내(구매자 본인 서재 열람 한정 등) */
  license: string
  registeredAt: ISODate
  /** 내가 구매했는지 */
  purchased: boolean
  /** 구매 후 서재에 있는 책 id. 서재에서 삭제했으면 undefined */
  libraryBookId?: ID
}

export type PaymentMethod = 'card' | 'easy' | 'transfer'

export interface PurchaseInput {
  method: PaymentMethod
  /** 이용 범위 동의 */
  agreed: true
}

export interface PurchaseResult {
  orderId: ID
  content: AuthorContent
  book: Book
}

/* ───────── Castle (성 모드: 지식의 성 디펜스) ─────────
 * 마지막 학습 시각부터 망각곡선 시점(10분·1시간·1일·1주·1달)마다 습격이 옴.
 * 서버(mock)가 습격 판정·점수 적립을 맡고, 화면은 결과만 그림. 규칙 수치는 domain/castle.ts.
 */

export type EnemyKind = 'ninja' | 'thief'

/** 수호 캐릭터 등급(해금 단계). 등급이 오르면 방어력·최대 HP 증가 */
export type DefenderLevel = 1 | 2 | 3

export interface DefenderStat {
  level: DefenderLevel
  hp: number
}

export interface RaidReport {
  id: ID
  at: ISODate
  /** 망각곡선 시점 인덱스(0=10분 … 4=1달) */
  wave: number
  enemies: Array<{ kind: EnemyKind; count: number }>
  /** 방어 전 원래 피해 */
  rawDamage: number
  /** 수호 캐릭터가 막은 피해 */
  blocked: number
  castleHpBefore: number
  castleHpAfter: number
  defenders: Array<{ charId: ID; damage: number; hpAfter: number }>
  seen: boolean
}

export interface PointEntry {
  at: ISODate
  amount: number
  reason: string
}

export interface CastleState {
  hp: number
  maxHp: number
  /** 지식 포인트(독서·퀴즈·방문으로 적립, 회복·해금에 사용) */
  points: number
  /** 성 앞 바둑판 칸(길이 25, 행 우선). 캐릭터 id 또는 빈 칸 null */
  slots: Array<ID | null>
  /** 캐릭터별 등급·HP. 자리에서 빼도 유지 */
  defenders: Record<ID, DefenderStat>
  /** 망각곡선 기준 시각(마지막 학습) */
  lastStudyAt: ISODate
  /** lastStudyAt 이후 이미 지나간 습격 수 */
  wavesDone: number
  /** 다음 습격(5회 모두 지났으면 없음) */
  nextRaid?: { at: ISODate; wave: number; enemies: RaidReport['enemies'] }
  /** 최근 습격 기록(최신순) */
  reports: RaidReport[]
  /** 최근 포인트 내역(최신순) */
  pointLog: PointEntry[]
  /** 마지막 방문 보너스를 받은 날(YYYY-MM-DD) */
  lastVisitDay?: string
}

export type CastleAction =
  | { type: 'repair' }
  | { type: 'heal'; charId: ID }
  | { type: 'upgrade'; charId: ID }
  | { type: 'slot'; index: number; charId: ID | null }
  | { type: 'ack' }

/* ───────── Village decor (마을 꾸미기) ───────── */

/** 마을 장면 소품 종류. 목록·해금 비용은 domain/decor.ts DECOR_CATALOG */
export type DecorKind = 'house' | 'tree' | 'bush' | 'flowerv' | 'flowery' | 'sign' | 'fence' | 'lamp' | 'bench' | 'mailbox' | 'rock' | 'well'

/** 장면에 놓인 소품 1개. x·y = 장면(.field) 기준 % 좌표(발 위치) */
export interface DecorItem {
  id: ID
  kind: DecorKind
  x: number
  y: number
}

export interface VillageLayout {
  items: DecorItem[]
  /** 배치할 수 있는 종류(기본 소품 + 지식 포인트로 해금한 소품) */
  unlocked: DecorKind[]
}
