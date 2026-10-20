import { describe, expect, it } from 'vitest';
import { historyReducer, initHistory, type History } from '../../src/markup/store';
import type { Markup } from '../../src/markup/types';

const mk = (id: string): Markup => ({
  id,
  kind: 'rect',
  page: 1,
  points: [{ x: 0, y: 0 }, { x: 10, y: 10 }],
  style: { color: '#ff0000', width: 2, opacity: 1 },
  createdAt: 0,
});

const run = (h: History, ...actions: Parameters<typeof historyReducer>[1][]) => actions.reduce(historyReducer, h);

describe('실행 취소 / 다시 실행', () => {
  it('추가·이동·속성 변경·삭제를 되돌리고 다시 한다', () => {
    let h = run(initHistory(), { type: 'add', markup: mk('a') });
    h = run(h, { type: 'update', id: 'a', patch: { points: [{ x: 5, y: 5 }, { x: 15, y: 15 }] } }); // 이동
    h = run(h, { type: 'updateMany', ids: ['a'], patch: { style: { color: '#0000ff', width: 4, opacity: 0.5 } } }); // 속성
    h = run(h, { type: 'remove', ids: ['a'] });
    expect(h.present.markups).toHaveLength(0);

    h = run(h, { type: 'undo' });
    expect(h.present.markups[0].style.color).toBe('#0000ff');
    h = run(h, { type: 'undo' });
    expect(h.present.markups[0].style.color).toBe('#ff0000');
    h = run(h, { type: 'undo' });
    expect(h.present.markups[0].points[0]).toEqual({ x: 0, y: 0 });
    h = run(h, { type: 'undo' });
    expect(h.present.markups).toHaveLength(0);
    h = run(h, { type: 'undo' }); // 더 없음
    expect(h.past).toHaveLength(0);

    h = run(h, { type: 'redo' }, { type: 'redo' });
    expect(h.present.markups[0].points[0]).toEqual({ x: 5, y: 5 });
    h = run(h, { type: 'redo' }, { type: 'redo' });
    expect(h.present.markups).toHaveLength(0);
  });

  it('새 동작을 하면 다시 실행 목록은 비워진다', () => {
    let h = run(initHistory(), { type: 'add', markup: mk('a') }, { type: 'undo' });
    expect(h.future).toHaveLength(1);
    h = run(h, { type: 'add', markup: mk('b') });
    expect(h.future).toHaveLength(0);
  });

  it('아무것도 안 바뀌는 동작은 기록하지 않는다', () => {
    const h = run(initHistory(), { type: 'add', markup: mk('a') });
    expect(run(h, { type: 'remove', ids: ['zzz'] })).toBe(h);
  });

  it('축척 설정도 되돌린다', () => {
    let h = run(initHistory(), { type: 'setCalibration', page: 1, calibration: { unitsPerPoint: 0.05, unit: 'm' } });
    expect(h.present.calibrations[1].unit).toBe('m');
    h = run(h, { type: 'undo' });
    expect(h.present.calibrations[1]).toBeUndefined();
  });

  it('색만 바꾸면 다른 속성은 유지, 슬라이더 연속 변경은 한 번에 되돌린다', () => {
    let h = run(initHistory(), { type: 'add', markup: mk('a') });
    h = run(h, { type: 'restyle', ids: ['a'], style: { color: '#00ff00' } });
    expect(h.present.markups[0].style).toEqual({ color: '#00ff00', width: 2, opacity: 1 });
    h = run(
      h,
      { type: 'restyle', ids: ['a'], style: { width: 3 }, coalesceKey: 'w' },
      { type: 'restyle', ids: ['a'], style: { width: 4 }, coalesceKey: 'w' },
      { type: 'restyle', ids: ['a'], style: { width: 5 }, coalesceKey: 'w' },
    );
    expect(h.present.markups[0].style.width).toBe(5);
    h = run(h, { type: 'undo' });
    expect(h.present.markups[0].style.width).toBe(2);
    expect(h.present.markups[0].style.color).toBe('#00ff00');
  });

  it('여러 개를 한 번에 옮기면 한 번에 되돌린다', () => {
    let h = run(initHistory(), { type: 'add', markup: mk('a') }, { type: 'add', markup: mk('b') });
    h = run(h, { type: 'translate', ids: ['a', 'b'], dx: 10, dy: 5 });
    expect(h.present.markups.map((m) => m.points[0])).toEqual([{ x: 10, y: 5 }, { x: 10, y: 5 }]);
    h = run(h, { type: 'undo' });
    expect(h.present.markups.map((m) => m.points[0])).toEqual([{ x: 0, y: 0 }, { x: 0, y: 0 }]);
  });
});
