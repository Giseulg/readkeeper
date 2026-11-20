import { useLayoutEffect, useRef, useState } from 'react'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import type { FieldGeom, Zone } from '@/domain/village'

type Point = { left: number; top: number }
type Pose = Point & { lift: number }

/* 겹치는 직사각형으로 표시 범위의 굴곡을 근사한다. 한 번의 이동은 같은 사각형 안에서만 한다. */
const WIDE_ZONES: Zone[] = [
  { l: 9, t: 32, r: 42, b: 87 },
  { l: 18, t: 22, r: 41, b: 47 },
  { l: 33, t: 41, r: 61, b: 81 },
  { l: 53, t: 40, r: 96, b: 52 },
  { l: 58, t: 32, r: 94, b: 48 },
  { l: 59, t: 23, r: 73, b: 46 },
]
const NARROW_ZONES: Zone[] = [
  { l: 10, t: 40, r: 44, b: 75 },
  { l: 20, t: 62, r: 62, b: 88 },
  { l: 35, t: 40, r: 66, b: 78 },
  { l: 57, t: 40, r: 85, b: 55 },
]

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const inside = (p: Point, z: Zone) => p.left >= z.l && p.left <= z.r && p.top >= z.t && p.top <= z.b
const nearest = (p: Point, z: Zone) => ({ left: clamp(p.left, z.l, z.r), top: clamp(p.top, z.t, z.b) })
const mix = (a: number, b: number, fraction: number) => a + (b - a) * fraction
const between = (a: number, b: number) => mix(a, b, Math.random())

export function roamingZones(geom: FieldGeom, size: { w: number; h: number }): Zone[] {
  const zones = geom.w >= 768 ? WIDE_ZONES : NARROW_ZONES
  const halfWidth = Math.max(size.w / 2, 1400 / geom.w)
  let allowed = zones.map((zone) => ({
    l: Math.max(zone.l, halfWidth + 1),
    r: Math.min(zone.r, 99 - halfWidth),
    t: Math.max(zone.t, size.h + (1400 / geom.h)),
    b: zone.b,
  }))
  for (const water of [geom.lake, geom.pond]) {
    if (!water) continue
    const shore = {
      l: water.l - halfWidth - 1,
      r: water.r + halfWidth + 1,
      t: water.t - 1,
      b: water.b + size.h + 1,
    }
    allowed = allowed.flatMap((z) => {
      if (z.r <= shore.l || z.l >= shore.r || z.b <= shore.t || z.t >= shore.b) return [z]
      return [
        { ...z, r: shore.l },
        { ...z, l: shore.r },
        { ...z, b: shore.t },
        { ...z, t: shore.b },
      ]
    })
  }
  return allowed.filter((z) => z.l < z.r && z.t < z.b)
}

export function constrainRoamPoint(p: Point, zones: Zone[]): Point {
  const distance = (q: Point) => Math.hypot(q.left - p.left, q.top - p.top)
  return zones.map((zone) => nearest(p, zone)).reduce<Point | undefined>(
    (best, choice) => !best || distance(choice) < distance(best) ? choice : best, undefined,
  ) ?? p
}

function characterPace(id: string) {
  let hash = 2166136261
  for (const letter of id) hash = Math.imul(hash ^ letter.codePointAt(0)!, 16777619)
  return {
    speed: 47 + ((hash >>> 0) / 4294967296) * 28,
    restScale: 0.85 + ((hash >>> 16) / 65536) * 0.35,
  }
}

function nextDestination(from: Point, zones: Zone[], w: number, h: number) {
  const reachable = zones.filter((zone) => inside(from, zone))
  if (!reachable.length) return null
  for (let i = 0; i < 16; i++) {
    const z = reachable[Math.floor(Math.random() * reachable.length)]
    const target = { left: between(z.l, z.r), top: between(z.t, z.b) }
    const distance = Math.hypot((target.left - from.left) * w, (target.top - from.top) * h) / 100
    if (distance < Math.min(22, w * 0.07)) continue
    // 긴 이동은 여러 번의 짧은 산책으로 나눈다.
    const fraction = Math.min(1, between(60, 145) / distance)
    return {
      left: mix(from.left, target.left, fraction),
      top: mix(from.top, target.top, fraction),
      distance: distance * fraction,
    }
  }
  return null
}

export function useVillageRoam(id: string, anchor: Point, geom: FieldGeom | null | undefined, zones: Zone[], paused: boolean) {
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const [pose, setPose] = useState<Pose>({ ...anchor, lift: 0 })
  const current = useRef(pose)

  useLayoutEffect(() => {
    current.current = { ...anchor, lift: 0 }
    setPose(current.current)
  }, [anchor, zones, reducedMotion])

  useLayoutEffect(() => {
    if (paused || reducedMotion || !geom || !zones.length) return
    const { w, h } = geom
    const { speed, restScale } = characterPace(id)
    let timer: number
    let frame: number
    const rest = (first: boolean) => {
      timer = window.setTimeout(walk, between(first ? 5 : 9, first ? 15 : 24) * restScale * 1000)
    }
    function walk() {
      const from = current.current
      const target = nextDestination(from, zones, w, h)
      if (!target) {
        rest(false)
        return
      }
      const duration = Math.max(500, 1000 * target.distance / (speed * between(0.86, 1.16)))
      const hops = Math.max(2, Math.round(duration / between(280, 390)))
      const height = between(4, 10)
      let started: number | undefined
      const tick = (now: number) => {
        started ??= now
        const progress = Math.min(1, (now - started) / duration)
        const phase = progress * hops
        const step = phase % 1
        const advance = (Math.floor(phase) + step * step * (3 - 2 * step)) / hops
        current.current = {
          left: mix(from.left, target.left, advance),
          top: mix(from.top, target.top, advance),
          lift: height * Math.sin(Math.PI * step),
        }
        setPose(current.current)
        if (progress < 1) frame = requestAnimationFrame(tick)
        else rest(false)
      }
      frame = requestAnimationFrame(tick)
    }
    rest(true)
    return () => {
      window.clearTimeout(timer)
      cancelAnimationFrame(frame)
    }
  }, [anchor, geom, id, paused, reducedMotion, zones])

  return paused || reducedMotion ? { ...pose, lift: 0 } : pose
}
