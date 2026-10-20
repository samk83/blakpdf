import type { Markup, Pt } from './types'

export const dist = (a: Pt, b: Pt) => Math.hypot(b.x - a.x, b.y - a.y)

/** 꺾은선 길이 (closed=true 이면 마지막 점→첫 점 포함) */
export function polylineLength(points: Pt[], closed = false): number {
  let total = 0
  for (let i = 1; i < points.length; i++) total += dist(points[i - 1], points[i])
  if (closed && points.length > 2) total += dist(points[points.length - 1], points[0])
  return total
}

/** 신발끈 공식으로 다각형 넓이 (절댓값) */
export function polygonArea(points: Pt[]): number {
  if (points.length < 3) return 0
  let s = 0
  for (let i = 0; i < points.length; i++) {
    const a = points[i]
    const b = points[(i + 1) % points.length]
    s += a.x * b.y - b.x * a.y
  }
  return Math.abs(s) / 2
}

export interface Box {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export function bbox(points: Pt[]): Box {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of points) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }
  return { minX, minY, maxX, maxY }
}

export function inflate(b: Box, d: number): Box {
  return { minX: b.minX - d, minY: b.minY - d, maxX: b.maxX + d, maxY: b.maxY + d }
}

export function centroid(points: Pt[]): Pt {
  const n = points.length || 1
  return {
    x: points.reduce((s, p) => s + p.x, 0) / n,
    y: points.reduce((s, p) => s + p.y, 0) / n,
  }
}

/** 점과 선분 사이 거리 */
export function distToSegment(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  if (len2 === 0) return dist(p, a)
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2
  t = Math.max(0, Math.min(1, t))
  return dist(p, { x: a.x + t * dx, y: a.y + t * dy })
}

export function pointInPolygon(p: Pt, poly: Pt[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]
    const b = poly[j]
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside
    }
  }
  return inside
}

/** 사각형 두 모서리 → 네 꼭짓점 */
export function rectCorners(a: Pt, b: Pt): Pt[] {
  return [
    { x: a.x, y: a.y },
    { x: b.x, y: a.y },
    { x: b.x, y: b.y },
    { x: a.x, y: b.y },
  ]
}

/** 다각형 가장자리를 따라 구름 모양 호(arc) 중심 목록을 만든다. 반지름 r 간격 */
export function cloudArcs(points: Pt[], r: number): { from: Pt; to: Pt }[] {
  const arcs: { from: Pt; to: Pt }[] = []
  if (points.length < 2 || r <= 0) return arcs
  const n = points.length
  for (let i = 0; i < n; i++) {
    const a = points[i]
    const b = points[(i + 1) % n]
    const len = dist(a, b)
    const count = Math.max(1, Math.round(len / (r * 1.6)))
    for (let k = 0; k < count; k++) {
      const t0 = k / count
      const t1 = (k + 1) / count
      arcs.push({
        from: { x: a.x + (b.x - a.x) * t0, y: a.y + (b.y - a.y) * t0 },
        to: { x: a.x + (b.x - a.x) * t1, y: a.y + (b.y - a.y) * t1 },
      })
    }
  }
  return arcs
}

/** 다각형이 시계 방향인지 (y 위쪽 좌표 기준) */
export function isClockwise(points: Pt[]): boolean {
  let s = 0
  for (let i = 0; i < points.length; i++) {
    const a = points[i]
    const b = points[(i + 1) % points.length]
    s += (b.x - a.x) * (b.y + a.y)
  }
  return s > 0
}

/** 화살촉 두 날개 끝점 (끝점 tip, 반대쪽 from) */
export function arrowHead(from: Pt, tip: Pt, size: number): [Pt, Pt] {
  const ang = Math.atan2(tip.y - from.y, tip.x - from.x)
  const spread = Math.PI / 7
  return [
    { x: tip.x - size * Math.cos(ang - spread), y: tip.y - size * Math.sin(ang - spread) },
    { x: tip.x - size * Math.cos(ang + spread), y: tip.y - size * Math.sin(ang + spread) },
  ]
}

/** 마크업이 차지하는 영역 (PDF 좌표). 선 두께·라벨 여유 포함 */
export function markupBounds(m: Markup): Box {
  const pad = Math.max(m.width, 1) + (m.type === 'cloud' ? 8 : 0) + (m.type === 'note' ? 0 : 2)
  if (m.type === 'note') {
    const p = m.points[0]
    return { minX: p.x, minY: p.y - 20, maxX: p.x + 20, maxY: p.y }
  }
  if (m.type === 'count') return inflate(bbox(m.points), 8)
  return inflate(bbox(m.points), pad)
}

