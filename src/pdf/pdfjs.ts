// legacy 빌드: 최신 JS 기능을 보완(polyfill)해 Electron·브라우저 버전 차이에 안전
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

const asset = (p: string) => new URL(`./pdfjs/${p}/`, document.baseURI).href

export async function openPdfJs(bytes: Uint8Array): Promise<PDFDocumentProxy> {
  // pdf.js 는 전달한 버퍼를 워커로 넘기며 비우므로 사본을 준다
  return pdfjs.getDocument({
    data: bytes.slice(),
    cMapUrl: asset('cmaps'),
    cMapPacked: true,
    standardFontDataUrl: asset('standard_fonts'),
    wasmUrl: asset('wasm'),
    iccUrl: asset('iccs'),
  }).promise
}

export { pdfjs }
export type { PDFDocumentProxy }
