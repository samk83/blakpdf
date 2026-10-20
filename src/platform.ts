// Electron(PC 프로그램)과 일반 브라우저(개발·테스트용) 양쪽에서 파일 열기/저장을 같은 방식으로 쓰게 하는 연결부

export interface OpenedFile {
  name: string;
  path: string | null;
  data: Uint8Array;
}

export type MenuCommand = 'open' | 'save' | 'saveAs';

interface DesktopBridge {
  openFile(): Promise<OpenedFile | null>;
  saveFile(path: string | null, data: Uint8Array, suggestedName: string): Promise<{ path: string; name: string } | null>;
  onMenu(cb: (cmd: MenuCommand) => void): () => void;
  setDirty(dirty: boolean): void;
  setTitle(title: string): void;
}

declare global {
  interface Window {
    blakpdf?: DesktopBridge;
  }
}

export const isDesktop = () => typeof window !== 'undefined' && !!window.blakpdf;

export async function readFile(file: File): Promise<OpenedFile> {
  return { name: file.name, path: null, data: new Uint8Array(await file.arrayBuffer()) };
}

/** 브라우저: 파일 선택 창. Electron: 운영체제 열기 창 */
export function openFileDialog(): Promise<OpenedFile | null> {
  if (window.blakpdf) return window.blakpdf.openFile();
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/pdf,.pdf';
    input.onchange = async () => resolve(input.files?.[0] ? await readFile(input.files[0]) : null);
    input.click();
  });
}

/** path가 null이면 "다른 이름으로 저장" 창을 연다. 브라우저에서는 내려받기로 저장한다. */
export async function saveFileDialog(path: string | null, data: Uint8Array, suggestedName: string) {
  if (window.blakpdf) return window.blakpdf.saveFile(path, data, suggestedName);
  const blob = new Blob([data as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = suggestedName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return { path: suggestedName, name: suggestedName };
}

export function markupFileName(name: string): string {
  const base = name.replace(/\.pdf$/i, '');
  return base.endsWith('_markup') ? `${base}.pdf` : `${base}_markup.pdf`;
}
