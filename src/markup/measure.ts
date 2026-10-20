import type { Calibration, Point } from './types';

// 축척을 설정하기 전 기본값: 1pt = 25.4/72 mm (도면 1:1)
export const DEFAULT_CALIBRATION: Calibration = { unitsPerPoint: 25.4 / 72, unit: 'mm' };

export function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function polylineLength(points: Point[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += distance(points[i - 1], points[i]);
  return total;
}

/** 알려진 두 점 사이 실제 길이로 축척을 만든다. */
export function calibrate(a: Point, b: Point, realLength: number, unit: string): Calibration {
  const d = distance(a, b);
  if (!(d > 0)) throw new Error('두 점이 같습니다. 서로 다른 두 점을 찍어 주세요.');
  if (!(realLength > 0)) throw new Error('실제 길이는 0보다 커야 합니다.');
  return { unitsPerPoint: realLength / d, unit };
}

export function measureLength(points: Point[], cal: Calibration): number {
  return polylineLength(points) * cal.unitsPerPoint;
}

export function formatMeasure(value: number, unit: string): string {
  const digits = Math.abs(value) >= 100 ? 1 : 2;
  return `${value.toFixed(digits)} ${unit}`;
}
