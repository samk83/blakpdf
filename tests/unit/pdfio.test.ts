import { readFileSync } from 'node:fs'
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { describe, expect, it } from 'vitest'
import { makeCalibration } from '../../src/lib/measure'
import { loadPdf, savePdf } from '../../src/lib/pdfio'
import type { MarkupType } from '../../src/lib/types'
import { mk } from './helpers'

GlobalWorkerOptions.workerSrc = new URL('../../node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs', import.meta.url).href

const sample = new Uint8Array(readFileSync('tests/fixtures/sample-plan.pdf'))
const font = new Uint8Array(readFileSync('node_modules/pretendard/dist/public/static/alternative/Pretendard-Regular.ttf'))

const ALL: [MarkupType, { x: number; y: number }[]][] = [
  ['line', [{ x: 100, y: 100 }, { x: 200, y: 150 }]],
  ['arrow', [{ x: 100, y: 200 }, { x: 200, y: 250 }]],
  ['rect', [{ x: 300, y: 300 }, { x: 400, y: 380 }]],
  ['ellipse', [{ x: 420, y: 300 }, { x: 500, y: 380 }]],
  ['polygon', [{ x: 100, y: 400 }, { x: 180, y: 420 }, { x: 150, y: 480 }]],
  ['cloud', [{ x: 600, y: 300 }, { x: 700, y: 300 }, { x: 700, y: 380 }, { x: 600, y: 380 }]],
  ['text', [{ x: 300, y: 500 }, { x: 450, y: 540 }]],
  ['callout', [{ x: 250, y: 600 }, { x: 300, y: 620 }, { x: 420, y: 660 }]],
  ['note', [{ x: 800, y: 700 }]],
  ['pen', [{ x: 800, y: 100 }, { x: 820, y: 130 }, { x: 850, y: 110 }]],
  ['highlighter', [{ x: 800, y: 200 }, { x: 900, y: 200 }]],
  ['length', [{ x: 100, y: 200 }, { x: 700, y: 200 }]],
  ['area', [{ x: 100, y: 200 }, { x: 400, y: 200 }, { x: 400, y: 700 }, { x: 100, y: 700 }]],
  ['perimeter', [{ x: 400, y: 200 }, { x: 700, y: 200 }, { x: 700, y: 700 }]],
  ['count', [{ x: 150, y: 250 }, { x: 250, y: 250 }, { x: 350, y: 250 }]],
]

describe('PDF 저장/열기 왕복 (SPEC #10)', () => {
  const markups = ALL.map(([t, pts]) => mk(t, pts, { text: t === 'text' || t === 'callout' ? '한글 메모 확인\n두 번째 줄' : `${t} 내용` }))
  markups.push(mk('rect', [{ x: 50, y: 50 }, { x: 90, y: 90 }], { page: 2, fill: '#ffe066' }))
  const cals = { 0: makeCalibration(100, 1, 'm') }

  it('표준 주석으로 저장되고 pdf.js 에서 보인다', async () => {
    const out = await savePdf(sample, markups, cals, { fontBytes: font })
    const pdf = await getDocument({ data: out.slice(), useSystemFonts: false }).promise
    expect(pdf.numPages).toBe(3)
    const annots = await (await pdf.getPage(1)).getAnnotations()
    const subtypes = annots.map((a: { subtype: string }) => a.subtype).sort()
    expect(subtypes).toEqual(
      ['Line', 'Line', 'Line', 'Square', 'Circle', 'Polygon', 'Polygon', 'Polygon', 'FreeText', 'FreeText', 'Text', 'Ink', 'Ink', 'Ink', 'PolyLine'].sort(),
    )
    for (const a of annots as { hasAppearance: boolean; subtype: string }[]) {
      expect(a.hasAppearance, a.subtype).toBe(true)
    }
    const page3 = await (await pdf.getPage(3)).getAnnotations()
    expect(page3).toHaveLength(1)
    // 측정값이 내용(Contents)에 들어간다
    const len = (annots as { subtype: string; contentsObj?: { str: string } }[]).find((a) => a.contentsObj?.str.includes('6.00 m'))
    expect(len).toBeTruthy()
    // 실제로 그려지는지 (오류 없이 연산자 목록 생성)
    const ops = await (await pdf.getPage(1)).getOperatorList({ annotationMode: 1 })
    expect(ops.fnArray.length).toBeGreaterThan(50)
    await pdf.destroy()
  })

  it('BlakPDF로 다시 열면 마크업과 축척이 복원되고 화면용 사본에는 중복 주석이 없다', async () => {
    const out = await savePdf(sample, markups, cals, { fontBytes: font })
    const loaded = await loadPdf(out)
    expect(loaded.pageCount).toBe(3)
    expect(loaded.markups).toEqual(markups)
    expect(loaded.calibrations).toEqual({ 0: cals[0] })
    const pdf = await getDocument({ data: loaded.viewBytes.slice() }).promise
    expect(await (await pdf.getPage(1)).getAnnotations()).toHaveLength(0)
    await pdf.destroy()
  })

  it('다시 저장해도 주석이 두 번 들어가지 않는다', async () => {
    const once = await savePdf(sample, markups, cals, { fontBytes: font })
    const twice = await savePdf(once, markups.slice(0, 2), cals, { fontBytes: font })
    const pdf = await getDocument({ data: twice.slice() }).promise
    expect(await (await pdf.getPage(1)).getAnnotations()).toHaveLength(2)
    await pdf.destroy()
  })

  it('여러 번 다시 저장해도 파일 크기가 계속 커지지 않는다 (이전 외형·글꼴 정리)', async () => {
    const first = await savePdf(sample, markups, cals, { fontBytes: font })
    let cur = first
    for (let i = 0; i < 3; i++) cur = await savePdf(cur, markups, cals, { fontBytes: font })
    expect(cur.length).toBeLessThan(first.length * 1.05)
    const pdf = await getDocument({ data: cur.slice() }).promise
    expect(await (await pdf.getPage(1)).getAnnotations()).toHaveLength(15)
    await pdf.destroy()
  })

  it('BlakPDF 데이터가 없는 PDF는 원본 바이트 그대로 보여 준다', async () => {
    const loaded = await loadPdf(sample)
    expect(loaded.viewBytes).toBe(sample)
    expect(loaded.markups).toEqual([])
  })
})
