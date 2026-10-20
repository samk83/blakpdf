import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { bbox, dist, hitTest, markupBounds, simplify } from '../lib/geometry'
import { measure } from '../lib/measure'
import type { Markup, MarkupType, Pt, Tool } from '../lib/types'
import { apply, invert, type Matrix } from '../lib/viewport'
import { useDoc } from '../store'
import { FREEHAND, MULTI_POINT, TWO_POINT } from '../tools'
import { useUi } from '../ui-store'
import { MarkupShape } from './MarkupShape'

interface Props {
  page: number
  matrix: Matrix
  zoom: number
  width: number
  height: number
}

type Drag =
  | { kind: 'move'; id: string; last: Pt; moved: boolean }
  | { kind: 'handle'; id: string; index: number; moved: boolean }
  | { kind: 'two'; tool: Tool; start: Pt; current: Pt }
  | { kind: 'free'; tool: Tool; points: Pt[] }
  | null

interface Draft {
  tool: Tool
  points: Pt[]
  hover: Pt | null
}

const DEFAULT_TEXT_BOX = { w: 160, h: 36 }
const DEFAULT_CALLOUT_BOX = { w: 150, h: 40 }

/** 끝점을 45° 단위로 맞춘다 */
function snap45(a: Pt, b: Pt): Pt {
  const ang = Math.atan2(b.y - a.y, b.x - a.x)
  const step = Math.PI / 4
  const r = Math.round(ang / step) * step
  const d = dist(a, b)
  return { x: a.x + d * Math.cos(r), y: a.y + d * Math.sin(r) }
}

function squareUp(a: Pt, b: Pt): Pt {
  const s = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y))
  return { x: a.x + Math.sign(b.x - a.x || 1) * s, y: a.y + Math.sign(b.y - a.y || 1) * s }
}

/** 손잡이로 모양을 고칠 수 있는 점 */
function handlePoints(m: Markup): Pt[] {
  if (m.type === 'pen' || m.type === 'highlighter' || m.type === 'note') return []
  return m.points
}

