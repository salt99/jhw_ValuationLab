# 브라우저 검증 체크리스트 — 후보 파이프라인

서브에이전트는 브라우저를 못 열어서 Task 2~8의 확인 절차가 전부 미실행 상태입니다.
`index_kelly.html`을 브라우저에서 열고 아래를 순서대로 확인하세요.

**시작 전 백업**: 도구의 `내보내기`로 현재 `kelly2y`를 JSON으로 받아두세요. 아래 절차 중
콘솔로 데이터를 조작하는 단계가 있습니다.

---

## 0. 회귀 — 기존 기능이 멀쩡한가 (Task 2)

- [ ] 파일을 열었을 때 기존 종목·원장·현금 기록이 **그대로** 보인다
- [ ] 콘솔에 빨간 에러가 없다
- [ ] DevTools 콘솔에서:
  ```js
  const s = JSON.parse(localStorage.getItem('kelly2y'));
  console.log('v', s.v, '| intro', s.rejIntroDate, '| cands', s.candidates);
  ```
  → `v` 는 `4`, `cands` 는 `[]`, `intro` 에 숫자가 들어 있다
- [ ] **새로고침 후 같은 명령을 다시 실행 → `intro` 값이 바뀌지 않는다**
  (바뀌면 기각률 분모가 매번 리셋되는 버그)

## 1. 백업 왕복 (Task 2 · 수정 라운드에서 고친 부분)

- [ ] `내보내기` → JSON 파일에 `candidates` 와 `rejIntroDate` 키가 있다
- [ ] 그 파일을 `가져오기` → 종목 목록이 그대로다

## 2. 카드가 보이는가 (Task 3)

콘솔에 붙여넣어 시드 데이터를 넣습니다:

```js
const s = JSON.parse(localStorage.getItem('kelly2y'));
const D = 864e5, now = Date.now();
s.candidates = [
  {id:(now-70*D).toString(36), name:'Costco', status:'reviewing', startDate:'2026-06-01'},
  {id:(now-20*D).toString(36), name:'Visa',   status:'reviewing', startDate:'2026-07-20'},
  {id:(now-1*D).toString(36),  name:'Arista', status:'rejected',  startDate:'2026-08-05',
   rejectedDate:'2026-08-09', rejectedAt:now-1*D, rejectPrice:142, rejectReason:'factor',
   trigger:'반도체 노출 줄면 재검토', note:'', linkedHoldingId:null, verify:null},
  {id:(now-40*D).toString(36), name:'TSMC',   status:'rejected',  startDate:'2023-05-01',
   rejectedDate:'2023-05-02', rejectedAt:now-40*D, rejectPrice:210, rejectReason:'valuation',
   trigger:'PBR 6배 이하 재검토', note:'', linkedHoldingId:null, verify:null},
  {id:(now-5*D).toString(36),  name:'Nvidia', status:'rejected',  startDate:'2026-01-01',
   rejectedDate:'2026-03-11', rejectedAt:now-5*D, rejectPrice:890, rejectReason:'thesis',
   trigger:'데이터센터 성장 재가속 시 재검토', note:'', linkedHoldingId:null, verify:null}
];
localStorage.setItem('kelly2y', JSON.stringify(s)); location.reload();
```

- [ ] 하단에 `후보 파이프라인` 카드가 있다
- [ ] 헤더: `검토중 2 · 기각 2 · 편입 N · 칸 회수 1`
- [ ] **헤더의 `기각 2` ↔ `▸ 기각` 카드 2장, `칸 회수 1` ↔ `▸ 칸 회수` 카드 1장** — 숫자와 카드 수가 일치
- [ ] 검토중은 **Costco(위) → Visa(아래)** 순서 (오래된 것이 위)
- [ ] Arista: `⏳ 검증 D-1094` 부근, `삭제` 버튼 **있음** (등재 1일 전 = 유예 내)
- [ ] TSMC: `🔍 검증 필요` + `검증` 버튼, `소급 등록` 배지, `삭제` 버튼 **없음**, 잠김 안내문 있음
- [ ] Nvidia는 `▸ 칸 회수` 섹션에 있고 사유가 `thesis 파기 청산`
- [ ] 글자가 안 깨지고 색이 나머지 도구와 같다 (스타일이 안 먹으면 CSS 클래스 오타)
- [ ] **모바일 폭(폰)에서 가로 스크롤이 안 생긴다**

## 3. 후보 등록 · 삭제 (Task 4)

- [ ] `+ 후보 등록` → 모달이 뜬다
- [ ] 종목명 비운 채 `검토중으로 등록` → `종목명을 입력하세요` 경고, 아무것도 안 생김
- [ ] `Progressive` 입력 → 등록 → 검토중 목록에 `0일 · <오늘>`, 헤더 검토중 +1
- [ ] **모달에 날짜 입력란이 없다** (의도된 설계)
- [ ] 새로고침 → 그대로 남아 있다
- [ ] `삭제` → 확인창 → 사라짐, 카운트 −1
- [ ] TSMC(잠김)의 카드에는 `삭제` 버튼 자체가 없다
- [ ] 모달 **배경을 클릭하면 닫힌다** (Task 5에서 추가)

## 4. 기각 등재 · 14일 유예 (Task 5)

