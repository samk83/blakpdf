import { create } from 'zustand'
import { translate } from './lib/geometry'
import type { Calibration, Calibrations, Markup, MarkupStyle, MarkupType, Pt, Tool } from './lib/types'

interface Snapshot {
  markups: Markup[]
  calibrations: Calibrations
}

const HISTORY_LIMIT = 200

export const DEFAULT_STYLES: Record<MarkupType, MarkupStyle> = {
  line: { color: '#e03131', fill: null, width: 2, opacity: 1, fontSize: 12 },
  arrow: { color: '#e03131', fill: null, width: 2, opacity: 1, fontSize: 12 },
  rect: { color: '#e03131', fill: null, width: 2, opacity: 1, fontSize: 12 },
  ellipse: { color: '#e03131', fill: null, width: 2, opacity: 1, fontSize: 12 },
  polygon: { color: '#e03131', fill: null, width: 2, opacity: 1, fontSize: 12 },
  cloud: { color: '#e03131', fill: null, width: 2, opacity: 1, fontSize: 12 },
  text: { color: '#1c2b4a', fill: null, width: 0, opacity: 1, fontSize: 14 },
  callout: { color: '#e03131', fill: '#ffffff', width: 1.5, opacity: 1, fontSize: 12 },
  note: { color: '#ffd43b', fill: null, width: 1, opacity: 1, fontSize: 12 },
  pen: { color: '#1971c2', fill: null, width: 2, opacity: 1, fontSize: 12 },
  highlighter: { color: '#fab005', fill: null, width: 12, opacity: 0.4, fontSize: 12 },
  length: { color: '#3b5bdb', fill: null, width: 1.5, opacity: 1, fontSize: 12 },
  area: { color: '#2f9e44', fill: null, width: 1.5, opacity: 1, fontSize: 12 },
  perimeter: { color: '#9c36b5', fill: null, width: 1.5, opacity: 1, fontSize: 12 },
  count: { color: '#f76707', fill: null, width: 1, opacity: 1, fontSize: 12 },
}

export interface DocState {
  fileName: string | null
  filePath: string | null
  /** 저장할 때 바탕이 되는 원본 바이트 */
  original: Uint8Array | null
  /** 화면용 바이트 (BlakPDF 주석 제거본) */
  viewBytes: Uint8Array | null
  pageCount: number
  markups: Markup[]
  calibrations: Calibrations
  selectedId: string | null
  tool: Tool
  styles: Record<MarkupType, MarkupStyle>
  author: string
  dirty: boolean
  past: Snapshot[]
  future: Snapshot[]
  /** 현재 페이지 (0부터) */
  page: number
  zoom: number
  /** 화면 이동 요청 (마크업 목록 클릭 등). seq 가 바뀌면 뷰어가 스크롤한다 */
  focus: { page: number; point?: Pt; seq: number } | null

  openDocument(p: { fileName: string; filePath: string | null; original: Uint8Array; viewBytes: Uint8Array; pageCount: number; markups: Markup[]; calibrations: Calibrations }): void
  /** changedSince: 저장하는 동안 생긴 변경이 있으면 true (저장 안 됨 표시 유지) */
  markSaved(p: { fileName: string; filePath: string | null; original: Uint8Array; changedSince?: boolean }): void
  setTool(t: Tool): void
  setZoom(z: number): void
  setPage(p: number): void
  focusPage(page: number, point?: Pt): void
  select(id: string | null): void
  addMarkup(m: Omit<Markup, 'id' | 'author' | 'createdAt' | 'modifiedAt'>): Markup
  updateMarkup(id: string, patch: Partial<Markup>, opts?: { history?: boolean }): void
  moveMarkup(id: string, dx: number, dy: number): void
  deleteMarkup(id: string): void
  setCalibration(page: number, c: Calibration, allPages?: boolean): void
  setStyle(type: MarkupType, patch: Partial<MarkupStyle>): void
  setAuthor(a: string): void
  /** 연속 변경(드래그) 시작 전에 한 번만 기록 */
  checkpoint(): void
  undo(): void
  redo(): void
}

let seq = 0
let lastEdit: { key: string; t: number } | null = null
export const newId = () => `${Date.now().toString(36)}-${(seq++).toString(36)}-${Math.random().toString(36).slice(2, 7)}`

const now = () => new Date().toISOString()

