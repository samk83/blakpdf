/** PDF 사용자 공간 좌표 (단위: pt, 원점: 페이지 왼쪽 아래, y 위쪽) */
export interface Pt {
  x: number
  y: number
}

export type DrawTool =
  | 'line'
  | 'arrow'
  | 'rect'
  | 'ellipse'
  | 'polygon'
  | 'cloud'
  | 'text'
  | 'callout'
  | 'note'
  | 'pen'
  | 'highlighter'

export type MeasureTool = 'length' | 'area' | 'perimeter' | 'count'

export type MarkupType = DrawTool | MeasureTool

export type Tool = 'select' | 'pan' | 'calibrate' | MarkupType

export interface Markup {
  id: string
  /** 0부터 시작하는 페이지 번호 */
  page: number
  type: MarkupType
  /**
   * 종류별 점 의미
   * - line/arrow/length: [시작, 끝]
   * - rect/ellipse/text: [모서리1, 모서리2]
   * - callout: [화살표 끝, 글상자 모서리1, 글상자 모서리2]
   * - note: [아이콘 위치]
   * - polygon/cloud/area/perimeter/pen/highlighter/count: 꼭짓점·점 목록
   */
  points: Pt[]
  color: string
  /** 채우기 색. null 이면 채우지 않음 */
  fill: string | null
  width: number
  opacity: number
  text: string
  fontSize: number
  author: string
  createdAt: string
  modifiedAt: string
}

export interface Calibration {
  /** PDF 상의 거리 (pt) */
  pdfDistance: number
  /** 실제 거리 */
  realDistance: number
  unit: string
}

export type Calibrations = Record<number, Calibration>

export interface MarkupStyle {
  color: string
  fill: string | null
  width: number
  opacity: number
  fontSize: number
}

export const MEASURE_TYPES: MarkupType[] = ['length', 'area', 'perimeter', 'count']

export const TYPE_LABELS: Record<MarkupType, string> = {
  line: '선',
  arrow: '화살표',
  rect: '사각형',
  ellipse: '타원',
  polygon: '다각형',
  cloud: '구름',
  text: '텍스트',
  callout: '콜아웃',
  note: '메모',
  pen: '펜',
  highlighter: '형광펜',
  length: '길이',
  area: '면적',
  perimeter: '둘레',
  count: '개수',
}
