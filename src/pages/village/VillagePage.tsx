import { useRef, useState, type CSSProperties } from 'react'
import { PixelSprite } from '@/components/pixel/PixelSprite'
import { formatLocation } from '@/domain/location'
import { DECOR, freshLayout, newDecorId, pickDropSpot, type DecorDef } from '@/domain/decor'
import type { DecorItem } from '@/domain/types'
import { useBooks, useCastle, useMyCharacters, useSaveDecor, useSaveVillage, useUnlockDecor, useVillageLayout } from '@/hooks/queries'
import './village.css'
import { Button } from '@/components/ui'
import { VillageCharacter } from './VillageCharacter'
import { VillageCharacterSheet } from './VillageCharacterSheet'
import { CharacterInfoModal } from './CharacterInfoModal'
import { CastleMode } from './CastleMode'
import { DecorPanel } from './DecorPanel'
import { DecorPiece } from './DecorPiece'
import { dryDecorPos, useFieldGeom } from './lake'
import { forestTile } from './forest'

type HomeMode = 'village' | 'castle'
const MODE_KEY = 'rf-home-mode'
function loadMode(): HomeMode {
  try {
    return localStorage.getItem(MODE_KEY) === 'castle' ? 'castle' : 'village'
  } catch {
    return 'village'
  }
}

/** 서버 응답 전·실제 백엔드 미연결 시 쓰는 기본 마을 */
const FALLBACK_LAYOUT = freshLayout()

