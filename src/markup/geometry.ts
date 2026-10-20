import type { Markup, Point } from './types';

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function boxFromPoints(a: Point, b: Point): Box {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) };
}

export function textBox(m: Markup): Box {
  const size = m.fontSize ?? 14;
  const lines = (m.text ?? '').split('\n');
  const longest = Math.max(1, ...lines.map((l) => l.length));
  // 대략적인 크기 (글자 폭 ≈ 0.6em). 선택·충돌 판정용
  return { x: m.points[0].x, y: m.points[0].y, w: longest * size * 0.6 + 8, h: lines.length * size * 1.25 + 6 };
}

export function markupBounds(m: Markup): Box {
  if (m.kind === 'text') return textBox(m);
  const xs = m.points.map((p) => p.x);
  const ys = m.points.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

function distToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** 점 p(페이지 좌표)가 마크업 위에 있는지. tol은 페이지 좌표 기준 허용 거리. */
export function hitTest(m: Markup, p: Point, tol: number): boolean {
  const t = tol + m.style.width / 2;
  switch (m.kind) {
    case 'pen':
    case 'highlight':
    case 'line':
    case 'arrow':
    case 'length':
      for (let i = 1; i < m.points.length; i++) if (distToSegment(p, m.points[i - 1], m.points[i]) <= t) return true;
      return m.points.length === 1 && Math.hypot(p.x - m.points[0].x, p.y - m.points[0].y) <= t;
    case 'text': {
      const b = textBox(m);
      return p.x >= b.x - tol && p.x <= b.x + b.w + tol && p.y >= b.y - tol && p.y <= b.y + b.h + tol;
    }
    case 'rect':
    case 'ellipse':
    case 'cloud': {
      // 도형 안쪽을 눌러도 선택되게 한다 (Bluebeam과 같은 느낌)
      const b = boxFromPoints(m.points[0], m.points[1]);
      return p.x >= b.x - t && p.x <= b.x + b.w + t && p.y >= b.y - t && p.y <= b.y + b.h + t;
    }
  }
}

/** 위에 그려진(나중에 만든) 마크업부터 찾는다. */
export function findHit(markups: Markup[], page: number, p: Point, tol: number): Markup | undefined {
  for (let i = markups.length - 1; i >= 0; i--) {
    const m = markups[i];
    if (m.page === page && hitTest(m, p, tol)) return m;
  }
  return undefined;
}

export function translatePoints(points: Point[], dx: number, dy: number): Point[] {
  return points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
}

const f = (n: number) => Number(n.toFixed(2));

export function polylinePath(points: Point[]): string {
  if (points.length === 0) return '';
  const [first, ...rest] = points;
  if (rest.length === 0) return `M ${f(first.x)} ${f(first.y)} L ${f(first.x + 0.01)} ${f(first.y)}`;
  return `M ${f(first.x)} ${f(first.y)} ` + rest.map((p) => `L ${f(p.x)} ${f(p.y)}`).join(' ');
}

export function rectPath(b: Box): string {
  return `M ${f(b.x)} ${f(b.y)} L ${f(b.x + b.w)} ${f(b.y)} L ${f(b.x + b.w)} ${f(b.y + b.h)} L ${f(b.x)} ${f(b.y + b.h)} Z`;
}

export function ellipsePath(b: Box): string {
  const rx = b.w / 2;
  const ry = b.h / 2;
  const cx = b.x + rx;
  const cy = b.y + ry;
  return `M ${f(cx - rx)} ${f(cy)} A ${f(rx)} ${f(ry)} 0 1 0 ${f(cx + rx)} ${f(cy)} A ${f(rx)} ${f(ry)} 0 1 0 ${f(cx - rx)} ${f(cy)} Z`;
}

/** 리비전 클라우드: 사각형 둘레를 따라 바깥으로 볼록한 반원 호를 잇는다. */
export function cloudPath(b: Box, arc = 12): string {
  if (b.w < 1 || b.h < 1) return rectPath(b);
  const corners: Point[] = [
    { x: b.x, y: b.y },
    { x: b.x + b.w, y: b.y },
    { x: b.x + b.w, y: b.y + b.h },
    { x: b.x, y: b.y + b.h },
  ];
  let d = `M ${f(corners[0].x)} ${f(corners[0].y)}`;
  for (let s = 0; s < 4; s++) {
    const a = corners[s];
    const c = corners[(s + 1) % 4];
    const len = Math.hypot(c.x - a.x, c.y - a.y);
    const n = Math.max(1, Math.round(len / arc));
    const r = len / n / 2;
    for (let i = 1; i <= n; i++) {
      const px = a.x + ((c.x - a.x) * i) / n;
      const py = a.y + ((c.y - a.y) * i) / n;
      // 시계 방향 진행 + sweep=1 → 호가 사각형 바깥으로 볼록
      d += ` A ${f(r)} ${f(r)} 0 0 1 ${f(px)} ${f(py)}`;
    }
  }
  return d + ' Z';
}

/** 화살표 머리(끝점 쪽) 두 날개 좌표 */
export function arrowHead(a: Point, b: Point, size: number): [Point, Point] {
  const ang = Math.atan2(b.y - a.y, b.x - a.x);
  const spread = Math.PI / 7;
  return [
    { x: b.x - size * Math.cos(ang - spread), y: b.y - size * Math.sin(ang - spread) },
    { x: b.x - size * Math.cos(ang + spread), y: b.y - size * Math.sin(ang + spread) },
  ];
}

export function arrowHeadSize(width: number): number {
  return Math.max(8, width * 4);
}

/** 길이 측정 양 끝의 짧은 수직 눈금 */
export function tickMarks(a: Point, b: Point, size: number): [Point, Point][] {
  const ang = Math.atan2(b.y - a.y, b.x - a.x) + Math.PI / 2;
  const ox = (Math.cos(ang) * size) / 2;
  const oy = (Math.sin(ang) * size) / 2;
  return [
    [{ x: a.x - ox, y: a.y - oy }, { x: a.x + ox, y: a.y + oy }],
    [{ x: b.x - ox, y: b.y - oy }, { x: b.x + ox, y: b.y + oy }],
  ];
}

/** 마크업을 그릴 SVG path 목록 (화면과 PDF 저장이 같은 함수를 쓴다) */
export function strokePaths(m: Markup): string[] {
  const [a, b] = m.points;
  switch (m.kind) {
    case 'pen':
    case 'highlight':
      return [polylinePath(m.points)];
    case 'line':
      return [polylinePath([a, b])];
    case 'arrow': {
      const [w1, w2] = arrowHead(a, b, arrowHeadSize(m.style.width));
      return [polylinePath([a, b]), polylinePath([w1, b, w2])];
    }
    case 'length': {
      const ticks = tickMarks(a, b, Math.max(10, m.style.width * 5));
      return [polylinePath([a, b]), ...ticks.map((t) => polylinePath(t))];
    }
    case 'rect':
      return [rectPath(boxFromPoints(a, b))];
    case 'ellipse':
      return [ellipsePath(boxFromPoints(a, b))];
    case 'cloud':
      return [cloudPath(boxFromPoints(a, b), Math.max(10, m.style.width * 6))];
    case 'text':
      return [];
  }
}

export function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}
