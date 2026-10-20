// 테스트·시연용 샘플 도면 PDF를 만든다: node scripts/make-sample.mjs [출력경로]
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const out = process.argv[2] ?? 'tests/e2e/fixtures/sample.pdf';
const doc = await PDFDocument.create();
const font = await doc.embedFont(StandardFonts.Helvetica);
for (let i = 1; i <= 3; i++) {
  const page = doc.addPage([842, 595]);
  page.drawRectangle({ x: 30, y: 30, width: 782, height: 535, borderColor: rgb(0, 0, 0), borderWidth: 2 });
  page.drawText(`SAMPLE FLOOR PLAN - SHEET A-10${i}`, { x: 50, y: 535, size: 18, font });
  for (let x = 100; x <= 700; x += 100) page.drawLine({ start: { x, y: 80 }, end: { x, y: 480 }, thickness: 0.5, color: rgb(0.6, 0.6, 0.6) });
  page.drawText('100 pt = 5 m', { x: 100, y: 60, size: 10, font });
  page.drawLine({ start: { x: 100, y: 75 }, end: { x: 200, y: 75 }, thickness: 1.5 });
}
await mkdir(dirname(out), { recursive: true });
await writeFile(out, await doc.save());
console.log(`만듦: ${out}`);
