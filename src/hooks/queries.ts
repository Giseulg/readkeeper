/**
 * 서버 상태 hooks. 화면은 이 hooks 또는 `api`만 사용함.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { MOCK_MODE } from '@/appMode'
import { api } from '@/api'
import type { CastleAction, CastleState, Category, Character, CreateBookInput, CreateMemoInput, HypothesisRevision, ID, MemoType, PurchaseInput, QuizAnswerInput, QuizSession, ReadingLocation, DecorItem, DecorKind, VillageLayout, UserSettings, UserSettingsPatch } from '@/domain/types'
import { mergeSettings } from '@/domain/settings'

export const qk = {
  me: ['me'] as const,
  stats: ['me', 'stats'] as const,
  settings: ['me', 'settings'] as const,
  books: ['books'] as const,
  book: (id: ID) => ['books', id] as const,
  content: (id: ID) => ['books', id, 'content'] as const,
  graph: (id: ID) => ['books', id, 'graph'] as const,
  memos: (id: ID, type?: MemoType) => ['books', id, 'memos', type ?? 'all'] as const,
  memo: (id: ID, memoId: ID) => ['books', id, 'memos', 'detail', memoId] as const,
  dueReviews: (id: ID) => ['books', id, 'memos', 'due'] as const,
  myCharacters: ['me', 'characters'] as const,
  castle: ['me', 'castle'] as const,
  decor: ['me', 'village', 'decor'] as const,
  explore: ['explore'] as const,
  exploreDetail: (id: ID) => ['explore', id] as const,
}

/* user */
export const useMe = () => useQuery({ queryKey: qk.me, queryFn: api.users.me })
export const useStats = () => useQuery({ queryKey: qk.stats, queryFn: api.users.stats })
export const useSettings = () => useQuery({ queryKey: qk.settings, queryFn: api.users.settings })

export function useCompleteOnboarding() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ nickname, interests }: { nickname: string; interests: Category[] }) =>
      api.users.completeOnboarding(nickname, interests),
    onSuccess: (user) => qc.setQueryData(qk.me, user),
  })
}

export function useUpdateSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (patch: UserSettingsPatch) => api.users.updateSettings(patch),
    onMutate: async (patch) => {
      const prev = qc.getQueryData<UserSettings>(qk.settings)
      if (prev) qc.setQueryData(qk.settings, mergeSettings(prev, patch))
      return { prev }
    },
    onError: (_e, _p, ctx) => ctx?.prev && qc.setQueryData(qk.settings, ctx.prev),
    onSuccess: (s) => qc.setQueryData(qk.settings, s),
  })
}

/* books */
export const useBooks = () => useQuery({ queryKey: qk.books, queryFn: api.books.list })
export const useBook = (id: ID) => useQuery({ queryKey: qk.book(id), queryFn: () => api.books.get(id) })
export const useBookContent = (id: ID) =>
  useQuery({ queryKey: qk.content(id), queryFn: () => api.books.content(id), staleTime: Infinity })

export function useCreateBook() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateBookInput) => api.books.create(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.books })
      qc.invalidateQueries({ queryKey: qk.stats })
    },
  })
}

export function useDeleteBook() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: ID) => api.books.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.books })
      qc.invalidateQueries({ queryKey: qk.stats })
      // 구매한 책을 지우면 Explore 상세의 "서재에서 읽기" 상태가 바뀜
      qc.invalidateQueries({ queryKey: qk.explore })
    },
  })
}

export function useConfirmRead(bookId: ID) {
  const qc = useQueryClient()
  return useMutation({
    scope: { id: `progress-${bookId}` },
    mutationFn: (loc: ReadingLocation) => api.books.confirmRead(bookId, loc),
    onSuccess: (book) => {
      qc.setQueryData(qk.book(bookId), book)
      qc.invalidateQueries({ queryKey: qk.books })
      void qc.invalidateQueries({ queryKey: qk.graph(bookId) })
      qc.invalidateQueries({ queryKey: ['books', bookId, 'memos'] })
      void qc.invalidateQueries({ queryKey: qk.castle }) // 읽음 확정 = 지식 포인트 적립
    },
  })
}

/** 화면 위치 저장 (확정 아님). 캐시만 갱신하고 목록은 다시 받지 않음 */
export function useSaveCurrent(bookId: ID) {
  const qc = useQueryClient()
  return useMutation({
    scope: { id: `progress-${bookId}` },
    mutationFn: (loc: ReadingLocation) => api.books.saveCurrent(bookId, loc),
    onSuccess: (book) => qc.setQueryData(qk.book(bookId), book),
  })
}

export function useRestartReading(bookId: ID) {
  const qc = useQueryClient()
  return useMutation({
    scope: { id: `progress-${bookId}` },
    mutationFn: () => api.books.restartReading(bookId),
    onSuccess: async (book) => {
      await qc.cancelQueries({ queryKey: qk.books })
      qc.removeQueries({ queryKey: qk.graph(bookId) })
      qc.removeQueries({ queryKey: ['books', bookId, 'memos'] })
      qc.setQueryData(qk.book(bookId), book)
      qc.setQueryData<Awaited<ReturnType<typeof api.books.list>>>(qk.books,
        (items) => items?.map((item) => item.id === bookId ? book : item))
      void qc.invalidateQueries({ queryKey: qk.books, exact: true })
    },
  })
}

/* graph */
export const useGraph = (bookId: ID) => useQuery({
  queryKey: qk.graph(bookId),
  queryFn: () => api.graph.get(bookId),
  refetchInterval: ({ state }) => ['queued', 'running'].includes(state.data?.analysisStatus ?? '') ? 3000 : false,
})

