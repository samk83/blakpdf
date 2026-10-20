/** 머리글·도구 막대·상태 표시줄 */
import {
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  Maximize2,
  MoveHorizontal,
  Moon,
  PanelBottom,
  PanelLeft,
  PanelRight,
  Redo2,
  Save,
  SaveAll,
  Sun,
  Undo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { useState } from 'react'
import { useDoc } from '../store'
import { MARKUP_TOOLS, MEASURE_TOOLS, NAV_TOOLS, type ToolDef } from '../tools'
import { useUi } from '../ui-store'
import { Button, cx, Divider, IconButton, inputCls } from './ui'
import { viewerControls } from './Viewer'

export function Logo() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
      <rect x="2" y="2" width="20" height="20" rx="6" fill="var(--color-primary)" />
      <path d="M8 6.5h5.2a3 3 0 0 1 .9 5.86A3.2 3.2 0 0 1 13.4 18.5H8z" fill="none" stroke="var(--color-primary-text)" strokeWidth="2" strokeLinejoin="round" />
      <path d="M8 12.2h5" stroke="var(--color-primary-text)" strokeWidth="2" />
    </svg>
  )
}

export function Header({ onOpen, onSave, onSaveAs }: { onOpen: () => void; onSave: () => void; onSaveAs: () => void }) {
  const fileName = useDoc((s) => s.fileName)
  const dirty = useDoc((s) => s.dirty)
  const author = useDoc((s) => s.author)
  const canUndo = useDoc((s) => s.past.length > 0)
  const canRedo = useDoc((s) => s.future.length > 0)
  const theme = useUi((s) => s.theme)
  const busy = useUi((s) => s.busy)
  const [editingAuthor, setEditingAuthor] = useState(false)

  return (
    <header className="flex h-[var(--header-h)] shrink-0 items-center gap-2 border-b border-border bg-surface px-3">
      <div className="flex items-center gap-2 pr-2">
        <Logo />
        <span className="text-[var(--text-lg)] font-bold tracking-tight">BlakPDF</span>
      </div>
      <Divider />
      <Button variant="ghost" icon={FolderOpen} onClick={onOpen}>
        열기
      </Button>
      <Button variant="ghost" icon={Save} onClick={onSave} disabled={!fileName || !!busy}>
        저장
      </Button>
      <IconButton icon={SaveAll} label="다른 이름으로 저장" shortcut="Ctrl+Shift+S" onClick={onSaveAs} disabled={!fileName || !!busy} />
      <Divider />
      <IconButton icon={Undo2} label="실행 취소" shortcut="Ctrl+Z" onClick={() => useDoc.getState().undo()} disabled={!canUndo} />
      <IconButton icon={Redo2} label="다시 실행" shortcut="Ctrl+Y" onClick={() => useDoc.getState().redo()} disabled={!canRedo} />

      <div className="mx-auto flex min-w-0 items-center gap-2 px-4" aria-live="polite">
        {fileName ? (
          <>
            <span className="truncate font-medium" data-testid="file-name">
              {fileName}
            </span>
            {dirty ? (
              <span className="flex items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 text-[var(--text-xs)] font-medium text-primary" data-testid="dirty">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" /> 저장 안 됨
              </span>
            ) : (
              <span className="text-[var(--text-xs)] text-subtle">저장됨</span>
            )}
          </>
        ) : (
          <span className="text-muted">열린 문서 없음</span>
        )}
        {busy && <span className="text-[var(--text-xs)] text-muted">{busy}</span>}
      </div>

      {editingAuthor ? (
        <input
          autoFocus
          aria-label="작성자 이름"
          defaultValue={author}
          className={cx(inputCls, 'h-7 w-36 select-text')}
          onBlur={(e) => {
            const v = e.target.value.trim()
            if (v) useDoc.getState().setAuthor(v)
            setEditingAuthor(false)
          }}
          onKeyDown={(e) => {
            e.stopPropagation()
            if (e.key === 'Enter' || e.key === 'Escape') (e.target as HTMLInputElement).blur()
          }}
        />
      ) : (
        <button
          onClick={() => setEditingAuthor(true)}
          className="flex h-8 items-center gap-2 rounded-[var(--radius-sm)] px-2 text-[var(--text-sm)] text-muted hover:bg-surface-hover hover:text-fg"
          aria-label={`작성자: ${author} (바꾸려면 클릭)`}
          title="작성자 이름 바꾸기"
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-soft text-[var(--text-xs)] font-semibold text-primary">{author.slice(0, 1)}</span>
          {author}
        </button>
      )}
      <IconButton
        icon={theme === 'dark' ? Sun : Moon}
        label={theme === 'dark' ? '밝은 테마' : '어두운 테마'}
        onClick={() => useUi.getState().setTheme(theme === 'dark' ? 'light' : 'dark')}
      />
    </header>
  )
}

function ToolGroup({ label, tools }: { label: string; tools: ToolDef[] }) {
  const tool = useDoc((s) => s.tool)
  return (
    <div role="group" aria-label={label} className="flex items-center gap-0.5">
      {tools.map((t) => (
        <IconButton
          key={t.id}
          icon={t.icon}
          label={t.label}
          shortcut={t.key}
          active={tool === t.id}
          data-tool={t.id}
          onClick={() => useDoc.getState().setTool(t.id)}
        />
      ))}
    </div>
  )
}

