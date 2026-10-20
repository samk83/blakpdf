import { create } from 'zustand'

export type Theme = 'light' | 'dark'

export interface Toast {
  id: number
  kind: 'info' | 'success' | 'error'
  text: string
}

interface UiState {
  theme: Theme
  showThumbs: boolean
  showList: boolean
  showProps: boolean
  /** 축척 보정 대화상자 */
  calibrating: { page: number; pdfDistance: number } | null
  /** 속성 패널의 내용 입력칸에 포커스 요청 */
  textFocusSeq: number
  /** 상태 표시줄에 보일 커서 위치·진행 중 측정값 */
  cursor: { page: number; x: number; y: number } | null
  live: string | null
  toasts: Toast[]
  busy: string | null
  setTheme(t: Theme): void
  toggle(k: 'showThumbs' | 'showList' | 'showProps'): void
  setCalibrating(c: UiState['calibrating']): void
  requestTextFocus(): void
  setCursor(c: UiState['cursor']): void
  setLive(s: string | null): void
  toast(kind: Toast['kind'], text: string): void
  dismiss(id: number): void
  setBusy(s: string | null): void
}

function initialTheme(): Theme {
  try {
    const t = localStorage.getItem('blakpdf.theme')
    if (t === 'light' || t === 'dark') return t
  } catch {
    /* 무시 */
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

let toastId = 0

export const useUi = create<UiState>((set) => ({
  theme: initialTheme(),
  showThumbs: true,
  showList: true,
  showProps: true,
  calibrating: null,
  textFocusSeq: 0,
  cursor: null,
  live: null,
  toasts: [],
  busy: null,
  setTheme: (theme) => {
    try {
      localStorage.setItem('blakpdf.theme', theme)
    } catch {
      /* 무시 */
    }
    set({ theme })
  },
  toggle: (k) => set((s) => ({ [k]: !s[k] }) as Partial<UiState>),
  setCalibrating: (calibrating) => set({ calibrating }),
  requestTextFocus: () => set((s) => ({ textFocusSeq: s.textFocusSeq + 1 })),
  setCursor: (cursor) => set({ cursor }),
  setLive: (live) => set({ live }),
  toast: (kind, text) => {
    const id = ++toastId
    set((s) => ({ toasts: [...s.toasts, { id, kind, text }] }))
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), kind === 'error' ? 6000 : 3000)
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  setBusy: (busy) => set({ busy }),
}))
