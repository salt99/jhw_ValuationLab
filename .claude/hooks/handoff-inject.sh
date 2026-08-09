#!/usr/bin/env bash
# SessionStart 훅 — docs/HANDOFF.md 를 세션 컨텍스트에 주입한다.
# 파일이 없으면 조용히 아무것도 하지 않는다.
set -uo pipefail

root="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
f="$root/docs/HANDOFF.md"
[ -f "$f" ] || exit 0

jq -Rs '{
  hookSpecificOutput: {
    hookEventName: "SessionStart",
    additionalContext: ("직전 세션이 남긴 인수인계다 (docs/HANDOFF.md). 이번 세션의 출발점으로 삼는다.\n\n" + .)
  }
}' < "$f"
