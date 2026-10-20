import { describe, expect, it } from 'vitest';
import { cloudPath, findHit, hitTest, markupBounds, strokePaths } from '../../src/markup/geometry';
import type { Markup, ShapeKind } from '../../src/markup/types';

const mk = (kind: ShapeKind, pts: [number, number][], extra: Partial<Markup> = {}): Markup => ({
  id: kind,
  kind,
  page: 1,
  points: pts.map(([x, y]) => ({ x, y })),
  style: { color: '#000000', width: 2, opacity: 1 },
  createdAt: 0,
  ...extra,
});

describe('도형 판정', () => {
  it('선 근처를 누르면 선택되고 멀면 안 된다', () => {
    const line = mk('line', [[0, 0], [100, 0]]);
    expect(hitTest(line, { x: 50, y: 3 }, 3)).toBe(true);
    expect(hitTest(line, { x: 50, y: 20 }, 3)).toBe(false);
  });

  it('사각형 안쪽을 누르면 선택된다', () => {
    expect(hitTest(mk('rect', [[10, 10], [50, 50]]), { x: 30, y: 30 }, 2)).toBe(true);
  });

  it('겹치면 나중에 그린 것이 먼저 선택된다, 다른 페이지는 무시', () => {
    const a = { ...mk('rect', [[0, 0], [50, 50]]), id: 'a' };
    const b = { ...mk('rect', [[0, 0], [50, 50]]), id: 'b' };
    const c = { ...mk('rect', [[0, 0], [50, 50]]), id: 'c', page: 2 };
    expect(findHit([a, b, c], 1, { x: 10, y: 10 }, 2)?.id).toBe('b');
  });

  it('텍스트 상자 크기는 글자 수에 비례', () => {
    const t = mk('text', [[0, 0]], { text: 'hello', fontSize: 10 });
    expect(markupBounds(t).w).toBeGreaterThan(20);
  });

  it('모든 도형이 SVG path를 만든다 (텍스트 제외)', () => {
    const kinds: ShapeKind[] = ['pen', 'highlight', 'line', 'arrow', 'rect', 'ellipse', 'cloud', 'length'];
    for (const k of kinds) {
      const paths = strokePaths(mk(k, [[0, 0], [100, 60]]));
      expect(paths.length, k).toBeGreaterThan(0);
      expect(paths[0].startsWith('M'), k).toBe(true);
    }
    expect(strokePaths(mk('text', [[0, 0]], { text: 'x' }))).toEqual([]);
  });

  it('구름은 둘레를 따라 여러 개의 호로 만들어진다', () => {
    const d = cloudPath({ x: 0, y: 0, w: 120, h: 60 }, 12);
    expect((d.match(/A /g) ?? []).length).toBe(10 + 5 + 10 + 5);
  });
});
