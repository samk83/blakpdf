// legacy 빌드: 최신 빌드는 아주 새로운 JS 기능(Map.getOrInsertComputed 등)을 써서 일부 Chromium에서 열리지 않는다
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export type PdfDoc = pdfjs.PDFDocumentProxy;
export type PdfPage = pdfjs.PDFPageProxy;

const tasks = new WeakMap<PdfDoc, pdfjs.PDFDocumentLoadingTask>();

export async function loadPdf(bytes: Uint8Array): Promise<PdfDoc> {
  // pdf.js는 넘겨받은 버퍼를 워커로 옮기며 비워 버리므로 복사본을 넘긴다 (원본은 저장할 때 필요)
  const task = pdfjs.getDocument({ data: bytes.slice() });
  const doc = await task.promise;
  tasks.set(doc, task);
  return doc;
}

/** 다른 파일을 열 때 이전 문서의 메모리를 돌려준다 */
export function closePdf(doc: PdfDoc | null) {
  if (doc) void tasks.get(doc)?.destroy();
}

export interface PageSize {
  width: number;
  height: number;
}

export async function getPageSizes(doc: PdfDoc): Promise<PageSize[]> {
  const sizes: PageSize[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const vp = page.getViewport({ scale: 1 });
    sizes.push({ width: vp.width, height: vp.height });
  }
  return sizes;
}

/** canvas에 페이지를 그린다. 이전 그리기 작업이 있으면 취소할 수 있게 RenderTask를 돌려준다. */
export function renderPage(page: PdfPage, canvas: HTMLCanvasElement, scale: number) {
  const ratio = window.devicePixelRatio || 1;
  const vp = page.getViewport({ scale: scale * ratio });
  canvas.width = Math.floor(vp.width);
  canvas.height = Math.floor(vp.height);
  canvas.style.width = `${Math.floor(vp.width / ratio)}px`;
  canvas.style.height = `${Math.floor(vp.height / ratio)}px`;
  return page.render({ canvas, viewport: vp });
}
