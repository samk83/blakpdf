import * as Dialog from '@radix-ui/react-dialog'
import { AlertCircle, CheckCircle2, DraftingCompass, FileText, FolderOpen, Info, Ruler, Upload, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { makeCalibration, UNITS } from '../lib/measure'
import { useDoc } from '../store'
import { useUi } from '../ui-store'
import { Logo } from './Chrome'
import { Button, cx, Field, inputCls, Kbd } from './ui'

export function CalibrateDialog() {
  const calibrating = useUi((s) => s.calibrating)
  const [real, setReal] = useState('1')
  const [unit, setUnit] = useState<string>('m')
  const [all, setAll] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (calibrating) setError(null)
  }, [calibrating])

  const close = () => useUi.getState().setCalibrating(null)
  const apply = () => {
    if (!calibrating) return
    try {
      const c = makeCalibration(calibrating.pdfDistance, Number(real.replace(',', '.')), unit)
      useDoc.getState().setCalibration(calibrating.page, c, all)
      useUi.getState().toast('success', `축척을 맞췄습니다: ${calibrating.pdfDistance.toFixed(1)}pt = ${c.realDistance} ${unit}${all ? ' (모든 페이지)' : ''}`)
      useDoc.getState().setTool('length')
      close()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <Dialog.Root open={!!calibrating} onOpenChange={(o) => !o && close()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[var(--z-dialog)] bg-black/30 backdrop-blur-[1px]" />
        <Dialog.Content
          className="animate-in fixed top-1/2 left-1/2 z-[var(--z-dialog)] w-[380px] -translate-x-1/2 -translate-y-1/2 rounded-[var(--radius-lg)] border border-border bg-surface p-5 shadow-[var(--shadow-lg)]"
          onKeyDown={(e) => e.stopPropagation()}
        >
          <div className="mb-4 flex items-start gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] bg-primary-soft text-primary">
              <DraftingCompass size={18} aria-hidden />
            </div>
            <div>
              <Dialog.Title className="text-[var(--text-lg)] font-semibold">축척 보정</Dialog.Title>
              <Dialog.Description className="mt-0.5 text-[var(--text-sm)] text-muted">
                클릭한 두 점 사이 거리: <b className="text-fg tabular">{calibrating?.pdfDistance.toFixed(2)} pt</b>
              </Dialog.Description>
            </div>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              apply()
            }}
            className="flex flex-col gap-4"
          >
            <div className="grid grid-cols-[1fr_96px] gap-2">
              <Field label="실제 거리" htmlFor="cal-real">
                <input
                  id="cal-real"
                  autoFocus
                  inputMode="decimal"
                  value={real}
                  onChange={(e) => setReal(e.target.value)}
                  aria-invalid={!!error}
                  aria-describedby={error ? 'cal-error' : undefined}
                  className={cx(inputCls, 'select-text tabular')}
                />
              </Field>
              <Field label="단위" htmlFor="cal-unit">
                <select id="cal-unit" value={unit} onChange={(e) => setUnit(e.target.value)} className={inputCls}>
                  {UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            {error && (
              <p id="cal-error" role="alert" className="flex items-center gap-1.5 text-[var(--text-sm)] text-danger">
                <AlertCircle size={14} aria-hidden /> {error}
              </p>
            )}
            <label className="flex items-center gap-2 text-[var(--text-sm)]">
              <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} className="h-4 w-4 accent-[var(--color-primary)]" />
              모든 페이지에 같은 축척 적용
            </label>
            <div className="mt-1 flex justify-end gap-2">
              <Dialog.Close asChild>
                <Button type="button">취소</Button>
              </Dialog.Close>
              <Button type="submit" variant="primary" data-testid="cal-apply">
                적용
              </Button>
            </div>
          </form>
          <Dialog.Close asChild>
            <button aria-label="닫기" className="absolute top-3 right-3 rounded p-1 text-subtle hover:bg-surface-hover hover:text-fg">
              <X size={16} />
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export function EmptyState({ onOpen, onSample, dragging }: { onOpen: () => void; onSample: () => void; dragging: boolean }) {
  return (
    <div className="canvas-dots flex h-full w-full items-center justify-center p-8">
      <div
        className={cx(
          'animate-in flex w-[520px] max-w-full flex-col items-center gap-5 rounded-[var(--radius-lg)] border bg-surface px-10 py-10 text-center shadow-[var(--shadow-md)] transition-colors',
          dragging ? 'border-2 border-dashed border-primary bg-primary-soft' : 'border-border',
        )}
      >
        <div className="scale-150">
          <Logo />
        </div>
        <div>
          <h1 className="text-[var(--text-xl)] font-bold tracking-tight">도면 검토를 시작하세요</h1>
          <p className="mt-1.5 text-[var(--text-md)] text-muted">PDF를 열어 마크업을 달고, 축척을 맞춰 길이·면적을 재고, 마크업 목록을 CSV로 내보냅니다.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="primary" icon={FolderOpen} onClick={onOpen}>
            PDF 열기
          </Button>
          <Button icon={FileText} onClick={onSample}>
            샘플 도면 열기
          </Button>
        </div>
        <div className="flex items-center gap-2 text-[var(--text-sm)] text-subtle">
          <Upload size={14} aria-hidden /> 또는 PDF 파일을 이 창에 끌어다 놓기
        </div>
        <div className="grid w-full grid-cols-3 items-start justify-items-start gap-2 border-t border-border pt-5 text-left text-[var(--text-sm)]">
          <div className="flex flex-col gap-1">
            <Kbd>Ctrl+O</Kbd>
            <span className="text-muted">열기</span>
          </div>
          <div className="flex flex-col gap-1">
            <Kbd>V · H · Space</Kbd>
            <span className="text-muted">선택 · 이동</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="flex items-center gap-1">
              <Kbd>K</Kbd>
              <Ruler size={13} className="text-subtle" aria-hidden />
            </span>
            <span className="text-muted">축척 보정</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export function Toasts() {
  const toasts = useUi((s) => s.toasts)
  return (
    <div aria-live="polite" className="pointer-events-none fixed right-4 bottom-12 z-[var(--z-popover)] flex flex-col items-end gap-2">
      {toasts.map((t) => {
        const Icon = t.kind === 'success' ? CheckCircle2 : t.kind === 'error' ? AlertCircle : Info
        return (
          <div
            key={t.id}
            role={t.kind === 'error' ? 'alert' : 'status'}
            data-toast={t.kind}
            className="animate-in pointer-events-auto flex max-w-[420px] items-start gap-2 rounded-[var(--radius-md)] border border-border bg-surface px-3 py-2.5 text-[var(--text-md)] shadow-[var(--shadow-lg)]"
          >
            <Icon size={16} className={cx('mt-0.5 shrink-0', t.kind === 'success' && 'text-[var(--color-success)]', t.kind === 'error' && 'text-danger', t.kind === 'info' && 'text-primary')} aria-hidden />
            <span className="leading-snug">{t.text}</span>
            <button aria-label="알림 닫기" onClick={() => useUi.getState().dismiss(t.id)} className="ml-1 rounded p-0.5 text-subtle hover:text-fg">
              <X size={13} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
