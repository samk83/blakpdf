import { memo, useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy } from '../pdf/pdfjs'
import type { PageInfo } from '../lib/viewport'
import { useDoc } from '../store'
import { cx } from './ui'

const THUMB_W = 132

const Thumb = memo(function Thumb({ pdf, index, info, active, count }: { pdf: PDFDocumentProxy; index: number; info: PageInfo; active: boolean; count: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const boxRef = useRef<HTMLButtonElement>(null)
  const [show, setShow] = useState(false)
  const scale = THUMB_W / info.width
  const h = Math.round(info.height * scale)

  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const io = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && setShow(true), { rootMargin: '200px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (!show) return
    let cancelled = false
    let task: { cancel(): void; promise: Promise<void> } | null = null
    pdf.getPage(index + 1).then((page) => {
      if (cancelled || !ref.current) return
      const vp = page.getViewport({ scale: scale * (window.devicePixelRatio || 1) })
      ref.current.width = Math.floor(vp.width)
      ref.current.height = Math.floor(vp.height)
      task = page.render({ canvas: ref.current, viewport: vp })
      task.promise.catch(() => {})
    })
    return () => {
      cancelled = true
      task?.cancel()
    }
  }, [show, pdf, index, scale])

  useEffect(() => {
    if (active) boxRef.current?.scrollIntoView({ block: 'nearest' })
  }, [active])

  return (
    <button
      ref={boxRef}
      data-thumb={index}
      aria-label={`${index + 1}쪽으로 이동`}
      aria-current={active ? 'page' : undefined}
      onClick={() => useDoc.getState().focusPage(index)}
      className="group flex flex-col items-center gap-1.5 rounded-[var(--radius-md)] p-2 transition-colors hover:bg-surface-hover"
    >
      <div
        className={cx(
          'relative overflow-hidden rounded-[3px] bg-white shadow-[var(--shadow-sm)] ring-1 transition-shadow',
          active ? 'ring-2 ring-primary' : 'ring-border group-hover:ring-border-strong',
        )}
        style={{ width: THUMB_W, height: h }}
      >
        <canvas ref={ref} style={{ width: THUMB_W, height: h }} />
        {count > 0 && (
          <span className="absolute top-1 right-1 rounded-full bg-primary px-1.5 text-[10px] leading-4 font-semibold text-on-primary tabular">{count}</span>
        )}
      </div>
      <span className={cx('text-[var(--text-xs)] tabular', active ? 'font-semibold text-primary' : 'text-muted')}>{index + 1}</span>
    </button>
  )
})

export function Thumbnails({ pdf, pages }: { pdf: PDFDocumentProxy; pages: PageInfo[] }) {
  const current = useDoc((s) => s.page)
  const markups = useDoc((s) => s.markups)
  const counts = new Map<number, number>()
  for (const m of markups) counts.set(m.page, (counts.get(m.page) ?? 0) + 1)
  return (
    <nav aria-label="페이지 썸네일" className="flex h-full flex-col">
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-border px-3">
        <span className="text-[var(--text-sm)] font-semibold">페이지</span>
        <span className="text-[var(--text-xs)] text-subtle tabular">{pages.length}쪽</span>
      </div>
      <div className="flex flex-1 flex-col items-center gap-1 overflow-y-auto py-2">
        {pages.map((p, i) => (
          <Thumb key={i} pdf={pdf} index={i} info={p} active={i === current} count={counts.get(i) ?? 0} />
        ))}
      </div>
    </nav>
  )
}
