# 기능 지도

| 기능 | 담당 파일 | 사용하는 공통 기능 | 부르는 곳 | 비고 |
|---|---|---|---|---|
| PDF 열기 (메뉴·버튼·끌어다 놓기) | `src/App.tsx` (openBytes), `src/platform.ts`, `electron/main.cjs` (open-file) | `src/pdf/loader.ts` | 도구 막대, 파일 메뉴, 시작 화면 | 브라우저는 파일 선택 창, PC는 운영체제 창 |
| 페이지 그리기 | `src/pdf/loader.ts` (renderPage), `src/components/PageView.tsx` | pdf.js legacy | App | 배율 바뀔 때마다 다시 그림 |
| 썸네일 | `src/components/Thumbnails.tsx` | renderPage | App | 마크업 개수 배지 |
| 확대/축소·페이지 이동 | `src/components/Toolbar.tsx` (nextZoom), `src/App.tsx` (Ctrl+휠, fitWidth, goPage) | | | |
| 마크업 그리기·선택·이동 | `src/components/PageView.tsx` | `src/markup/geometry.ts` (findHit, translatePoints) | App | Shift = 45° / 여러 개 선택 |
| 마크업 모양 | `src/markup/geometry.ts` (strokePaths, cloudPath, arrowHead…), `src/components/MarkupShape.tsx` | | 화면·저장 둘 다 | 같은 path로 그려 화면=저장 결과 |
| 속성 (색·굵기·투명도·글자 크기) | `src/components/SidePanel.tsx` (PropertiesPanel), `src/App.tsx` (onStyle) | store `restyle` | | 도구별 기본 스타일 기억 |
| 축척·길이 측정 | `src/markup/measure.ts`, `src/App.tsx` (calibrate 창) | store `setCalibration` | PageView, MarkupShape, exportPdf | 페이지별 축척 |
| 마크업 목록 | `src/components/SidePanel.tsx` (MarkupList) | | App | 클릭 = 이동·선택 |
| 실행 취소/다시 실행 | `src/markup/store.ts` | | App (Ctrl+Z/Y, 버튼) | 슬라이더 연속 변경은 1단계로 합침 |
| PDF 저장 | `src/pdf/exportPdf.ts`, `src/pdf/rasterizeText.ts`, `src/platform.ts`, `electron/main.cjs` (save-file) | geometry, measure | App (save) | 한글 글자는 PNG로 넣음 |
| PC 프로그램 창·메뉴·닫기 확인 | `electron/main.cjs`, `electron/preload.cjs` | | | app:// 로 dist 제공 |
