import type { Markup, MarkupType, Pt } from '../../src/lib/types'

export function mk(type: MarkupType, points: Pt[], extra: Partial<Markup> = {}): Markup {
  return {
    id: `t-${type}-${Math.random().toString(36).slice(2, 7)}`,
    page: 0,
    type,
    points,
    color: '#e03131',
    fill: null,
    width: 2,
    opacity: 1,
    text: '',
    fontSize: 12,
    author: '검토자',
    createdAt: '2026-10-20T00:00:00.000Z',
    modifiedAt: '2026-10-20T00:00:00.000Z',
    ...extra,
  }
}
