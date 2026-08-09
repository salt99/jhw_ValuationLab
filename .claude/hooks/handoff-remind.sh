#!/usr/bin/env bash
# Stop 훅 — docs/HANDOFF.md 가 커밋에 뒤처지면 세션당 한 번만 알린다.
#
# Stop 은 매 턴 끝마다 발화한다. 그래서 두 겹으로 조용히 만든다:
#   ① HANDOFF 가 실제로 뒤처졌을 때만  ② 세션당 한 번만
# 차단하지 않는다 — 사람에게 보이는 알림만 낸다.
set -uo pipefail

THRESHOLD=3   # HANDOFF 커밋 이후 이만큼 쌓이면 알린다

input=$(cat)
sid=$(printf '%s' "$input" | jq -r '.session_id // "nosession"' 2>/dev/null || echo nosession)
marker="${TMPDIR:-/tmp}/claude-handoff-nag-${sid}"
[ -e "$marker" ] && exit 0

root="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
cd "$root" 2>/dev/null || exit 0
git rev-parse --git-dir >/dev/null 2>&1 || exit 0
[ -f docs/HANDOFF.md ] || exit 0

last=$(git log -1 --format=%H -- docs/HANDOFF.md 2>/dev/null)
[ -n "$last" ] || exit 0

n=$(git rev-list --count "$last"..HEAD 2>/dev/null || echo 0)
[ "$n" -ge "$THRESHOLD" ] || exit 0

: > "$marker"
jq -nc --arg n "$n" '{
  systemMessage: ("docs/HANDOFF.md 가 커밋 " + $n + "개 뒤처졌습니다 — 세션을 끝내기 전에 갱신하세요.")
}'