export function Toolbar({ disabled }: { disabled: boolean }) {
  const ui = useUi()
  return (
    <div
      role="toolbar"
      aria-label="도구"
      className={cx('flex h-[var(--toolbar-h)] shrink-0 items-center gap-1 border-b border-border bg-surface px-2', disabled && 'pointer-events-none opacity-50')}
    >
      <IconButton icon={PanelLeft} label="페이지 패널" active={ui.showThumbs} onClick={() => ui.toggle('showThumbs')} />
      <Divider />
      <ToolGroup label="탐색" tools={NAV_TOOLS} />
      <Divider />
      <span className="px-1 text-[var(--text-xs)] font-medium text-subtle">마크업</span>
      <ToolGroup label="마크업" tools={MARKUP_TOOLS} />
      <Divider />
      <span className="px-1 text-[var(--text-xs)] font-medium text-subtle">측정</span>
      <ToolGroup label="측정" tools={MEASURE_TOOLS} />
      <div className="ml-auto flex items-center gap-0.5">
        <IconButton icon={PanelBottom} label="마크업 목록" active={ui.showList} onClick={() => ui.toggle('showList')} />
        <IconButton icon={PanelRight} label="속성 패널" active={ui.showProps} onClick={() => ui.toggle('showProps')} />
      </div>
    </div>
  )
}

export function StatusBar() {
  const page = useDoc((s) => s.page)
  const pageCount = useDoc((s) => s.pageCount)
  const zoom = useDoc((s) => s.zoom)
  const cal = useDoc((s) => s.calibrations[s.page])
  const tool = useDoc((s) => s.tool)
  const cursor = useUi((s) => s.cursor)
  const live = useUi((s) => s.live)
  const [pageInput, setPageInput] = useState<string | null>(null)
  const hint = [...NAV_TOOLS, ...MARKUP_TOOLS, ...MEASURE_TOOLS].find((t) => t.id === tool)?.hint
  const go = (p: number) => useDoc.getState().focusPage(Math.max(0, Math.min(pageCount - 1, p)))

  return (
    <footer className="flex h-[var(--status-h)] shrink-0 items-center gap-1 border-t border-border bg-surface px-2 text-[var(--text-sm)] text-muted">
      <IconButton size="sm" icon={ChevronLeft} label="이전 페이지" tooltipSide="top" onClick={() => go(page - 1)} disabled={page <= 0} />
      <div className="flex items-center gap-1">
        <input
          aria-label="페이지 번호"
          data-testid="page-input"
          className="h-6 w-10 rounded border border-border bg-surface text-center text-fg tabular outline-none select-text focus:border-primary"
          value={pageInput ?? String(pageCount ? page + 1 : 0)}
          onFocus={(e) => {
            setPageInput(String(page + 1))
            requestAnimationFrame(() => e.target.select())
          }}
          onChange={(e) => setPageInput(e.target.value.replace(/\D/g, ''))}
          onBlur={() => setPageInput(null)}
          onKeyDown={(e) => {
            e.stopPropagation()
            if (e.key === 'Enter') {
              go(Number(pageInput || page + 1) - 1)
              ;(e.target as HTMLInputElement).blur()
            }
          }}
        />
        <span className="tabular" data-testid="page-total">/ {pageCount}</span>
      </div>
      <IconButton size="sm" icon={ChevronRight} label="다음 페이지" tooltipSide="top" onClick={() => go(page + 1)} disabled={page >= pageCount - 1} />
      <Divider />
      <IconButton size="sm" icon={ZoomOut} label="축소" shortcut="Ctrl+-" tooltipSide="top" onClick={() => viewerControls.zoomBy(1 / 1.25)} />
      <span className="w-12 text-center text-fg tabular" data-testid="zoom">
        {Math.round(zoom * 100)}%
      </span>
      <IconButton size="sm" icon={ZoomIn} label="확대" shortcut="Ctrl++" tooltipSide="top" onClick={() => viewerControls.zoomBy(1.25)} />
      <IconButton size="sm" icon={MoveHorizontal} label="폭 맞춤" shortcut="Ctrl+0" tooltipSide="top" onClick={() => viewerControls.fitWidth()} />
      <IconButton size="sm" icon={Maximize2} label="쪽 맞춤" shortcut="Ctrl+9" tooltipSide="top" onClick={() => viewerControls.fitPage()} />
      <Divider />
      <span className="truncate" data-testid="scale">
        축척 {cal ? `${cal.pdfDistance.toFixed(1)}pt = ${cal.realDistance} ${cal.unit}` : '미보정'}
      </span>
      <div className="ml-auto flex min-w-0 items-center gap-3">
        {live ? (
          <span className="font-semibold text-primary tabular" data-testid="live">
            {live}
          </span>
        ) : (
          hint && <span className="truncate text-subtle">{hint}</span>
        )}
        {cursor && (
          <span className="w-36 text-right tabular text-subtle">
            X {cursor.x.toFixed(0)} · Y {cursor.y.toFixed(0)} pt
          </span>
        )}
      </div>
    </footer>
  )
}
