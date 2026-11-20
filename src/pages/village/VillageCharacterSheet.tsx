import { PixelSprite } from '@/components/pixel/PixelSprite'
import { Sheet } from '@/components/ui'
import { pickFreeSpot } from '@/domain/village'
import type { Character } from '@/domain/types'
import { useSaveVillage } from '@/hooks/queries'

/** 1.0 마을 > 집: 보유 캐릭터 목록. 체크한 캐릭터만 마을에 표시 */
export function VillageCharacterSheet({ chars, onClose }: { chars: Character[]; onClose: () => void }) {
  const save = useSaveVillage()
  const shown = chars.filter((c) => c.villagePosition).length

  const toggle = (c: Character) =>
    save.mutate([{ id: c.id, villagePosition: c.villagePosition ? undefined : pickFreeSpot(chars) }])

  const setAll = (on: boolean) => {
    const next = chars.map((c) => ({ ...c }))
    const positions = next
      .filter((c) => Boolean(c.villagePosition) !== on)
      .map((c) => {
        c.villagePosition = on ? pickFreeSpot(next) : undefined
        return { id: c.id, villagePosition: c.villagePosition }
      })
    if (positions.length) save.mutate(positions)
  }

  return (
    <Sheet title="내 집" aside={<span className="tag mono">{shown}/{chars.length} 표시 중</span>} onClose={onClose}>
      <p className="lbl">체크한 캐릭터가 마을에 나와 있음.</p>
      {chars.length === 0 ? (
        <div className="empty-slot">
          <PixelSprite name="house" scale={3} />
          아직 얻은 캐릭터가 없음
        </div>
      ) : (
        <>
          <div className="row">
            <button type="button" className="chip" onClick={() => setAll(true)} disabled={shown === chars.length}>
              모두 표시
            </button>
            <button type="button" className="chip" onClick={() => setAll(false)} disabled={shown === 0}>
              모두 숨김
            </button>
          </div>
          <ul className="sheet-scroll home-chars">
            {chars.map((c) => {
              const on = Boolean(c.villagePosition)
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    className={`home-char${on ? ' on' : ''}`}
                    role="checkbox"
                    aria-checked={on}
                    onClick={() => toggle(c)}
                  >
                    <span className="pic">
                      <PixelSprite name={c.sprite} fit={64} title={c.name} />
                    </span>
                    <span className="col grow" style={{ gap: 4, minWidth: 0 }}>
                      <span className="t">{c.name}</span>
                      <span className="lbl">{c.bookTitle}</span>
                    </span>
                    <span className="box" aria-hidden="true">
                      {on && <PixelSprite name="i_check" scale={3} color="#fff" />}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </Sheet>
  )
}
