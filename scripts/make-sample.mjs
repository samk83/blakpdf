// 테스트·시연용 샘플 도면 PDF를 만든다: node scripts/make-sample.mjs
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { writeFileSync, mkdirSync } from 'node:fs'

const doc = await PDFDocument.create()
const font = await doc.embedFont(StandardFonts.Helvetica)
for (let n = 1; n <= 3; n++) {
  // A3 가로 (pt)
  const page = doc.addPage([1190.55, 841.89])
  const { width, height } = page.getSize()
  const gray = rgb(0.25, 0.27, 0.3)
  // 도면 테두리 + 표제란
  page.drawRectangle({ x: 20, y: 20, width: width - 40, height: height - 40, borderColor: gray, borderWidth: 1.5 })
  page.drawRectangle({ x: width - 320, y: 20, width: 300, height: 90, borderColor: gray, borderWidth: 1 })
  page.drawText(`SAMPLE FLOOR PLAN  -  SHEET A-10${n}`, { x: width - 310, y: 80, size: 12, font, color: gray })
  page.drawText('Scale 1:100  (100 pt = 1 m grid)', { x: width - 310, y: 60, size: 9, font, color: gray })
  page.drawText('BlakPDF test drawing', { x: width - 310, y: 40, size: 9, font, color: gray })
  // 100pt 격자
  for (let x = 100; x < width - 20; x += 100) page.drawLine({ start: { x, y: 120 }, end: { x, y: height - 20 }, thickness: 0.3, color: rgb(0.85, 0.87, 0.9) })
  for (let y = 200; y < height - 20; y += 100) page.drawLine({ start: { x: 20, y }, end: { x: width - 20, y }, thickness: 0.3, color: rgb(0.85, 0.87, 0.9) })
  // 방 외곽
  const walls = [[100, 200, 700, 200], [700, 200, 700, 700], [700, 700, 100, 700], [100, 700, 100, 200], [400, 200, 400, 500], [400, 600, 400, 700], [100, 450, 300, 450]]
  for (const [x1, y1, x2, y2] of walls) page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: 6, color: rgb(0.15, 0.16, 0.18) })
  page.drawText('ROOM 101', { x: 200, y: 600, size: 14, font, color: gray })
  page.drawText('ROOM 102', { x: 520, y: 400, size: 14, font, color: gray })
  page.drawText('6.00 m', { x: 380, y: 180, size: 10, font, color: gray })
}
mkdirSync('tests/fixtures', { recursive: true })
writeFileSync('tests/fixtures/sample-plan.pdf', await doc.save())
console.log('tests/fixtures/sample-plan.pdf')
