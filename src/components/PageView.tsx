import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { findHit, polylinePath, translatePoints } from '../markup/geometry';
import { distance } from '../markup/measure';
import type { Calibration, Markup, Point, ShapeKind, Style, Tool } from '../markup/types';
import { renderPage, type PageSize, type PdfPage } from '../pdf/loader';
import { MarkupShape } from './MarkupShape';

interface Props {
  page: PdfPage | null;
  pageNumber: number;
  size: PageSize;
  zoom: number;
  tool: Tool;
  style: Style;
  fontSize: number;
  markups: Markup[]; // 이 페이지 것만
  selectedIds: string[];
  calibration: Calibration;
  onAdd: (m: Omit<Markup, 'id' | 'createdAt'>) => void;
  onSelect: (ids: string[]) => void;
  onMove: (ids: string[], dx: number, dy: number) => void;
  onRequestText: (at: Point) => void;
  onRequestCalibrate: (a: Point, b: Point) => void;
  onCursor: (p: Point | null) => void;
  onPan: (dx: number, dy: number) => void;
}

type Gesture =
  | { kind: 'draw'; shape: ShapeKind; points: Point[] }
  | { kind: 'calibrate'; points: Point[] }
  | { kind: 'move'; ids: string[]; start: Point; offset: Point }
  | { kind: 'pan'; lastX: number; lastY: number };

const FREEHAND: ShapeKind[] = ['pen', 'highlight'];

export function PageView(props: Props) {
  const { page, size, zoom, tool, style, markups, selectedIds, calibration, pageNumber } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [gesture, setGesture] = useState<Gesture | null>(null);
  const [rendering, setRendering] = useState(false);

  // 페이지·배율이 바뀌면 PDF를 다시 그린다 (이전 작업은 취소)
  useEffect(() => {
    if (!page || !canvasRef.current) return;
    setRendering(true);
    const task = renderPage(page, canvasRef.current, zoom);
    task.promise.then(
      () => setRendering(false),
      () => undefined, // 취소됨
    );
    return () => task.cancel();
  }, [page, zoom]);

  const toPage = (e: { clientX: number; clientY: number }): Point => {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) / zoom, y: (e.clientY - r.top) / zoom };
  };

  const onPointerDown = (e: RPointerEvent<SVGSVGElement>) => {
    if (e.button === 1 || tool === 'pan') {
      setGesture({ kind: 'pan', lastX: e.clientX, lastY: e.clientY });
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }
    if (e.button !== 0) return;
    const p = toPage(e);
    e.currentTarget.setPointerCapture(e.pointerId);

    if (tool === 'select') {
      const hit = findHit(markups, pageNumber, p, 4 / zoom);
      if (!hit) {
        props.onSelect([]);
        return;
      }
      let ids = selectedIds;
      if (e.shiftKey) ids = selectedIds.includes(hit.id) ? selectedIds.filter((i) => i !== hit.id) : [...selectedIds, hit.id];
      else if (!selectedIds.includes(hit.id)) ids = [hit.id];
      props.onSelect(ids);
      if (ids.includes(hit.id)) setGesture({ kind: 'move', ids, start: p, offset: { x: 0, y: 0 } });
      return;
    }
    if (tool === 'text') {
      props.onRequestText(p);
      return;
    }
    if (tool === 'calibrate') {
      setGesture({ kind: 'calibrate', points: [p, p] });
      return;
    }
    setGesture({ kind: 'draw', shape: tool, points: [p, p] });
  };

  const onPointerMove = (e: RPointerEvent<SVGSVGElement>) => {
    const p = toPage(e);
    props.onCursor(p);
    if (!gesture) return;
    if (gesture.kind === 'pan') {
      props.onPan(gesture.lastX - e.clientX, gesture.lastY - e.clientY);
      setGesture({ ...gesture, lastX: e.clientX, lastY: e.clientY });
    } else if (gesture.kind === 'move') {
      setGesture({ ...gesture, offset: { x: p.x - gesture.start.x, y: p.y - gesture.start.y } });
    } else if (gesture.kind === 'draw' && FREEHAND.includes(gesture.shape)) {
      const last = gesture.points[gesture.points.length - 1];
      if (distance(last, p) * zoom >= 1.5) setGesture({ ...gesture, points: [...gesture.points, p] });
    } else {
      setGesture({ ...gesture, points: [gesture.points[0], shiftSnap(gesture.points[0], p, e.shiftKey)] });
    }
  };

  const onPointerUp = () => {
    const g = gesture;
    setGesture(null);
    if (!g) return;
    if (g.kind === 'move') {
      if (g.offset.x !== 0 || g.offset.y !== 0) props.onMove(g.ids, g.offset.x, g.offset.y);
      return;
    }
    if (g.kind === 'calibrate') {
      if (distance(g.points[0], g.points[1]) * zoom > 3) props.onRequestCalibrate(g.points[0], g.points[1]);
      return;
    }
    if (g.kind === 'draw') {
      const pts = FREEHAND.includes(g.shape) ? g.points.slice(1) : g.points;
      const big = FREEHAND.includes(g.shape) ? pts.length >= 2 : distance(pts[0], pts[1]) * zoom > 3;
      if (big) props.onAdd({ kind: g.shape, page: pageNumber, points: pts, style: { ...style }, fontSize: undefined });
    }
  };

  const moving = gesture?.kind === 'move' ? gesture : null;
  const draft: Markup | null =
    gesture?.kind === 'draw'
      ? { id: 'draft', kind: gesture.shape, page: pageNumber, points: FREEHAND.includes(gesture.shape) ? gesture.points.slice(1) : gesture.points, style, createdAt: 0 }
      : null;

  return (
    <div className="page" style={{ width: size.width * zoom, height: size.height * zoom }} data-testid="page" data-page={pageNumber}>
      <canvas ref={canvasRef} className="page-canvas" aria-label={`${pageNumber}쪽`} data-rendering={rendering ? 'true' : 'false'} />
      <svg
        ref={svgRef}
        className={`page-overlay tool-${tool}`}
        data-testid="overlay"
        width={size.width * zoom}
        height={size.height * zoom}
        viewBox={`0 0 ${size.width} ${size.height}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => setGesture(null)}
        onPointerLeave={() => props.onCursor(null)}
      >
        {markups.map((m) => {
          const shown = moving && moving.ids.includes(m.id) ? { ...m, points: translatePoints(m.points, moving.offset.x, moving.offset.y) } : m;
          return <MarkupShape key={m.id} markup={shown} calibration={calibration} selected={selectedIds.includes(m.id)} zoom={zoom} />;
        })}
        {draft && draft.points.length > 0 && <MarkupShape markup={draft} calibration={calibration} zoom={zoom} />}
        {gesture?.kind === 'calibrate' && (
          <path d={polylinePath(gesture.points)} stroke="var(--color-accent)" strokeWidth={2 / zoom} strokeDasharray={`${6 / zoom} ${4 / zoom}`} fill="none" />
        )}
      </svg>
    </div>
  );
}

/** Shift를 누르면 45° 단위로 맞춘다 */
function shiftSnap(a: Point, b: Point, on: boolean): Point {
  if (!on) return b;
  const ang = Math.round(Math.atan2(b.y - a.y, b.x - a.x) / (Math.PI / 4)) * (Math.PI / 4);
  const d = distance(a, b);
  return { x: a.x + d * Math.cos(ang), y: a.y + d * Math.sin(ang) };
}
