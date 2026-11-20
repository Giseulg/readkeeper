import { Button } from '@/components/ui'

export function NotFoundPage() {
  return (
    <div className="app-shell">
      <main className="app-content" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <p className="h" style={{ fontSize: 24 }}>길을 잃었음</p>
        <Button to="/">마을로 돌아가기</Button>
      </main>
    </div>
  )
}
