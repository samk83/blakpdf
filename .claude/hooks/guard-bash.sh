#!/usr/bin/env bash
# PreToolUse 훅 (Bash): 되돌릴 수 없는 위험한 명령을 실행 전에 막는다.
# .claude/settings.json의 deny 목록을 보조한다. deny 목록은 명령의 앞부분만 보지만,
# 이 훅은 `cd x && rm -rf y`, `rm -r -f`, `git -C repo push --force`처럼 모양이 다른 명령도 잡는다.
# 막으면 exit 2 + 이유(stderr)를 Claude에게 돌려준다. 판단할 수 없으면 막지 않는다 (exit 0, 기존 승인 절차 그대로).
# 막는 것: 강제 올리기(push --force), rm 재귀+강제 삭제, sudo, 비밀 파일(.env, SSH 키, *.pem) 접근.
# 완벽한 보안이 아니라 흔한 실수를 막는 안전망이다.
set -u
set -f   # 명령 안의 * 같은 글자를 파일 이름으로 펼치지 않게

input="$(cat)"

# 입력 JSON에서 tool_input.command만 꺼낸다. python3 → python 순으로 시도하고, 둘 다 없으면 sed로 "command" 값을 대충 꺼낸다.
extract='import json,sys
try:
    print(json.load(sys.stdin).get("tool_input",{}).get("command",""))
except Exception:
    sys.exit(1)'
cmd=""
for py in python3 python; do
  if command -v "$py" >/dev/null 2>&1; then
    if cmd="$(printf '%s' "$input" | "$py" -c "$extract" 2>/dev/null)"; then
      break
    fi
    cmd=""
  fi
done
if [ -z "$cmd" ]; then
  cmd="$(printf '%s' "$input" | tr '\n' ' ' \
    | sed -nE 's/.*"command"[[:space:]]*:[[:space:]]*"(([^"\\]|\\.)*)".*/\1/p' \
    | sed -E 's/\\"/"/g; s/\\n/ /g; s/\\\\/\\/g')"
  [ -n "$cmd" ] || cmd="$input"
fi

# 커밋 메시지·PR 본문 같은 글(-m "…", --body "…")은 명령이 아니므로 검사에서 뺀다.
# 단, 큰따옴표 안의 $(…)나 `…`는 실제로 실행되므로 그런 글은 빼지 않고 검사한다.
cmd="$(printf '%s' "$cmd" | sed -E "s/(-m|--message|--body|--title|-t|-b)([[:space:]]+|=)\"([^\"\\\\\$\`]|\\\\.)*\"/\1 \"\"/g; s/(-m|--message|--body|--title|-t|-b)([[:space:]]+|=)'[^']*'/\1 ''/g")"

block() {
  {
    echo "하네스 안전장치(guard-bash 훅)가 이 명령을 막았습니다: $1"
    echo "이 작업은 Owner 승인이 필요한 L3 작업입니다. 실행하지 말고, 무엇을 왜 하려는지 Owner에게 먼저 묻습니다."
    echo "Owner가 직접 실행하겠다고 하면 복사해 쓸 수 있게 명령을 알려 줍니다."
  } >&2
  exit 2
}

# 명령을 ; && || | ( ) ` 줄바꿈 기준으로 나눠 조각마다 검사한다 ($(…) 안의 명령도 따로 검사됨).
segments="$(printf '%s\n' "$cmd" | tr ';|&()`' '\n\n\n\n\n\n')"

while IFS= read -r seg; do
  # 앞뒤 공백, 따옴표 제거
  s="$(printf '%s' "$seg" | sed -E "s/^[[:space:]]+//; s/[\"']//g")"
  [ -n "$s" ] || continue

  # 1) sudo
  if printf '%s' "$s" | grep -Eq '^(env[[:space:]]+)?sudo([[:space:]]|$)'; then
    block "sudo (관리자 권한 실행)"
  fi

  # 2) git push 강제 (--force, --force-with-lease, -f, -uf 같은 묶음 옵션, +브랜치, --mirror)
  if printf '%s' "$s" | grep -Eq '(^|[[:space:]])git([[:space:]]+-[Cc][[:space:]]+[^[:space:]]+)*[[:space:]]+push([[:space:]]|$)'; then
    if printf '%s' "$s" | grep -Eq '[[:space:]](--force([=-][^[:space:]]*)?|--mirror|-[A-Za-z]*f[A-Za-z]*)([[:space:]]|$)|[[:space:]]\+[^[:space:]]+'; then
      block "git push 강제 올리기 (원격 기록을 덮어씀)"
    fi
  fi

  # 3) rm 재귀 + 강제 (-rf, -fr, -r -f, --recursive --force 등)
  if printf '%s' "$s" | grep -Eq '(^|[[:space:]])rm[[:space:]]'; then
    rec=0; frc=0
    printf '%s' "$s" | grep -Eq '[[:space:]](-[A-Za-z]*[rR][A-Za-z]*|--recursive)([[:space:]]|$)' && rec=1
    printf '%s' "$s" | grep -Eq '[[:space:]](-[A-Za-z]*f[A-Za-z]*|--force)([[:space:]]|$)' && frc=1
    if [ "$rec" = 1 ] && [ "$frc" = 1 ]; then
      block "rm 재귀+강제 삭제 (폴더째 확인 없이 지움)"
    fi
  fi

  # 4) 비밀 파일: .env, .env.local 등. 아래는 괜찮음:
  #    .env.example 같은 예시 파일, 예시 파일을 복사해 .env 만들기(cp .env.example .env),
  #    .gitignore에 적기(echo .env >> .gitignore), git 추적에서 빼기(git rm --cached .env), 커밋
  #    (조각 안에 $(…)나 `…`가 있으면 예외 없이 검사)
  if printf '%s' "$s" | grep -q '[$`]' || ! printf '%s' "$s" | grep -Eq '>>?[[:space:]]*[^[:space:]]*\.gitignore([[:space:]]|$)|^git[[:space:]]+(commit|rm[[:space:]]+(-[^[:space:]]+[[:space:]]+)*--cached)([[:space:]]|$)|^(cp|mv)[[:space:]]+(-[^[:space:]]+[[:space:]]+)*[^[:space:]]*\.env\.(example|sample|template|dist)[[:space:]]+[^[:space:]]*\.env(\.[A-Za-z0-9_-]+)?[[:space:]]*$'; then
    for word in $s; do
      f="${word##*[/=<>]}"   # 경로·리다이렉트(>) 앞부분을 떼고 파일 이름만
      case "$f" in
        .env.example|.env.sample|.env.template|.env.dist) ;;
        .env|.env.*) block ".env 비밀 설정 파일 접근 ($f). .env.example 같은 예시 파일은 괜찮음" ;;
      esac
    done
  fi
  if printf '%s' "$s" | grep -Eq '(\.ssh/|id_rsa|id_ed25519|id_ecdsa|\.pem([[:space:]]|$))'; then
    block "SSH 키·인증서 키 파일 접근"
  fi
done <<< "$segments"

exit 0
