/** 파일 열기/저장: Electron 이면 기본 대화상자, 브라우저면 파일 선택·다운로드로 대신한다 */
export interface OpenedFile {
  path: string | null
  name: string
  bytes: Uint8Array
}

interface ElectronApi {
  openPdf(): Promise<OpenedFile | null>
  readPdf(path: string): Promise<OpenedFile>
  savePdf(path: string, bytes: Uint8Array): Promise<{ path: string; name: string }>
  savePdfAs(name: string, bytes: Uint8Array): Promise<{ path: string; name: string } | null>
  saveCsv(name: string, text: string): Promise<string | null>
  setDirty(v: boolean): void
  pathForFile(f: File): string | null
}

declare global {
  interface Window {
    blakpdf?: ElectronApi
  }
}

const api = () => window.blakpdf

export const isDesktop = () => Boolean(api())

function pickFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/pdf,.pdf'
    input.onchange = () => resolve(input.files?.[0] ?? null)
    input.oncancel = () => resolve(null)
    input.click()
  })
}

export async function fileToOpened(f: File): Promise<OpenedFile> {
  return { name: f.name, path: api()?.pathForFile(f) ?? null, bytes: new Uint8Array(await f.arrayBuffer()) }
}

export async function openPdf(): Promise<OpenedFile | null> {
  const a = api()
  if (a) return a.openPdf()
  const f = await pickFile()
  return f ? fileToOpened(f) : null
}

function download(name: string, data: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** 경로가 있으면 덮어쓰고, 없으면 다른 이름으로 저장 */
export async function savePdf(path: string | null, name: string, bytes: Uint8Array): Promise<{ path: string | null; name: string } | null> {
  const a = api()
  if (a) return path ? a.savePdf(path, bytes) : a.savePdfAs(name, bytes)
  download(name, bytes as BlobPart, 'application/pdf')
  return { path: null, name }
}

export async function savePdfAs(name: string, bytes: Uint8Array) {
  return savePdf(null, name, bytes)
}

export async function saveCsv(name: string, text: string): Promise<boolean> {
  const a = api()
  if (a) return Boolean(await a.saveCsv(name, text))
  download(name, text, 'text/csv;charset=utf-8')
  return true
}

export function setDirty(v: boolean) {
  api()?.setDirty(v)
}
