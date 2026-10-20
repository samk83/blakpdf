/**
 * 마크업 → 그리기 기본 요소(경로·글자) 변환.
 * 화면(SVG)과 저장(PDF 외형 스트림)이 같은 결과를 쓰도록 한 곳에서 만든다.
 * 모든 좌표는 PDF 사용자 공간(pt, y 위쪽).
 */
import { arrowHead, bbox, centroid, cloudArcs, dist, isClockwise, nearestRectPoint } from './geometry'
import { measure } from './measure'
import type { Calibration, Markup, Pt } from './types'

export type Seg =
  | { op: 'M'; p: Pt }
  | { op: 'L'; p: Pt }
  | { op: 'C'; c1: Pt; c2: Pt; p: Pt }
  | { op: 'Z' }

export interface PathPrim {
  kind: 'path'
  segs: Seg[]
  stroke: string | null
  width: number
  fill: string | null
  /** 마크업 투명도에 곱해지는 채우기 투명도 */
  fillOpacity: number
}

export interface TextPrim {
  kind: 'text'
  /** 첫 줄 기준선 왼쪽 */
  at: Pt
  lines: string[]
  size: number
  color: string
  /** 측정 라벨처럼 글자 뒤에 흰 바탕을 깐다 */
  halo: boolean
  /** at 을 가운데 정렬 기준으로 쓸지 */
  center: boolean
}

export type Prim = PathPrim | TextPrim

const KAPPA = 0.5522847498

export const LABEL_SIZE = 9
export const TEXT_PAD = 4
export const NOTE_SIZE = 20
export const COUNT_RADIUS = 6

function polyline(points: Pt[], closed: boolean): Seg[] {
  if (!points.length) return []
  const segs: Seg[] = [{ op: 'M', p: points[0] }]
  for (let i = 1; i < points.length; i++) segs.push({ op: 'L', p: points[i] })
  if (closed) segs.push({ op: 'Z' })
  return segs
}

export function ellipseSegs(cx: number, cy: number, rx: number, ry: number): Seg[] {
  const ox = rx * KAPPA
  const oy = ry * KAPPA
  return [
    { op: 'M', p: { x: cx + rx, y: cy } },
    { op: 'C', c1: { x: cx + rx, y: cy + oy }, c2: { x: cx + ox, y: cy + ry }, p: { x: cx, y: cy + ry } },
    { op: 'C', c1: { x: cx - ox, y: cy + ry }, c2: { x: cx - rx, y: cy + oy }, p: { x: cx - rx, y: cy } },
    { op: 'C', c1: { x: cx - rx, y: cy - oy }, c2: { x: cx - ox, y: cy - ry }, p: { x: cx, y: cy - ry } },
    { op: 'C', c1: { x: cx + ox, y: cy - ry }, c2: { x: cx + rx, y: cy - oy }, p: { x: cx + rx, y: cy } },
    { op: 'Z' },
  ]
}

/** 구름 테두리: 각 변을 따라 바깥쪽으로 볼록한 반원 호를 잇는다 */
export function cloudSegs(points: Pt[], radius: number): Seg[] {
  const arcs = cloudArcs(points, radius)
  if (!arcs.length) return []
  // y 위쪽 좌표에서 반시계 다각형이면 바깥 법선은 (dy, -dx)
  const sign = isClockwise(points) ? -1 : 1
  const segs: Seg[] = [{ op: 'M', p: arcs[0].from }]
  for (const a of arcs) {
    const dx = a.to.x - a.from.x
    const dy = a.to.y - a.from.y
    const len = Math.hypot(dx, dy) || 1
    const nx = (sign * dy) / len
    const ny = (sign * -dx) / len
    const h = (len / 2) * (4 / 3)
    segs.push({
      op: 'C',
      c1: { x: a.from.x + nx * h, y: a.from.y + ny * h },
      c2: { x: a.to.x + nx * h, y: a.to.y + ny * h },
      p: a.to,
    })
  }
  segs.push({ op: 'Z' })
  return segs
}

function path(segs: Seg[], m: Markup, opts: Partial<PathPrim> = {}): PathPrim {
  return { kind: 'path', segs, stroke: m.color, width: m.width, fill: null, fillOpacity: 1, ...opts }
}

function label(at: Pt, text: string, color: string): TextPrim {
  return { kind: 'text', at, lines: [text], size: LABEL_SIZE, color, halo: true, center: true }
}

/** 상자 안 글자: 왼쪽 위부터 줄 단위 */
export function boxText(a: Pt, b: Pt, m: Markup): TextPrim {
  const box = bbox([a, b])
  return {
    kind: 'text',
    at: { x: box.minX + TEXT_PAD, y: box.maxY - TEXT_PAD - m.fontSize * 0.9 },
    lines: m.text.split(/\r?\n/),
    size: m.fontSize,
    color: m.color,
    halo: false,
    center: false,
  }
}

