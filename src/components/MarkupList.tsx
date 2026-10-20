import { ArrowDown, ArrowUp, FileDown, Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { centroid } from '../lib/geometry'
import { measure } from '../lib/measure'
import { TYPE_LABELS, type Markup } from '../lib/types'
import { useDoc } from '../store'
import { ALL_TOOLS } from '../tools'
import { Button, cx, inputCls } from './ui'

type SortKey = 'page' | 'type' | 'text' | 'value' | 'author' | 'modifiedAt'

const COLS: { key: SortKey; label: string; className: string }[] = [
  { key: 'page', label: '페이지', className: 'w-16' },
  { key: 'type', label: '종류', className: 'w-28' },
  { key: 'text', label: '내용', className: '' },
  { key: 'value', label: '측정값', className: 'w-32 text-right' },
  { key: 'author', label: '작성자', className: 'w-28' },
  { key: 'modifiedAt', label: '수정일', className: 'w-40' },
]

export function MarkupList({ onExport }: { onExport: () => void }) {
  const markups = useDoc((s) => s.markups)
  const cals = useDoc((s) => s.calibrations)
  const selectedId = useDoc((s) => s.selectedId)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'page', dir: 1 })

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = markups.map((m) => ({ m, ms: measure(m, cals[m.page]) }))
    const filtered = q
      ? list.filter(({ m, ms }) =>
          [TYPE_LABELS[m.type], m.text, m.author, ms?.label ?? '', String(m.page + 1)].some((v) => v.toLowerCase().includes(q)),
        )
      : list
    const val = (r: (typeof list)[number]): string | number => {
      switch (sort.key) {
        case 'page':
          return r.m.page
        case 'type':
          return TYPE_LABELS[r.m.type]
        case 'value':
          return r.ms?.value ?? -Infinity
        default:
          return r.m[sort.key]
      }
    }
    return [...filtered].sort((a, b) => {
      const va = val(a)
      const vb = val(b)
      const c = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), 'ko')
      return c * sort.dir || a.m.createdAt.localeCompare(b.m.createdAt)
    })
  }, [markups, cals, query, sort])

  const go = (m: Markup) => {
    const d = useDoc.getState()
    d.setTool('select')
    d.select(m.id)
    d.focusPage(m.page, centroid(m.points))
  }

  return (
    <section aria-label="마크업 목록" className="flex h-full flex-col">
      <div className="flex h-10 shrink-0 items-center gap-3 border-b border-border px-3">
        <span className="text-[var(--text-sm)] font-semibold">마크업 목록</span>
        <span className="rounded-full bg-surface-2 px-2 text-[var(--text-xs)] text-muted tabular" data-testid="markup-count">
          {query ? `${rows.length} / ${markups.length}` : markups.length}
        </span>
        <div className="relative ml-auto w-64">
          <Search size={14} className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-subtle" aria-hidden />
          <input
            aria-label="마크업 검색"
            placeholder="종류·내용·작성자로 찾기"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className={cx(inputCls, 'h-7 pr-7 pl-7 text-[var(--text-sm)] select-text')}
          />
          {query && (
            <button aria-label="검색어 지우기" onClick={() => setQuery('')} className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded p-0.5 text-subtle hover:text-fg">
              <X size={13} />
            </button>
          )}
        </div>
        <Button size="sm" icon={FileDown} onClick={onExport} disabled={!markups.length}>
          CSV 내보내기
        </Button>
      </div>
      <div className="flex-1 overflow-auto">
        {markups.length === 0 ? (
          <div className="flex h-full items-center justify-center text-[var(--text-sm)] text-muted">
            아직 마크업이 없습니다. 위 도구 막대에서 도구를 골라 도면에 그려 보세요.
          </div>
        ) : (
          <table className="w-full border-collapse text-[var(--text-sm)]">
            <thead className="sticky top-0 z-[1] bg-surface-2">
              <tr>
                {COLS.map((c) => (
                  <th key={c.key} scope="col" className={cx('border-b border-border px-3 py-0 text-left font-medium whitespace-nowrap text-muted', c.className)} aria-sort={sort.key === c.key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
                    <button
                      className={cx('inline-flex h-8 items-center gap-1 hover:text-fg', c.className.includes('text-right') && 'w-full justify-end')}
                      onClick={() => setSort((s) => ({ key: c.key, dir: s.key === c.key ? (s.dir === 1 ? -1 : 1) : 1 }))}
                    >
                      {c.label}
                      {sort.key === c.key && (sort.dir === 1 ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ m, ms }) => {
                const Icon = ALL_TOOLS.find((t) => t.id === m.type)?.icon
                const active = m.id === selectedId
                return (
                  <tr
                    key={m.id}
                    data-row={m.id}
                    tabIndex={0}
                    aria-selected={active}
                    onClick={() => go(m)}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), go(m))}
                    className={cx('cursor-pointer border-b border-border/60 outline-none', active ? 'bg-primary-soft' : 'hover:bg-surface-hover focus-visible:bg-surface-hover')}
                  >
                    <td className="px-3 py-1.5 tabular">{m.page + 1}</td>
                    <td className="px-3 py-1.5">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-black/10" style={{ background: m.color }} aria-hidden />
                        {Icon && <Icon size={13} className="text-muted" aria-hidden />}
                        {TYPE_LABELS[m.type]}
                      </span>
                    </td>
                    <td className="max-w-0 truncate px-3 py-1.5" title={m.text}>
                      {m.text || <span className="text-subtle">—</span>}
                    </td>
                    <td className="px-3 py-1.5 text-right font-medium tabular">{ms?.label ?? ''}</td>
                    <td className="truncate px-3 py-1.5 text-muted">{m.author}</td>
                    <td className="px-3 py-1.5 text-muted tabular">{new Date(m.modifiedAt).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  )
}
