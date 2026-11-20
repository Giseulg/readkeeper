/**
 * Mock 전용 in-memory DB. 변경 내용은 localStorage에 저장해 새로고침 후에도 유지함.
 * 실제 백엔드 연결 후에는 사용하지 않음.
 */
import type { AuthorContent, Book, CastleState, VillageLayout, BookContent, Character, GraphEdge, GraphNode, Memo, QuizQuestion, QuizSession, User, UserSettings } from '@/domain/types'
import * as seed from './seed'

const KEY = 'rf-mock-db-v10'

interface DB {
  user: User
  settings: UserSettings
  books: Book[]
  contents: BookContent[]
  nodes: GraphNode[]
  edges: GraphEdge[]
  memos: Memo[]
  questions: QuizQuestion[]
  sessions: QuizSession[]
  characters: Character[]
  /** Explore 저자 등록 콘텐츠(구매 여부 포함) */
  store: AuthorContent[]
  /** 성 모드 상태. 처음 접근할 때 만듦(저장 키 버전 유지) */
  castle?: CastleState
  /** 마을 꾸미기 소품 배치·해금. 처음 접근할 때 만듦(저장 키 버전 유지) */
  village?: VillageLayout
}

function fresh(): DB {
  return structuredClone({
    user: seed.seedUser,
    settings: seed.seedSettings,
    books: seed.seedBooks,
    contents: seed.seedContents,
    nodes: seed.seedNodes,
    edges: seed.seedEdges,
    memos: seed.seedMemos,
    questions: seed.seedQuestions,
    sessions: [],
    characters: seed.seedCharacters,
    store: seed.seedStore,
  })
}

function load(): DB {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as DB
  } catch {
    /* 저장소 접근 불가 시 시드 사용 */
  }
  return fresh()
}

export const db: DB = load()

export function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(db))
  } catch {
    /* ignore */
  }
}

export function resetDb() {
  Object.assign(db, fresh())
  persist()
}

export const uid = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 9)}`
