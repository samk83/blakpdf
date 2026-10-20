import { beforeEach, describe, expect, it } from 'vitest'
import { makeCalibration } from '../../src/lib/measure'
import { useDoc } from '../../src/store'

const base = { page: 0, color: '#000000', fill: null, width: 1, opacity: 1, text: '', fontSize: 12 }

describe('실행 취소/다시 실행 (SPEC #5)', () => {
  beforeEach(() => {
    useDoc.getState().openDocument({ fileName: 'a.pdf', filePath: null, original: new Uint8Array(), viewBytes: new Uint8Array(), pageCount: 2, markups: [], calibrations: {} })
  })
  it('추가 → 취소 → 다시', () => {
    const s = useDoc.getState()
    s.addMarkup({ ...base, type: 'rect', points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] })
    expect(useDoc.getState().markups).toHaveLength(1)
    expect(useDoc.getState().dirty).toBe(true)
    useDoc.getState().undo()
    expect(useDoc.getState().markups).toHaveLength(0)
    useDoc.getState().redo()
    expect(useDoc.getState().markups).toHaveLength(1)
  })
  it('이동(checkpoint + move) 되돌리기', () => {
    const m = useDoc.getState().addMarkup({ ...base, type: 'line', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }] })
    useDoc.getState().checkpoint()
    useDoc.getState().moveMarkup(m.id, 5, 5)
    useDoc.getState().moveMarkup(m.id, 5, 5)
    expect(useDoc.getState().markups[0].points[0]).toEqual({ x: 10, y: 10 })
    useDoc.getState().undo()
    expect(useDoc.getState().markups[0].points[0]).toEqual({ x: 0, y: 0 })
  })
  it('속성 변경과 삭제 되돌리기', () => {
    const m = useDoc.getState().addMarkup({ ...base, type: 'rect', points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] })
    useDoc.getState().updateMarkup(m.id, { color: '#ff0000' })
    useDoc.getState().deleteMarkup(m.id)
    expect(useDoc.getState().markups).toHaveLength(0)
    useDoc.getState().undo()
    expect(useDoc.getState().markups[0].color).toBe('#ff0000')
    useDoc.getState().undo()
    expect(useDoc.getState().markups[0].color).toBe('#000000')
    useDoc.getState().redo()
    useDoc.getState().redo()
    expect(useDoc.getState().markups).toHaveLength(0)
  })
  it('축척 보정도 되돌릴 수 있고, 전체 페이지 적용', () => {
    useDoc.getState().setCalibration(0, makeCalibration(100, 1, 'm'), true)
    expect(Object.keys(useDoc.getState().calibrations)).toEqual(['0', '1'])
    useDoc.getState().undo()
    expect(useDoc.getState().calibrations).toEqual({})
  })
})

describe('연속 속성 변경 묶기', () => {
  it('같은 속성을 연달아 바꾸면 실행 취소 한 번에 되돌아간다', () => {
    useDoc.getState().openDocument({ fileName: 'a.pdf', filePath: null, original: new Uint8Array(), viewBytes: new Uint8Array(), pageCount: 1, markups: [], calibrations: {} })
    const m = useDoc.getState().addMarkup({ ...base, type: 'rect', points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] })
    for (const o of [0.9, 0.8, 0.7, 0.6]) useDoc.getState().updateMarkup(m.id, { opacity: o })
    expect(useDoc.getState().markups[0].opacity).toBe(0.6)
    useDoc.getState().undo()
    expect(useDoc.getState().markups[0].opacity).toBe(1)
  })
})
