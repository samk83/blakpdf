import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

/** 테스트용 2쪽짜리 A4 가로 "도면" PDF */
export async function makeSamplePdf(pages = 2): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= pages; i++) {
    const page = doc.addPage([842, 595]);
    page.drawRectangle({ x: 40, y: 40, width: 762, height: 515, borderColor: rgb(0, 0, 0), borderWidth: 2 });
    page.drawText(`SAMPLE DRAWING - SHEET ${i}`, { x: 60, y: 520, size: 20, font });
    // 100pt 짜리 기준선 (축척 테스트용)
    page.drawLine({ start: { x: 100, y: 300 }, end: { x: 200, y: 300 }, thickness: 1 });
  }
  return doc.save();
}