export function markupPrims(m: Markup, cal?: Calibration): Prim[] {
  const p = m.points
  const out: Prim[] = []
  switch (m.type) {
    case 'line':
      out.push(path(polyline(p, false), m))
      break
    case 'arrow': {
      out.push(path(polyline(p, false), m))
      const size = Math.max(8, m.width * 4)
      const [w1, w2] = arrowHead(p[0], p[1], size)
      out.push(path([{ op: 'M', p: w1 }, { op: 'L', p: p[1] }, { op: 'L', p: w2 }], m))
      break
    }
    case 'rect': {
      const b = bbox(p)
      out.push(
        path(
          polyline(
            [
              { x: b.minX, y: b.minY },
              { x: b.maxX, y: b.minY },
              { x: b.maxX, y: b.maxY },
              { x: b.minX, y: b.maxY },
            ],
            true,
          ),
          m,
          { fill: m.fill },
        ),
      )
      break
    }
    case 'ellipse': {
      const b = bbox(p)
      out.push(
        path(ellipseSegs((b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2, (b.maxX - b.minX) / 2, (b.maxY - b.minY) / 2), m, {
          fill: m.fill,
        }),
      )
      break
    }
    case 'polygon':
      out.push(path(polyline(p, p.length > 2), m, { fill: m.fill }))
      break
    case 'cloud':
      if (p.length > 2) out.push(path(cloudSegs(p, Math.max(6, m.width * 4)), m, { fill: m.fill }))
      else out.push(path(polyline(p, false), m))
      break
    case 'pen':
      out.push(path(polyline(p, false), m))
      break
    case 'highlighter':
      out.push(path(polyline(p, false), m))
      break
    case 'text': {
      const b = bbox(p)
      const corners = [
        { x: b.minX, y: b.minY },
        { x: b.maxX, y: b.minY },
        { x: b.maxX, y: b.maxY },
        { x: b.minX, y: b.maxY },
      ]
      if (m.width > 0 || m.fill) out.push(path(polyline(corners, true), m, { stroke: m.width > 0 ? m.color : null, fill: m.fill }))
      out.push(boxText(p[0], p[1], m))
      break
    }
    case 'callout': {
      const b = bbox([p[1], p[2]])
      const join = nearestRectPoint(p[0], b)
      out.push(path(polyline([p[0], join], false), m))
      const size = Math.max(7, m.width * 4)
      if (dist(p[0], join) > size) {
        const [w1, w2] = arrowHead(join, p[0], size)
        out.push(path([{ op: 'M', p: w1 }, { op: 'L', p: p[0] }, { op: 'L', p: w2 }, { op: 'Z' }], m, { fill: m.color }))
      }
      const corners = [
        { x: b.minX, y: b.minY },
        { x: b.maxX, y: b.minY },
        { x: b.maxX, y: b.maxY },
        { x: b.minX, y: b.maxY },
      ]
      out.push(path(polyline(corners, true), m, { fill: m.fill ?? '#ffffff' }))
      out.push(boxText(p[1], p[2], m))
      break
    }
    case 'note': {
      // 말풍선 아이콘 (왼쪽 위 = 점)
      const { x, y } = p[0]
      const s = NOTE_SIZE
      const r = 3
      const body: Pt[] = [
        { x: x + r, y },
        { x: x + s - r, y },
        { x: x + s, y: y - r },
        { x: x + s, y: y - s * 0.7 + r },
        { x: x + s - r, y: y - s * 0.7 },
        { x: x + s * 0.45, y: y - s * 0.7 },
        { x: x + s * 0.2, y: y - s },
        { x: x + s * 0.25, y: y - s * 0.7 },
        { x: x + r, y: y - s * 0.7 },
        { x, y: y - s * 0.7 + r },
        { x, y: y - r },
      ]
      out.push(path(polyline(body, true), m, { stroke: '#1f2937', width: 0.75, fill: m.color }))
      for (let i = 0; i < 3; i++) {
        const ly = y - 4.5 - i * 3.5
        out.push(path(polyline([{ x: x + 4, y: ly }, { x: x + s - 4 - (i === 2 ? 5 : 0), y: ly }], false), m, { stroke: '#1f2937', width: 0.9 }))
      }
      break
    }
    case 'length': {
      out.push(path(polyline(p, false), m))
      if (p.length === 2) {
        const [a, b] = p
        const len = dist(a, b) || 1
        const nx = (-(b.y - a.y) / len) * 5
        const ny = ((b.x - a.x) / len) * 5
        for (const q of [a, b]) {
          out.push(path(polyline([{ x: q.x - nx, y: q.y - ny }, { x: q.x + nx, y: q.y + ny }], false), m))
        }
        const ms = measure(m, cal)
        if (ms) out.push(label({ x: (a.x + b.x) / 2 + nx * 1.6, y: (a.y + b.y) / 2 + ny * 1.6 }, ms.label, m.color))
      }
      break
    }
    case 'perimeter': {
      out.push(path(polyline(p, false), m))
      for (const q of p) out.push(path(ellipseSegs(q.x, q.y, 1.8, 1.8), m, { stroke: null, fill: m.color }))
      const ms = measure(m, cal)
      if (ms && p.length > 1) {
        const last = p[p.length - 1]
        out.push(label({ x: last.x, y: last.y + 10 }, ms.label, m.color))
      }
      break
    }
    case 'area': {
      out.push(path(polyline(p, p.length > 2), m, { fill: m.fill ?? m.color, fillOpacity: m.fill ? 1 : 0.18 }))
      const ms = measure(m, cal)
      if (ms && p.length > 2) out.push(label(centroid(p), ms.label, m.color))
      break
    }
    case 'count': {
      p.forEach((q) => {
        out.push(path(ellipseSegs(q.x, q.y, COUNT_RADIUS, COUNT_RADIUS), m, { stroke: '#ffffff', width: 1.2, fill: m.color }))
      })
      if (p.length) {
        const last = p[p.length - 1]
        const ms = measure(m, cal)
        if (ms) out.push(label({ x: last.x, y: last.y + COUNT_RADIUS + 6 }, ms.label, m.color))
      }
      break
    }
  }
  return out
}
