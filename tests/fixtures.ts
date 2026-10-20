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

/** 회전·CropBox가 있는 1쪽 PDF (실제 도면에서 흔한 모양) */
export async function makeTrickyPdf(rotation: number, crop?: [number, number, number, number]): Promise<Uint8Array> {
  const { degrees } = await import('pdf-lib');
  const doc = await PDFDocument.create();
  const page = doc.addPage([842, 595]);
  page.drawRectangle({ x: 0, y: 0, width: 842, height: 595, borderColor: rgb(0, 0, 0), borderWidth: 1 });
  page.setRotation(degrees(rotation));
  if (crop) page.setCropBox(...crop);
  return doc.save();
}