export function MarkupLayer({ page, matrix, zoom, width, height }: Props) {
  const markups = useDoc((s) => s.markups)
  const selectedId = useDoc((s) => s.selectedId)
  const tool = useDoc((s) => s.tool)
  const cal = useDoc((s) => s.calibrations[page])
  const svgRef = useRef<SVGSVGElement>(null)
  const drag = useRef<Drag>(null)
  const [, force] = useState(0)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const countId = useRef<string | null>(null)
  const inv = useMemo(() => invert(matrix), [matrix])
  const pageMarkups = useMemo(() => markups.filter((m) => m.page === page), [markups, page])
  const tol = 5 / zoom

  const toPdf = (e: { clientX: number; clientY: number }): Pt => {
    const r = svgRef.current!.getBoundingClientRect()
    return apply(inv, { x: e.clientX - r.left, y: e.clientY - r.top })
  }

  // 도구를 바꾸면 그리던 것을 버린다
  useEffect(() => {
    setDraft(null)
    countId.current = null
    drag.current = null
  }, [tool])

  // Enter/Esc/Backspace: 여러 점 도구 마무리·취소
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input, textarea, select')) return
      if (draft && draft.points.length) {
        if (e.key === 'Enter') {
          e.preventDefault()
          finishMulti(draft)
        } else if (e.key === 'Escape') {
          e.preventDefault()
          e.stopPropagation()
          setDraft(null)
          useUi.getState().setLive(null)
        } else if (e.key === 'Backspace') {
          e.preventDefault()
          setDraft({ ...draft, points: draft.points.slice(0, -1) })
        }
      } else if (countId.current && (e.key === 'Enter' || e.key === 'Escape')) {
        countId.current = null
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  })

  const doc = useDoc.getState

  function create(type: MarkupType, points: Pt[], extra: Partial<Markup> = {}): Markup {
    const st = doc().styles[type]
    return doc().addMarkup({
      page,
      type,
      points,
      color: st.color,
      fill: st.fill,
      width: st.width,
      opacity: st.opacity,
      fontSize: st.fontSize,
      text: '',
      ...extra,
    })
  }

  function finishMulti(d: Draft) {
    const pts = d.points
    const minPts = d.tool === 'perimeter' ? 2 : 3
    if (pts.length >= minPts) {
      const m = create(d.tool as MarkupType, pts)
      doc().select(m.id)
    }
    setDraft(null)
    useUi.getState().setLive(null)
  }

  function liveLabel(type: MarkupType, points: Pt[]) {
    const fake = { type, points } as Markup
    const ms = measure(fake, cal)
    useUi.getState().setLive(ms ? `${TYPE_LIVE[type] ?? ''} ${ms.label}` : null)
  }

  const onPointerDown = (e: RPointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return
    const p = toPdf(e)
    const d = doc()
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)

    if (tool === 'select') {
      // 선택된 마크업의 손잡이 먼저
      const sel = d.markups.find((m) => m.id === d.selectedId && m.page === page)
      if (sel) {
        const idx = handlePoints(sel).findIndex((q) => dist(q, p) <= 7 / zoom)
        if (idx >= 0) {
          drag.current = { kind: 'handle', id: sel.id, index: idx, moved: false }
          return
        }
      }
      const hit = [...pageMarkups].reverse().find((m) => hitTest(m, p, tol))
      d.select(hit?.id ?? null)
      if (hit) drag.current = { kind: 'move', id: hit.id, last: p, moved: false }
      return
    }

    if (TWO_POINT.includes(tool)) {
      drag.current = { kind: 'two', tool, start: p, current: p }
      force((n) => n + 1)
      return
    }
    if (FREEHAND.includes(tool)) {
      drag.current = { kind: 'free', tool, points: [p] }
      force((n) => n + 1)
      return
    }
    if (MULTI_POINT.includes(tool)) {
      const pts = draft && draft.tool === tool ? draft.points : []
      // 더블클릭의 두 번째 클릭은 같은 점이므로 추가하지 않는다
      if (pts.length && dist(pts[pts.length - 1], p) < 2 / zoom) return
      setDraft({ tool, points: [...pts, p], hover: p })
      return
    }
    if (tool === 'note') {
      const m = create('note', [p])
      d.select(m.id)
      d.setTool('select')
      useUi.getState().requestTextFocus()
      return
    }
    if (tool === 'count') {
      const existing = countId.current && d.markups.find((m) => m.id === countId.current && m.page === page)
      if (existing) {
        d.updateMarkup(existing.id, { points: [...existing.points, p] })
      } else {
        const m = create('count', [p])
        countId.current = m.id
        d.select(m.id)
      }
      return
    }
    if (tool === 'calibrate') {
      if (!draft || draft.tool !== 'calibrate') {
        setDraft({ tool, points: [p], hover: p })
      } else {
        const a = draft.points[0]
        const b = e.shiftKey ? snap45(a, p) : p
        setDraft(null)
        if (dist(a, b) < 1) {
          useUi.getState().toast('error', '두 점이 너무 가깝습니다. 길이를 아는 두 점을 떨어뜨려 클릭하세요.')
          return
        }
        useUi.getState().setCalibrating({ page, pdfDistance: dist(a, b) })
      }
    }
  }

  const onPointerMove = (e: RPointerEvent<SVGSVGElement>) => {
    const p = toPdf(e)
    useUi.getState().setCursor({ page, x: p.x, y: p.y })
    const g = drag.current
    const d = doc()
    if (g?.kind === 'move') {
      const dx = p.x - g.last.x
      const dy = p.y - g.last.y
      if (!g.moved) {
        if (Math.hypot(dx, dy) < 2 / zoom) return
        d.checkpoint()
        g.moved = true
      }
      d.moveMarkup(g.id, dx, dy)
      g.last = p
      return
    }
    if (g?.kind === 'handle') {
      const m = d.markups.find((x) => x.id === g.id)
      if (!m) return
      if (!g.moved) {
        d.checkpoint()
        g.moved = true
      }
      const pts = m.points.slice()
      pts[g.index] = p
      d.updateMarkup(g.id, { points: pts }, { history: false })
      return
    }
    if (g?.kind === 'two') {
      let c = p
      if (e.shiftKey) c = g.tool === 'rect' || g.tool === 'ellipse' ? squareUp(g.start, p) : snap45(g.start, p)
      g.current = c
      if (g.tool === 'length') liveLabel('length', [g.start, c])
      force((n) => n + 1)
      return
    }
    if (g?.kind === 'free') {
      const last = g.points[g.points.length - 1]
      if (dist(last, p) > 1 / zoom) {
        g.points.push(p)
        force((n) => n + 1)
      }
      return
    }
    if (draft) {
      let h = p
      if (e.shiftKey && draft.points.length) h = snap45(draft.points[draft.points.length - 1], p)
      setDraft({ ...draft, hover: h })
      if (draft.tool === 'area' || draft.tool === 'perimeter') liveLabel(draft.tool, [...draft.points, h])
      if (draft.tool === 'calibrate') liveLabel('length', [draft.points[0], h])
    }
  }

  const onPointerUp = () => {
    const g = drag.current
    drag.current = null
    if (!g) return
    const d = doc()
    if (g.kind === 'two') {
      useUi.getState().setLive(null)
      const tiny = dist(g.start, g.current) < 3 / zoom
      if (g.tool === 'text') {
        const pts = tiny
          ? [g.start, { x: g.start.x + DEFAULT_TEXT_BOX.w, y: g.start.y - DEFAULT_TEXT_BOX.h }]
          : [g.start, g.current]
        const m = create('text', pts)
        d.select(m.id)
        setEditing(m.id)
      } else if (g.tool === 'callout') {
        const end = tiny ? { x: g.start.x + 40, y: g.start.y + 40 } : g.current
        const w = DEFAULT_CALLOUT_BOX.w
        const h = DEFAULT_CALLOUT_BOX.h
        const left = end.x >= g.start.x
        const pts = [g.start, { x: left ? end.x : end.x - w, y: end.y - h / 2 }, { x: left ? end.x + w : end.x, y: end.y + h / 2 }]
        const m = create('callout', pts)
        d.select(m.id)
        setEditing(m.id)
      } else if (!tiny) {
        const m = create(g.tool as MarkupType, [g.start, g.current])
        d.select(m.id)
      }
      force((n) => n + 1)
    } else if (g.kind === 'free') {
      if (g.points.length > 1) {
        const pts = simplify(g.points, 0.6 / zoom)
        const m = create(g.tool as MarkupType, pts)
        d.select(m.id)
      }
      force((n) => n + 1)
    }
  }

  const onDoubleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (draft && MULTI_POINT.includes(draft.tool)) {
      finishMulti(draft)
      return
    }
    if (tool !== 'select') return
    const p = toPdf(e)
    const hit = [...pageMarkups].reverse().find((m) => hitTest(m, p, tol))
    if (!hit) return
    if (hit.type === 'text' || hit.type === 'callout') setEditing(hit.id)
    else useUi.getState().requestTextFocus()
  }

  const onPointerLeave = () => useUi.getState().setCursor(null)

  // 그리는 중 미리보기
  let preview: Markup | null = null
  const g = drag.current
  const styles = useDoc.getState().styles
  const previewOf = (type: MarkupType, points: Pt[]): Markup => ({
    id: 'preview',
    page,
    type,
    points,
    ...styles[type],
    text: '',
    author: '',
    createdAt: '',
    modifiedAt: '',
  })
  if (g?.kind === 'two') {
    if (g.tool === 'callout') preview = previewOf('line', [g.start, g.current])
    else if (g.tool === 'text') preview = previewOf('rect', [g.start, g.current])
    else preview = previewOf(g.tool as MarkupType, [g.start, g.current])
    if (g.tool === 'text') preview = { ...preview, width: 1, color: '#3b5bdb' }
  } else if (g?.kind === 'free') preview = previewOf(g.tool as MarkupType, g.points)
  else if (draft && draft.tool !== 'calibrate') {
    const pts = draft.hover ? [...draft.points, draft.hover] : draft.points
    preview = previewOf(draft.tool as MarkupType, pts)
  }

  const selected = pageMarkups.find((m) => m.id === selectedId)
  const editingMarkup = pageMarkups.find((m) => m.id === editing)

  const cursor =
    tool === 'select' ? 'default' : tool === 'pan' ? 'grab' : tool === 'text' ? 'text' : 'crosshair'

  return (
    <div className="absolute inset-0" style={{ width, height }}>
      <svg
        ref={svgRef}
        data-page-overlay={page}
        width={width}
        height={height}
        className="absolute inset-0 touch-none"
        style={{ cursor }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={onPointerLeave}
        onDoubleClick={onDoubleClick}
      >
        {pageMarkups.map((m) => (
          <MarkupShape key={m.id} m={m} cal={cal} matrix={matrix} zoom={zoom} hideText={m.id === editing} />
        ))}
        {preview && <MarkupShape m={preview} cal={cal} matrix={matrix} zoom={zoom} preview />}
        {draft && <DraftVertices points={draft.points} matrix={matrix} />}
        {draft?.tool === 'calibrate' && draft.hover && (
          <CalibrateLine a={draft.points[0]} b={draft.hover} matrix={matrix} />
        )}
        {selected && <Selection m={selected} matrix={matrix} />}
      </svg>
      {editingMarkup && (
        <InlineEditor
          key={editingMarkup.id}
          m={editingMarkup}
          matrix={matrix}
          zoom={zoom}
          onChangeText={(text) => doc().updateMarkup(editingMarkup.id, { text })}
          onDone={() => {
            const d = doc()
            setEditing(null)
            if (d.tool === 'text' || d.tool === 'callout') d.setTool('select')
            d.select(editingMarkup.id)
          }}
        />
      )}
    </div>
  )
}

