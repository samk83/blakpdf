import {
  Circle,
  Cloud,
  DraftingCompass,
  Hand,
  Hash,
  Highlighter,
  MessageSquareText,
  MousePointer2,
  MoveUpRight,
  PenLine,
  Pentagon,
  Ruler,
  Slash,
  Spline,
  Square,
  SquareDashed,
  StickyNote,
  Type,
  type LucideIcon,
} from 'lucide-react'
import type { Tool } from './lib/types'

export interface ToolDef {
  id: Tool
  label: string
  icon: LucideIcon
  key: string
  hint: string
}

export const NAV_TOOLS: ToolDef[] = [
  { id: 'select', label: '선택', icon: MousePointer2, key: 'V', hint: '클릭해 선택, 끌어서 이동. 점 손잡이로 모양 수정' },
  { id: 'pan', label: '화면 이동', icon: Hand, key: 'H', hint: '끌어서 화면 이동 (어느 도구에서나 Space+끌기, 가운데 버튼)' },
]

export const MARKUP_TOOLS: ToolDef[] = [
  { id: 'line', label: '선', icon: Slash, key: 'L', hint: '끌어서 선. Shift: 45° 단위' },
  { id: 'arrow', label: '화살표', icon: MoveUpRight, key: 'A', hint: '끌어서 화살표. Shift: 45° 단위' },
  { id: 'rect', label: '사각형', icon: Square, key: 'R', hint: '끌어서 사각형. Shift: 정사각형' },
  { id: 'ellipse', label: '타원', icon: Circle, key: 'E', hint: '끌어서 타원. Shift: 원' },
  { id: 'polygon', label: '다각형', icon: Pentagon, key: 'P', hint: '클릭으로 꼭짓점, 더블클릭·Enter로 끝내기' },
  { id: 'cloud', label: '구름', icon: Cloud, key: 'C', hint: '클릭으로 꼭짓점, 더블클릭·Enter로 끝내기' },
  { id: 'text', label: '텍스트', icon: Type, key: 'T', hint: '클릭하거나 끌어서 글상자, 바로 입력' },
  { id: 'callout', label: '콜아웃', icon: MessageSquareText, key: 'Q', hint: '가리킬 곳에서 글상자 위치까지 끌기' },
  { id: 'note', label: '메모', icon: StickyNote, key: 'N', hint: '클릭해서 메모 붙이기' },
  { id: 'pen', label: '펜', icon: PenLine, key: 'F', hint: '자유롭게 그리기' },
  { id: 'highlighter', label: '형광펜', icon: Highlighter, key: 'I', hint: '자유롭게 칠하기' },
]

export const MEASURE_TOOLS: ToolDef[] = [
  { id: 'calibrate', label: '축척 보정', icon: DraftingCompass, key: 'K', hint: '길이를 아는 두 점을 클릭한 뒤 실제 거리 입력' },
  { id: 'length', label: '길이', icon: Ruler, key: 'M', hint: '끌어서 길이 측정. Shift: 45° 단위' },
  { id: 'perimeter', label: '둘레', icon: Spline, key: 'U', hint: '클릭으로 점 추가, 더블클릭·Enter로 끝내기' },
  { id: 'area', label: '면적', icon: SquareDashed, key: 'G', hint: '클릭으로 꼭짓점, 더블클릭·Enter로 끝내기' },
  { id: 'count', label: '개수', icon: Hash, key: 'O', hint: '클릭할 때마다 1개씩 셈, Enter·Esc로 끝내기' },
]

export const ALL_TOOLS = [...NAV_TOOLS, ...MARKUP_TOOLS, ...MEASURE_TOOLS]

export const toolDef = (t: Tool) => ALL_TOOLS.find((d) => d.id === t)!

export const TWO_POINT: Tool[] = ['line', 'arrow', 'rect', 'ellipse', 'text', 'length', 'callout']
export const MULTI_POINT: Tool[] = ['polygon', 'cloud', 'area', 'perimeter']
export const FREEHAND: Tool[] = ['pen', 'highlighter']