/* memos */
export const useMemos = (bookId: ID, type?: MemoType) =>
  useQuery({ queryKey: qk.memos(bookId, type), queryFn: () => api.memos.list(bookId, type) })
export const useMemoDetail = (bookId: ID, memoId: ID) =>
  useQuery({ queryKey: qk.memo(bookId, memoId), queryFn: () => api.memos.get(bookId, memoId) })

export function useCreateMemo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateMemoInput) => api.memos.create(input),
    onSuccess: (m) => {
      void qc.invalidateQueries({ queryKey: ['books', m.bookId, 'memos'] })
      void qc.invalidateQueries({ queryKey: qk.castle })
    },
  })
}

export const useDueReviews = (bookId: ID, enabled = true) =>
  useQuery({ queryKey: qk.dueReviews(bookId), queryFn: () => api.memos.dueReviews(bookId), enabled })

export function useReviseMemo(bookId: ID) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ memoId, revision }: { memoId: ID; revision: Omit<HypothesisRevision, 'createdAt'> }) =>
      api.memos.revise(bookId, memoId, revision),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['books', bookId, 'memos'] }),
  })
}

/* quiz: 세션은 화면 상태로 관리하고 mutation 결과로 갱신 */
export const useStartQuiz = (bookId: ID) =>
  useMutation({ mutationFn: ({ mode, count }: { mode: QuizSession['mode']; count?: number }) => api.quizzes.start(bookId, mode, count) })

export function useAnswerQuiz() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ sessionId, input }: { sessionId: ID; input: QuizAnswerInput }) => api.quizzes.answer(sessionId, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.stats })
      void qc.invalidateQueries({ queryKey: qk.castle })
    },
  })
}

export function useFinishQuiz() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (sessionId: ID) => api.quizzes.finish(sessionId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.stats })
      void qc.invalidateQueries({ queryKey: ['me', 'collectibles'] })
      void qc.invalidateQueries({ queryKey: qk.castle })
    },
  })
}

/* characters */
export const useCollectibles = () => useQuery({ queryKey: ['me', 'collectibles'], queryFn: api.characters.collectibles })
export const useMyCharacters = () => useQuery({ queryKey: qk.myCharacters, queryFn: api.characters.mine })

/** 마을 표시 토글. villagePosition 이 있으면 마을에 표시, undefined 면 숨김. 목록은 즉시 반영 후 실패 시 되돌림 */
export function useSaveVillage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (positions: Array<Pick<Character, 'id' | 'villagePosition'>>) => api.characters.saveVillage(positions),
    onMutate: async (positions) => {
      await qc.cancelQueries({ queryKey: qk.myCharacters })
      const prev = qc.getQueryData<Character[]>(qk.myCharacters)
      qc.setQueryData<Character[]>(qk.myCharacters, (list) =>
        list?.map((c) => {
          const p = positions.find((x) => x.id === c.id)
          return p ? { ...c, villagePosition: p.villagePosition } : c
        }),
      )
      return { prev }
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(qk.myCharacters, ctx.prev),
    onSuccess: (list) => qc.setQueryData(qk.myCharacters, list),
  })
}

/* castle: 성 모드. 습격 판정은 서버가 조회 시점에 함 → 1분마다 다시 조회해 다음 습격을 반영 */
export const useCastle = () =>
  useQuery({ queryKey: qk.castle, queryFn: api.castle.get, refetchInterval: 60_000 })

export function useCastleAction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (a: CastleAction) => api.castle.act(a),
    onSuccess: (s) => qc.setQueryData<CastleState>(qk.castle, s),
  })
}

export function useCastleSkip() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: api.castle.skip, onSuccess: (s) => qc.setQueryData<CastleState>(qk.castle, s) })
}

/* decor: 마을 꾸미기. 배치는 즉시 반영 후 실패 시 되돌림, 해금은 지식 포인트를 쓰므로 성 상태도 다시 조회 */
export const useVillageLayout = () => useQuery({ queryKey: qk.decor, queryFn: api.decor.get })

export function useSaveDecor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (items: DecorItem[]) => api.decor.save(items),
    onMutate: async (items) => {
      await qc.cancelQueries({ queryKey: qk.decor })
      const prev = qc.getQueryData<VillageLayout>(qk.decor)
      if (prev) qc.setQueryData<VillageLayout>(qk.decor, { ...prev, items })
      return { prev }
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(qk.decor, ctx.prev),
    onSuccess: (layout) => qc.setQueryData(qk.decor, layout),
  })
}

export function useUnlockDecor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (kind: DecorKind) => api.decor.unlock(kind),
    onSuccess: (layout) => {
      qc.setQueryData(qk.decor, layout)
      void qc.invalidateQueries({ queryKey: qk.castle })
    },
  })
}

/* explore: 저자 등록 콘텐츠 */
export const useExplore = () => useQuery({ queryKey: qk.explore, queryFn: api.explore.list, enabled: MOCK_MODE })
export const useExploreDetail = (id: ID) =>
  useQuery({ queryKey: qk.exploreDetail(id), queryFn: () => api.explore.get(id) })

/** 구매(mock 결제) 후 서재에 책 추가 */
export function usePurchaseContent(id: ID) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: PurchaseInput) => api.explore.purchase(id, input),
    onSuccess: (res) => {
      qc.setQueryData(qk.exploreDetail(id), res.content)
      qc.invalidateQueries({ queryKey: qk.explore })
      qc.invalidateQueries({ queryKey: qk.books })
      qc.invalidateQueries({ queryKey: qk.stats })
    },
  })
}