/** 1.0 랜딩홈: 캐릭터 마을 ↔ 지식의 성(디펜스) 모드 */
export function VillagePage() {
  const chars = useMyCharacters()
  const books = useBooks()
  const recent = books.data
    ?.filter((b) => b.status === 'ready' && b.progress.lastReadAt)
    .sort((a, b) => (b.progress.lastReadAt ?? '').localeCompare(a.progress.lastReadAt ?? ''))[0]
  const placed = chars.data?.filter((c) => c.villagePosition) ?? []
  const [homeOpen, setHomeOpen] = useState(false)
  /** 한 번 누른 캐릭터의 정보 팝업 */
  const [infoId, setInfoId] = useState<string | null>(null)
  const infoChar = infoId ? chars.data?.find((c) => c.id === infoId) : undefined
  const fieldRef = useRef<HTMLDivElement>(null)
  const binRef = useRef<HTMLDivElement>(null)
  /** 상태창(이어 읽기 카드) 자리의 숲: 캐릭터·소품을 둘 수 없음 */
  const lakeRef = useRef<HTMLDivElement>(null)
  const save = useSaveVillage()
  const layoutQ = useVillageLayout()
  const layout = layoutQ.data ?? FALLBACK_LAYOUT
  const castle = useCastle()
  const saveDecor = useSaveDecor()
  const unlock = useUnlockDecor()
  /** 꾸미기 모드([내 마을] 버튼) */
  const [editing, setEditing] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [binHot, setBinHot] = useState(false)
  const decorError = (saveDecor.error ?? unlock.error)?.message

  const commit = (items: DecorItem[]) => saveDecor.mutate(items)
  const moveItem = (id: string, pos: { x: number; y: number }) =>
    commit(layout.items.map((it) => (it.id === id ? { ...it, ...pos } : it)))
  const recallItem = (id: string) => {
    setSelected(null)
    commit(layout.items.filter((it) => it.id !== id))
  }
  const addItem = (def: DecorDef) => {
    const item: DecorItem = { id: newDecorId(def.kind), kind: def.kind, ...pickDropSpot(layout.items) }
    commit([...layout.items, item])
    setSelected(item.id)
  }
  const openEditor = () => {
    saveDecor.reset()
    unlock.reset()
    setSelected(null)
    setEditing(true)
  }
  const closeEditor = () => {
    setSelected(null)
    setEditing(false)
  }
  const [mode, setModeState] = useState<HomeMode>(loadMode)
  const geom = useFieldGeom(fieldRef, lakeRef, mode === 'village' || editing)
  const setMode = (m: HomeMode) => {
    setModeState(m)
    try {
      localStorage.setItem(MODE_KEY, m)
    } catch {
      /* 저장 불가 환경은 무시 */
    }
  }

  const toggle = (
    <div className="mode-toggle" role="group" aria-label="홈 모드">
      {(['village', 'castle'] as const).map((m) => (
        <button key={m} type="button" className={mode === m ? 'on' : ''} aria-pressed={mode === m} onClick={() => setMode(m)}>
          <PixelSprite name={m === 'village' ? 'i_home' : 'i_flag'} scale={2} />
          {m === 'village' ? '마을' : '성'}
        </button>
      ))}
    </div>
  )

  if (mode === 'castle' && !editing) {
    return (
      <section className="scene castle-mode" aria-label="지식의 성">
        <CastleMode chars={chars.data ?? []} />
        <div className="plate">지식의 성</div>
        {toggle}
      </section>
    )
  }

  return (
    <section className={'scene' + (editing ? ' decorating' : '')} aria-label="내 마을">
      <div className="field" ref={fieldRef} onPointerDown={(e) => editing && e.target === e.currentTarget && setSelected(null)}>
        <div className="path-v" />
        <div className="path-h" />
        <div className="pond" />
        <div className="lake" ref={lakeRef} style={{ '--forest': forestTile() } as CSSProperties} aria-hidden />
        {layout.items.map((it) => {
          const def = DECOR[it.kind]
          if (!def) return null
          if (editing)
            return (
              <DecorPiece
                key={it.id}
                item={it}
                def={def}
                fieldRef={fieldRef}
                binRef={binRef}
                selected={selected === it.id}
                onSelect={() => setSelected(it.id)}
                onMove={(pos) => moveItem(it.id, pos)}
                onRecall={() => recallItem(it.id)}
                onHoverBin={setBinHot}
                geom={geom}
              />
            )
          const at = dryDecorPos(def, { left: it.x, top: it.y }, geom)
          if (it.kind === 'house')
            return (
              <button
                key={it.id}
                type="button"
                className="house-btn"
                style={{ left: `${at.left}%`, top: `${at.top}%`, zIndex: Math.round(at.top) }}
                aria-label="내 집: 마을에 띄울 캐릭터 고르기"
                onClick={() => setHomeOpen(true)}
              >
                <span className="namecard">내 집</span>
                <PixelSprite name={def.sprite} scale={def.scale} fluid />
              </button>
            )
          return (
            <div key={it.id} className="deco" style={{ left: `${at.left}%`, top: `${at.top}%`, zIndex: Math.round(at.top) }}>
              <PixelSprite name={def.sprite} scale={def.scale} fluid />
            </div>
          )
        })}
        {placed.map((c) => (
          <VillageCharacter
            key={c.id}
            char={c}
            fieldRef={fieldRef}
            onDrop={(villagePosition) => save.mutate([{ id: c.id, villagePosition }])}
            onInfo={() => setInfoId(c.id)}
            paused={editing || homeOpen || Boolean(infoChar)}
            geom={geom}
          />
        ))}
      </div>

      {editing ? (
        <button type="button" className="plate plate-btn done" onClick={closeEditor} aria-label="꾸미기 마치기">
          <PixelSprite name="i_check" scale={2} />
          꾸미기 완료
        </button>
      ) : (
        <button type="button" className="plate plate-btn" onClick={openEditor} aria-label="내 마을 꾸미기">
          내 마을
          <PixelSprite name="i_edit" scale={2} />
          {chars.data && <span className="num">{placed.length}/{chars.data.length}</span>}
        </button>
      )}
      {!editing && toggle}

      {editing && (
        <DecorPanel
          ref={binRef}
          items={layout.items}
          unlocked={layout.unlocked}
          points={castle.data?.points}
          binHot={binHot}
          busy={unlock.isPending}
          error={decorError}
          onAdd={addItem}
          onUnlock={(def) => unlock.mutate(def.kind)}
        />
      )}

      {!editing && recent && (
        <div className="quest">
          <div className="row" style={{ gap: 12 }}>
            <span className="cover" style={{ '--c': `var(--${recent.coverColor})` } as CSSProperties} />
            <div className="col grow" style={{ gap: 4 }}>
              <span className="lbl">{recent.progress.percent === 100 ? '완독' : '이어 읽기'}</span>
              <span className="t">{recent.title}</span>
              <span className="lbl">
                {recent.progress.percent > 0 ? `${formatLocation(recent.progress.confirmed)}까지 읽음` : '처음부터'}
              </span>
            </div>
            <span className="num" style={{ fontSize: 13 }}>{recent.progress.percent}%</span>
          </div>
          <Button to={`/library/${recent.id}/${recent.progress.percent === 100 ? 'complete' : 'read'}`} full icon="i_book">
            {recent.progress.percent === 100 ? '완독 기록 보기' : '이어서 읽기'}
          </Button>
        </div>
      )}

      {infoChar && <CharacterInfoModal char={infoChar} onClose={() => setInfoId(null)} />}
      {homeOpen && chars.data && <VillageCharacterSheet chars={chars.data} onClose={() => setHomeOpen(false)} />}
    </section>
  )
}
