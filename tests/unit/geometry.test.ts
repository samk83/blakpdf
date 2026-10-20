import { describe, expect, it } from 'vitest'
import { hitTest, polygonArea, polylineLength, simplify } from '../../src/lib/geometry'
import { mk } from './helpers'

describe('geometry', () => {
  it('꺾은선 길이와 닫힌 둘레', () => {
    const sq = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }]
    expect(polylineLength(sq)).toBe(30)
    expect(polylineLength(sq, true)).toBe(40)
  })
  it('다각형 넓이 (방향과 무관)', () => {
    const sq = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }]
    expect(polygonArea(sq)).toBe(100)
    expect(polygonArea([...sq].reverse())).toBe(100)
  })
  it('선 클릭 판정', () => {
    const m = mk('line', [{ x: 0, y: 0 }, { x: 100, y: 0 }])
    expect(hitTest(m, { x: 50, y: 2 }, 3)).toBe(true)
    expect(hitTest(m, { x: 50, y: 20 }, 3)).toBe(false)
  })
  it('채우지 않은 사각형은 테두리만, 텍스트 상자는 안쪽도 선택된다', () => {
    const r = mk('rect', [{ x: 0, y: 0 }, { x: 100, y: 100 }])
    expect(hitTest(r, { x: 50, y: 50 }, 3)).toBe(false)
    expect(hitTest(r, { x: 0, y: 50 }, 3)).toBe(true)
    const t = mk('text', [{ x: 0, y: 0 }, { x: 100, y: 100 }], { width: 0 })
    expect(hitTest(t, { x: 50, y: 50 }, 3)).toBe(true)
  })
  it('면적 측정은 안쪽 클릭으로 선택된다', () => {
    const a = mk('area', [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }])
    expect(hitTest(a, { x: 80, y: 20 }, 3)).toBe(true)
  })
  it('펜 획 단순화는 끝점을 유지한다', () => {
    const pts = Array.from({ length: 50 }, (_, i) => ({ x: i, y: 0.01 * (i % 2) }))
    const s = simplify(pts, 0.5)
    expect(s.length).toBe(2)
    expect(s[0]).toEqual(pts[0])
    expect(s[1]).toEqual(pts[49])
  })
})
