import { polygonArea, polylineLength } from './geometry'
import type { Calibration, Markup } from './types'

/** 보정하지 않은 페이지의 기본 축척: 1pt = 1/72 inch */
export const DEFAULT_CALIBRATION: Calibration = { pdfDistance: 72, realDistance: 1, unit: 'in' }

export const UNITS = ['mm', 'cm', 'm', 'in', 'ft'] as const

export function makeCalibration(pdfDistance: number, realDistance: number, unit: string): Calibration {
  if (!(pdfDistance > 0)) throw new Error('보정할 두 점이 너무 가깝습니다.')
  if (!(realDistance > 0)) throw new Error('실제 거리는 0보다 커야 합니다.')
  return { pdfDistance, realDistance, unit }
}

/** 1pt 가 실제로 몇 단위인지 */
export const unitsPerPoint = (c: Calibration) => c.realDistance / c.pdfDistance

export interface Measurement {
  value: number
  unit: string
  label: string
}

/** 측정 마크업의 값. 측정이 아닌 마크업은 null */
export function measure(m: Markup, cal: Calibration | undefined): Measurement | null {
  const c = cal ?? DEFAULT_CALIBRATION
  const k = unitsPerPoint(c)
  switch (m.type) {
    case 'length': {
      const v = polylineLength(m.points) * k
      return { value: v, unit: c.unit, label: `${fmt(v)} ${c.unit}` }
    }
    case 'perimeter': {
      const v = polylineLength(m.points) * k
      return { value: v, unit: c.unit, label: `${fmt(v)} ${c.unit}` }
    }
    case 'area': {
      const v = polygonArea(m.points) * k * k
      return { value: v, unit: `${c.unit}²`, label: `${fmt(v)} ${c.unit}²` }
    }
    case 'count':
      return { value: m.points.length, unit: 'ea', label: `${m.points.length} ea` }
    default:
      return null
  }
}

export function fmt(v: number): string {
  return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
