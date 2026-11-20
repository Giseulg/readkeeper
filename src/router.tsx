/**
 * 라우트 표: IA 문서 "라우트 표 (Vite + React SPA)" 기준.
 * 페이지 단위는 라우트, 팝업·시트는 페이지 내부 상태.
 */
import { createBrowserRouter } from 'react-router'
import { MOCK_MODE } from '@/appMode'
import { AccountPage } from '@/pages/AccountPage'
import { FullscreenLayout } from '@/layouts/FullscreenLayout'
import { OnboardingGuard } from '@/layouts/OnboardingGuard'
import { TabLayout } from '@/layouts/TabLayout'
import { CollectionPage } from '@/pages/collection/CollectionPage'
import { ExploreDetailPage } from '@/pages/explore/ExploreDetailPage'
import { ExplorePage } from '@/pages/explore/ExplorePage'
import { GraphPage } from '@/pages/graph/GraphPage'
import { LibraryPage } from '@/pages/library/LibraryPage'
import { CuratedBookPage } from '@/pages/library/CuratedBookPage'
import { MyPage } from '@/pages/my/MyPage'
import { MySettingsPage } from '@/pages/my/MySettingsPage'
import { MyCharactersPage, MyDataPage, MyInterestsPage } from '@/pages/my/MySubPages'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { NoteDetailPage } from '@/pages/notes/NoteDetailPage'
import { NotesPage } from '@/pages/notes/NotesPage'
import { OnboardingPage } from '@/pages/onboarding/OnboardingPage'
import { QuizPage } from '@/pages/quiz/QuizPage'
import { ReaderPage } from '@/pages/reader/ReaderPage'
import { ReadingCompletePage } from '@/pages/reader/ReadingCompletePage'
import { ReadingCasePage } from '@/pages/reader/ReadingCasePage'
import { CharacterDesignPage } from '@/pages/reader/CharacterDesignPage'
import { VillagePage } from '@/pages/village/VillagePage'

export const router = createBrowserRouter([
  {
    element: <FullscreenLayout />,
    children: [
      { path: '/login', element: <AccountPage /> },
      { path: '/onboarding', element: <OnboardingPage /> },
    ],
  },
  {
    element: <OnboardingGuard />,
    children: [
      {
        // 탭바 노출
        element: <TabLayout />,
        children: [
          { path: '/', element: <VillagePage /> },
          { path: '/library', element: <LibraryPage /> },
          { path: '/collection', element: <CollectionPage /> },
          { path: '/library/create', element: <CuratedBookPage /> },
          { path: '/my', element: <MyPage /> },
          { path: '/my/settings', element: <MySettingsPage /> },
          ...(MOCK_MODE ? [
            // 저자 공식 콘텐츠 스토어: 하단 탭에서 빠지고 서재 [추가] 시트에서 진입
            { path: '/explore', element: <ExplorePage /> },
            { path: '/explore/:contentId', element: <ExploreDetailPage /> },
            { path: '/my/characters', element: <MyCharactersPage /> },
            { path: '/my/interests', element: <MyInterestsPage /> },
            { path: '/my/data', element: <MyDataPage /> },
          ] : []),
        ],
      },
      {
        // 탭바 숨김
        path: '/library/:bookId',
        element: <FullscreenLayout />,
        children: [
          { path: 'read', element: <ReaderPage /> },
          { path: 'complete', element: <ReadingCompletePage /> },
          { path: 'character-design', element: <CharacterDesignPage /> },
          { path: 'case', element: <ReadingCasePage /> },
          { path: 'jump', element: <ReadingCasePage /> },
          { path: 'graph', element: <GraphPage /> },
          { path: 'quiz', element: <QuizPage /> },
          { path: 'notes', element: <NotesPage /> },
          { path: 'notes/:noteId', element: <NoteDetailPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
])
