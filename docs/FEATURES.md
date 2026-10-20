# 기능 지도

각 기능이 어디에 구현되어 있고 어디서 쓰이는지 기록한다. 기능을 추가·수정할 때마다 갱신한다.

| 기능 | 담당 파일 | 사용하는 공통 기능 | 부르는 곳 | 비고 |
|---|---|---|---|---|
| PDF 열기 | `src/App.tsx` (openBytes), `src/lib/pdfio.ts` (loadPdf), `src/pdf/pdfjs.ts` | `src/lib/platform.ts` | 머리글 열기, 빈 화면, 끌어다 놓기, Ctrl+O | BlakPDF 주석은 화면용 사본에서 빼고 편집 데이터로 복원 |
| PDF 저장 | `src/lib/pdfio.ts` (savePdf), `electron/main.cjs` (file:save) | `src/lib/shapes.ts`, `src/lib/fonts.ts` | 머리글 저장, Ctrl+S | 표준 /Annot + /AP, 카탈로그 /BlakPDFData(JSON). 임시 파일 후 교체 |
| 페이지 보기·확대 | `src/components/Viewer.tsx`, `PageView.tsx` | `src/lib/viewport.ts` | App | 보이는 페이지만 렌더, Ctrl+휠, Space 이동 |
| 썸네일 | `src/components/Thumbnails.tsx` | – | App 왼쪽 패널 | 페이지별 마크업 개수 배지 |
| 마크업 그리기 | `src/components/MarkupLayer.tsx` | `src/lib/geometry.ts`, `src/tools.ts` | PageView | 2점/여러 점/자유곡선/클릭 도구 |
| 마크업 모양 | `src/lib/shapes.ts` | `geometry.ts`, `measure.ts` | MarkupShape(SVG), pdfio(저장) | 화면·저장 공통 |
| 선택·이동·손잡이 | `src/components/MarkupLayer.tsx` | `geometry.ts` (hitTest) | – | |
| 속성 | `src/components/PropertiesPanel.tsx` | store | App 오른쪽 패널 | 선택 없으면 도구 기본값 편집 |
| 실행 취소 | `src/store.ts` | – | 단축키, 머리글 | 같은 속성 연속 변경은 한 번으로 묶음 |
| 축척 보정 | `MarkupLayer.tsx`, `Overlays.tsx` (CalibrateDialog), `src/lib/measure.ts` | store | 측정 도구 | 페이지별, 전체 적용 선택 |
| 측정 | `src/lib/measure.ts` | `geometry.ts` | shapes, 목록, 속성, CSV | 길이·둘레·면적·개수 |
| 마크업 목록 | `src/components/MarkupList.tsx` | measure | App 아래 패널 | 정렬·검색·클릭 이동 |
| CSV 내보내기 | `src/lib/csv.ts` | measure | 목록 패널 버튼 | UTF-8 BOM |
| 테마 | `design/tokens.css`, `src/ui-store.ts` | – | 머리글 | 라이트/다크 |
| 닫기 전 확인 | `electron/main.cjs` | platform.setDirty | – | 저장 안 된 변경 있을 때 |
