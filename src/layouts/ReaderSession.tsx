import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { auth, rememberToken } from '@/api/auth'
import { Button, Panel } from '@/components/ui'

const googleLoginEnabled = import.meta.env.VITE_GOOGLE_LOGIN_ENABLED === 'true'

function clearFailedLoginCallback() {
  const url = new URL(window.location.href)

  const fragment = new URLSearchParams(url.hash.slice(1))
  const callbackParams = ['code', 'error', 'error_code', 'error_description']
  if (!callbackParams.some((name) => url.searchParams.has(name) || fragment.has(name))) return false

  // Supabase removes the code after a successful exchange. Clear a failed callback
  // so a reload cannot replay it or keep the error details in the address bar.
  // Supabase가 허용 목록에 없는 주소 대신 Site URL(/)로 돌려보낸 경우도 같은 안내를 보여 줌
  window.history.replaceState(window.history.state, '', url.pathname === '/login' ? url.pathname : '/login')
  return true
}

function LoginForm({ client, callbackFailed }: { client: NonNullable<typeof auth>; callbackFailed: boolean }) {
  const [email, setEmail] = useState('')
  const [pending, setPending] = useState<'email' | 'google' | null>(null)
  const [message, setMessage] = useState(callbackFailed
    ? '로그인을 완료하지 못했어요. 등록한 계정으로, 로그인을 시작한 주소에서 다시 시도해 주세요.'
    : '')
  const redirectTo = window.location.origin + '/login'

  async function signInWithGoogle() {
    if (pending) return
    setPending('google')
    setMessage('')
    try {
      const { error } = await client.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, queryParams: { prompt: 'select_account' } },
      })
      if (error) throw error
    } catch {
      setMessage('Google 로그인을 시작하지 못했어요. 잠시 후 다시 시도해 주세요.')
    } finally {
      setPending(null)
    }
  }

  async function send(event: FormEvent) {
    event.preventDefault()
    if (pending) return
    setPending('email')
    setMessage('')
    try {
      const { error } = await client.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: false, emailRedirectTo: redirectTo },
      })
      setMessage(error ? '메일을 보내지 못했어요. 등록한 이메일을 확인해 주세요.'
        : '이 브라우저에서 이메일의 로그인 링크를 열어 주세요.')
    } catch {
      setMessage('연결을 확인하고 다시 시도해 주세요.')
    } finally {
      setPending(null)
    }
  }

  return <main className="app-content col" style={{ justifyContent: 'center' }}>
    <Panel tone="white" title="로그인" stack gap={12}>
      {googleLoginEnabled && (
        <Button full disabled={pending !== null} onClick={() => void signInWithGoogle()}>
          {pending === 'google' ? 'Google로 이동 중…' : 'Google로 로그인'}
        </Button>
      )}
      <form className="col" onSubmit={send}>
        <label>등록한 이메일 <input type="email" autoComplete="email" required
          value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <Button type="submit" variant={googleLoginEnabled ? 'ghost' : 'primary'} disabled={pending !== null}>
          {pending === 'email' ? '로그인 링크 보내는 중…' : '로그인 링크 받기'}
        </Button>
      </form>
      {message && <p role="status">{message}</p>}
    </Panel>
  </main>
}

export function ReaderSession({ children }: { children: (id: string) => ReactNode }) {
  const [reader, setReader] = useState<string | null | undefined>(auth ? undefined : 'demo')
  const [callbackFailed, setCallbackFailed] = useState(false)
  useEffect(() => {
    if (!auth) return
    const { data } = auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') setCallbackFailed(clearFailedLoginCallback() && !session)
      rememberToken(session?.access_token)
      setReader(session?.user.id ?? null)
    })
    return () => data.subscription.unsubscribe()
  }, [])
  if (reader === undefined) return <p role="status">로그인 확인 중…</p>
  if (reader === null) return auth && <LoginForm client={auth} callbackFailed={callbackFailed} />
  return children(reader)
}
