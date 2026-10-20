import {
  PDFDocument, StandardFonts, rgb, LineCapStyle, concatTransformationMatrix, popGraphicsState, pushGraphicsState, type PDFFont, type PDFPage,
} from 'pdf-lib';
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

export type Matrix = [number, number, number, number, number, number];

/**
 * 화면 좌표(보이는 페이지의 왼쪽 위 원점, 아래로 +y)를 PDF 좌표로 바꾸는 변환 행렬.
 * 입력은 (u, v) = (x, -y): drawSvgPath가 y를 뒤집어 넘겨 주는 모양에 맞췄다.
 * pdf.js 화면과 같게 CropBox 원점과 페이지 회전(/Rotate, 시계 방향)을 반영한다.
 */
export function viewMatrix(box: { x: number; y: number; width: number; height: number }, rotation: number): Matrix {
  const { x, y, width: w, height: h } = box;
  switch (((rotation % 360) + 360) % 360) {
    case 90:
      return [0, 1, -1, 0, x, y];
    case 180:
      return [-1, 0, 0, -1, x + w, y];
    case 270:
      return [0, -1, 1, 0, x + w, y + h];
    default:
      return [1, 0, 0, 1, x, y + h];
  }
}

/** 화면 좌표 한 점 → PDF 좌표 (테스트·확인용) */
export function viewToPdf(m: Matrix, vx: number, vy: number) {
  const [a, b, c, d, e, f] = m;
  const u = vx;
  const v = -vy;
  return { x: a * u + c * v + e, y: b * u + d * v + f };
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
  const lines = text.split('\n');
  if (lines.every((l) => canEncode(font, l))) {
    lines.forEach((line, i) => {
      page.drawText(line, { x, y: -(topY + size * (i + 1) * 1.2 - size * 0.2), size, font, color: hexToRgb(color), opacity });
    });
    return;
  }
  if (!opts.rasterizeText) throw new Error('이 글자는 PDF 기본 글꼴로 저장할 수 없습니다.');
  const img = await opts.rasterizeText(text, size, color);
  const embedded = await page.doc.embedPng(img.png);
  page.drawImage(embedded, { x, y: -(topY + img.height), width: img.width, height: img.height, opacity });
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
    const color = hexToRgb(m.style.color);
    // 이 마크업의 그리기 명령은 q … Q 로 감싸고, 그 안에서 화면 좌표를 그대로 쓴다
    page.pushOperators(pushGraphicsState(), concatTransformationMatrix(...viewMatrix(page.getCropBox(), page.getRotation().angle)));

    for (const path of strokePaths(m)) {
      // drawSvgPath는 y축을 뒤집어 (x, -y)로 그린다 → 위 변환 행렬이 화면 좌표로 맞춰 준다
      page.drawSvgPath(path, {
        x: 0,
        y: 0,
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
    page.pushOperators(popGraphicsState());
  }
  return doc.save();
}
