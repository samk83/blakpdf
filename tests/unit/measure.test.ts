import { describe, expect, it } from 'vitest'
import { makeCalibration, measure } from '../../src/lib/measure'
import { mk } from './helpers'

describe('measure', () => {
  const cal = makeCalibration(100, 1, 'm') // 100pt = 1m
  it('SPEC #6: 100pt=1m 보정 시 200pt 선은 2.00 m', () => {
    const m = mk('length', [{ x: 0, y: 0 }, { x: 200, y: 0 }])
    expect(measure(m, cal)).toEqual({ value: 2, unit: 'm', label: '2.00 m' })
  })
  it('면적은 단위 제곱', () => {
    const m = mk('area', [{ x: 0, y: 0 }, { x: 300, y: 0 }, { x: 300, y: 200 }, { x: 0, y: 200 }])
    const r = measure(m, cal)!
    expect(r.value).toBeCloseTo(6)
    expect(r.unit).toBe('m²')
    expect(r.label).toBe('6.00 m²')
  })
  it('둘레는 꺾은선 길이', () => {
    const m = mk('perimeter', [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 }])
    expect(measure(m, cal)!.value).toBeCloseTo(1.5)
  })
  it('개수는 점 개수', () => {
    const m = mk('count', [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }])
    expect(measure(m, cal)).toEqual({ value: 3, unit: 'ea', label: '3 ea' })
  })
  it('보정 없으면 72pt = 1in', () => {
    const m = mk('length', [{ x: 0, y: 0 }, { x: 144, y: 0 }])
    expect(measure(m, undefined)!.label).toBe('2.00 in')
  })
  it('측정이 아닌 마크업은 null', () => {
    expect(measure(mk('rect', [{ x: 0, y: 0 }, { x: 1, y: 1 }]), cal)).toBeNull()
  })
  it('잘못된 보정 값은 거부', () => {
    expect(() => makeCalibration(0, 1, 'm')).toThrow()
    expect(() => makeCalibration(10, -1, 'm')).toThrow()
  })
})
