import { markupBounds, midpoint, strokePaths } from '../markup/geometry';
import { formatMeasure, measureLength } from '../markup/measure';
import type { Calibration, Markup } from '../markup/types';

interface Props {
  markup: Markup;
  calibration: Calibration;
  selected?: boolean;
  zoom: number;
}

/** 마크업 하나를 SVG로 그린다. 좌표는 페이지 포인트, 확대는 바깥 viewBox가 맡는다. */
export function MarkupShape({ markup: m, calibration, selected, zoom }: Props) {
  const common = {
    stroke: m.style.color,
    strokeWidth: m.style.width,
    strokeOpacity: m.style.opacity,
    fill: 'none',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  const b = markupBounds(m);
  const pad = 4 / zoom + m.style.width / 2;

  return (
    <g data-markup-id={m.id} data-kind={m.kind}>
      {strokePaths(m).map((d, i) => (
        <path key={i} d={d} {...common} />
      ))}
      {m.kind === 'text' && (
        <text
          x={m.points[0].x + 4}
          y={m.points[0].y + 3}
          fill={m.style.color}
          fillOpacity={m.style.opacity}
          fontSize={m.fontSize ?? 14}
          fontFamily='"Segoe UI", "Malgun Gothic", Helvetica, sans-serif'
          dominantBaseline="hanging"
        >
          {(m.text ?? '').split('\n').map((line, i) => (
            <tspan key={i} x={m.points[0].x + 4} dy={i === 0 ? 0 : (m.fontSize ?? 14) * 1.2}>
              {line}
            </tspan>
          ))}
        </text>
      )}
      {m.kind === 'length' && <LengthLabel markup={m} calibration={calibration} />}
      {selected && (
        <rect
          className="selection-box"
          x={b.x - pad}
          y={b.y - pad}
          width={b.w + pad * 2}
          height={b.h + pad * 2}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth={1.5 / zoom}
          strokeDasharray={`${4 / zoom} ${3 / zoom}`}
        />
      )}
    </g>
  );
}

function LengthLabel({ markup, calibration }: { markup: Markup; calibration: Calibration }) {
  const mid = midpoint(markup.points[0], markup.points[1]);
  const label = formatMeasure(measureLength(markup.points, calibration), calibration.unit);
  return (
    <text
      className="measure-label"
      x={mid.x + 4}
      y={mid.y - 6}
      fill={markup.style.color}
      fontSize={11}
      fontFamily='"Segoe UI", Helvetica, sans-serif'
      paintOrder="stroke"
      stroke="#ffffff"
      strokeWidth={3}
      strokeOpacity={0.85}
    >
      {label}
    </text>
  );
}
