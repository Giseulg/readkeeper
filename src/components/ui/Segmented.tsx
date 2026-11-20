import type { ReactNode } from 'react'

interface Props<T extends string | number | boolean> {
  label: string
  options: ReadonlyArray<{ value: T; label: ReactNode }>
  value: T
  onChange: (v: T) => void
  /** 라벨 아래 보조 설명 */
  hint?: ReactNode
}

/** 라벨 + 세그먼트 버튼 한 줄 (.seg) */
export function Segmented<T extends string | number | boolean>({ label, options, value, onChange, hint }: Props<T>) {
  return (
    <div className="col" style={{ gap: 6 }} role="group" aria-label={label}>
      <span className="lbl">{label}</span>
      <div className="seg">
        {options.map((o) => (
          <button key={String(o.value)} type="button" className={o.value === value ? 'on' : ''} aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
      {hint && <span className="lbl">{hint}</span>}
    </div>
  )
}
