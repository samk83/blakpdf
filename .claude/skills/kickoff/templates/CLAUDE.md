# {프로젝트 이름}

{한두 문장: 무엇을 하는 앱인지, 누가 쓰는지}

## 먼저 읽을 것
- 다음 할 일: `NEXT_STEPS.md` (세션 시작 때 가장 먼저)
- 수락기준: `docs/SPEC.md` · 기획: `docs/PLAN.md`
- 디자인 규칙: `design.md` (공통) · 시안 스택·참고자료: `docs/DESIGN_REFERENCES.md` · `design/brand.md`, `design/tokens.css` (이 프로젝트, 시안 확정 후 생김)
- 기능 지도: `docs/FEATURES.md` · 결정 기록: `docs/DECISIONS.md` · 변경 기록: `CHANGELOG.md`

## 진행 단계
- [x] 1. 기획서로 시작 (kickoff)
- [ ] 2. 시안 (design-board) — Owner가 `/design`으로 5안 → 3안 → 1안 확정. 기록은 `design/README.md`
- [ ] 3. 설계 (구조·데이터·화면 연결)
- [ ] 4. 개발 (작은 단위로 구현·테스트·커밋)
- [ ] 5. 출시 전 점검 (ship-check)

## 개발 흐름 (Owner 작업 규칙 v3.1)
설계·개발은 `build` 스킬(개발 루프)을 따른다. 요약:
1. `docs/SPEC.md`, 이 파일, `NEXT_STEPS.md`, git 상태를 읽는다. SPEC이 없거나 수락기준이 비어 있으면 먼저 요청한다.
2. 범위 확인은 **1회만**: 만들 것 / 안 만들 것 / 리스크 / 꼭 필요한 질문을 5줄 이내로 보여 준다. OK를 받으면 이후 질문 없이 진행한다. "코딩 진행할까요?"를 매번 묻지 않는다.
3. 작은 단위로 구현 → 테스트 → 수정 → 다음 단위.
4. COMPLETED라고 하기 전에 `spec-reviewer` 에이전트로 수락기준을 대조한다.
5. `CHANGELOG.md`·`NEXT_STEPS.md`·`docs/FEATURES.md` 갱신 → 커밋 → 보고.

## 권한 LEVEL
| LEVEL | 무엇 | 하는 법 |
|---|---|---|
| L1 자동 | 코드, 테스트, 리팩터, 버그 수정, 문서, 로컬 커밋, 무료 라이브러리 | 그냥 한다 |
| L2 판단 후 실행 | 새 모듈, 성능 최적화, 파일 3개 이하 구조 변경 | 하고 `docs/DECISIONS.md`에 기록 |
| L3 승인 필수 | 데이터 삭제, 핵심 기능 제거, 파일 4개 이상 구조 변경, 유료, 배포, push --force, 보안 약화, 키·개인정보 외부 전송, SPEC 밖 기능 | 그 작업만 멈추고 묻는다. 나머지는 계속 |

명령 승인 목록은 `.claude/settings.json`에 있다 (L1 명령은 자동 허용, L3에 해당하는 명령은 확인 또는 차단).
같은 파일의 훅이 세션 시작 때 현황(git·`NEXT_STEPS.md`)을 알려 주고, 강제 올리기·`rm -rf`·`sudo`·비밀 파일 접근은 실행 전에 막는다. 막히면 우회하지 말고 Owner에게 묻는다.

## 멈추는 규칙
- 같은 오류 3회 실패 → 가설을 다시 세운다. 5회 → 멈추고 현황을 보고한다.
- 테스트를 통과시키려고 검사를 끄거나, 테스트를 지우거나, skip하지 않는다.
- 확인하지 않은 것을 됐다고 말하지 않는다.

## 완료 기준 (Definition of Done)
- SPEC 수락기준 전부 통과 (spec-reviewer 확인)
- 타입·린트·빌드·테스트 통과 (해당 없으면 N/A, 못 돌린 것은 이유 기록)
- 기존 기능 회귀 없음
- 문서·CHANGELOG·NEXT_STEPS 갱신, 커밋 완료

상태는 셋 중 하나로 보고한다: **COMPLETED** / **IMPLEMENTED — VERIFICATION PENDING** / **INCOMPLETE**

## 작업 규칙
- UI를 만들거나 고칠 때는 `design.md`와 `design/tokens.css`를 따른다. 색·간격을 하드코딩하지 않고 토큰을 쓴다.
- UI/디자인 시안 작업 시 `docs/DESIGN_REFERENCES.md`의 스택·참고자료를 우선 사용한다.
- 기능을 추가·수정하면 `docs/FEATURES.md`를, 중요한 결정을 하면 `docs/DECISIONS.md`를 함께 갱신한다.
- 필요한 도구·자료·로그인은 작업할 때 Owner에게 요청한다 (무엇이·왜·어떻게).

## 기술 선택
- {예: 웹 앱 — Vite + React + TypeScript}
- 실행 환경: {예: 브라우저 (PC·휴대폰)}

## 자주 쓰는 명령
- {설계·개발 단계에서 채움: 설치, 실행, 테스트, 빌드}
