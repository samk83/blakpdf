import type { TextRasterizer } from './exportPdf';

const SCALE = 4; // 저장 PDF에서 선명하도록 4배로 그린다

/** 한글 등 PDF 기본 글꼴에 없는 글자를 PNG로 그린다 (브라우저/Electron 전용). */
export const rasterizeText: TextRasterizer = async (text, fontSize, color) => {
  const lines = text.split('\n');
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('글자를 그릴 수 없습니다 (canvas 사용 불가).');
  const font = `${fontSize * SCALE}px "Malgun Gothic", "Segoe UI", sans-serif`;
  ctx.font = font;
  const width = Math.ceil(Math.max(1, ...lines.map((l) => ctx.measureText(l).width)));
  const lineH = fontSize * 1.2 * SCALE;
  canvas.width = width + 2;
  canvas.height = Math.ceil(lineH * lines.length);
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textBaseline = 'top';
  lines.forEach((l, i) => ctx.fillText(l, 0, i * lineH + fontSize * 0.1 * SCALE));
  const blob: Blob = await new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG 변환 실패'))), 'image/png'));
  return { png: new Uint8Array(await blob.arrayBuffer()), width: canvas.width / SCALE, height: canvas.height / SCALE };
};
