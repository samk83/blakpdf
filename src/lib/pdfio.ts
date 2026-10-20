/**
 * PDF 읽기/쓰기 (pdf-lib).
 * - 저장: 마크업을 표준 PDF 주석(/Annot)과 외형 스트림(/AP)으로 넣어 다른 뷰어에서도 보이게 한다.
 *   편집 정보(마크업·축척)는 카탈로그의 /BlakPDFData 스트림(JSON)에 함께 넣는다.
 * - 열기: 이전에 BlakPDF가 넣은 주석(/NM 이 'blakpdf-' 로 시작)을 화면용 사본에서 빼고,
 *   /BlakPDFData 에서 편집 가능한 마크업으로 되살린다.
 */
import fontkit from '@pdf-lib/fontkit'
import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFOperator,
  PDFRawStream,
  PDFRef,
  PDFString,
  appendBezierCurve,
  beginText,
  closePath,
  decodePDFRawStream,
  endText,
  fill,
  fillAndStroke,
  lineTo,
  moveTo,
  popGraphicsState,
  pushGraphicsState,
  rectangle,
  setFillingRgbColor,
  setFontAndSize,
  setGraphicsState,
  setLineCap,
  setLineJoin,
  setLineWidth,
  setStrokingRgbColor,
  setTextMatrix,
  showText,
  stroke,
  type PDFFont,
} from 'pdf-lib'
import { bbox, inflate, type Box } from './geometry'
import { measure } from './measure'
import { markupPrims, type Prim } from './shapes'
import type { Calibrations, Markup } from './types'

export const NM_PREFIX = 'blakpdf-'
const DATA_KEY = PDFName.of('BlakPDFData')
const DATA_VERSION = 1

export interface EditData {
  version: number
  markups: Markup[]
  calibrations: Calibrations
}

export interface LoadedPdf {
  /** 화면에 그릴 사본 (BlakPDF 주석 제거) */
  viewBytes: Uint8Array
  markups: Markup[]
  calibrations: Calibrations
  pageCount: number
}

function nmOf(dict: PDFDict): string | undefined {
  const nm = dict.lookup(PDFName.of('NM'))
  if (nm instanceof PDFString || nm instanceof PDFHexString) return nm.decodeText()
  return undefined
}

/** BlakPDF가 넣었던 주석과 편집 데이터를 문서에서 뺀다 */
function stripOwn(doc: PDFDocument): number {
  let removed = 0
  for (const page of doc.getPages()) {
    const annots = page.node.lookupMaybe(PDFName.of('Annots'), PDFArray)
    if (!annots) continue
    for (let i = annots.size() - 1; i >= 0; i--) {
      const d = annots.lookupMaybe(i, PDFDict)
      const nm = d && nmOf(d)
      if (nm && nm.startsWith(NM_PREFIX)) {
        const ref = annots.get(i)
        annots.remove(i)
        if (ref instanceof PDFRef) doc.context.delete(ref)
        removed++
      }
    }
  }
  doc.catalog.delete(DATA_KEY)
  return removed
}

function readEditData(doc: PDFDocument): EditData | null {
  const s = doc.catalog.lookupMaybe(DATA_KEY, PDFRawStream)
  if (!s) return null
  try {
    const bytes = decodePDFRawStream(s).decode()
    const data = JSON.parse(new TextDecoder().decode(bytes)) as EditData
    if (!Array.isArray(data.markups)) return null
    return { version: data.version ?? 1, markups: data.markups, calibrations: data.calibrations ?? {} }
  } catch {
    return null
  }
}

export async function loadPdf(bytes: Uint8Array): Promise<LoadedPdf> {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false, ignoreEncryption: true })
  const data = readEditData(doc)
  const removed = stripOwn(doc)
  const pageCount = doc.getPageCount()
  // 고칠 것이 없으면 원본 바이트를 그대로 보여 준다 (원본 손상 위험 없음)
  const viewBytes = data || removed ? await doc.save({ useObjectStreams: false }) : bytes
  return {
    viewBytes,
    markups: (data?.markups ?? []).filter((m) => m.page < pageCount),
    calibrations: data?.calibrations ?? {},
    pageCount,
  }
}

// ---------- 저장 ----------

function rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.padEnd(6, '0')
  const n = parseInt(full.slice(0, 6), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

function pdfDate(iso: string): string {
  const d = new Date(iso)
  const t = isNaN(d.getTime()) ? new Date() : d
  const p = (n: number) => String(n).padStart(2, '0')
  return `D:${t.getUTCFullYear()}${p(t.getUTCMonth() + 1)}${p(t.getUTCDate())}${p(t.getUTCHours())}${p(t.getUTCMinutes())}${p(t.getUTCSeconds())}Z`
}

const SUBTYPE: Record<Markup['type'], string> = {
  line: 'Line',
  arrow: 'Line',
  length: 'Line',
  rect: 'Square',
  ellipse: 'Circle',
  polygon: 'Polygon',
  cloud: 'Polygon',
  area: 'Polygon',
  perimeter: 'PolyLine',
  pen: 'Ink',
  highlighter: 'Ink',
  count: 'Ink',
  text: 'FreeText',
  callout: 'FreeText',
  note: 'Text',
}

const hasText = (m: Markup) => m.type === 'text' || m.type === 'callout'

interface Fonts {
  font: PDFFont | null
}

/** 그리기 요소 → PDF 연산자 */
function primOps(prims: Prim[], m: Markup, fonts: Fonts): { ops: PDFOperator[]; box: Box } {
  const ops: PDFOperator[] = [pushGraphicsState(), setGraphicsState('GS0'), setLineCap(1), setLineJoin(1)]
  const pts: { x: number; y: number }[] = []
  for (const pr of prims) {
    if (pr.kind === 'path') {
      if (!pr.segs.length) continue
      const fillOp = pr.fill && pr.fillOpacity < 1
      ops.push(pushGraphicsState())
      if (fillOp) ops.push(setGraphicsState('GS1'))
      for (const s of pr.segs) {
        if (s.op === 'M') ops.push(moveTo(s.p.x, s.p.y))
        else if (s.op === 'L') ops.push(lineTo(s.p.x, s.p.y))
        else if (s.op === 'C') ops.push(appendBezierCurve(s.c1.x, s.c1.y, s.c2.x, s.c2.y, s.p.x, s.p.y))
        else ops.push(closePath())
        if (s.op !== 'Z') pts.push(s.p)
        if (s.op === 'C') pts.push(s.c1, s.c2)
      }
      if (pr.stroke) {
        ops.push(setStrokingRgbColor(...rgb(pr.stroke)), setLineWidth(pr.width))
      }
      if (pr.fill) ops.push(setFillingRgbColor(...rgb(pr.fill)))
      if (pr.fill && pr.stroke && !fillOp) ops.push(fillAndStroke())
      else if (pr.fill && !fillOp) ops.push(fill())
      else if (pr.stroke && !fillOp) ops.push(stroke())
      else if (fillOp) ops.push(fill())
      ops.push(popGraphicsState())
      // 반투명 채우기와 테두리를 함께 쓰는 경우 테두리를 한 번 더 그린다
      if (fillOp && pr.stroke) {
        ops.push(pushGraphicsState())
        for (const s of pr.segs) {
          if (s.op === 'M') ops.push(moveTo(s.p.x, s.p.y))
          else if (s.op === 'L') ops.push(lineTo(s.p.x, s.p.y))
          else if (s.op === 'C') ops.push(appendBezierCurve(s.c1.x, s.c1.y, s.c2.x, s.c2.y, s.p.x, s.p.y))
          else ops.push(closePath())
        }
        ops.push(setStrokingRgbColor(...rgb(pr.stroke)), setLineWidth(pr.width), stroke(), popGraphicsState())
      }
    } else {
      const font = fonts.font
      if (!font) continue
      const lh = pr.size * 1.25
      pr.lines.forEach((line, i) => {
        if (!line) return
        const w = font.widthOfTextAtSize(line, pr.size)
        const x = pr.center ? pr.at.x - w / 2 : pr.at.x
        const y = pr.center ? pr.at.y - pr.size * 0.35 : pr.at.y - i * lh
        if (pr.halo) {
          ops.push(
            pushGraphicsState(),
            setFillingRgbColor(1, 1, 1),
            rectangle(x - 2, y - pr.size * 0.3, w + 4, pr.size * 1.3),
            fill(),
            popGraphicsState(),
          )
          pts.push({ x: x - 2, y: y - pr.size * 0.3 }, { x: x + w + 2, y: y + pr.size })
        } else {
          pts.push({ x, y: y - pr.size * 0.3 }, { x: x + w, y: y + pr.size })
        }
        ops.push(
          beginText(),
          setFillingRgbColor(...rgb(pr.color)),
          setFontAndSize('F0', pr.size),
          setTextMatrix(1, 0, 0, 1, x, y),
          showText(font.encodeText(line)),
          endText(),
        )
      })
    }
  }
  ops.push(popGraphicsState())
  const box = pts.length ? inflate(bbox(pts), m.width + 1) : inflate(bbox(m.points), m.width + 1)
  return { ops, box }
}

function buildAnnot(doc: PDFDocument, m: Markup, cals: Calibrations, fonts: Fonts): PDFRef {
  const ctx = doc.context
  const prims = markupPrims(m, cals[m.page])
  const { ops, box } = primOps(prims, m, fonts)
  const rect = [box.minX, box.minY, box.maxX, box.maxY]
  const highlighter = m.type === 'highlighter'

  const resources: Record<string, unknown> = {
    ExtGState: {
      GS0: { Type: 'ExtGState', CA: m.opacity, ca: m.opacity, ...(highlighter ? { BM: 'Multiply' } : {}) },
      GS1: { Type: 'ExtGState', CA: m.opacity, ca: m.opacity * (m.fill ? 1 : 0.18) },
    },
  }
  if (fonts.font) resources.Font = { F0: fonts.font.ref }
  const ap = ctx.register(ctx.formXObject(ops, { BBox: rect, Resources: resources }))

  const ms = measure(m, cals[m.page])
  const contents = [m.text, ms?.label].filter(Boolean).join(' | ')
  const dict: Record<string, unknown> = {
    Type: 'Annot',
    Subtype: SUBTYPE[m.type],
    Rect: rect,
    NM: PDFString.of(NM_PREFIX + m.id),
    T: PDFHexString.fromText(m.author),
    Contents: PDFHexString.fromText(contents),
    M: PDFString.of(pdfDate(m.modifiedAt)),
    CreationDate: PDFString.of(pdfDate(m.createdAt)),
    F: 4,
    C: rgb(m.color),
    CA: m.opacity,
    BS: { W: m.width, S: 'S' },
    AP: { N: ap },
  }
  if (m.fill) dict.IC = rgb(m.fill)
  const flat = (pts: { x: number; y: number }[]) => pts.flatMap((p) => [p.x, p.y])
  switch (SUBTYPE[m.type]) {
    case 'Line':
      dict.L = flat(m.points.slice(0, 2))
      if (m.type === 'arrow') dict.LE = [PDFName.of('None'), PDFName.of('OpenArrow')]
      if (m.type === 'length') dict.IT = PDFName.of('LineDimension')
      break
    case 'Polygon':
      dict.Vertices = flat(m.points)
      if (m.type === 'cloud') dict.BE = { S: 'C', I: 1 }
      if (m.type === 'area') dict.IT = PDFName.of('PolygonDimension')
      break
    case 'PolyLine':
      dict.Vertices = flat(m.points)
      dict.IT = PDFName.of('PolyLineDimension')
      break
    case 'Ink':
      dict.InkList = m.type === 'count' ? m.points.map((p) => [p.x, p.y]) : [flat(m.points)]
      break
    case 'FreeText':
      dict.DA = PDFString.of(`/Helv ${m.fontSize} Tf ${rgb(m.color).map((v) => v.toFixed(3)).join(' ')} rg`)
      if (m.type === 'callout') {
        dict.IT = PDFName.of('FreeTextCallout')
        dict.CL = flat([m.points[0], m.points[1]])
      }
      break
    case 'Text':
      dict.Name = PDFName.of('Comment')
      dict.Open = false
      break
  }
  return ctx.register(ctx.obj(dict as never))
}

export interface SaveOptions {
  /** 글자(한글 포함)를 외형 스트림에 넣을 TTF 글꼴 */
  fontBytes?: Uint8Array
}

/** 원본 PDF + 마크업 → 새 PDF 바이트. 원본은 바꾸지 않는다. */
export async function savePdf(
  original: Uint8Array,
  markups: Markup[],
  calibrations: Calibrations,
  opts: SaveOptions = {},
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(original, { updateMetadata: false, ignoreEncryption: true })
  stripOwn(doc)
  const fonts: Fonts = { font: null }
  const needsFont = markups.some((m) => hasText(m) || measure(m, calibrations[m.page]))
  if (needsFont && opts.fontBytes) {
    doc.registerFontkit(fontkit)
    fonts.font = await doc.embedFont(opts.fontBytes, { subset: true })
  }
  const pages = doc.getPages()
  for (const m of markups) {
    const page = pages[m.page]
    if (!page) continue
    const ref = buildAnnot(doc, m, calibrations, fonts)
    let annots = page.node.lookupMaybe(PDFName.of('Annots'), PDFArray)
    if (!annots) {
      annots = doc.context.obj([])
      page.node.set(PDFName.of('Annots'), annots)
    }
    annots.push(ref)
  }
  const data: EditData = { version: DATA_VERSION, markups, calibrations }
  const json = new TextEncoder().encode(JSON.stringify(data))
  const stream = doc.context.flateStream(json)
  doc.catalog.set(DATA_KEY, doc.context.register(stream))
  return doc.save({ useObjectStreams: false })
}

