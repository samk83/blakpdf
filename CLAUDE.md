# BlakPDF

Windows용 PDF 도면 검토 데스크톱 앱. PDF에 마크업을 달고, 축척을 맞춰 길이·면적을 재고, 마크업 목록을 CSV로 내보낸다. Bluebeam Revu 같은 도구를 쓰는 건설·설계 검토자가 대상. Owner의 개인 실험 프로젝트.

## 먼저 읽을 것
- 다음 할 일: `NEXT_STEPS.md` (세션 시작 때 가장 먼저) · 진행 현황: `STATUS.md`
- 수락기준: `docs/SPEC.md` · 기획·조사: `docs/PLAN.md`
- 디자인 규칙: `design.md` (공통) · `design/brand.md`, `design/tokens.css` (이 프로젝트) · 참고자료: `docs/DESIGN_REFERENCES.md`
- 기능 지도: `docs/FEATURES.md` · 결정 기록: `docs/DECISIONS.md` · 변경 기록: `CHANGELOG.md`

## 진행 단계
- [x] 1. 기획 (Bluebeam 기능 조사 → SPEC)
- [x] 2. 시안 (Owner 위임: Claude가 결정. `design/brand.md`)
- [x] 3. 설계
- [x] 4. 개발 (MVP)
- [ ] 5. 출시 전 점검 (Owner PC에서 실제 실행 확인)

## 개발 흐름 (Owner 작업 규칙 v3.1)
설계·개발은 `build` 스킬(개발 루프)을 따른다. 요약:
1. `docs/SPEC.md`, 이 파일, `NEXT_STEPS.md`, `STATUS.md`, git 상태를 읽는다.
2. 범위 확인은 **1회만**. OK를 받으면 이후 질문 없이 진행한다.
3. 작은 단위로 구현 → 테스트 → 수정 → 다음 단위.
4. COMPLETED라고 하기 전에 `spec-reviewer` 에이전트로 수락기준을 대조한다.
5. `CHANGELOG.md`·`NEXT_STEPS.md`·`docs/FEATURES.md`·`STATUS.md` 갱신 → 커밋 → 보고.

## 권한 LEVEL
| LEVEL | 무엇 | 하는 법 |
|---|---|---|
| L1 자동 | 코드, 테스트, 리팩터, 버그 수정, 문서, 로컬 커밋, 무료 라이브러리 | 그냥 한다 |
| L2 판단 후 실행 | 새 모듈, 성능 최적화, 파일 3개 이하 구조 변경 | 하고 `docs/DECISIONS.md`에 기록 |
| L3 승인 필수 | 데이터 삭제, 핵심 기능 제거, 파일 4개 이상 구조 변경, 유료, 배포, push --force, 보안 약화, 키·개인정보 외부 전송, SPEC 밖 기능 | 그 작업만 멈추고 묻는다 |

## 멈추는 규칙
- 같은 오류 3회 실패 → 가설을 다시 세운다. 5회 → 멈추고 현황을 보고한다.
- 테스트를 통과시키려고 검사를 끄거나, 테스트를 지우거나, skip하지 않는다.
- 확인하지 않은 것을 됐다고 말하지 않는다.

## 클린룸 원칙 (중요)
- Bluebeam의 코드·디컴파일 결과·아이콘·이미지·도움말 문구를 이 저장소에 넣지 않는다. 기능 관찰 결과만 참고한다.
- 아이콘은 Lucide, 글꼴은 Pretendard(OFL), PDF 처리는 pdf.js(Apache-2.0)·pdf-lib(MIT).

## 작업 규칙
- UI를 만들거나 고칠 때는 `design.md`와 `design/tokens.css`를 따른다. 색·간격은 토큰(CSS 변수)을 쓴다.
- 화면(SVG)과 저장(PDF)의 마크업 모양은 `src/lib/shapes.ts` 한 곳에서 만든다. 모양을 바꾸면 둘 다 바뀐다.
- 기능을 추가·수정하면 `docs/FEATURES.md`를, 중요한 결정을 하면 `docs/DECISIONS.md`를 갱신한다.

## 기술 선택
- 데스크톱 앱: Electron 44 + Vite 7 + React 19 + TypeScript
- UI: Tailwind CSS 4, Radix UI(툴팁·대화상자), Lucide 아이콘, Pretendard 글꼴
- PDF: pdf.js 5 (화면 그리기), pdf-lib (주석 저장), @pdf-lib/fontkit (한글 글꼴 넣기)
- 상태 관리: zustand
- 실행 환경: Windows 10/11 (브라우저에서도 대부분 동작: `npm run dev`)

## 자주 쓰는 명령
- 설치: `npm install`
- 앱 실행: `npm start` (빌드 후 Electron 창)
- 개발 서버(브라우저): `npm run dev`
- 단위 테스트: `npm test`
- 타입 검사: `npm run typecheck`
- 빌드: `npm run build`
- 화면 테스트: `npm run test:e2e` (Playwright Chromium 필요)
- 데스크톱 창 확인(Linux): `xvfb-run -a node tests/electron/smoke.mjs`
- 실행 파일 만들기(Windows): `npm run dist` → `release/` 폴더 (L3: 배포 전 Owner 확인)
