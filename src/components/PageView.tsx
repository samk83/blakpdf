import { memo, useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy } from '../pdf/pdfjs'
import { scaleMatrix, type PageInfo } from '../lib/viewport'
import { MarkupLayer } from './MarkupLayer'

/** 캔버스 한 장 최대 픽셀 수 (너무 크게 확대하면 해상도를 낮춰 메모리를 지킨다) */
const MAX_PIXELS = 24_000_000

interface Props {
  pdf: PDFDocumentProxy
  index: number
  info: PageInfo
  zoom: number
  visible: boolean
}

export const PageView = memo(function PageView({ pdf, index, info, zoom, visible }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [rendered, setRendered] = useState(false)
  const w = Math.floor(info.width * zoom)
  const h = Math.floor(info.height * zoom)
  const matrix = scaleMatrix(info.transform, zoom)

  useEffect(() => {
    if (!visible) return
    let cancelled = false
    let task: { cancel(): void; promise: Promise<void> } | null = null
    const timer = setTimeout(async () => {
      const page = await pdf.getPage(index + 1)
      if (cancelled) return
      const dpr = window.devicePixelRatio || 1
      let scale = zoom * dpr
      const px = info.width * info.height * scale * scale
      if (px > MAX_PIXELS) scale *= Math.sqrt(MAX_PIXELS / px)
      const vp = page.getViewport({ scale })
      // 화면 깜빡임이 없도록 따로 그린 뒤 한 번에 옮긴다
      const off = document.createElement('canvas')
      off.width = Math.floor(vp.width)
      off.height = Math.floor(vp.height)
      task = page.render({ canvas: off, viewport: vp })
      try {
        await task.promise
      } catch {
        return
      }
      if (cancelled || !canvasRef.current) return
      const c = canvasRef.current
      c.width = off.width
      c.height = off.height
      c.getContext('2d')!.drawImage(off, 0, 0)
      setRendered(true)
    }, 30)
    return () => {
      cancelled = true
      clearTimeout(timer)
      task?.cancel()
    }
  }, [pdf, index, zoom, visible, info.width, info.height])

  return (
    <div
      data-page={index}
      className="page-shadow relative shrink-0 bg-white"
      style={{ width: w, height: h }}
    >
      <canvas ref={canvasRef} className="absolute inset-0" style={{ width: w, height: h }} aria-label={`${index + 1}쪽`} />
      {!rendered && (
        <div className="absolute inset-0 flex items-center justify-center text-[var(--text-sm)] text-[#6b737e]">
          {index + 1}쪽 불러오는 중…
        </div>
      )}
      <MarkupLayer page={index} matrix={matrix} zoom={zoom} width={w} height={h} />
    </div>
  )
})
