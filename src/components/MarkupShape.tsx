import { memo } from 'react'
import { markupPrims, type Seg } from '../lib/shapes'
import type { Calibration, Markup } from '../lib/types'
import { apply, type Matrix } from '../lib/viewport'

export function segsToD(segs: Seg[]): string {
  return segs
    .map((s) => {
      switch (s.op) {
        case 'M':
          return `M${s.p.x} ${s.p.y}`
        case 'L':
          return `L${s.p.x} ${s.p.y}`
        case 'C':
          return `C${s.c1.x} ${s.c1.y} ${s.c2.x} ${s.c2.y} ${s.p.x} ${s.p.y}`
        default:
          return 'Z'
      }
    })
    .join('')
}

interface Props {
  m: Markup
  cal?: Calibration
  /** PDF → 화면 행렬 (현재 배율) */
  matrix: Matrix
  zoom: number
  /** 글자 편집 중이면 글자를 숨긴다 */
  hideText?: boolean
  preview?: boolean
}

/** 마크업 하나를 SVG 로 그린다. 저장(PDF)과 같은 shapes.ts 결과를 쓴다 */
export const MarkupShape = memo(function MarkupShape({ m, cal, matrix, zoom, hideText, preview }: Props) {
  const prims = markupPrims(m, cal)
  const highlighter = m.type === 'highlighter'
  return (
    <g
      data-markup-id={preview ? undefined : m.id}
      data-markup-type={m.type}
      opacity={m.opacity}
      style={highlighter ? { mixBlendMode: 'multiply' } : undefined}
    >
      <g transform={`matrix(${matrix.join(' ')})`}>
        {prims.map((p, i) =>
          p.kind === 'path' ? (
            <path
              key={i}
              d={segsToD(p.segs)}
              fill={p.fill ?? 'none'}
              fillOpacity={p.fillOpacity}
              stroke={p.stroke ?? 'none'}
              strokeWidth={p.width}
              strokeLinecap={highlighter ? 'butt' : 'round'}
              strokeLinejoin="round"
            />
          ) : null,
        )}
      </g>
      {!hideText &&
        prims.map((p, i) => {
          if (p.kind !== 'text') return null
          const at = apply(matrix, p.at)
          const size = p.size * zoom
          return (
            <text
              key={`t${i}`}
              x={at.x}
              y={at.y}
              fill={p.color}
              fontSize={size}
              textAnchor={p.center ? 'middle' : 'start'}
              dominantBaseline={p.center ? 'central' : 'alphabetic'}
              className={p.halo ? 'markup-label tabular' : undefined}
              style={{ fontFamily: 'var(--font-sans)', fontWeight: p.halo ? 600 : 400 }}
            >
              {p.lines.map((line, li) => (
                <tspan key={li} x={at.x} dy={li === 0 ? 0 : size * 1.25}>
                  {line || ' '}
                </tspan>
              ))}
            </text>
          )
        })}
    </g>
  )
})
