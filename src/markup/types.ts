// 마크업 좌표는 모두 "PDF 포인트(1/72 inch), 페이지 왼쪽 위가 원점, 아래로 +y" 단위로 저장한다.
// 화면 배율과 무관하므로 확대/축소해도 위치가 그대로이고, 저장할 때만 PDF 좌표(아래가 원점)로 뒤집는다.

export type Point = { x: number; y: number };

export type ShapeKind = 'pen' | 'highlight' | 'line' | 'arrow' | 'rect' | 'ellipse' | 'cloud' | 'text' | 'length';

export type Tool = 'select' | 'pan' | 'calibrate' | ShapeKind;

export interface Style {
  color: string; // #rrggbb
  width: number; // 선 굵기 (pt)
  opacity: number; // 0~1
}

export interface Markup {
  id: string;
  kind: ShapeKind;
  page: number; // 1부터
  points: Point[]; // pen/highlight: 모든 점, 나머지: [시작, 끝]
  style: Style;
  text?: string; // text 마크업 내용
  fontSize?: number;
  createdAt: number;
}

export interface Calibration {
  unitsPerPoint: number; // PDF 1pt 당 실제 길이
  unit: string; // 'm', 'mm', 'ft' ...
}

export const KIND_LABEL: Record<ShapeKind, string> = {
  pen: '펜',
  highlight: '형광펜',
  line: '선',
  arrow: '화살표',
  rect: '사각형',
  ellipse: '원',
  cloud: '구름',
  text: '텍스트',
  length: '길이 측정',
};
