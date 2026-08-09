# 브라우저 검증 — 후보 파이프라인

서브에이전트는 브라우저를 못 열어서, 이 기능의 렌더·클릭 경로는 아무도 실제로 본 적이 없다.
구문 파싱과 순수 함수 테스트만 통과한 상태다.

**2단계로 나뉜다. 1단계는 붙여넣기 한 번, 2단계는 눈으로 보는 것뿐이다.**

---

## 1단계 — 자동 검사 (30초)

### 실행 순서 — 터미널에 한 줄

```sh
node docs/superpowers/build-selfcheck.js && open _selfcheck.html
```

브라우저가 뜨면서 **결과가 화면에 바로 표시된다.** DevTools도, 복사·붙여넣기도 필요 없다.

`_selfcheck.html` 은 `index_kelly.html` 사본에 검사 스크립트를 주입한 임시 파일이다.
원본은 건드리지 않고, `.gitignore` 에 있으며, 확인이 끝나면 `rm _selfcheck.html` 로 지우면 된다.
저장소 루트에 만드는 이유는 `file://` 오리진과 상대 경로를 원본과 똑같이 맞추기 위해서다.


<details><summary>DevTools로 직접 돌리고 싶다면</summary>

`open index_kelly.html` 후 `⌘ + ⌥ + J` 로 콘솔을 열고
`docs/superpowers/selfcheck-rejection-ledger.js` 전체를 붙여넣는다.
Chrome이 처음엔 붙여넣기를 막으므로, 콘솔에 `allow pasting` 을 **타이핑**하고
엔터를 친 뒤 다시 붙여넣는다.
</details>

<details><summary>화면을 볼 수 없을 때 (에이전트 세션)</summary>

`open` 은 창을 띄울 뿐이라 터미널로 결과가 안 돌아온다. headless 로 DOM 을 덤프해서 읽는다:

```sh
python3 -m http.server 8765 --bind 127.0.0.1 &          # file:// 은 오리진 문제로 피한다
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --disable-gpu --no-first-run --user-data-dir=/tmp/cp \
  --dump-dom http://127.0.0.1:8765/_selfcheck.html > /tmp/dom.html
```

**Chrome 151 은 DOM 을 뱉은 뒤에도 종료하지 않는다.** 백그라운드로 돌리고 죽여야 한다.
`--virtual-time-budget` 은 붙이면 더 오래 매달리므로 쓰지 않는다.
결과는 `/tmp/dom.html` 의 `id="selfcheck-panel"` 이후에 있다.

이 오리진은 localStorage 가 비어 있어 `저장 포맷` 1건이 SKIP 된다 — 정상이다.
</details>

### 실데이터로 볼지, 빈 상태로 볼지

`file://` 와 `salt99.github.io` 는 **오리진이 달라 localStorage가 서로 분리돼 있다.**
로컬 파일을 열면 저장소가 비어 있는 게 정상이고, 스크립트는 그 경우 저장 포맷 검사를 건너뛴다.

- **빈 상태로 검사** — 그냥 실행하면 된다. 30여 항목 중 저장 포맷 3개만 건너뛴다.
- **실데이터로 검사** (권장) — 배포본에서 `내보내기`로 JSON을 받아두고, 로컬 파일에서
  `가져오기` 로 그 파일을 넣은 다음 실행한다. v4 마이그레이션까지 함께 확인된다.
  스크립트는 끝나면 원상복구하므로 가져온 데이터도 그대로 남는다.

97개 항목이 표로 출력된다. 데이터 무결성은 전부 여기서 확인된다:

- 저장 포맷 v4, 도입일 불변성, `candidates` 오염 가드
- 기각률 회계 (thesis 분자 제외, 도입 이전 종목 분모 제외, 레거시 id 제외)
- 14일 유예 · 소급 배지 · 3년 검증 D-day 판정
- 섹션 분리와 헤더 숫자의 1:1 대응, 검토중 정렬
- **잠긴 기각을 DevTools로 강제 활성화해 저장해도 데이터가 안 바뀌는지** ← 이 기능의 핵심
- 가격 미입력으로 저장이 거부될 때 유령 후보가 안 생기는지
- thesis 청산 후 기각 모달 문구가 오염되지 않는지
- 청산 종목이 계획(`rows`·`pos`)에서 빠지고 **남은 종목 목표가 줄지 않는지**
- 칸 회수 모달이 `✕`·배경클릭으로 **안 닫히는지** (수동 기각 모달은 닫히는지 — 회귀)
- 매매 이력 모달의 버튼 노출 조건 · 원장 렌더 · **읽기 전용 여부**(PRD §7-D18 가드)
- 계기(`origin`) 등록·편집·trim, 빈 값이면 필드 미생성
- 진행 체크 3개의 렌더·토글·저장, 기각 시 폐기 (PRD §7-D19 가드)
- 편입·직접 추가 양쪽의 논지 승계와 폼 리셋, 칸 회수 모달의 원 논지 표시

스크립트는 시작할 때 `kelly2y`를 통째로 백업하고 **끝나면 무슨 일이 있어도 되돌린다.**
실패해도 실제 데이터는 안전하다.

- [ ] `전부 통과` 가 초록색으로 출력됐다

FAIL이 하나라도 나오면 항목 이름을 알려주면 고치겠다.

---

## 2단계 — 눈으로 볼 것 (5분)

기계가 판단할 수 없는 것만 남겼다. 아래를 콘솔에 붙여 화면용 데이터를 넣는다:

