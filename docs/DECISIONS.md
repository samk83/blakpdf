# 결정 기록

| 날짜 | 결정 | 이유 | 대안 | 결정한 사람 |
|---|---|---|---|---|
| 2026-10-20 | Windows 데스크톱 앱 = React + Electron | Owner 선택. 같은 화면 코드를 브라우저에서도 자동 테스트 가능 | Tauri(작지만 Rust 필요), 웹 앱 | Owner |
| 2026-10-20 | PDF 보기 pdf.js **legacy 빌드** | 최신 빌드는 `Map.getOrInsertComputed` 같은 아주 새 JS를 써서 Chromium 141에서 열리지 않음 (테스트에서 확인) | 최신 빌드 | Claude (L2) |
| 2026-10-20 | 저장 = pdf-lib로 마크업을 페이지 내용에 그려 넣기(평탄화), 원본은 덮어쓰지 않고 `_markup.pdf`로 | 어떤 PDF 뷰어에서도 똑같이 보임, 구현 단순 | PDF 주석(annotation) 객체로 저장 — 편집 가능하지만 뷰어마다 모양 다름 → 다음 버전 후보 | Claude (L2) |
| 2026-10-20 | 한글 텍스트는 PNG 이미지로 PDF에 넣음 | PDF 기본 글꼴(Helvetica)에 한글 없음, 한글 글꼴 파일(수 MB) 포함은 무거움 | 글꼴 포함(fontkit) | Claude (L2) |
| 2026-10-20 | 시안(design-board) 단계 건너뜀, Bluebeam 계열 어두운 작업 화면을 `design/tokens.css`로 직접 정의 | Owner가 "만들어줘"로 바로 결과를 원함. 도면 작업 프로그램은 화면 구성이 사실상 정해져 있음 | /design 5→3→1 시안 | Claude (L2) |
| 2026-10-20 | 한 페이지씩 보기 (연속 스크롤 아님) | 큰 도면에서 메모리·속도 안정적, 구현 단순 | 연속 스크롤 | Claude (L2) |
| 2026-10-20 | Electron은 `app://` 사용자 프로토콜로 화면 제공 | file:// 에서는 pdf.js 모듈 워커가 막힐 수 있음 | file:// | Claude (L2) |
