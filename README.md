# BlakPDF

PDF 도면 검토용 Windows 데스크톱 앱입니다. 도면에 마크업을 달고, 축척을 맞춰 길이·면적을 재고, 마크업 목록을 CSV(엑셀)로 내보냅니다.

## 실행 방법 (Windows)

준비물: [Node.js](https://nodejs.org) 22 이상, Git

PowerShell에서:

```powershell
git clone https://github.com/samk83/blakpdf.git
cd blakpdf
npm install
npm start
```

처음 `npm install`은 몇 분 걸립니다 (Electron 내려받기). 앱이 뜨면 **샘플 도면 열기**로 바로 써 볼 수 있습니다.

## 할 수 있는 것

| 영역 | 기능 |
|---|---|
| 보기 | PDF 열기(끌어다 놓기 가능), 썸네일, 확대·축소(Ctrl+휠), 폭/쪽 맞춤, 화면 이동(Space+끌기) |
| 마크업 | 선, 화살표, 사각형, 타원, 다각형, 구름, 텍스트, 콜아웃, 메모, 펜, 형광펜 |
| 편집 | 선택·이동·점 손잡이로 모양 수정, 색·채우기·두께·투명도·글자 크기, 실행 취소/다시 실행 |
| 측정 | 축척 보정, 길이, 둘레, 면적, 개수 |
| 목록 | 마크업 표, 정렬·검색, 클릭하면 그 위치로 이동, CSV 내보내기 |
| 저장 | 표준 PDF 주석으로 저장(다른 PDF 뷰어에서도 보임), 다시 열면 편집 가능 |

## 단축키

| 키 | 동작 | 키 | 동작 |
|---|---|---|---|
| V | 선택 | H / Space | 화면 이동 |
| L | 선 | A | 화살표 |
| R | 사각형 | E | 타원 |
| P | 다각형 | C | 구름 |
| T | 텍스트 | Q | 콜아웃 |
| N | 메모 | F | 펜 |
| I | 형광펜 | K | 축척 보정 |
| M | 길이 | U | 둘레 |
| G | 면적 | O | 개수 |
| Ctrl+O / S / Shift+S | 열기 / 저장 / 다른 이름 저장 | Ctrl+Z / Y | 실행 취소 / 다시 |
| Ctrl+휠, Ctrl+ +/- | 확대·축소 | Ctrl+0 / 9 | 폭 / 쪽 맞춤 |
| Delete | 선택 삭제 | Enter / Esc | 여러 점 도구 끝내기 / 취소 |

## 개발

`CLAUDE.md`의 "자주 쓰는 명령"을 보세요. 사용한 오픈소스: Electron, React, pdf.js, pdf-lib, Tailwind CSS, Radix UI, Lucide, Pretendard, zustand.

Bluebeam®은 Bluebeam, Inc.의 상표이며 이 프로젝트와 관계없습니다. 이 앱은 기능을 관찰해 새로 작성했고 Bluebeam의 코드·아이콘·에셋을 포함하지 않습니다.