- [ ] 검토중 항목의 `기각` → 모달, 기각일이 오늘로 채워져 있다
- [ ] 트리거를 비운 채 저장 → 거부 (`재검토 트리거를 적어주세요…`)
- [ ] 주가 `142`, 사유 `팩터 중복`, 트리거 입력 후 저장 → `▸ 기각`으로 이동, 헤더 카운트 이동
- [ ] 사유 드롭다운에 **`thesis 파기 청산` 항목이 없다** (자동 등재 전용)
- [ ] `+ 후보 등록` → 이름 입력 → `바로 기각 등재` → 기각 모달이 바로 뜬다
- [ ] **그 모달을 저장하지 않고 닫는다 → 검토중 목록에 유령 항목이 안 생긴다**
- [ ] 방금 만든 기각의 `✎ 수정` → 기각일·주가·사유가 **입력 가능**
- [ ] 잠김 확인 — 콘솔에서 등재 시각을 15일 전으로 되돌린다:
  ```js
  const s=JSON.parse(localStorage.getItem('kelly2y'));
  s.candidates.find(c=>c.status==='rejected').rejectedAt = Date.now()-15*864e5;
  localStorage.setItem('kelly2y',JSON.stringify(s)); location.reload();
  ```
  - [ ] `삭제` 버튼 사라짐, `✎` 라벨이 `트리거·메모`로 바뀜
  - [ ] 모달 열면 기각일·주가·사유가 **회색(disabled)**, 잠김 안내문 표시
  - [ ] 트리거만 고쳐 저장 → 트리거는 바뀌고 **주가·사유는 그대로**
  - [ ] 저장 후 콘솔로 확인: `JSON.parse(localStorage.getItem('kelly2y')).candidates` 에서
        해당 항목의 `rejectPrice`/`rejectReason`/`rejectedDate` 가 **변하지 않았다**
        (UI만 막고 저장 로직이 덮어쓰면 잠금이 무의미)
  - [ ] `rejectedAt` 도 그대로다 (수정 때 갱신되면 유예가 무한 연장됨)

## 5. 3년 검증

- [ ] TSMC(`🔍 검증 필요`)의 `검증` → 모달에 `2023-05-02 · $210`과 당시 트리거가 보인다
- [ ] 현재가 `310`, 판정 `기각이 틀렸다` → 저장
- [ ] 카드에 `$210 → $310 (+48%) · 기각이 틀렸음`, 배지 `✓ 검증 완료`, 버튼 `검증 보기`
- [ ] 모달 하단에 **TOOL 03의 r·N 가정을 재검토하라**는 문구가 있다

## 6. 편입 연결

- [ ] 검토중 항목의 `편입` → 종목 추가 폼으로 스크롤, 종목명 프리필
- [ ] **여기서 아무것도 안 하고 새로고침 → 후보가 검토중에 그대로 남아 있다**
- [ ] 다시 `편입` → 가격·목표·승률 입력 → `추가` → 보유 목록에 생기고 검토중에서 사라짐
- [ ] 헤더: 검토중 −1, 편입 +1

## 7. thesis 자동 등재 · 재진입 차단

- [ ] 종목 추가 → 매수 기록 → **전량 매도**, 사유 `원 논지 훼손`
- [ ] 매도 저장 직후 **칸 회수 모달**이 뜨고 주가·날짜가 프리필돼 있다
- [ ] 트리거 입력 후 저장 → `▸ 칸 회수` 섹션에 등재, 헤더 `칸 회수` +1
- [ ] **기각률은 변하지 않는다** (thesis는 분자에서 제외)
- [ ] 같은 이름으로 `종목 추가` → `새 1칸` 경고 확인창 → 진행하면 **새 행**이 생긴다
- [ ] 청산된 historical 행을 펼쳐 새 매수 기록 시도 → **차단 메시지**, 모달이 안 열린다
- [ ] 그 행의 기존 기록 `✎ 수정`은 **여전히 열린다**

---

## 마무리

- [ ] 마지막으로 `s.candidates = []` 로 되돌리거나, 실제로 쓸 대기열
      (Costco · Visa/Mastercard · Danaher/Thermo Fisher · Progressive · Arista)을
      `+ 후보 등록`으로 직접 넣는다 — 전부 오늘 날짜로 시작 (설계상 소급 입력 없음)
- [ ] 허브(`index.html`)에서 다른 도구 3개도 열어 콘솔 에러가 없는지 확인

## 8. 최종 리뷰에서 고친 두 가지 (반드시 확인)

교차 태스크 결함이라 태스크별 리뷰가 잡을 수 없었던 것들입니다.

- [ ] **`rj-intro` 오염** — 위 §7에서 thesis 청산으로 칸 회수를 등재한 **직후**,
      새로고침하지 말고 `[+ 후보 등록] → [바로 기각 등재]`를 누른다.
      모달 상단 문구가 `기각 판단을 기록합니다. 3년 뒤 이 판단이 옳았는지 검증합니다.` 여야 한다.
      `thesis 파기로 청산했습니다…`가 남아 있으면 수정이 안 먹은 것.
- [ ] **백업 복원 경고** — 구버전 백업(`candidates` 키가 없는 JSON)을 `가져오기` 하면
      확인창에 `후보 N건 → 0건`과 ⚠ 경고줄이 보여야 한다. 취소를 눌러 실제로 덮어쓰지는 말 것.
