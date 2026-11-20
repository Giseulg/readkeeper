import { ScreenStub } from '@/components/ScreenStub'
import { resetMockDb } from '@/mocks/reset'
import { Button } from '@/components/ui'

export const MyCharactersPage = () => <ScreenStub id="4.1" title="내 캐릭터" todo={['보유 캐릭터 목록', '공개/비공개 설정']} />
export const MyInterestsPage = () => <ScreenStub id="4.2" title="관심 분야" todo={['카테고리 선택(Explore 노출 기준)']} />

export const MyDataPage = () => (
  <ScreenStub id="4.4" title="데이터 관리" todo={['로컬 데이터 내보내기', '앱 정보']}>
    <Button variant="wood" size="sm" onClick={resetMockDb}>
      Mock 데이터 초기화
    </Button>
  </ScreenStub>
)
