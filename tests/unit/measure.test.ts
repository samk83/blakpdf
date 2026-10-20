import { describe, expect, it } from 'vitest';
import { calibrate, DEFAULT_CALIBRATION, formatMeasure, measureLength } from '../../src/markup/measure';

describe('측정/축척', () => {
  it('두 점과 실제 길이로 축척을 만들고 그 축척으로 길이를 잰다', () => {
    const cal = calibrate({ x: 100, y: 100 }, { x: 200, y: 100 }, 5, 'm');
    expect(cal.unitsPerPoint).toBeCloseTo(0.05);
    expect(measureLength([{ x: 0, y: 0 }, { x: 300, y: 400 }], cal)).toBeCloseTo(25);
    expect(formatMeasure(25, 'm')).toBe('25.00 m');
  });

  it('기본 축척은 1pt = 0.3528 mm', () => {
    expect(measureLength([{ x: 0, y: 0 }, { x: 72, y: 0 }], DEFAULT_CALIBRATION)).toBeCloseTo(25.4);
  });

  it('잘못된 입력은 오류', () => {
    expect(() => calibrate({ x: 1, y: 1 }, { x: 1, y: 1 }, 5, 'm')).toThrow();
    expect(() => calibrate({ x: 0, y: 0 }, { x: 1, y: 1 }, 0, 'm')).toThrow();
  });
});