const TYPE_LIVE: Partial<Record<MarkupType, string>> = { length: '길이', area: '면적', perimeter: '둘레' }

function DraftVertices({ points, matrix }: { points: Pt[]; matrix: Matrix }) {
  return (
    <g pointerEvents="none">
      {points.map((p, i) => {
        const s = apply(matrix, p)
        return <circle key={i} cx={s.x} cy={s.y} r={3.5} fill="#ffffff" stroke="var(--color-selection)" strokeWidth={1.5} />
      })}
    </g>
  )
}

function CalibrateLine({ a, b, matrix }: { a: Pt; b: Pt; matrix: Matrix }) {
  const sa = apply(matrix, a)
  const sb = apply(matrix, b)
  return (
    <g pointerEvents="none">
      <line x1={sa.x} y1={sa.y} x2={sb.x} y2={sb.y} stroke="var(--color-warning)" strokeWidth={2} strokeDasharray="6 4" />
      {[sa, sb].map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={4} fill="#ffffff" stroke="var(--color-warning)" strokeWidth={2} />
      ))}
    </g>
  )
}

function Selection({ m, matrix }: { m: Markup; matrix: Matrix }) {
  const b = markupBounds(m)
  const corners = [
    apply(matrix, { x: b.minX, y: b.minY }),
    apply(matrix, { x: b.maxX, y: b.maxY }),
  ]
  const sb = bbox(corners)
  return (
    <g pointerEvents="none" data-selection={m.id}>
      <rect
        x={sb.minX - 3}
        y={sb.minY - 3}
        width={sb.maxX - sb.minX + 6}
        height={sb.maxY - sb.minY + 6}
        fill="none"
        stroke="var(--color-selection)"
        strokeWidth={1}
        strokeDasharray="4 3"
      />
      {handlePoints(m).map((p, i) => {
        const s = apply(matrix, p)
        return <rect key={i} x={s.x - 4} y={s.y - 4} width={8} height={8} rx={2} fill="#ffffff" stroke="var(--color-selection)" strokeWidth={1.5} />
      })}
    </g>
  )
}

