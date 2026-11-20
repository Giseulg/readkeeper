import { useLayoutEffect, useState, type RefObject } from 'react'
import { SPRITES } from '@/components/pixel/sprites'
import type { DecorDef } from '@/domain/decor'
import { avoidZone, unitsToPct, type FieldGeom } from '@/domain/village'

/**
 * 장면(.field) 크기와 호수(.lake) 위치를 장면 % 로 잼. 화면 크기·모드(모바일/태블릿)가 바뀌면 다시 잼.
 * 호수 위치는 CSS(village.css·tablet.css)가 정하므로 화면 모드별 분기를 JS 에 두지 않음.
 */
export function useFieldGeom(
  fieldRef: RefObject<HTMLElement | null>,
  lakeRef: RefObject<HTMLElement | null>,
  /** 장면이 그려져 있는지(성 모드에서는 마을 장면이 없음). 바뀌면 다시 잼 */
  active: boolean,
): FieldGeom | null {
  const [geom, setGeom] = useState<FieldGeom | null>(null)
  useLayoutEffect(() => {
    const field = fieldRef.current
    if (!active || !field) return
    const pondEl = field.querySelector('.pond')
    const measure = () => {
      const f = field.getBoundingClientRect()
      if (f.width === 0 || f.height === 0) return
      const readZone = (element: Element | null) => {
        const k = element?.getBoundingClientRect()
        if (!k?.width || !k.height) return null
        const z = {
          l: ((k.left - f.left) / f.width) * 100,
          t: ((k.top - f.top) / f.height) * 100,
          r: ((k.right - f.left) / f.width) * 100,
          b: ((k.bottom - f.top) / f.height) * 100,
        }
        return z.t < 100 && z.b > 0 && z.l < 100 && z.r > 0 ? z : null
      }
      const lake = readZone(lakeRef.current)
      const pond = readZone(pondEl)
      setGeom((g) =>
        g && g.w === f.width && g.h === f.height
          && JSON.stringify(g.lake) === JSON.stringify(lake) && JSON.stringify(g.pond) === JSON.stringify(pond)
          ? g : { w: f.width, h: f.height, lake, pond },
      )
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(field)
    if (pondEl) ro.observe(pondEl)
    if (lakeRef.current) ro.observe(lakeRef.current)
    // 화면 모드 전환(data-tablet)은 크기 변화로 잡히지 않을 수 있어 속성 변화도 봄
    const mo = new MutationObserver(measure)
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-tablet', 'data-wide'] })
    return () => {
      ro.disconnect()
      mo.disconnect()
    }
  }, [fieldRef, lakeRef, active])
  return geom
}

/** 소품 원본 크기(칸 수 × 배율) */
export function decorUnits(def: DecorDef): { w: number; h: number } {
  const rows = SPRITES[def.sprite]
  return { w: (rows ? Math.max(...rows.map((r) => r.length)) : 8) * def.scale, h: (rows?.length ?? 8) * def.scale }
}

/** 소품 발 위치를 호수 밖으로(화면 표시용). 장면 크기 정보가 없으면 그대로 */
export function dryDecorPos(def: DecorDef, p: { left: number; top: number }, geom: FieldGeom | null | undefined) {
  if (!geom) return p
  const u = decorUnits(def)
  const size = unitsToPct(geom, u.w, u.h)
  return avoidZone(p, size, geom.lake, { minLeft: 2, maxLeft: 98, minTop: Math.min(60, size.h) })
}