/** 클릭 위치가 마크업에 닿는지. tol 은 PDF 좌표 기준 허용 거리 */
export function hitTest(m: Markup, p: Pt, tol: number): boolean {
  const pts = m.points
  const t = tol + m.width / 2
  switch (m.type) {
    case 'line':
    case 'arrow':
    case 'length':
      return distToSegment(p, pts[0], pts[1]) <= t
    case 'pen':
    case 'highlighter':
    case 'perimeter':
      for (let i = 1; i < pts.length; i++) if (distToSegment(p, pts[i - 1], pts[i]) <= t) return true
      return pts.length === 1 && dist(p, pts[0]) <= t
    case 'rect':
    case 'text': {
      const b = bbox(pts)
      const inside = p.x >= b.minX && p.x <= b.maxX && p.y >= b.minY && p.y <= b.maxY
      if (m.type === 'text' || m.fill) return inside || nearPolygon(p, rectCorners(pts[0], pts[1]), t)
      return nearPolygon(p, rectCorners(pts[0], pts[1]), t)
    }
    case 'ellipse': {
      const b = bbox(pts)
      const rx = (b.maxX - b.minX) / 2
      const ry = (b.maxY - b.minY) / 2
      if (rx === 0 || ry === 0) return false
      const cx = b.minX + rx
      const cy = b.minY + ry
      const v = ((p.x - cx) / rx) ** 2 + ((p.y - cy) / ry) ** 2
      if (m.fill) return v <= 1
      const edge = t / Math.min(rx, ry)
      return Math.abs(Math.sqrt(v) - 1) <= edge
    }
    case 'polygon':
    case 'cloud':
    case 'area':
      return (m.fill || m.type === 'area' ? pointInPolygon(p, pts) : false) || nearPolygon(p, pts, t + (m.type === 'cloud' ? 6 : 0))
    case 'callout': {
      const box = rectCorners(pts[1], pts[2])
      const b = bbox([pts[1], pts[2]])
      const inside = p.x >= b.minX && p.x <= b.maxX && p.y >= b.minY && p.y <= b.maxY
      return inside || distToSegment(p, pts[0], nearestRectPoint(pts[0], b)) <= t || nearPolygon(p, box, t)
    }
    case 'note': {
      const b = markupBounds(m)
      return p.x >= b.minX && p.x <= b.maxX && p.y >= b.minY && p.y <= b.maxY
    }
    case 'count':
      return pts.some((q) => dist(p, q) <= Math.max(t, 8))
  }
}

function nearPolygon(p: Pt, poly: Pt[], t: number): boolean {
  for (let i = 0; i < poly.length; i++) {
    if (distToSegment(p, poly[i], poly[(i + 1) % poly.length]) <= t) return true
  }
  return false
}

/** 사각형 테두리 위에서 점 p 에 가장 가까운 점 (콜아웃 지시선 연결용) */
export function nearestRectPoint(p: Pt, b: Box): Pt {
  const cx = Math.max(b.minX, Math.min(p.x, b.maxX))
  const cy = Math.max(b.minY, Math.min(p.y, b.maxY))
  if (cx !== p.x || cy !== p.y) return { x: cx, y: cy }
  // 점이 상자 안이면 가장 가까운 변으로
  const dl = p.x - b.minX
  const dr = b.maxX - p.x
  const db = p.y - b.minY
  const dt = b.maxY - p.y
  const m = Math.min(dl, dr, db, dt)
  if (m === dl) return { x: b.minX, y: p.y }
  if (m === dr) return { x: b.maxX, y: p.y }
  if (m === db) return { x: p.x, y: b.minY }
  return { x: p.x, y: b.maxY }
}

export function translate(points: Pt[], dx: number, dy: number): Pt[] {
  return points.map((p) => ({ x: p.x + dx, y: p.y + dy }))
}

/** 펜 획 단순화 (Ramer–Douglas–Peucker) */
export function simplify(points: Pt[], eps: number): Pt[] {
  if (points.length < 3) return points
  let maxD = 0
  let idx = 0
  const a = points[0]
  const b = points[points.length - 1]
  for (let i = 1; i < points.length - 1; i++) {
    const d = distToSegment(points[i], a, b)
    if (d > maxD) {
      maxD = d
      idx = i
    }
  }
  if (maxD > eps) {
    const left = simplify(points.slice(0, idx + 1), eps)
    const right = simplify(points.slice(idx), eps)
    return [...left.slice(0, -1), ...right]
  }
  return [a, b]
}
