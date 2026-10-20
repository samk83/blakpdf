import { DraftingCompass, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { measure } from '../lib/measure'
import { TYPE_LABELS, type MarkupStyle, type MarkupType } from '../lib/types'
import { useDoc } from '../store'
import { toolDef } from '../tools'
import { useUi } from '../ui-store'
import { Button, cx, Field, inputCls } from './ui'

const PALETTE = ['#e03131', '#f76707', '#fab005', '#2f9e44', '#1098ad', '#1971c2', '#3b5bdb', '#9c36b5', '#1c2b4a', '#495057']
const FILLABLE: MarkupType[] = ['rect', 'ellipse', 'polygon', 'cloud', 'text', 'callout', 'area']
const TEXTUAL: MarkupType[] = ['text', 'callout']

function Swatches({ value, onChange, allowNone, label }: { value: string | null; onChange: (c: string | null) => void; allowNone?: boolean; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap items-center gap-1.5">
      {allowNone && (
        <button
          role="radio"
          aria-checked={value === null}
          aria-label="없음"
          onClick={() => onChange(null)}
          className={cx(
            'relative h-6 w-6 overflow-hidden rounded-full border border-border-strong bg-surface',
            value === null && 'ring-2 ring-primary ring-offset-1 ring-offset-surface',
          )}
        >
          <span className="absolute top-1/2 left-1/2 h-px w-7 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-danger" />
        </button>
      )}
      {PALETTE.map((c) => (
        <button
          key={c}
          role="radio"
          aria-checked={value?.toLowerCase() === c}
          aria-label={c}
          onClick={() => onChange(c)}
          className={cx('h-6 w-6 rounded-full border border-black/10', value?.toLowerCase() === c && 'ring-2 ring-primary ring-offset-1 ring-offset-surface')}
          style={{ background: c }}
        />
      ))}
      <label className="relative h-6 w-6 cursor-pointer overflow-hidden rounded-full border border-border-strong" title="직접 고르기" style={{ background: 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)' }}>
        <input type="color" aria-label={`${label} 직접 고르기`} className="absolute inset-0 cursor-pointer opacity-0" value={value ?? '#ffffff'} onChange={(e) => onChange(e.target.value)} />
      </label>
    </div>
  )
}

function Slider({ id, value, min, max, step, onChange, format }: { id: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; format: (v: number) => string }) {
  return (
    <div className="flex items-center gap-3">
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="flex-1 accent-[var(--color-primary)]" />
      <span className="w-12 text-right text-[var(--text-sm)] text-muted tabular">{format(value)}</span>
    </div>
  )
}

export function PropertiesPanel() {
  const selected = useDoc((s) => s.markups.find((m) => m.id === s.selectedId) ?? null)
  const tool = useDoc((s) => s.tool)
  const styles = useDoc((s) => s.styles)
  const page = useDoc((s) => s.page)
  const cal = useDoc((s) => s.calibrations[selected?.page ?? page])
  const textFocusSeq = useUi((s) => s.textFocusSeq)
  const textRef = useRef<HTMLTextAreaElement>(null)
  const [draftText, setDraftText] = useState('')

  useEffect(() => setDraftText(selected?.text ?? ''), [selected?.id, selected?.text])
  useEffect(() => {
    if (textFocusSeq) requestAnimationFrame(() => textRef.current?.focus())
  }, [textFocusSeq])

  const styleType: MarkupType | null = selected ? selected.type : tool !== 'select' && tool !== 'pan' && tool !== 'calibrate' ? tool : null
  const style: MarkupStyle | null = selected ?? (styleType ? styles[styleType] : null)

  const set = (patch: Partial<MarkupStyle>) => {
    const d = useDoc.getState()
    // 선택한 마크업만 바꾼다. 선택이 없으면 그 도구의 기본값을 바꾼다
    if (selected) d.updateMarkup(selected.id, patch)
    else if (styleType) d.setStyle(styleType, patch)
  }

  const ms = selected ? measure(selected, cal) : null

  return (
    <aside aria-label="속성" className="flex h-full flex-col">
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-border px-3">
        <span className="text-[var(--text-sm)] font-semibold">속성</span>
        {styleType && (
          <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[var(--text-xs)] font-medium text-primary">
            {selected ? TYPE_LABELS[styleType] : `${TYPE_LABELS[styleType]} 기본값`}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-4">
        {!style && <EmptyProps />}

        {selected && ms && (
          <div className="rounded-[var(--radius-md)] border border-border bg-surface-2 p-3">
            <div className="text-[var(--text-xs)] text-muted">{TYPE_LABELS[selected.type]} 측정값</div>
            <div data-testid="measure-value" className="mt-0.5 text-[var(--text-xl)] font-semibold tabular">{ms.label}</div>
            <div className="mt-1 text-[var(--text-xs)] text-subtle">
              {cal ? `축척: ${cal.pdfDistance.toFixed(1)}pt = ${cal.realDistance} ${cal.unit}` : '축척 미보정 (72pt = 1 in)'}
            </div>
          </div>
        )}

        {style && styleType && (
          <>
            <Field label={styleType === 'note' ? '아이콘 색' : '선 색'}>
              <Swatches label="선 색" value={style.color} onChange={(c) => c && set({ color: c })} />
            </Field>
            {FILLABLE.includes(styleType) && (
              <Field label="채우기">
                <Swatches label="채우기" value={style.fill} onChange={(c) => set({ fill: c })} allowNone />
              </Field>
            )}
            {styleType !== 'note' && styleType !== 'count' && (
              <Field label="두께" htmlFor="prop-width">
                <Slider id="prop-width" value={style.width} min={styleType === 'text' ? 0 : 0.5} max={styleType === 'highlighter' ? 30 : 12} step={0.5} onChange={(v) => set({ width: v })} format={(v) => `${v}pt`} />
              </Field>
            )}
            <Field label="투명도" htmlFor="prop-opacity">
              <Slider id="prop-opacity" value={Math.round(style.opacity * 100)} min={10} max={100} step={5} onChange={(v) => set({ opacity: v / 100 })} format={(v) => `${v}%`} />
            </Field>
            {TEXTUAL.includes(styleType) && (
              <Field label="글자 크기" htmlFor="prop-font">
                <Slider id="prop-font" value={style.fontSize} min={6} max={48} step={1} onChange={(v) => set({ fontSize: v })} format={(v) => `${v}pt`} />
              </Field>
            )}
          </>
        )}

        {selected && (
          <>
            <Field label="내용" htmlFor="prop-text">
              <textarea
                id="prop-text"
                ref={textRef}
                rows={4}
                value={draftText}
                placeholder="메모나 설명을 입력하세요"
                onChange={(e) => {
                  // 입력할 때마다 문서에 반영 (저장·닫기 확인에서 빠지지 않게). 연속 입력은 실행 취소 한 번으로 묶인다
                  setDraftText(e.target.value)
                  useDoc.getState().updateMarkup(selected.id, { text: e.target.value })
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) (e.target as HTMLTextAreaElement).blur()
                }}
                className={cx(inputCls, 'h-auto resize-y py-1.5 leading-relaxed select-text')}
              />
            </Field>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[var(--text-sm)]">
              <dt className="text-muted">페이지</dt>
              <dd className="tabular">{selected.page + 1}</dd>
              <dt className="text-muted">작성자</dt>
              <dd>{selected.author}</dd>
              <dt className="text-muted">수정</dt>
              <dd className="tabular">{new Date(selected.modifiedAt).toLocaleString('ko-KR')}</dd>
            </dl>
            <Button variant="danger" icon={Trash2} className="justify-start" onClick={() => useDoc.getState().deleteMarkup(selected.id)}>
              마크업 삭제 <span className="ml-auto text-[var(--text-xs)] text-subtle">Delete</span>
            </Button>
          </>
        )}

        {!selected && tool === 'calibrate' && <CalibrateHelp />}
      </div>
    </aside>
  )
}

function EmptyProps() {
  const tool = useDoc((s) => s.tool)
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-center">
      <div className="text-[var(--text-md)] font-medium">선택한 마크업 없음</div>
      <p className="max-w-[200px] text-[var(--text-sm)] leading-relaxed text-muted">{toolDef(tool).hint}</p>
    </div>
  )
}

function CalibrateHelp() {
  const page = useDoc((s) => s.page)
  const cal = useDoc((s) => s.calibrations[page])
  return (
    <div className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-border bg-surface-2 p-3">
      <div className="flex items-center gap-2 font-medium">
        <DraftingCompass size={16} aria-hidden /> 축척 보정
      </div>
      <p className="text-[var(--text-sm)] leading-relaxed text-muted">도면에서 길이를 아는 두 점(치수선 양 끝 등)을 차례로 클릭하세요. 그다음 실제 거리를 입력합니다.</p>
      <div className="text-[var(--text-xs)] text-subtle">현재 {page + 1}쪽: {cal ? `${cal.pdfDistance.toFixed(1)}pt = ${cal.realDistance} ${cal.unit}` : '미보정'}</div>
    </div>
  )
}
