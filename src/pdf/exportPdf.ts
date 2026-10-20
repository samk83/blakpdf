import { PDFDocument, StandardFonts, rgb, LineCapStyle, type PDFFont, type PDFPage } from 'pdf-lib';
import { strokePaths, midpoint } from '../markup/geometry';
import { DEFAULT_CALIBRATION, formatMeasure, measureLength } from '../markup/measure';
import type { Calibration, Markup } from '../markup/types';

export function hexToRgb(hex: string) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

/** Helvetica로 못 쓰는 글자(한글 등)가 있는 텍스트를 PNG로 바꿔 주는 함수. 브라우저에서만 넘긴다. */
export type TextRasterizer = (text: string, fontSize: number, color: string) => Promise<{ png: Uint8Array; width: number; height: number }>;

export interface ExportOptions {
  rasterizeText?: TextRasterizer;
}

function canEncode(font: PDFFont, text: string): boolean {
  try {
    font.encodeText(text);
    return true;
  } catch {
    return false;
  }
}

async function drawTextBlock(
  page: PDFPage,
  font: PDFFont,
  text: string,
  x: number,
  topY: number,
  size: number,
  color: string,
  opacity: number,
  opts: ExportOptions,
) {
  const pageH = page.getHeight();
  const lines = text.split('\n');
  if (lines.every((l) => canEncode(font, l))) {
    lines.forEach((line, i) => {
      page.drawText(line, { x, y: pageH - topY - size * (i + 1) * 1.2 + size * 0.2, size, font, color: hexToRgb(color), opacity });
    });
    return;
  }
  if (!opts.rasterizeText) throw new Error('이 글자는 PDF 기본 글꼴로 저장할 수 없습니다.');
  const img = await opts.rasterizeText(text, size, color);
  const embedded = await page.doc.embedPng(img.png);
  page.drawImage(embedded, { x, y: pageH - topY - img.height, width: img.width, height: img.height, opacity });
}

/**
 * 원본 PDF 바이트 + 마크업 → 마크업이 그려진 새 PDF 바이트.
 * 원본은 바꾸지 않는다. 마크업은 페이지 내용으로 그려 넣는다(평탄화).
 */
export async function exportPdf(
  original: Uint8Array,
  markups: Markup[],
  calibrations: Record<number, Calibration>,
  opts: ExportOptions = {},
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(original, { ignoreEncryption: true });
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();

  for (const m of markups) {
    const page = pages[m.page - 1];
    if (!page) continue;
    const pageH = page.getHeight();
    const color = hexToRgb(m.style.color);

    for (const path of strokePaths(m)) {
      // drawSvgPath는 (x, y)를 SVG 원점으로 보고 y축을 뒤집어 준다 → 왼쪽 위 원점 좌표를 그대로 쓸 수 있다
      page.drawSvgPath(path, {
        x: 0,
        y: pageH,
        borderColor: color,
        borderWidth: m.style.width,
        borderOpacity: m.style.opacity,
        borderLineCap: LineCapStyle.Round,
      });
    }

    if (m.kind === 'text' && m.text) {
      await drawTextBlock(page, font, m.text, m.points[0].x + 4, m.points[0].y + 3, m.fontSize ?? 14, m.style.color, m.style.opacity, opts);
    }
    if (m.kind === 'length') {
      const cal = calibrations[m.page] ?? DEFAULT_CALIBRATION;
      const label = formatMeasure(measureLength(m.points, cal), cal.unit);
      const mid = midpoint(m.points[0], m.points[1]);
      const size = 11;
      await drawTextBlock(page, font, label, mid.x + 4, mid.y - size - 6, size, m.style.color, 1, opts);
    }
  }
  return doc.save();
}
