import { Segmented, Sheet } from '@/components/ui'
import { FONT_SIZES, LINE_HEIGHTS, READING_MODE_HINT, READING_MODE_OPTIONS, THEME_OPTIONS } from '@/domain/labels'
import type { ReaderSettings } from '@/domain/types'
import { useUpdateSettings } from '@/hooks/queries'

/** 2.5d 리더 설정 */
export function ReaderSettingsSheet({ value, onClose }: { value: ReaderSettings; onClose: () => void }) {
  const update = useUpdateSettings()
  const set = (patch: Partial<ReaderSettings>) => update.mutate({ reader: patch })

  return (
    <Sheet title="읽기 설정" onClose={onClose}>
      <Segmented label="읽기 방식" options={READING_MODE_OPTIONS} value={value.mode} onChange={(mode) => set({ mode })} hint={READING_MODE_HINT[value.mode]} />
      <Segmented label="글자 크기" options={FONT_SIZES.map((v) => ({ value: v, label: v }))} value={value.fontSize} onChange={(fontSize) => set({ fontSize })} />
      <Segmented label="줄 간격" options={LINE_HEIGHTS.map((v) => ({ value: v, label: v.toFixed(1) }))} value={value.lineHeight} onChange={(lineHeight) => set({ lineHeight })} />
      <Segmented label="테마" options={THEME_OPTIONS} value={value.theme} onChange={(theme) => set({ theme })} />
    </Sheet>
  )
}
