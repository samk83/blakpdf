import { measure } from './measure'
import { TYPE_LABELS, type Calibrations, type Markup } from './types'

export const CSV_HEADERS = ['페이지', '종류', '내용', '색', '측정값', '단위', '작성자', '작성일', '수정일'] as const

function cell(v: string | number): string {
  const s = String(v)
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function markupRow(m: Markup, cals: Calibrations): (string | number)[] {
  const ms = measure(m, cals[m.page])
  return [
    m.page + 1,
    TYPE_LABELS[m.type],
    m.text,
    m.color,
    ms ? Number(ms.value.toFixed(4)) : '',
    ms ? ms.unit : '',
    m.author,
    m.createdAt,
    m.modifiedAt,
  ]
}

/** 엑셀에서 한글이 깨지지 않도록 UTF-8 BOM 을 붙인 CSV 문자열 */
export function toCsv(markups: Markup[], cals: Calibrations): string {
  const lines = [CSV_HEADERS.join(',')]
  for (const m of markups) lines.push(markupRow(m, cals).map(cell).join(','))
  return '﻿' + lines.join('\r\n') + '\r\n'
}
