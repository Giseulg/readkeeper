import { Navigate, useNavigate } from 'react-router'
import { Button, Panel } from '@/components/ui'
import { hasSelectedAccount, selectDemoAccount } from '@/domain/demoAccount'
import { useCompleteOnboarding, useMe } from '@/hooks/queries'

import { auth } from '@/api/auth'

export function AccountPage() {
  // 로그인한 뒤에는 로그아웃 전까지 로그인 화면을 거치지 않음
  return auth || hasSelectedAccount() ? <Navigate to="/" replace /> : <DemoAccountPage />
}

function DemoAccountPage() {
  const navigate = useNavigate()
  const me = useMe()
  const complete = useCompleteOnboarding()
  const enter = () => {
    selectDemoAccount()
    navigate('/', { replace: true })
  }
  const selectAccount = () => {
    if (me.data?.onboarded && me.data.nickname === '정재') {
      enter()
    } else {
      complete.mutate({ nickname: '정재', interests: me.data?.interests ?? [] }, { onSuccess: enter })
    }
  }

  return (
    <main className="app-content col" style={{ justifyContent: 'center' }}>
      <Panel tone="white" title="로그인" stack gap={12}>
        <p>사용할 계정을 선택하세요.</p>
        <Button full disabled={me.isLoading || complete.isPending} onClick={selectAccount}>정재</Button>
        {complete.isError && <p role="alert">{complete.error.message}</p>}
      </Panel>
    </main>
  )
}
