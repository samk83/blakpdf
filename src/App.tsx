import * as RTooltip from '@radix-ui/react-tooltip'
import { useCallback, useEffect, useState } from 'react'
import { Header, StatusBar, Toolbar } from './components/Chrome'
import { MarkupList } from './components/MarkupList'
import { CalibrateDialog, EmptyState, Toasts } from './components/Overlays'
import { PropertiesPanel } from './components/PropertiesPanel'
import { Thumbnails } from './components/Thumbnails'
import { Viewer, viewerControls } from './components/Viewer'
import { toCsv } from './lib/csv'
import { loadSaveFont } from './lib/fonts'
import { loadPdf, savePdf } from './lib/pdfio'
import * as platform from './lib/platform'
import type { Matrix, PageInfo } from './lib/viewport'
import { openPdfJs, type PDFDocumentProxy } from './pdf/pdfjs'
import { useDoc } from './store'
import { ALL_TOOLS } from './tools'
import { useUi } from './ui-store'

function baseName(name: string) {
  return name.replace(/\.pdf$/i, '')
}

export default function App() {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null)
  const [pages, setPages] = useState<PageInfo[]>([])
  const [dragging, setDragging] = useState(false)
  const theme = useUi((s) => s.theme)
  const ui = useUi()
  const fileName = useDoc((s) => s.fileName)
  const dirty = useDoc((s) => s.dirty)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  useEffect(() => {
    document.title = fileName ? `${dirty ? '● ' : ''}${fileName} — BlakPDF` : 'BlakPDF'
    platform.setDirty(dirty)
  }, [fileName, dirty])

  // 브라우저에서 실행할 때도 닫기 전 확인
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (useDoc.getState().dirty && !platform.isDesktop()) e.preventDefault()
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  const openBytes = useCallback(async (file: platform.OpenedFile) => {
    const u = useUi.getState()
    if (useDoc.getState().dirty && !window.confirm('저장하지 않은 마크업이 있습니다. 버리고 새 문서를 열까요?')) return
    u.setBusy('여는 중…')
    try {
      const loaded = await loadPdf(file.bytes)
      const doc = await openPdfJs(loaded.viewBytes)
      const infos: PageInfo[] = []
      for (let i = 1; i <= doc.numPages; i++) {
        const vp = (await doc.getPage(i)).getViewport({ scale: 1 })
        infos.push({ width: vp.width, height: vp.height, transform: vp.transform as Matrix })
      }
      setPdf((old) => {
        old?.destroy()
        return doc
      })
      setPages(infos)
      useDoc.getState().openDocument({
        fileName: file.name,
        filePath: file.path,
        original: file.bytes,
        viewBytes: loaded.viewBytes,
        pageCount: doc.numPages,
        markups: loaded.markups,
        calibrations: loaded.calibrations,
      })
      if (loaded.markups.length) u.toast('info', `저장된 마크업 ${loaded.markups.length}개를 불러왔습니다.`)
    } catch (e) {
      console.error(e)
      u.toast('error', `PDF를 열 수 없습니다. 파일이 손상되었거나 암호가 걸려 있을 수 있습니다. (${(e as Error).message})`)
    } finally {
      u.setBusy(null)
    }
  }, [])

  const onOpen = useCallback(async () => {
    const f = await platform.openPdf()
    if (f) await openBytes(f)
  }, [openBytes])

  const onSample = useCallback(async () => {
    const r = await fetch(new URL('./sample-plan.pdf', document.baseURI).href)
    await openBytes({ name: 'sample-plan.pdf', path: null, bytes: new Uint8Array(await r.arrayBuffer()) })
  }, [openBytes])

  const doSave = useCallback(async (asNew: boolean) => {
    const d = useDoc.getState()
    const u = useUi.getState()
    if (!d.original || !d.fileName || u.busy) return
    u.setBusy('저장 중…')
    // 입력 중인 글자를 먼저 반영한다
    ;(document.activeElement as HTMLElement | null)?.blur?.()
    const snap = useDoc.getState()
    try {
      const bytes = await savePdf(snap.original!, snap.markups, snap.calibrations, { fontBytes: await loadSaveFont() })
      const target = asNew ? null : d.filePath
      const name = asNew ? `${baseName(d.fileName)}-markup.pdf` : d.fileName
      const r = await platform.savePdf(target, name, bytes)
      if (!r) return
      const now = useDoc.getState()
      now.markSaved({
        fileName: r.name,
        filePath: r.path,
        original: bytes,
        changedSince: now.markups !== snap.markups || now.calibrations !== snap.calibrations,
      })
      u.toast('success', `저장했습니다: ${r.name}`)
    } catch (e) {
      console.error(e)
      u.toast('error', `저장하지 못했습니다. 파일이 다른 프로그램에서 열려 있으면 닫고 다시 시도하세요. (${(e as Error).message})`)
    } finally {
      u.setBusy(null)
    }
  }, [])

  const onExport = useCallback(async () => {
    const d = useDoc.getState()
    if (!d.markups.length) return
    const ok = await platform.saveCsv(`${baseName(d.fileName ?? 'markups')}-markups.csv`, toCsv(d.markups, d.calibrations))
    if (ok) useUi.getState().toast('success', `마크업 ${d.markups.length}개를 CSV로 내보냈습니다.`)
  }, [])

  // 단축키
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const typing = target?.closest("textarea, select, [contenteditable], input:not([type=range]):not([type=checkbox]):not([type=color]):not([type=radio])")
      const ctrl = e.ctrlKey || e.metaKey
      const d = useDoc.getState()
      if (ctrl) {
        const k = e.key.toLowerCase()
        if (k === 'o') return e.preventDefault(), void onOpen()
        if (k === 's') return e.preventDefault(), void doSave(e.shiftKey)
        if (typing) return
        if (k === 'z' && !e.shiftKey) return e.preventDefault(), d.undo()
        if (k === 'y' || (k === 'z' && e.shiftKey)) return e.preventDefault(), d.redo()
        if (!pdf) return
        if (k === '=' || k === '+') return e.preventDefault(), viewerControls.zoomBy(1.25)
        if (k === '-') return e.preventDefault(), viewerControls.zoomBy(1 / 1.25)
        if (k === '0') return e.preventDefault(), viewerControls.fitWidth()
        if (k === '9') return e.preventDefault(), viewerControls.fitPage()
        return
      }
      if (typing || e.altKey || !pdf) return
      if ((e.key === 'Delete' || e.key === 'Backspace') && d.selectedId) {
        e.preventDefault()
        d.deleteMarkup(d.selectedId)
        return
      }
      if (e.key === 'Escape') {
        if (d.selectedId) d.select(null)
        else d.setTool('select')
        return
      }
      if (e.key === 'PageDown') return e.preventDefault(), d.focusPage(Math.min(d.pageCount - 1, d.page + 1))
      if (e.key === 'PageUp') return e.preventDefault(), d.focusPage(Math.max(0, d.page - 1))
      const t = ALL_TOOLS.find((x) => x.key.toLowerCase() === e.key.toLowerCase())
      if (t) d.setTool(t.id)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onOpen, doSave, pdf])

  // 파일 끌어다 놓기
  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const f = [...e.dataTransfer.files].find((x) => x.name.toLowerCase().endsWith('.pdf'))
    if (!f) {
      useUi.getState().toast('error', 'PDF 파일만 열 수 있습니다.')
      return
    }
    await openBytes(await platform.fileToOpened(f))
  }

  return (
    <RTooltip.Provider delayDuration={350} skipDelayDuration={150}>
      <div
        className="flex h-full flex-col"
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes('Files')) {
            e.preventDefault()
            setDragging(true)
          }
        }}
        onDragLeave={(e) => e.currentTarget === e.target && setDragging(false)}
        onDrop={onDrop}
      >
        <Header onOpen={onOpen} onSave={() => doSave(false)} onSaveAs={() => doSave(true)} />
        <Toolbar disabled={!pdf} />
        <div className="flex min-h-0 flex-1">
          {pdf && ui.showThumbs && (
            <div className="w-[172px] shrink-0 border-r border-border bg-surface">
              <Thumbnails pdf={pdf} pages={pages} />
            </div>
          )}
          <div className="flex min-w-0 flex-1 flex-col">
            <main className="relative min-h-0 flex-1">
              {pdf ? <Viewer pdf={pdf} pages={pages} /> : <EmptyState onOpen={onOpen} onSample={onSample} dragging={dragging} />}
              {pdf && dragging && (
                <div className="pointer-events-none absolute inset-3 flex items-center justify-center rounded-[var(--radius-lg)] border-2 border-dashed border-primary bg-primary-soft/70 text-[var(--text-lg)] font-semibold text-primary">
                  놓으면 이 PDF를 엽니다
                </div>
              )}
            </main>
            {pdf && ui.showList && (
              <div className="h-[220px] shrink-0 border-t border-border bg-surface">
                <MarkupList onExport={onExport} />
              </div>
            )}
          </div>
          {pdf && ui.showProps && (
            <div className="w-[264px] shrink-0 border-l border-border bg-surface">
              <PropertiesPanel />
            </div>
          )}
        </div>
        <StatusBar />
        <CalibrateDialog />
        <Toasts />
      </div>
    </RTooltip.Provider>
  )
}