```js
const s=JSON.parse(localStorage.getItem('kelly2y')), D=864e5, n=Date.now();
const iso=m=>new Date(m).toISOString().slice(0,10);
s.candidates=[
 {id:'d1',name:'Costco',status:'reviewing',startDate:iso(n-70*D)},
 {id:'d2',name:'Visa',status:'reviewing',startDate:iso(n-20*D)},
 {id:'d3',name:'Arista',status:'rejected',startDate:iso(n-10*D),rejectedDate:iso(n-D),
  rejectedAt:n-D,rejectPrice:142,rejectReason:'factor',trigger:'반도체 노출 줄면 재검토',
  note:'',linkedHoldingId:null,verify:null},
 {id:'d4',name:'TSMC',status:'rejected',startDate:iso(n-1200*D),rejectedDate:iso(n-1200*D),
  rejectedAt:n-40*D,rejectPrice:210,rejectReason:'valuation',trigger:'PBR 6배 이하 재검토',
  note:'',linkedHoldingId:null,verify:null},
 {id:'d5',name:'Nvidia',status:'rejected',startDate:iso(n-200*D),rejectedDate:iso(n-5*D),
  rejectedAt:n-5*D,rejectPrice:890,rejectReason:'thesis',trigger:'데이터센터 재가속 시 재검토',
  note:'',linkedHoldingId:null,verify:null}];
localStorage.setItem('kelly2y',JSON.stringify(s)); location.reload();
```

### 보기

- [ ] 하단에 `후보 파이프라인` 카드가 있고, 나머지 도구와 **색·폰트가 같다**
      (스타일이 안 먹으면 CSS 클래스 오타 — 파싱 검사로는 안 잡힌다)
- [ ] 섹션이 `▸ 검토중` / `▸ 기각` / `▸ 칸 회수` 세 개로 보인다
- [ ] TSMC에 `🔍 검증 필요`(앰버색) 와 `소급 등록` 배지가 있다
- [ ] TSMC에는 `삭제` 버튼이 없고 잠김 안내문이 있다 (Arista에는 삭제 버튼이 있다)
- [ ] **폰 폭으로 좁혔을 때 가로 스크롤이 안 생긴다** — 모바일 우선 원칙(P3)
- [ ] 콘솔에 빨간 에러가 없다
- [ ] **진행 체크박스 3개가 폰 폭에서 한 줄에 들어간다** — 넘치면 wrap 되고 가로 스크롤은 안 생긴다 (P3)
- [ ] 계기 줄이 회색 이탤릭으로 나머지 카드 텍스트와 구분된다
- [ ] `✎ 메모` 모달이 다른 모달과 색·폰트가 같다

### 눌러보기

- [ ] `+ 후보 등록` → 모달이 뜨고, **배경을 클릭하면 닫힌다**
- [ ] 이름만 넣고 `검토중으로 등록` → 목록에 `0일`로 나타난다 (날짜 입력란은 없는 게 정상)
- [ ] TSMC의 `검증` → 모달에 당시 주가·트리거가 보이고,
      하단에 **"TOOL 03의 r·N 가정을 재검토하세요"** 문구가 있다
- [ ] 현재가 `310`, `기각이 틀렸다` 로 저장 → 카드가 `$210 → $310 (+48%)` 로 바뀐다
- [ ] 검토중 항목의 `편입` → 종목 추가 폼으로 스크롤되고 종목명이 채워진다
- [ ] **거기서 아무것도 안 하고 새로고침 → 후보가 그대로 남아 있다** (사라지면 버그)

### 실제 매매 흐름 (기존 기능 회귀 + 칸 회수)

- [ ] 기존 종목·원장·현금 기록이 **그대로** 보인다
- [ ] 테스트 종목을 하나 추가 → 매수 기록 → **전량 매도, 사유 `원 논지 훼손`**
- [ ] 매도 직후 **칸 회수 모달**이 뜨고 주가·날짜가 채워져 있다
- [ ] **닫기(✕)가 없고, 배경을 클릭해도 안 닫힌다** — 칸 회수는 강제다 `¹`
- [ ] 트리거 없이 `기각 등재` → 거부 메시지가 뜨고 안 닫힌다 `¹`
- [ ] 트리거 입력 후 저장 → `▸ 칸 회수` 에 등재되고 **기각률은 안 변한다**
- [ ] 저장 직후 **그 종목이 `목표 배분`·`분기 매매일지` 양쪽에서 사라진다** `¹`
- [ ] 남아 있는 다른 종목의 목표 금액이 **줄지 않았다** (희석 해소 — 늘거나 그대로) `¹`
- [ ] `▸ 칸 회수` 카드의 `매매 이력` → 매수·매도 기록이 그대로 보인다 (읽기 전용) `¹`
- [ ] `▸ 기각` 카드에는 `매매 이력` 버튼이 **없다** `¹`

`¹` 1단계 자동 검사가 이미 확인하는 항목. 여기서는 **실데이터로** 한 번 더 보는 것이라
빠르게 훑고 지나가도 된다. 자동 검사가 못 보는 것은 CSS·레이아웃·실데이터 마이그레이션이다.
- [ ] 같은 이름으로 다시 `종목 추가` → `새 1칸` 경고가 뜨고, 진행하면 **새 행**이 생긴다

---

## 마무리

- [ ] 콘솔에서 `candidates=[]; save(); render();` 로 테스트 데이터를 지운다
- [ ] 실제 대기열(Costco · Visa/Mastercard · Danaher/Thermo Fisher · Progressive · Arista)을
      `+ 후보 등록`으로 넣는다 — 전부 오늘 날짜로 시작한다 (설계상 소급 입력 없음)
- [ ] 허브(`index.html`)에서 다른 도구 3개도 열어 콘솔 에러가 없는지 본다

여기까지 통과하면 `main` 병합 = GitHub Pages 배포.
