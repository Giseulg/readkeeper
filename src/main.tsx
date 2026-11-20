import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ReaderApp } from './layouts/ReaderApp'
import { ReaderSession } from './layouts/ReaderSession'
import { ReleaseNotice } from './layouts/ReleaseNotice'
import { BookIntro } from './components/BookIntro'
import './styles/global.css'
// 태블릿 규칙은 모바일 규칙 뒤에 와야 덮어씀
import './styles/tablet.css'

/** 개발·데모 빌드에서만 MSW를 사용할 수 있다. */
async function enableMocking() {
  if (import.meta.env.VITE_USE_MOCK === 'false') {
    try {
      if (!('serviceWorker' in navigator)) return
      const registrations = await navigator.serviceWorker.getRegistrations()
      await Promise.all(registrations.filter(r => {
        const worker = r.active ?? r.waiting ?? r.installing
        return worker && new URL(worker.scriptURL).pathname === '/mockServiceWorker.js'
      }).map(r => r.unregister()))
    } catch { /* Storage access can be disabled in a private window. */ }
    return
  }
  const { worker } = await import('./mocks/browser')
  await worker.start({ onUnhandledFrame: 'bypass', quiet: import.meta.env.PROD })
}

enableMocking().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ReleaseNotice />
      <ReaderSession>{id => <ReaderApp key={id} />}</ReaderSession>
      {/* 첫 진입 인트로: 화면은 뒤에서 먼저 그려지고 인트로가 끝나면 드러남 */}
      <BookIntro />
    </StrictMode>,
  )
})
