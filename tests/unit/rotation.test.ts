import { describe, expect, it } from 'vitest';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { PDFDocument } from 'pdf-lib';
import { viewMatrix, viewToPdf } from '../../src/pdf/exportPdf';
import { makeTrickyPdf } from '../fixtures';

// 화면(pdf.js 뷰포트)과 저장(pdf-lib)이 같은 점을 가리키는지, pdf.js 자체 계산과 비교한다
describe('회전·CropBox 페이지 저장 좌표', () => {
  const cases: [number, [number, number, number, number] | undefined][] = [
    [0, undefined],
    [90, undefined],
    [180, undefined],
    [270, undefined],
    [0, [100, 100, 500, 300]],
    [90, [100, 100, 500, 300]],
    [270, [50, 20, 600, 400]],
  ];
  for (const [rot, crop] of cases) {
    it(`회전 ${rot}°${crop ? ' + CropBox' : ''}`, async () => {
      const bytes = await makeTrickyPdf(rot, crop);
      const lib = (await PDFDocument.load(bytes)).getPages()[0];
      const m = viewMatrix(lib.getCropBox(), lib.getRotation().angle);

      const task = pdfjs.getDocument({ data: bytes.slice() });
      const doc = await task.promise;
      const vp = (await doc.getPage(1)).getViewport({ scale: 1 });
      for (const [vx, vy] of [[0, 0], [100, 50], [vp.width, vp.height], [vp.width / 3, vp.height - 10]]) {
        const [ex, ey] = vp.convertToPdfPoint(vx, vy);
        const got = viewToPdf(m, vx, vy);
        expect(got.x).toBeCloseTo(ex, 3);
        expect(got.y).toBeCloseTo(ey, 3);
      }
      await task.destroy();
    });
  }
});
