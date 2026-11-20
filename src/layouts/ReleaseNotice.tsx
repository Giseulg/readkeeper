import { useEffect, useState } from 'react'

export function ReleaseNotice() {
  const release = import.meta.env.VITE_RELEASE_SHA
  const [updated, setUpdated] = useState(false)
  useEffect(() => {
    if (!release) return
    let active = true
    async function check() {
      if (document.hidden) return
      try {
        const response = await fetch('/release.json', { cache: 'no-store' })
        const info = await response.json()
        if (active && response.ok && /^[0-9a-f]{40}$/.test(info.release)) setUpdated(info.release !== release)
      } catch { /* Offline readers keep their current page. */ }
    }
    void check()
    window.addEventListener('focus', check)
    const timer = window.setInterval(check, 60000)
    return () => { active = false; clearInterval(timer); window.removeEventListener('focus', check) }
  }, [release])
  if (!updated) return null
  return <aside role="status" className="release-notice">
    새 버전이 있어요. 작성 중인 메모를 저장한 뒤 열어 주세요.
    <button className="btn" onClick={() => window.location.reload()}>새 버전 열기</button>
  </aside>
}
