#!/usr/bin/env bash
# SessionStart 훅: 세션이 시작될 때 프로젝트 현황을 Claude에게 알려 준다.
# 여기서 출력(stdout)한 글은 그대로 Claude의 대화 맥락에 들어간다 (최대 10,000자, 넘으면 잘림).
# 무엇을 알려 주나: 하네스 버전, git 브랜치·변경 파일·최근 커밋, NEXT_STEPS.md(앞부분), STATUS.md(있으면, 앞부분).
# 실패해도 세션을 막지 않도록 항상 exit 0으로 끝낸다.
set -u
input="$(cat 2>/dev/null || true)"

# 지금 작업 중인 폴더: 훅 입력 JSON의 "cwd"를 먼저 쓴다 (worktree 세션에서는 CLAUDE_PROJECT_DIR가 원래 폴더를 가리킴).
# 없으면 CLAUDE_PROJECT_DIR, 그것도 없으면 현재 폴더.
DIR="$(printf '%s' "$input" | tr '\n' ' ' | sed -nE 's/.*"cwd"[[:space:]]*:[[:space:]]*"(([^"\\]|\\.)*)".*/\1/p' | sed -E 's/\\\\/\\/g; s/\\"/"/g')"
[ -n "$DIR" ] && [ -d "$DIR" ] || DIR="${CLAUDE_PROJECT_DIR:-$PWD}"
cd "$DIR" 2>/dev/null || exit 0

MAX_LINES=60   # 파일마다 보여 줄 최대 줄 수

show_file() {   # $1=파일, $2=제목
  [ -f "$1" ] || return 0
  local total
  total=$(wc -l < "$1" | tr -d ' ')
  echo
  echo "## $2 (\`$1\`)"
  head -n "$MAX_LINES" "$1"
  if [ "$total" -gt "$MAX_LINES" ]; then
    echo "… (${total}줄 중 ${MAX_LINES}줄만 표시. 나머지는 파일을 직접 읽을 것)"
  fi
}

{
  echo "# 프로젝트 현황 (세션 시작 훅이 자동으로 넣은 정보)"
  [ -f .claude/harness-version ] && echo "- 하네스: $(cat .claude/harness-version)"

  if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    branch=$(git branch --show-current 2>/dev/null)
    echo "- git 브랜치: ${branch:-(분리된 HEAD)}"
    changes=$(git status --porcelain 2>/dev/null | head -n 20)
    if [ -n "$changes" ]; then
      echo "- 커밋 안 된 변경:"
      printf '%s\n' "$changes" | sed 's/^/    /'
    else
      echo "- 커밋 안 된 변경: 없음"
    fi
    echo "- 최근 커밋:"
    git log --oneline -5 2>/dev/null | sed 's/^/    /'
  else
    echo "- git 저장소 아님"
  fi

  show_file NEXT_STEPS.md "다음 할 일"
  show_file STATUS.md "작업 현황판"

  if [ ! -f NEXT_STEPS.md ]; then
    echo
    echo "NEXT_STEPS.md가 없다. kickoff 전이면 기획서로 시작(kickoff)부터 한다."
  fi
} | head -c 9000

exit 0
