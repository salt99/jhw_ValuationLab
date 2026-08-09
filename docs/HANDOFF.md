# HANDOFF

> 세션을 끝낼 때 이 파일을 **덮어쓴다.** 다음 세션은 이것부터 읽는다.
> 파일은 항상 하나다 — 지난 내용은 `git log docs/HANDOFF.md` 에 남는다.

**갱신**: 2026-08-09 · **브랜치**: `main` (배포됨)

## 지금 상태

TOOL 04에 후보 파이프라인(기각 원장)을 넣고 배포했다.
라이브: `https://salt99.github.io/jhw_ValuationLab/index_kelly.html`

이어서 SPIKE·DEVLOG·ADR·HANDOFF 규약을 도입했다 (CLAUDE.md §작업 기록).
`SessionStart` 훅이 이 파일을 자동으로 읽어 들이고, `Stop` 훅이 이 파일이 뒤처지면
세션당 한 번 알린다. **훅은 이 세션에서 새로 추가돼서 아직 실제 발화가 확인되지 않았다** —
다음 세션 시작 시 이 문단이 컨텍스트에 들어와 있으면 `SessionStart` 훅이 동작하는 것이다.

## 진행 중 — 다음 세션이 이어받을 것

**브라우저 실기 검증이 절반만 끝났다.** `docs/superpowers/browser-checklist-rejection-ledger.md`

- 끝남: 자동 검사 전체 통과 (`node docs/superpowers/build-selfcheck.js && open _selfcheck.html`)
- 끝남: 기각 모달 레이아웃 버그 발견·수정 (`76c1b01`)
- **안 끝남**: 체크리스트 2단계의 실제 매매 흐름 —
  종목 추가 → 매수 → 전량 매도(원 논지 훼손) → 칸 회수 모달 → 재진입 경고 → 기록 차단
- **안 끝남**: 실데이터에서의 v3→v4 마이그레이션 확인. 지금 기기엔 데이터가 없다.
  실사용 데이터는 폰(홈 화면 웹앱)에 있다.

## 알아야 할 것

- **폰 백업을 아직 안 받았을 수 있다.** v4 마이그레이션은 이미 폰에서 돌아갔다.
  마이그레이션은 추가만 하고 기존 필드를 안 건드리지만, 백업이 유일한 안전망이다.
- 되돌리기: `git revert --no-commit 71f8d61..HEAD && git commit -m "revert: roll back candidate pipeline" && git push`
  → 10분 내 폰 반영. `candidates`·`rejIntroDate`는 구버전 코드가 무시하므로 데이터 손실 없음.
- `_selfcheck.html` 은 생성물이다. `.gitignore` 에 있고 언제든 지워도 된다.

## 손대지 말 것

- `todayStr()` 의 UTC 기준 (`index_kelly.html`). 파일 내 5곳과 같은 관행이고,
  신규 코드만 로컬 시간으로 바꾸면 일수 계산이 음수가 되어 더 나빠진다. 판단 근거는 PRD §8.
- 커밋 `08ecddc` `6216f9b` `668a7cb` 의 제목 50자 초과. 사용자가 유지하기로 결정했다.

## 다음에 할 만한 것 (확정 아님)

- 체크리스트 2단계 마무리
- PRD §9 백로그: README 드리프트 해소, 프리미엄 11요소 서지, 켈리 v1 폐기 키 정리
