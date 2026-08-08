# 브라우저 검증 — 후보 파이프라인

서브에이전트는 브라우저를 못 열어서, 이 기능의 렌더·클릭 경로는 아무도 실제로 본 적이 없다.
구문 파싱과 순수 함수 테스트만 통과한 상태다.

**2단계로 나뉜다. 1단계는 붙여넣기 한 번, 2단계는 눈으로 보는 것뿐이다.**

---

## 1단계 — 자동 검사 (30초)

`index_kelly.html`을 브라우저에서 열고, DevTools 콘솔에
`docs/superpowers/selfcheck-rejection-ledger.js` 파일 **전체**를 붙여넣고 엔터.

30여 개 항목이 표로 출력된다. 데이터 무결성은 전부 여기서 확인된다:

- 저장 포맷 v4, 도입일 불변성, `candidates` 오염 가드
- 기각률 회계 (thesis 분자 제외, 도입 이전 종목 분모 제외, 레거시 id 제외)
- 14일 유예 · 소급 배지 · 3년 검증 D-day 판정
- 섹션 분리와 헤더 숫자의 1:1 대응, 검토중 정렬
- **잠긴 기각을 DevTools로 강제 활성화해 저장해도 데이터가 안 바뀌는지** ← 이 기능의 핵심
- 가격 미입력으로 저장이 거부될 때 유령 후보가 안 생기는지
- thesis 청산 후 기각 모달 문구가 오염되지 않는지

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
- [ ] 트리거 입력 후 저장 → `▸ 칸 회수` 에 등재되고 **기각률은 안 변한다**
- [ ] 같은 이름으로 다시 `종목 추가` → `새 1칸` 경고가 뜨고, 진행하면 **새 행**이 생긴다
- [ ] 청산된 종목의 historical 행에서 새 매수 기록 시도 → 차단 메시지
- [ ] 그 행의 기존 기록 `✎ 수정`은 여전히 열린다

---

## 마무리

- [ ] 콘솔에서 `candidates=[]; save(); render();` 로 테스트 데이터를 지운다
- [ ] 실제 대기열(Costco · Visa/Mastercard · Danaher/Thermo Fisher · Progressive · Arista)을
      `+ 후보 등록`으로 넣는다 — 전부 오늘 날짜로 시작한다 (설계상 소급 입력 없음)
- [ ] 허브(`index.html`)에서 다른 도구 3개도 열어 콘솔 에러가 없는지 본다

여기까지 통과하면 `main` 병합 = GitHub Pages 배포.