function loadAuthor(): string {
  try {
    return localStorage.getItem('blakpdf.author') || '검토자'
  } catch {
    return '검토자'
  }
}

export const useDoc = create<DocState>((set, get) => {
  const snap = (): Snapshot => ({ markups: get().markups, calibrations: get().calibrations })
  const record = () => {
    lastEdit = null
    set((s) => ({ past: [...s.past, snap()].slice(-HISTORY_LIMIT), future: [], dirty: true }))
  }

  return {
    fileName: null,
    filePath: null,
    original: null,
    viewBytes: null,
    pageCount: 0,
    markups: [],
    calibrations: {},
    selectedId: null,
    tool: 'select',
    styles: DEFAULT_STYLES,
    author: loadAuthor(),
    dirty: false,
    past: [],
    future: [],
    page: 0,
    zoom: 1,
    focus: null,

    openDocument: (p) =>
      set({
        ...p,
        selectedId: null,
        dirty: false,
        past: [],
        future: [],
        page: 0,
        tool: 'select',
        focus: null,
      }),
    markSaved: ({ changedSince, ...p }) => set({ ...p, dirty: Boolean(changedSince) }),
    setTool: (tool) => set({ tool, selectedId: tool === 'select' ? get().selectedId : null }),
    setZoom: (z) => set({ zoom: Math.min(8, Math.max(0.1, z)) }),
    setPage: (page) => set({ page }),
    focusPage: (page, point) => set((s) => ({ page, focus: { page, point, seq: (s.focus?.seq ?? 0) + 1 } })),
    select: (selectedId) => set({ selectedId }),

    addMarkup: (m) => {
      record()
      const t = now()
      const full: Markup = { ...m, id: newId(), author: get().author, createdAt: t, modifiedAt: t }
      set((s) => ({ markups: [...s.markups, full] }))
      return full
    },
    updateMarkup: (id, patch, opts = {}) => {
      // 슬라이더처럼 같은 속성을 연달아 바꾸면 실행 취소 한 번에 되돌아가도록 묶는다
      const key = `${id}:${Object.keys(patch).sort().join(',')}`
      const t = Date.now()
      const coalesce = lastEdit && lastEdit.key === key && t - lastEdit.t < 800
      if (opts.history !== false && !coalesce) record()
      else set({ dirty: true })
      lastEdit = { key, t }
      set((s) => ({ markups: s.markups.map((m) => (m.id === id ? { ...m, ...patch, modifiedAt: now() } : m)) }))
    },
    moveMarkup: (id, dx, dy) => {
      set((s) => ({
        dirty: true,
        markups: s.markups.map((m) => (m.id === id ? { ...m, points: translate(m.points, dx, dy), modifiedAt: now() } : m)),
      }))
    },
    deleteMarkup: (id) => {
      if (!get().markups.some((m) => m.id === id)) return
      record()
      set((s) => ({ markups: s.markups.filter((m) => m.id !== id), selectedId: s.selectedId === id ? null : s.selectedId }))
    },
    setCalibration: (page, c, allPages = false) => {
      record()
      set((s) => {
        const next = { ...s.calibrations }
        if (allPages) for (let i = 0; i < s.pageCount; i++) next[i] = c
        else next[page] = c
        return { calibrations: next }
      })
    },
    setStyle: (type, patch) => set((s) => ({ styles: { ...s.styles, [type]: { ...s.styles[type], ...patch } } })),
    setAuthor: (author) => {
      try {
        localStorage.setItem('blakpdf.author', author)
      } catch {
        /* 저장 못 해도 동작에는 문제 없음 */
      }
      set({ author })
    },
    checkpoint: () => record(),
    undo: () => {
      lastEdit = null
      const { past } = get()
      if (!past.length) return
      const prev = past[past.length - 1]
      set((s) => ({
        past: s.past.slice(0, -1),
        future: [snap(), ...s.future],
        ...prev,
        dirty: true,
        selectedId: prev.markups.some((m) => m.id === s.selectedId) ? s.selectedId : null,
      }))
    },
    redo: () => {
      const { future } = get()
      if (!future.length) return
      const next = future[0]
      set((s) => ({
        future: s.future.slice(1),
        past: [...s.past, snap()],
        ...next,
        dirty: true,
        selectedId: next.markups.some((m) => m.id === s.selectedId) ? s.selectedId : null,
      }))
    },
  }
})
