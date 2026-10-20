import type { Pt } from './types'

/** pdf.js viewport.transform 과 같은 [a, b, c, d, e, f] 행렬 */
export type Matrix = [number, number, number, number, number, number]

export const apply = (m: Matrix, p: Pt): Pt => ({ x: m[0] * p.x + m[2] * p.y + m[4], y: m[1] * p.x + m[3] * p.y + m[5] })

export function invert(m: Matrix): Matrix {
  const [a, b, c, d, e, f] = m
  const det = a * d - b * c
  return [d / det, -b / det, -c / det, a / det, (c * f - d * e) / det, (b * e - a * f) / det]
}

export const scaleMatrix = (m: Matrix, s: number): Matrix => [m[0] * s, m[1] * s, m[2] * s, m[3] * s, m[4] * s, m[5] * s]

export interface PageInfo {
  /** 배율 1일 때 화면 크기 (pt) */
  width: number
  height: number
  /** 배율 1일 때 PDF→화면 행렬 */
  transform: Matrix
}
