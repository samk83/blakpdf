# 브랜드 디자인: BlakPDF

> 공통 규칙은 프로젝트 루트의 `design.md`. 이 파일은 이 앱만의 디자인 결정이다. 실제 값은 `tokens.css`.

## 확정 안
- 시안: "차분한 전문가 도구" · 확정일: 2026-10-20 (Owner 위임, Claude 결정)
- 한 줄 콘셉트: 도면이 주인공. 회색 중립 바탕에 인디고 한 색으로 상태만 강조, 촘촘하지만 정돈된 도구 막대.
- 참고: Microsoft Fluent 2(데스크톱 밀도), Radix Colors(중립 팔레트), shadcn/ui(부품 모양). 그대로 복제하지 않고 재해석.

## 색 역할
| 역할 | 토큰 | 라이트 | 다크 | 쓰는 곳 |
|---|---|---|---|---|
| 기본색 | `--color-primary` | #3b5bdb | #748ffc | 주요 버튼, 선택된 도구, 선택 표시 |
| 배경 | `--color-bg` / `--color-surface` | #f1f3f5 / #ffffff | #111317 / #1a1d23 | 창 / 패널 |
| 캔버스 | `--color-canvas` | #dfe3e8 | #0b0c0f | 도면 뒤 점 무늬 바탕 |
| 글자 | `--color-text` / `-muted` / `-subtle` | #1a1d23 / #59616d / #6b737e | #eceef1 / #a4abb5 / #7d8590 | 본문 / 보조 / 힌트 |
| 상태 | `--color-success` · `--color-warning` · `--color-danger` | | | 저장 완료·축척 보정선·오류 |

명도 대비: 모든 글자 조합 4.5:1 이상 (contrast.py로 계산, 2026-10-20).

## 글꼴
- Pretendard Variable (UI), 숫자는 `tabular-nums`
- 크기: 11 / 12 / 13(기본) / 15 / 20px

## 모양
- 모서리 6 / 8 / 12px · 버튼 높이 28·32px · 머리글 48px · 도구 막대 44px · 상태 표시줄 30px
- 그림자: 패널은 테두리 위주, 페이지·대화상자·알림만 그림자

## 아이콘
- Lucide, 선 굵기 1.9, 17px (작은 버튼 15px)

## 움직임
- 120ms(빠름) / 200ms, ease `cubic-bezier(0.2,0,0,1)`. 알림·툴팁은 살짝 떠오르며 나타남
- Reduced Motion 설정 시 애니메이션 1ms

## 화면
| 화면 | 파일 |
|---|---|
| 빈 화면(시작) | `src/components/Overlays.tsx` EmptyState |
| 메인(머리글·도구·썸네일·도면·속성·목록·상태) | `src/App.tsx`, `src/components/*` |
| 축척 보정 대화상자 | `src/components/Overlays.tsx` CalibrateDialog |

## 다크 모드
- 지원. `[data-theme='dark']`에서 토큰 덮어쓰기. 머리글 오른쪽 해/달 버튼, 선택 기억.
- 도면(PDF 페이지)은 다크에서도 흰 종이로 둔다 (도면 색 왜곡 방지).
