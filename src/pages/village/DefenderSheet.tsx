import { PixelSprite } from '@/components/pixel/PixelSprite'
import { Button, Sheet } from '@/components/ui'
import { COST, LEVELS, MAX_DEFENDERS, cellLabel, hpTone } from '@/domain/castle'
import type { CastleAction, CastleState, Character } from '@/domain/types'

interface Props {
  castle: CastleState
  chars: Character[]
  index: number
  pending: boolean
  error: string | null
  onAction: (a: CastleAction) => void
  onClose: () => void
}

/** 성 모드 > 필드 칸: 선 캐릭터 회복·등급 해금, 다른 캐릭터로 바꾸기·옮겨 오기 */
export function DefenderSheet({ castle, chars, index, pending, error, onAction, onClose }: Props) {
  const id = castle.slots[index]
  const cur = chars.find((c) => c.id === id)
  const st = id ? castle.defenders[id] : undefined
  const others = chars.filter((c) => c.id !== id)
  const placed = castle.slots.filter(Boolean).length

  return (
    <Sheet title={cellLabel(index)} aside={<span className="tag mono">{castle.points}P 보유</span>} onClose={onClose}>
      {cur && st ? (
        <div className="def-card">
          <span className="pic">
            <PixelSprite name={cur.sprite} fit={64} title={cur.name} />
          </span>
          <div className="col grow" style={{ gap: 6, minWidth: 0 }}>
            <div className="row" style={{ gap: 6 }}>
              <span className="t">{cur.name}</span>
              <span className="tag a">{'★'.repeat(st.level)} {LEVELS[st.level].name}</span>
            </div>
            <div className="hpbar">
              <i className={hpTone(st.hp / LEVELS[st.level].maxHp)} style={{ width: `${(st.hp / LEVELS[st.level].maxHp) * 100}%` }} />
            </div>
            <span className="lbl">
              HP <b className="num">{st.hp}/{LEVELS[st.level].maxHp}</b> · 피해 {LEVELS[st.level].block}% 막음{st.hp === 0 ? ' · 쓰러져서 막지 못함' : ''}
            </span>
          </div>
        </div>
      ) : (
        <p className="lbl">
          빈 칸임. 성을 지킬 캐릭터를 고름({placed}/{MAX_DEFENDERS}명 배치 중
          {placed >= MAX_DEFENDERS ? ', 가득 차서 다른 칸의 캐릭터만 옮겨 올 수 있음' : ''}).
        </p>
      )}

      {cur && st && (
        <div className="row" style={{ gap: 8 }}>
          <Button
            variant="secondary"
            size="sm"
            full
            icon="i_heart"
            trailing={`${COST.heal}P`}
            disabled={pending || st.hp >= LEVELS[st.level].maxHp}
            onClick={() => onAction({ type: 'heal', charId: cur.id })}
          >
            회복
          </Button>
          <Button
            variant="accent"
            size="sm"
            full
            icon="i_up"
            trailing={st.level < 3 ? `${COST.upgrade[(st.level + 1) as 2 | 3]}P` : undefined}
            disabled={pending || st.level >= 3}
            onClick={() => onAction({ type: 'upgrade', charId: cur.id })}
          >
            {st.level < 3 ? `${LEVELS[(st.level + 1) as 2 | 3].name} 해금` : '최고 등급'}
          </Button>
        </div>
      )}
      {error && <p className="lbl err" role="alert">{error}</p>}

      <span className="lbl" style={{ marginTop: 4 }}>{cur ? '다른 캐릭터로 바꾸기' : '보유 캐릭터'}</span>
      {others.length === 0 ? (
        <div className="empty-slot">아직 얻은 캐릭터가 없음. 읽고 퀴즈를 풀면 얻을 수 있음.</div>
      ) : (
        <ul className="sheet-scroll home-chars def-list">
          {others.map((c) => {
            const s = castle.defenders[c.id]
            const where = castle.slots.indexOf(c.id)
            return (
              <li key={c.id}>
                <button type="button" className={`home-char${s && s.hp > 0 ? ' on' : ''}`} onClick={() => onAction({ type: 'slot', index, charId: c.id })}>
                  <span className="pic">
                    <PixelSprite name={c.sprite} scale={1} title={c.name} />
                  </span>
                  <span className="col grow" style={{ gap: 4, minWidth: 0 }}>
                    <span className="t">{c.name}</span>
                    <span className="lbl">
                      {s ? `${'★'.repeat(s.level)} · HP ${s.hp}/${LEVELS[s.level].maxHp}${s.hp === 0 ? ' · 쓰러짐' : ''}` : ''}
                      {where >= 0 ? ` · ${cellLabel(where)}에서 옮김` : ''}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {cur && (
        <button type="button" className="chip" style={{ alignSelf: 'flex-start' }} onClick={() => onAction({ type: 'slot', index, charId: null })}>
          필드에서 빼기
        </button>
      )}
    </Sheet>
  )
}
