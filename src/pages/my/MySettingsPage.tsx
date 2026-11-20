import { QueryState } from '@/components/QueryState'
import { Panel, Segmented } from '@/components/ui'
import { FONT_SIZES, LAYOUT_MODE_LABEL, LIBRARY_VIEW_LABEL, LINE_HEIGHTS, READING_MODE_HINT, READING_MODE_OPTIONS, THEME_OPTIONS } from '@/domain/labels'
import type { LayoutMode, LibraryView } from '@/domain/types'
import { useSettings, useUpdateSettings } from '@/hooks/queries'

const LAYOUTS: LayoutMode[] = ['auto', 'mobile', 'tablet']
const LAYOUT_HINT: Record<LayoutMode, string> = {
  auto: '화면 폭에 맞춰 바꿈 (768px 이상이면 태블릿 배치)',
  mobile: '어느 기기에서나 한 손 세로 화면으로 봄',
  tablet: '왼쪽 메뉴 레일과 넓은 배치로 봄. 가로 폭이 넓으면 Reader 옆에 메모·목차 패널',
}
const VIEWS: LibraryView[] = ['list', 'shelf']
const VIEW_HINT: Record<LibraryView, string> = {
  list: '제목·분류·진도를 한 줄씩 자세히 봄',
  shelf: '표지를 책장에 꽂아 한눈에 봄',
}

/** 4.3 읽기·학습 설정 */
export function MySettingsPage() {
  const { data: s, isLoading, error } = useSettings()
  const update = useUpdateSettings()

  return (
    <QueryState isLoading={isLoading} error={error}>
      {s && (
        <div className="col" style={{ gap: 16 }} data-screen="4.3">
          <Panel title="화면" stack gap={12}>
            <Segmented
              label="화면 모드"
              options={LAYOUTS.map((v) => ({ value: v, label: LAYOUT_MODE_LABEL[v] }))}
              value={s.display.layout}
              onChange={(layout) => update.mutate({ display: { layout } })}
              hint={LAYOUT_HINT[s.display.layout]}
            />
          </Panel>

          <Panel title="서재" stack gap={12}>
            <Segmented
              label="보기 방식"
              options={VIEWS.map((v) => ({ value: v, label: LIBRARY_VIEW_LABEL[v] }))}
              value={s.library.view}
              onChange={(view) => update.mutate({ library: { view } })}
              hint={VIEW_HINT[s.library.view]}
            />
          </Panel>

          <Panel title="리더 기본값" stack gap={12}>
            <Segmented label="읽기 방식" options={READING_MODE_OPTIONS} value={s.reader.mode} onChange={(mode) => update.mutate({ reader: { mode } })} hint={READING_MODE_HINT[s.reader.mode]} />
            <Segmented label="글자 크기" options={FONT_SIZES.map((v) => ({ value: v, label: v }))} value={s.reader.fontSize} onChange={(fontSize) => update.mutate({ reader: { fontSize } })} />
            <Segmented label="줄 간격" options={LINE_HEIGHTS.map((v) => ({ value: v, label: v.toFixed(1) }))} value={s.reader.lineHeight} onChange={(lineHeight) => update.mutate({ reader: { lineHeight } })} />
            <Segmented label="테마" options={THEME_OPTIONS} value={s.reader.theme} onChange={(theme) => update.mutate({ reader: { theme } })} />
          </Panel>

          <Panel title="학습" stack gap={12}>
            <Segmented
              label="게임 배경음"
              options={[{ value: true, label: '켜기' }, { value: false, label: '끄기' }]}
              value={s.learning.gameMusic}
              onChange={(gameMusic) => update.mutate({ learning: { gameMusic } })}
            />
            <Segmented
              label="게임 효과음"
              options={[{ value: true, label: '켜기' }, { value: false, label: '끄기' }]}
              value={s.learning.gameSound}
              onChange={(gameSound) => update.mutate({ learning: { gameSound } })}
            />
            <Segmented
              label="이어 읽을 때 회상 질문 제안"
              options={[{ value: true, label: '켜기' }, { value: false, label: '끄기' }]}
              value={s.learning.recallPrompt}
              onChange={(recallPrompt) => update.mutate({ learning: { recallPrompt } })}
            />
            {s.learning.recallPrompt && (
              <Segmented
                label="회상 질문 수"
                options={[{ value: 1 as const, label: '1문항' }, { value: 2 as const, label: '2문항' }]}
                value={s.learning.recallCount}
                onChange={(recallCount) => update.mutate({ learning: { recallCount } })}
              />
            )}
          </Panel>
        </div>
      )}
    </QueryState>
  )
}
