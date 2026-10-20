import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy } from '../pdf/pdfjs'
import { apply, scaleMatrix, type PageInfo } from '../lib/viewport'
import { useDoc } from '../store'
import { PageView } from './PageView'

const GAP = 24
const PAD = 32

/** 다른 컴포넌트(툴바·상태 표시줄)에서 부르는 화면 맞춤 기능 */
export const viewerControls = {
  fitWidth: () => {},
  fitPage: () => {},
  zoomBy: (_factor: number) => {},
}

export function Viewer({ pdf, pages }: { pdf: PDFDocumentProxy; pages: PageInfo[] }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const zoom = useDoc((s) => s.zoom)
  const tool = useDoc((s) => s.tool)
  const focus = useDoc((s) => s.focus)
  const [visible, setVisible] = useState<Set<number>>(() => new Set([0]))
  const pan = useRef<{ x: number; y: number; sl: number; st: number } | null>(null)
  const [spaceDown, setSpaceDown] = useState(false)
  const [panning, setPanning] = useState(false)
  /** 배율을 바꿀 때 유지할 기준점 (스크롤 영역 좌표 비율) */
  const anchor = useRef<{ fx: number; fy: number; cx: number; cy: number } | null>(null)

  // 보이는 페이지 계산 + 현재 페이지
  const updateVisible = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const top = el.scrollTop - el.clientHeight * 0.5
    const bottom = el.scrollTop + el.clientHeight * 1.5
    const next = new Set<number>()
    let y = PAD
    let current = 0
    let best = Infinity
    const center = el.scrollTop + el.clientHeight / 2
    pages.forEach((p, i) => {
      const h = p.height * zoom
      if (y + h >= top && y <= bottom) next.add(i)
      const d = Math.abs(y + h / 2 - center)
      if (d < best) {
        best = d
        current = i
      }
      y += h + GAP
    })
    setVisible((prev) => (prev.size === next.size && [...next].every((i) => prev.has(i)) ? prev : next))
    if (useDoc.getState().page !== current) useDoc.getState().setPage(current)
  }, [pages, zoom])

  useEffect(() => {
    updateVisible()
  }, [updateVisible])

  // 배율 변경 후 기준점 유지
  useLayoutEffect(() => {
    const el = scrollRef.current
    const a = anchor.current
    if (!el || !a) return
    anchor.current = null
    el.scrollLeft = a.fx * el.scrollWidth - a.cx
    el.scrollTop = a.fy * el.scrollHeight - a.cy
  }, [zoom])

  const zoomAt = useCallback((next: number, cx?: number, cy?: number) => {
    const el = scrollRef.current
    if (!el) return
    const x = cx ?? el.clientWidth / 2
    const y = cy ?? el.clientHeight / 2
    anchor.current = {
      fx: (el.scrollLeft + x) / el.scrollWidth,
      fy: (el.scrollTop + y) / el.scrollHeight,
      cx: x,
      cy: y,
    }
    useDoc.getState().setZoom(next)
  }, [])

  const pageTop = useCallback(
    (index: number, z: number) => {
      let y = PAD
      for (let i = 0; i < index; i++) y += pages[i].height * z + GAP
      return y
    },
    [pages],
  )

  useEffect(() => {
    viewerControls.fitWidth = () => {
      const el = scrollRef.current
      if (!el) return
      const maxW = Math.max(...pages.map((p) => p.width))
      const z = (el.clientWidth - PAD * 2 - 16) / maxW
      const page = useDoc.getState().page
      useDoc.getState().setZoom(z)
      requestAnimationFrame(() => {
        el.scrollTop = pageTop(page, useDoc.getState().zoom) - PAD / 2
      })
    }
    viewerControls.fitPage = () => {
      const el = scrollRef.current
      if (!el) return
      const page = useDoc.getState().page
      const p = pages[page]
      const z = Math.min((el.clientWidth - PAD * 2) / p.width, (el.clientHeight - PAD * 2) / p.height)
      useDoc.getState().setZoom(z)
      requestAnimationFrame(() => {
        el.scrollTop = pageTop(page, useDoc.getState().zoom) - PAD
      })
    }
    viewerControls.zoomBy = (f) => zoomAt(useDoc.getState().zoom * f)
  }, [pages, pageTop, zoomAt])

  // 처음 열 때 폭 맞춤
  useEffect(() => {
    requestAnimationFrame(() => viewerControls.fitWidth())
  }, [pdf])

  // 페이지 이동 요청 (썸네일·목록 클릭)
  useEffect(() => {
    const el = scrollRef.current
    if (!el || !focus) return
    const z = useDoc.getState().zoom
    let top = pageTop(focus.page, z)
    let left = el.scrollLeft
    if (focus.point) {
      const info = pages[focus.page]
      const s = apply(scaleMatrix(info.transform, z), focus.point)
      top += s.y - el.clientHeight / 2
      const pageLeft = Math.max(PAD, (el.scrollWidth - info.width * z) / 2)
      left = pageLeft + s.x - el.clientWidth / 2
    } else {
      top -= PAD / 2
    }
    el.scrollTo({ top, left, behavior: 'smooth' })
  }, [focus, pages, pageTop])

  // Ctrl+휠 확대/축소 (커서 위치 기준)
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      const r = el.getBoundingClientRect()
      const factor = Math.exp(-e.deltaY * 0.0015)
      zoomAt(useDoc.getState().zoom * factor, e.clientX - r.left, e.clientY - r.top)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoomAt])

  // Space 를 누르는 동안 화면 이동
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !(e.target as HTMLElement)?.closest('input, textarea, select, button')) {
        e.preventDefault()
        setSpaceDown(true)
      }
    }
    const up = (e: KeyboardEvent) => e.code === 'Space' && setSpaceDown(false)
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])

  const panMode = tool === 'pan' || spaceDown

  const onPointerDownCapture = (e: React.PointerEvent) => {
    if (e.button === 1 || (e.button === 0 && panMode)) {
      e.preventDefault()
      e.stopPropagation()
      const el = scrollRef.current!
      pan.current = { x: e.clientX, y: e.clientY, sl: el.scrollLeft, st: el.scrollTop }
      el.setPointerCapture(e.pointerId)
      setPanning(true)
    } else if (e.target === scrollRef.current || (e.target as HTMLElement).dataset.canvasBg) {
      useDoc.getState().select(null)
    }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const p = pan.current
    if (!p) return
    const el = scrollRef.current!
    el.scrollLeft = p.sl - (e.clientX - p.x)
    el.scrollTop = p.st - (e.clientY - p.y)
  }
  const endPan = () => {
    pan.current = null
    setPanning(false)
  }

  return (
    <div
      ref={scrollRef}
      data-testid="viewer"
      className="canvas-dots relative h-full w-full overflow-auto outline-none"
      tabIndex={-1}
      onScroll={updateVisible}
      onPointerDownCapture={onPointerDownCapture}
      onPointerMove={onPointerMove}
      onPointerUp={endPan}
      onPointerCancel={endPan}
      style={{ cursor: panning ? 'grabbing' : panMode ? 'grab' : undefined }}
    >
      <div
        data-canvas-bg="1"
        className="flex min-w-full flex-col items-center"
        style={{ padding: PAD, gap: GAP, width: 'max-content', pointerEvents: panMode ? 'none' : undefined }}
      >
        {pages.map((info, i) => (
          <PageView key={i} pdf={pdf} index={i} info={info} zoom={zoom} visible={visible.has(i)} />
        ))}
      </div>
    </div>
  )
}
