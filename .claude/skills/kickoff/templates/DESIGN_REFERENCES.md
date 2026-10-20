# DESIGN_REFERENCES.md — 디자인 시안 작업 기준
<!-- CLAUDE.md에 추가: "UI/디자인 시안 작업 시 docs/DESIGN_REFERENCES.md의 스택·참고자료를 우선 사용한다." -->

## 0. 원칙
- 기본 스택을 바꾸지 말 것. 1절 스택은 kickoff에서 정한 기술과 맞을 때의 기본값이다 (웹은 React 기준, 모바일은 Flutter 기준). 다른 기술(Vue, Svelte, React Native 등)을 골랐으면 그 기술을 유지하고 같은 역할의 대응 라이브러리를 쓴다.
- 새 라이브러리는 MIT/Apache/BSD/ISC/OFL만.
- 시안은 "실제 제품처럼" — 더미 텍스트(lorem ipsum) 금지, 실제 도메인 문구 사용.
- 아이콘은 한 세트만, 폰트는 최대 2종, 색상은 토큰(CSS 변수)으로만.
- 스크린샷 참고 자료가 있으면 레이아웃·간격·위계만 참고하고 그대로 복제하지 않는다.

## 1. 기본 스택

### 웹 / Electron / Tauri
| 역할 | 라이브러리 | 라이선스 | 링크 |
|---|---|---|---|
| 컴포넌트 | shadcn/ui | MIT | https://ui.shadcn.com |
| 스타일 | Tailwind CSS | MIT | https://tailwindcss.com |
| 헤드리스 프리미티브 | Radix UI | MIT | https://www.radix-ui.com |
| 아이콘 | Lucide | ISC | https://lucide.dev |
| 차트 | Recharts | MIT | https://recharts.org |
| 대시보드 블록 | Tremor | Apache 2.0 | https://tremor.so |
| 표/데이터그리드 | TanStack Table | MIT | https://tanstack.com/table |
| 애니메이션 | Motion (Framer Motion) | MIT | https://motion.dev |
| 폼 | React Hook Form + Zod | MIT | https://react-hook-form.com |

### 모바일 (Flutter)
| 역할 | 라이브러리 | 라이선스 | 링크 |
|---|---|---|---|
| 디자인 시스템 | Material 3 (내장) | BSD | https://m3.material.io |
| iOS 스타일 | Cupertino (내장) | BSD | https://docs.flutter.dev/ui/widgets/cupertino |
| 애니메이션 | flutter_animate | MIT | https://pub.dev/packages/flutter_animate |
| 아이콘 | lucide_icons | ISC | https://pub.dev/packages/lucide_icons |
| 반응형 | flutter_screenutil | Apache 2.0 | https://pub.dev/packages/flutter_screenutil |
| 폰트 | google_fonts | Apache 2.0 | https://pub.dev/packages/google_fonts |

### Windows 데스크톱 (.NET)
| 역할 | 라이브러리 | 라이선스 | 링크 |
|---|---|---|---|
| WPF 모던 UI | WPF UI (lepoco) | MIT | https://wpfui.lepo.co |
| WinUI 3 | Windows App SDK | MIT | https://learn.microsoft.com/windows/apps/winui |
| 아이콘 | Fluent UI System Icons | MIT | https://github.com/microsoft/fluentui-system-icons |

## 2. 디자인 시스템 가이드 (구조·규칙 참고)
| 이름 | 용도 | 링크 |
|---|---|---|
| Material Design 3 | 모바일 기본 규칙(간격·타이포·색) | https://m3.material.io |
| Apple Human Interface Guidelines | iOS/macOS 규칙 | https://developer.apple.com/design/human-interface-guidelines |
| Fluent 2 | Windows 앱 규칙 | https://fluent2.microsoft.design |
| Atlassian Design System | B2B/업무용 UI 패턴 | https://atlassian.design |
| GitLab Pajamas | 복잡한 관리 화면 패턴 | https://design.gitlab.com |
| Shopify Polaris | 관리자/대시보드 패턴 | https://polaris.shopify.com |
| IBM Carbon | 엔터프라이즈·데이터 UI | https://carbondesignsystem.com |
| GOV.UK Design System | 폼·접근성 정석 | https://design-system.service.gov.uk |

## 3. 실제 앱 화면 참고 (스크린샷 → 레이아웃 참고용)
| 이름 | 특징 | 링크 |
|---|---|---|
| Refero | 실제 웹앱 화면·플로우, 무료 티어 | https://refero.design |
| Screenlane | 모바일 앱 화면 | https://screenlane.com |
| Page Flows | 플로우 영상 | https://pageflows.com |
| SaaS UI Patterns | B2B 패턴 | https://www.saasuipatterns.com |
| Mobbin | 유료, 가장 방대 (필요 시) | https://mobbin.com |

## 4. 토큰 / 색 / 타이포
| 이름 | 용도 | 링크 |
|---|---|---|
| Tailwind 색 팔레트 | 기본 색 토큰 | https://tailwindcss.com/docs/colors |
| Radix Colors | 접근성 보장 팔레트 (다크모드 포함) | https://www.radix-ui.com/colors |
| Google Fonts | 상업용 무료 폰트 (OFL) | https://fonts.google.com |
| Inter | 기본 영문 UI 폰트 | https://rsms.me/inter |
| Pretendard | 기본 한글 UI 폰트 | https://github.com/orioncactus/pretendard |
| Type Scale | 타이포 비율 계산 | https://typescale.com |
| Realtime Colors | 팔레트 미리보기 | https://www.realtimecolors.com |

## 5. 일러스트 / 이미지 (상업용 무료)
| 이름 | 라이선스 | 링크 |
|---|---|---|
| unDraw | 자체 오픈 라이선스 | https://undraw.co |
| Storyset | 무료(출처 표기) | https://storyset.com |
| Unsplash | Unsplash License | https://unsplash.com |
| Phosphor Icons | MIT | https://phosphoricons.com |
| Tabler Icons | MIT | https://tabler.io/icons |

## 6. 디자인 툴 (오픈소스)
| 이름 | 용도 | 링크 |
|---|---|---|
| Penpot | Figma 대체, 오픈소스 | https://penpot.app |
| Excalidraw | 와이어프레임·플로우 스케치 | https://excalidraw.com |
| tldraw | 화이트보드 | https://tldraw.com |

## 7. 시안 요청 시 프롬프트 템플릿
    [시안 요청]
    - 플랫폼: 웹 / Flutter / WPF
    - 화면: ○○ 화면 (목적: ___)
    - 스택: DESIGN_REFERENCES.md 1절 기본 스택
    - 참고: (스크린샷 첨부 또는 2절 디자인 시스템 이름)
    - 톤: 전문적 / 미니멀 / 다크모드 지원
    - 색: Radix Slate 중립 + 포인트 1색
    - 결과물: 실제 데이터 문구, 상태 3종(기본/빈 화면/에러) 포함
