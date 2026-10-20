import { describe, expect, it } from 'vitest'
import { CSV_HEADERS, toCsv } from '../../src/lib/csv'
import { makeCalibration } from '../../src/lib/measure'
import { mk } from './helpers'

describe('CSV 내보내기 (SPEC #9)', () => {
  it('UTF-8 BOM, 필수 열, 측정값, 따옴표 처리', () => {
    const cals = { 0: makeCalibration(100, 1, 'm') }
    const csv = toCsv(
      [
        mk('length', [{ x: 0, y: 0 }, { x: 250, y: 0 }], { text: '벽 길이' }),
        mk('cloud', [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }], { page: 1, text: '수정 필요, "확인"' }),
      ],
      cals,
    )
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    const lines = csv.slice(1).trim().split('\r\n')
    expect(lines[0]).toBe(CSV_HEADERS.join(','))
    for (const h of ['페이지', '종류', '내용', '색', '측정값', '단위', '작성자', '작성일']) expect(lines[0]).toContain(h)
    expect(lines[1].startsWith('1,길이,벽 길이,#e03131,2.5,m,검토자,')).toBe(true)
    expect(lines[2]).toContain('2,구름,"수정 필요, ""확인""",#e03131,,,')
  })
})