function InlineEditor({ m, matrix, zoom, onChangeText, onDone }: { m: Markup; matrix: Matrix; zoom: number; onChangeText: (text: string) => void; onDone: () => void }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const [text, setText] = useState(m.text)
  const done = useRef(false)
  const boxPts = m.type === 'callout' ? [m.points[1], m.points[2]] : [m.points[0], m.points[1]]
  const s = bbox(boxPts.map((p) => apply(matrix, p)))
  useEffect(() => {
    ref.current?.focus()
  }, [])
  const finish = () => {
    if (done.current) return
    done.current = true
    onDone()
  }
  return (
    <textarea
      ref={ref}
      aria-label="마크업 내용"
      value={text}
      onChange={(e) => {
        setText(e.target.value)
        onChangeText(e.target.value)
      }}
      onBlur={finish}
      onKeyDown={(e) => {
        // Ctrl+S 는 저장 단축키로 넘긴다 (글자는 이미 문서에 반영돼 있음)
        if (!((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's')) e.stopPropagation()
        if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) {
          e.preventDefault()
          finish()
        }
      }}
      onPointerDown={(e) => e.stopPropagation()}
      className="absolute resize-none border-0 bg-transparent outline-2 outline-primary"
      style={{
        left: s.minX,
        top: s.minY,
        width: Math.max(40, s.maxX - s.minX),
        height: Math.max(24, s.maxY - s.minY),
        padding: `${4 * zoom}px`,
        fontSize: m.fontSize * zoom,
        lineHeight: 1.25,
        color: m.color,
        fontFamily: 'var(--font-sans)',
        userSelect: 'text',
      }}
    />
  )
}
