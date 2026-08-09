# 청산 종목 계획 제외 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 논지 훼손으로 전량 청산한 종목을 목표 배분·분기 매매일지 양쪽에서 제외하고, 회고용 매매 이력은 후보 파이프라인의 `▸ 칸 회수` 카드에서 열람하게 한다.

**Architecture:** 판정 로직을 기존 `PIPELINE PURE` 마커 블록(645-692행)에 순수 함수로 추가하고 `test_pipeline.js`로 DOM 없이 검증한다(P5). `compute()`는 그 순수 함수를 한 번 호출해 `rows` 단계에서 걸러내므로, 목표 배분·매매일지·배분 정규화가 한 지점 수정으로 함께 해결된다. 렌더·모달 변경은 기존 마크업 패턴을 그대로 따른다.

**Tech Stack:** vanilla JS, `localStorage`, 빌드 없음, 의존성 없음. 검증은 `node test_pipeline.js` (Node 표준 라이브러리만) + 브라우저 자체 검사 `node docs/superpowers/build-selfcheck.js && open _selfcheck.html`.

**설계 정본:** `docs/superpowers/specs/2026-08-09-liquidated-holding-design.md`

## Global Constraints

- 파일 추가 금지 — 도구 코드는 전부 `index_kelly.html` 안에 인라인 (PRD §7-D2 플랫 파일 규칙). 검증 스크립트는 기존 `test_pipeline.js`를 확장하고 새로 만들지 않는다.
- 외부 CDN·프레임워크·패키지 매니저 금지 (P2 로컬 우선, 오프라인 원칙).
- 신규 CSS는 기존 토큰만 사용: `--bg --panel --panel-2 --ink --dim --faint --line --accent --accent-dim --good --warn --bad --cash --cash-dim --mono`. 새 토큰 정의 금지.
- `localStorage` 키는 `kelly2y` 하나. 새 키 금지. **저장 포맷을 바꾸지 않는다** — 이번 변경은 렌더·판정만 건드린다.
- 기존 사용자 데이터 무손실. 마이그레이션 없음. 기존 미등재 청산 종목도 자동 변환하지 않는다(Task 4).
- 기각 사유 코드 6종: `factor` `circle` `premium` `valuation` `thesis` `abandoned`. `thesis`는 자동 등재 전용.
- 논지 훼손형 매도 사유 3종: `thesis` `criteria` `better` (기존 `isThesisBroken()` 정의).
- 커밋 메시지: Conventional Commits (`<타입>(<범위>): <제목>`), 제목 명령형 50자 이내, 본문은 *왜*. AI 저작 표기 금지.
- 각 태스크는 독립적으로 커밋한다.

---

### Task 1: 순수 판정 함수 + Node 검증

청산 판정·클램프·미등재 감지를 DOM에서 분리해 `PIPELINE PURE` 블록에 넣고, `test_pipeline.js`로 검증한다. 이후 모든 태스크가 이 함수들을 쓴다.

**Files:**
- Modify: `index_kelly.html` — `PIPELINE PURE` 블록 안 (645-692행), `migrateCandidates` 아래
- Modify: `index_kelly.html:1074-1075` — `isThesisBroken`을 블록으로 이동
- Modify: `index_kelly.html:1666-1669` — `thesisRejectOf`가 새 술어를 쓰도록
- Modify: `test_pipeline.js`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `isThesisBroken(r: string) -> boolean` — 이동만, 동작 불변
  - `isThesisReject(c: object, holdingId: string) -> boolean`
  - `livePlanHoldings(holdings: array, candidates: array) -> array`
  - `pctClamp(x: number) -> number`
  - `needsPunchBack(h: object, candidates: array) -> boolean`

- [ ] **Step 1: 검증부터 작성한다**

`test_pipeline.js` 끝의 결과 출력 직전에 아래 블록을 추가한다. 먼저 파일 상단의 추출부에서 `return {...}` 목록에 새 함수 5개를 더한다:

```js
const api = new Function(m[0] + `
  return {GRACE_MS, VERIFY_DAYS, isEditable, isSeeded, verifyDaysLeft, rejectionStats, migrateCandidates,
          isThesisBroken, isThesisReject, livePlanHoldings, pctClamp, needsPunchBack};
`)();
```

그리고 파일 끝의 결과 출력 직전에 검사 케이스를 추가한다. 단언 헬퍼는 이 파일에 이미 있는 `eq(label, got, want)`(12행)와 그룹 헤더 `grp(title)`(17행)를 쓴다. `eq`는 `JSON.stringify` 비교라 배열·객체가 그대로 비교된다:

```js
/* ---- 청산 종목 계획 제외 ---- */
grp('livePlanHoldings');
{
  const H_LIVE = {id:'h1', ledger:[{type:'buy',shares:3}]};
  const H_DEAD = {id:'h2', ledger:[{type:'buy',shares:3},{type:'sell',shares:3,sellReason:'thesis'}]};
  const C_PUNCH = {status:'rejected', rejectReason:'thesis', linkedHoldingId:'h2'};
  const C_PLAIN = {status:'rejected', rejectReason:'valuation', linkedHoldingId:null};

  eq('칸 회수 등재된 종목은 계획에서 빠진다',
     api.livePlanHoldings([H_LIVE,H_DEAD],[C_PUNCH]).map(h=>h.id), ['h1']);
  eq('일반 기각은 종목을 빼지 않는다',
     api.livePlanHoldings([H_LIVE,H_DEAD],[C_PLAIN]).map(h=>h.id), ['h1','h2']);
  eq('칸 회수를 삭제하면 종목이 계획으로 복귀한다',
     api.livePlanHoldings([H_LIVE,H_DEAD],[]).map(h=>h.id), ['h1','h2']);
  eq('다른 종목의 칸 회수는 영향이 없다',
     api.livePlanHoldings([H_LIVE,H_DEAD],
       [{status:'rejected',rejectReason:'thesis',linkedHoldingId:'zzz'}]).map(h=>h.id), ['h1','h2']);
  eq('후보가 비어도 안전하다', api.livePlanHoldings([H_LIVE],null).map(h=>h.id), ['h1']);
  eq('종목이 비어도 안전하다', api.livePlanHoldings(null,[C_PUNCH]), []);
  eq('모든 종목이 청산되면 빈 배열',
     api.livePlanHoldings([H_DEAD],[C_PUNCH]), []);

  grp('pctClamp');
  eq('음수 퍼센트는 0으로 클램프', api.pctClamp(-0.25), 0);
  eq('100 초과는 100으로 클램프', api.pctClamp(140), 100);
  eq('정상값은 그대로', api.pctClamp(37.5), 37.5);
  eq('NaN은 0으로', api.pctClamp(NaN), 0);

  grp('needsPunchBack');
  eq('논지 훼손 전량매도 + 미등재 = 배너 대상', api.needsPunchBack(H_DEAD, []), true);
  eq('이미 등재됐으면 배너 대상 아님', api.needsPunchBack(H_DEAD, [C_PUNCH]), false);
  eq('보유가 남아 있으면 배너 대상 아님',
     api.needsPunchBack({id:'h3', ledger:[{type:'buy',shares:5},{type:'sell',shares:2,sellReason:'thesis'}]}, []), false);
  eq('목표가 도달 매도는 배너 대상 아님',
     api.needsPunchBack({id:'h4', ledger:[{type:'buy',shares:3},{type:'sell',shares:3,sellReason:'target'}]}, []), false);
  eq('criteria 사유도 논지 훼손형이다',
     api.needsPunchBack({id:'h5', ledger:[{type:'buy',shares:3},{type:'sell',shares:3,sellReason:'criteria'}]}, []), true);
  eq('매도 이력이 없으면 배너 대상 아님', api.needsPunchBack(H_LIVE, []), false);
}
```

- [ ] **Step 2: 실패를 확인한다**

```sh
node test_pipeline.js
```

기대: `isThesisReject is not defined` 류의 에러 또는 새 케이스 전부 FAIL.

- [ ] **Step 3: 순수 함수를 추가한다**

`index_kelly.html`에서 `migrateCandidates` 함수가 끝나는 691행과 블록 종료 주석 692행 사이에 삽입한다:

```js
/* 논지 훼손형 매도 사유 판정 — updateSellGuide()의 UI 안내와 lm-save의 칸 회수 자동등재가 공유한다 */
function isThesisBroken(r){ return r==='thesis'||r==='criteria'||r==='better'; }
/* 이 후보가 해당 종목의 칸 회수 등재인가. thesisRejectOf와 livePlanHoldings가 공유한다. */
function isThesisReject(c, holdingId){
  return !!c && c.status==='rejected' && c.rejectReason==='thesis' && c.linkedHoldingId===holdingId;
}
/* 계획(목표 배분·매매일지) 대상 종목. 칸 회수된 종목은 보유가 없으므로 계획에서 뺀다.
   holdings 배열 자체는 건드리지 않는다 — 회고용 원장이 남아야 한다. */
function livePlanHoldings(holdings, candidates){
  const cs = candidates||[];
  return (holdings||[]).filter(h=>!cs.some(c=>isThesisReject(c,h.id)));
}
/* 진행 바 폭. 음수를 그대로 넘기면 width:-0.25% 가 무효 CSS라 선언이 버려지고,
   .exec-track-fill 에 기본 width가 없어 100%로 렌더된다. 아래쪽도 반드시 자른다. */
function pctClamp(x){ return Number.isFinite(x) ? Math.max(0, Math.min(100, x)) : 0; }
/* 논지 훼손 전량매도인데 칸 회수 미등재 — 자동 등재하지 않고 배너로 유도한다.
   조용히 데이터를 바꾸는 것보다 사용자가 누르게 하는 편이 안전하다. */
function needsPunchBack(h, candidates){
  const L = (h&&h.ledger)||[];
  const sells = L.filter(e=>e.type==='sell');
  if(!sells.length) return false;
  const bought = L.filter(e=>e.type==='buy').reduce((s,e)=>s+(e.shares||0),0);
  const sold = sells.reduce((s,e)=>s+(e.shares||0),0);
  if(bought-sold > 0) return false;
  if(!isThesisBroken(sells[sells.length-1].sellReason)) return false;
  return !(candidates||[]).some(c=>isThesisReject(c,h.id));
}
```

- [ ] **Step 4: 옮겨온 원본을 지운다**

`index_kelly.html`의 1074-1075행(이동 전 기준)에 있던 원본 두 줄을 삭제한다:

```js
// 논지 훼손형 사유 판정 — updateSellGuide()의 UI 안내와 lm-save의 칸 회수 자동등재가 공유한다
function isThesisBroken(r){ return r==='thesis'||r==='criteria'||r==='better'; }
```

함수 선언은 호이스팅되므로 호출부(`updateSellGuide`, `lm-save`)는 그대로 동작한다. 삭제 후 `grep -c "function isThesisBroken" index_kelly.html` 이 `1`인지 확인한다.

- [ ] **Step 5: `thesisRejectOf`가 새 술어를 쓰게 한다**

1666-1669행(이동 후 행번호는 달라질 수 있다):

```js
function thesisRejectOf(holdingId){
  return candidates.find(c=>isThesisReject(c,holdingId));
}
```

`thesisRejectByName`은 이름 기준이라 건드리지 않는다.

- [ ] **Step 6: 검증이 통과하는지 확인한다**

```sh
node test_pipeline.js
```

기대: 새 케이스 13개 포함 전부 PASS. **기존 케이스도 전부 PASS여야 한다** — 하나라도 깨지면 `isThesisBroken` 이동이 잘못된 것이므로 되돌리고 다시 본다.

- [ ] **Step 7: 커밋**

```sh
git add index_kelly.html test_pipeline.js
git commit -m "refactor(kelly): extract liquidation predicates as pure fns"
```

본문에 *왜*를 적는다: 청산 판정을 DOM에서 분리해 P5 검증 경로에 올리기 위함이며, 동작 변경은 없다.

---

### Task 2: 청산 종목을 계획에서 제외 + 진행 바 클램프

이 태스크가 보고된 증상을 실제로 고친다.

**Files:**
- Modify: `index_kelly.html` — `compute()` 시작부 (Task 1 이전 기준 840-841행)
- Modify: `index_kelly.html` — `investedPct` 정의 (Task 1 이전 기준 1214행)
- Modify: `docs/superpowers/selfcheck-rejection-ledger.js`

**Interfaces:**
- Consumes: `livePlanHoldings(holdings, candidates)`, `pctClamp(x)` (Task 1)
- Produces: 없음 — 기존 `compute()` 반환 형태 `{rows,pos,posSum,equityScale,cashWeight,anyCapped}` 불변

- [ ] **Step 1: 브라우저 자체 검사에 실패 케이스를 먼저 넣는다**

`docs/superpowers/selfcheck-rejection-ledger.js`의 검사 목록에 추가한다. 이 스크립트는 시작 시 `kelly2y`를 백업하고 끝나면 복원하므로 실제 데이터는 안전하다:

```js
/* 청산 종목이 계획에서 빠지는가 */
check('칸 회수된 종목은 pos에서 빠진다', ()=>{
  const hid='__t_dead';
  holdings.push({id:hid,name:'__TEST_DEAD',price:100,up:200,down:50,prob:0.6,
                 startQ:currentQGuess(),ccy:'USD',fx:1,
                 ledger:[{type:'buy',shares:3,price:100,amount:300,quarter:currentQGuess()},
                         {type:'sell',shares:3,price:110,amount:330,sellReason:'thesis',quarter:currentQGuess()}]});
  candidates.push({id:'__t_c',name:'__TEST_DEAD',status:'rejected',rejectReason:'thesis',
                   linkedHoldingId:hid,rejectedAt:Date.now(),rejectedDate:todayStr(),
                   startDate:todayStr(),trigger:'t',note:'',verify:null});
  const A=compute();
  return A.pos.every(r=>r.h.id!==hid) && A.rows.every(r=>r.h.id!==hid);
});

/* 남은 종목 목표가 재정규화되는가 — 등재 전후를 직접 비교한다.
   posSum≥1이면 커지고 posSum<1이면 그대로이므로, 단언은 "줄지 않는다"여야 한다. */
check('칸 회수 등재 후 남은 종목 목표가 줄지 않는다', ()=>{
  const hid='__t_dead2';
  holdings.push({id:hid,name:'__TEST_DEAD2',price:100,up:200,down:50,prob:0.6,
                 startQ:currentQGuess(),ccy:'USD',fx:1,
                 ledger:[{type:'buy',shares:3,price:100,amount:300,quarter:currentQGuess()},
                         {type:'sell',shares:3,price:110,amount:330,sellReason:'thesis',quarter:currentQGuess()}]});
  const before=compute();
  const t0={}; before.pos.forEach(r=>{ t0[r.h.id]=r.rel*before.equityScale; });
  candidates.push({id:'__t_c2',name:'__TEST_DEAD2',status:'rejected',rejectReason:'thesis',
                   linkedHoldingId:hid,rejectedAt:Date.now(),rejectedDate:todayStr(),
                   startDate:todayStr(),trigger:'t',note:'',verify:null});
  const after=compute();
  return after.pos.every(r=>r.h.id!==hid)
      && after.pos.every(r=>r.rel*after.equityScale >= (t0[r.h.id]||0) - 1e-9);
});

/* 진행 바 폭 */
check('순매수 음수에서 진행 바가 0%다', ()=>pctClamp(-0.25)===0);
```

검사 후 `holdings`/`candidates`에 넣은 `__t_` 항목을 제거하는 정리 코드를 같은 블록 끝에 둔다 — 이 스크립트의 기존 정리 관례를 따른다.

- [ ] **Step 2: 실패를 확인한다**

```sh
node docs/superpowers/build-selfcheck.js && open _selfcheck.html
```

기대: 새 케이스 3개 중 최소 2개 FAIL (`pos에서 빠진다`, `진행 바 0%`).

- [ ] **Step 3: `compute()`에서 걸러낸다**

```js
function compute(){
  const rows=livePlanHoldings(holdings,candidates).map(h=>({h,k:kellyOf(h)}));
  const pos=rows.filter(r=>r.k.f&&r.k.f>0);
```

`rows`가 줄면 `pos`·`posSum`·일지의 `historical` 버킷이 전부 따라 줄어든다. **다른 곳은 손대지 않는다.**

- [ ] **Step 4: 진행 바를 클램프한다**

`investedPct` 정의 한 줄:

```js
const investedPct = targetAmt>0 ? pctClamp(st.netInvested/targetAmt*100) : 0;
```

- [ ] **Step 5: 검증이 통과하는지 확인한다**

```sh
node test_pipeline.js && node docs/superpowers/build-selfcheck.js && open _selfcheck.html
```

기대: Node 전부 PASS, 브라우저 `전부 통과` 초록색.

- [ ] **Step 6: 손계산 대조 (P5 필수)**

브라우저 콘솔에서 실제 숫자를 확인한다. **`posSum` 값에 따라 결과가 갈리므로 어느 경우인지 먼저 판정한다** (`목표 = rel × equityScale × 총원금`, `equityScale = min(posSum,1) × HALF`):

```js
const A=compute();
console.log('posSum', A.posSum, 'equityScale', A.equityScale);
A.pos.forEach(r=>console.log(r.h.name, 'rel', r.rel, '목표', r.rel*A.equityScale*totalCapital));
```

- `posSum ≥ 1` → 청산 종목 제외로 남은 종목 목표가 **커진다**
- `posSum < 1` → `rel` 증가와 `equityScale` 감소가 정확히 상쇄되어 **변하지 않는다**

두 값을 손으로 계산해 콘솔 출력과 일치하는지 확인한다. "항상 커진다"고 단정하면 두 번째 경우에서 멀쩡한 코드를 버그로 잡는다.

- [ ] **Step 7: 커밋**

```sh
git add index_kelly.html docs/superpowers/selfcheck-rejection-ledger.js
git commit -m "fix(kelly): drop liquidated holdings from the plan"
```

본문: 보유 0주인 칸이 목표 금액을 받고 살아있는 종목의 배분까지 희석하던 문제. 진행 바 음수 클램프도 함께.

---

### Task 3: 칸 회수 카드에 매매 이력 모달

청산 종목이 두 탭에서 사라지므로, 회고 경로를 여기서 만든다. 이 태스크 없이 Task 2만 배포하면 이력에 도달할 수 없다.

**Files:**
- Modify: `index_kelly.html` — `rjModal`(568행) 다음에 새 모달 마크업
- Modify: `index_kelly.html` — `rejectCard` 마크업에 버튼 추가
- Modify: `index_kelly.html` — 렌더 함수와 클릭 핸들러

**Interfaces:**
- Consumes: `ledgerStats(h)` (기존, 802행), `holdings` (전역)
- Produces: `openHistModal(holdingId: string) -> void`

- [ ] **Step 1: 모달 마크업을 추가한다**

`rjModal` 닫는 `</div>` 다음에 삽입. 기존 모달의 구조·클래스를 그대로 따른다:

`rjModal`(568-573행)의 헤더 구조를 그대로 따른다 — 제목은 `<span id>`, 닫기는 `<span class="modal-x" id>✕</span>`다:

```html
<!-- 매매 이력 모달 (읽기 전용) -->
<div class="modal-bg" id="histModal" style="display:none">
  <div class="modal">
    <div class="modal-head">
      <span id="hist-title">매매 이력</span>
      <span class="modal-x" id="hist-close">✕</span>
    </div>
    <div class="hist-sum" id="hist-sum"></div>
    <div id="hist-body"></div>
    <div class="keep-note" style="margin-top:10px;">
      읽기 전용입니다. 기록을 고치려면 백업을 내보내 JSON을 편집한 뒤 가져오세요.
    </div>
  </div>
</div>
```

- [ ] **Step 2: CSS는 두 줄만 추가한다**

원장 행은 **일지가 이미 쓰는 클래스를 그대로 재사용한다** — `lg-entry` `lg-top` `lg-badge buy|sell|hold` `lg-meta mono` `lg-reason` `lg-sellreason` (1356-1362행). 새로 필요한 건 요약줄과 분기 헤더뿐이다. 기존 토큰만 쓴다:

```css
.hist-sum{font-size:12px;color:var(--dim);font-family:var(--mono);margin:2px 0 10px;}
.hist-q{font-size:11px;color:var(--faint);margin:10px 0 4px;font-family:var(--mono);}
```

- [ ] **Step 3: 렌더 함수를 추가한다**

`thesisRejectOf` 근처, 후보 파이프라인 함수들 사이에 둔다:

매도 사유 라벨은 이미 있는 `SELL_REASONS` 맵(1067행)을 쓴다. 행 마크업은 일지의 `lg-entry` 구조를 그대로 따르되 **`✎ 수정`·`✕ 삭제` 버튼은 넣지 않는다** — 읽기 전용이다:

```js
function openHistModal(holdingId){
  const h=holdings.find(x=>x.id===holdingId);
  if(!h){ setStatus('원본 종목 기록을 찾지 못했습니다',true); return; }
  const st=ledgerStats(h);
  $('hist-title').textContent=`${h.name} · 매매 이력`;
  $('hist-sum').textContent=
    `매수 ${st.buyCount}회 ${fmtMoney(st.buyAmt)} · 매도 ${st.sellCount}회 ${fmtMoney(st.sellAmt)}`;
  const L=h.ledger||[];
  if(!L.length){ $('hist-body').innerHTML='<div class="empty">기록이 없습니다.</div>'; }
  else {
    const byQ={};
    L.forEach(e=>{ const k=e.quarter||'—'; (byQ[k]=byQ[k]||[]).push(e); });
    $('hist-body').innerHTML=Object.keys(byQ).map(q=>{
      const rows=byQ[q].map(e=>{
        const badge = e.type==='buy'?'<span class="lg-badge buy">매수</span>'
                    : e.type==='sell'?'<span class="lg-badge sell">매도</span>'
                    : e.type==='reassess'?'<span class="lg-badge hold">재평가</span>'
                    : '<span class="lg-badge hold">보류</span>';
        const pxStr=(e.price)?` @$${fmtNum(e.price)}`:'';
        const shStr=(e.shares)?` · ${e.shares.toLocaleString('ko-KR')}주`:'';
        const amtStr=(e.amount)?` · ${fmtMoney(e.amount)}`:'';
        const sr=e.sellReason?`<div class="lg-sellreason">매도사유: ${SELL_REASONS[e.sellReason]||e.sellReason}</div>`:'';
        return `<div class="lg-entry">
          <div class="lg-top">${badge}<span class="lg-meta mono">${e.date||''}${pxStr}${shStr}${amtStr}</span></div>
          ${e.reason?`<div class="lg-reason">${escapeHtml(e.reason)}</div>`:''}
          ${sr}
        </div>`;
      }).join('');
      return `<div class="hist-q">${escapeHtml(q)}</div>${rows}`;
    }).join('');
  }
  $('histModal').style.display='flex';
}
$('hist-close').addEventListener('click',()=>{ $('histModal').style.display='none'; });
$('histModal').addEventListener('click',e=>{ if(e.target===$('histModal'))$('histModal').style.display='none'; });
```

- [ ] **Step 4: 칸 회수 카드에 버튼을 단다**

`rejectCard(c, now)`(1624행)의 액션 버튼들이 모인 자리에 추가한다. 기존 버튼과 같은 `class="btn ghost"`를 쓰고, 속성 이름은 파이프라인 관례인 `pl` 접두사를 따라 `data-plhist`로 한다(`data-plvf`·`data-pledit`와 같은 계열):

```js
${c.linkedHoldingId?`<button class="btn ghost" data-plhist="${c.linkedHoldingId}">매매 이력</button>`:''}
```

**이 코드베이스는 이벤트 위임을 쓰지 않는다.** 렌더가 끝난 뒤 `bindPipeline()`(1747행)에서 요소마다 직접 바인딩한다. 같은 패턴으로 `data-pladopt` 블록 다음에 추가한다:

```js
document.querySelectorAll('[data-plhist]').forEach(b=>b.addEventListener('click',()=>{
  openHistModal(b.dataset.plhist);
}));
```

**주의:** `rejectCard`는 `▸ 기각`과 `▸ 칸 회수`가 **공유하는 마크업**이다(PRD §4). 일반 기각 후보는 `linkedHoldingId`가 `null`이라 버튼이 안 나오므로 분기 없이 위 조건만으로 충분하다.

- [ ] **Step 5: 브라우저에서 확인한다**

```sh
node docs/superpowers/build-selfcheck.js --demo && open _selfcheck.html
```

- `▸ 칸 회수`의 Nvidia 카드에 `매매 이력` 버튼이 있는가 (demo 데이터는 `linkedHoldingId:null`이므로 **안 보이는 게 정상**이다 — 버튼을 보려면 Task 2 Step 1의 `__t_dead` 데이터를 쓰거나 콘솔에서 `linkedHoldingId`를 채운다)
- `▸ 기각`의 Arista·TSMC 카드에는 버튼이 없는가
- 모달이 배경 클릭으로 닫히는가
- 콘솔에 빨간 에러가 없는가

- [ ] **Step 6: 커밋**

```sh
git add index_kelly.html
git commit -m "feat(kelly): view trade ledger from punch-back card"
```

본문: 청산 종목이 계획에서 사라지므로 회고 경로가 필요하다. 8분기 트랜치 UI는 청산된 포지션에 의미가 없어 평면 원장으로 낸다.

---

### Task 4: 미등재 청산 종목 배너

칸 회수 모달을 닫아버려 등재되지 않은 기존 데이터를 구제한다. 자동 등재하지 않는다.

**Files:**
- Modify: `index_kelly.html` — 일지 렌더의 `inactiveBanner` 근처
- Modify: `index_kelly.html` — 클릭 핸들러

**Interfaces:**
- Consumes: `needsPunchBack(h, candidates)` (Task 1), `openRejectModal(...)` (기존)
- Produces: 없음

- [ ] **Step 1: 배너를 렌더한다**

일지 렌더에서 `inactiveBanner`를 만드는 블록 **앞에** 추가하고, 카드 마크업의 `${inactiveBanner}` 옆에 붙인다:

```js
const punchWarn = needsPunchBack(h, candidates)
  ? `<div class="inactive-banner">⚠ 논지 훼손 전량매도 · <b>칸 회수 미등재</b>
       <div class="inactive-act">
         <button class="btn ghost sm" data-punch="${h.id}">등재하기</button>
       </div>
       <div class="inactive-advice">등재해야 기각 원장에 남고 계획에서 빠집니다.</div>
     </div>`
  : '';
```

카드 마크업에서 `${inactiveBanner}` 를 `${punchWarn}${inactiveBanner}` 로 바꾼다.

**주의:** 이 배너는 카드가 펼쳐졌을 때만 보인다(`isExpanded` 분기 안). 접힌 요약에도 신호가 필요하면 `nextActionSummary`에 한 줄 추가하되, **이번 범위에서는 하지 않는다** — 실사용에서 필요가 확인되면 그때 넣는다(P6).

- [ ] **Step 2: 핸들러를 연결한다**

일지도 위임이 아니라 렌더 후 개별 바인딩이다. `body.querySelectorAll('[data-iakeep]')` 블록(1453-1455행) 다음에 같은 패턴으로 추가한다 — 컨테이너 변수 이름은 `body`다:

```js
body.querySelectorAll('[data-punch]').forEach(b=>b.addEventListener('click',()=>{
  const h=holdings.find(x=>x.id===b.dataset.punch);
  if(!h) return;
  const sells=(h.ledger||[]).filter(x=>x.type==='sell');
  const last=sells[sells.length-1]||{};
  openRejectModal(null,{name:h.name, price:last.price, date:last.date||todayStr(),
                        reason:'thesis', holdingId:h.id});
  $('rj-title').textContent=`${h.name} · 칸 회수`;
  $('rj-intro').textContent='thesis 파기로 청산했습니다. 기각 원장에 등재됩니다. 재진입은 새 1칸입니다.';
  $('rj-reason').disabled=true;
}));
```

이 인자 구성은 `lm-save`의 자동 등재 경로와 동일하다(설계 §4-5). 등재되면 다음 렌더부터 Task 2의 필터를 타고 카드가 사라진다.

- [ ] **Step 3: 브라우저에서 확인한다**

콘솔에서 미등재 청산 상태를 만든 뒤 확인한다:

```js
holdings.push({id:'__t_orphan',name:'__ORPHAN',price:100,up:200,down:50,prob:0.6,
  startQ:currentQGuess(),ccy:'USD',fx:1,
  ledger:[{type:'buy',shares:3,price:100,amount:300,quarter:currentQGuess(),date:todayStr()},
          {type:'sell',shares:3,price:110,amount:330,sellReason:'thesis',quarter:currentQGuess(),date:todayStr()}]});
render();
```

- 일지에서 `__ORPHAN` 카드를 펼치면 `칸 회수 미등재` 배너가 보이는가
- `등재하기` → 칸 회수 모달이 뜨고 종목명·주가·날짜가 채워져 있는가
- 트리거 입력 후 저장 → **카드가 일지에서 사라지고** `▸ 칸 회수`에 나타나는가
- 기각률이 안 변하는가 (thesis는 분자에서 제외 — PRD §4)

확인 후 `holdings=holdings.filter(h=>h.id!=='__t_orphan'); save(); render();` 로 정리한다.

- [ ] **Step 4: 커밋**

```sh
git add index_kelly.html
git commit -m "feat(kelly): flag liquidated holdings missing punch-back"
```

본문: 칸 회수 모달을 닫아 등재를 건너뛴 기존 데이터가 계획에 남는다. 조용히 등재하는 대신 사용자가 누르게 한다.

---

### Task 5: 칸 회수 등재 강제

닫기·배경 클릭으로 등재를 건너뛰면 도달 불가 종목이 생긴다. PRD §4(147행)의 "칸 회수 강제"를 코드가 실제로 지키게 한다.

**Files:**
- Modify: `index_kelly.html` — `rj-close` 핸들러 (1816행)
- Modify: `index_kelly.html` — `rjModal` 배경 클릭 (1817행)
- Modify: `index_kelly.html` — `rj-save` 핸들러 (1826행)
- Modify: `index_kelly.html` — `openRejectModal` (닫기 버튼 표시 제어)

**Interfaces:**
- Consumes: `rjCtx` (기존 전역), `rjCtx.forceReason`
- Produces: 없음

- [ ] **Step 1: 강제 모드에서 닫기를 막는다**

```js
function rjIsForced(){ return rjCtx.forceReason==='thesis'; }
$('rj-close').addEventListener('click', ()=>{
  if(rjIsForced()){ setStatus('칸 회수는 등재해야 닫힙니다 — 재검토 트리거를 적으세요',true); return; }
  $('rjModal').style.display='none';
});
$('rjModal').addEventListener('click',e=>{
  if(e.target===$('rjModal') && !rjIsForced()) $('rjModal').style.display='none';
});
```

- [ ] **Step 2: 트리거 없이 저장되지 않게 한다**

`rj-save` 핸들러에서 후보 객체에 값을 쓰기 **전에** 넣는다:

```js
if(rjIsForced() && !$('rj-trigger').value.trim()){
  setStatus('재검토 트리거를 적어야 등재됩니다 (예: PBR 6배 이하 재검토)',true);
  $('rj-trigger').focus();
  return;
}
```

트리거 입력칸은 `<textarea id="rj-trigger">`(593행)다. `rj-save` 핸들러는 이미 1827행에서 `$('rj-trigger').value.trim()`을 읽으므로 그 위에 가드를 넣으면 된다.

- [ ] **Step 3: 강제 모드에서 닫기 버튼을 숨긴다**

`openRejectModal` 안, `$('rjModal').style.display='flex';` 직전:

```js
$('rj-close').style.display = rjIsForced() ? 'none' : '';
```

`rjCtx.forceReason`이 그 시점에 이미 설정돼 있어야 한다 — `openRejectModal`에서 `rjCtx`를 만드는 줄(1785행 부근) **다음에** 와야 한다.

- [ ] **Step 4: 브라우저에서 확인한다**

```sh
node docs/superpowers/build-selfcheck.js && open _selfcheck.html
```

- 테스트 종목 추가 → 매수 → **전량 매도, 사유 `원 논지 훼손`**
- 칸 회수 모달이 뜨고 **닫기 버튼이 없는가**
- **배경을 클릭해도 안 닫히는가**
- 트리거 없이 `기각 등재` → 거부 메시지가 뜨고 안 닫히는가
- 트리거 입력 후 저장 → 등재되고 **종목이 두 탭에서 사라지는가**
- `+ 후보 등록` 경유 **수동 기각 모달은 여전히 배경 클릭으로 닫히는가** (회귀 확인)

- [ ] **Step 5: 커밋**

```sh
git add index_kelly.html
git commit -m "feat(kelly): require punch-back before closing modal"
```

본문: 모달을 닫아 등재를 건너뛰면 청산 종목이 계획에서도 원장에서도 사라져 도달 불가가 된다. PRD §4가 규정한 "칸 회수 강제"를 코드가 지키게 한다.

---

### Task 6: 문서 갱신

코드와 문서가 어긋난 채로 끝내지 않는다.

**Files:**
- Modify: `PRD.md` §4 (147행), §7 (결정 표 끝)
- Modify: `docs/superpowers/browser-checklist-rejection-ledger.md` (24행, 112-113행)
- Modify: `docs/HANDOFF.md`

- [ ] **Step 1: PRD §4 147행을 고친다**

기존:
> **칸 회수 강제**: thesis 파기 전량 청산 시 기각 자동 등재. 같은 이름 재진입은 새 항목으로 강제하고, 청산된 historical 행에는 새 매수 기록을 막는다.

새 문구:
> **칸 회수 강제**: thesis 파기 전량 청산 시 기각 등재 모달이 뜨고, 재검토 트리거를 적어야 닫힌다. 등재된 종목은 **목표 배분·분기 매매일지 양쪽에서 사라지고**(`livePlanHoldings`), 매매 이력은 `▸ 칸 회수` 카드의 `매매 이력`에서 읽기 전용으로 본다. 같은 이름 재진입은 새 항목으로 강제한다. 등재를 건너뛴 기존 데이터는 자동 변환하지 않고 일지에 `칸 회수 미등재` 배너로 유도한다.

- [ ] **Step 2: PRD §7에 결정 한 줄을 추가한다**

결정 표 마지막 행 다음에 (번호는 기존 마지막 D번호 + 1):

| D18 | 청산 종목을 계획에서 제외, 이력은 칸 회수 카드 | ① 일지에 `▸ 청산` 섹션으로 남긴다 ② `holdings`에서 실제 삭제 | 보유 0주인 칸이 목표 금액을 받고 살아있는 종목 배분까지 희석했다. `holdings` 삭제는 회고용 원장을 잃고 `candidates` 스키마에 원장 자리가 없다. 계획에서만 빼고 원장은 남긴다 |

- [ ] **Step 3: 브라우저 체크리스트를 고친다**

- 24행 "배포본(`salt99.github.io`)은 아직 옛날 버전이니 그쪽을 열면 안 된다" → 삭제한다. 배포 완료 후라 사실이 아니다.
- 112-113행 "청산된 종목의 historical 행에서 새 매수 기록 시도 → 차단 메시지", "그 행의 기존 기록 `✎ 수정`은 여전히 열린다" → 두 항목을 삭제하고 아래로 교체한다:

```md
- [ ] 트리거 입력 후 저장 → **종목이 목표 배분·분기 매매일지 양쪽에서 사라진다**
- [ ] `▸ 칸 회수` 카드의 `매매 이력` → 매수·매도 기록이 그대로 보인다 (읽기 전용)
```

- [ ] **Step 4: HANDOFF를 갱신한다**

`docs/HANDOFF.md`를 덮어쓴다. 반드시 담을 것:

- 청산 종목이 계획에서 빠진다는 동작 변경과 그 이유
- **함정**: 청산 후에는 그 종목의 기존 기록을 앱 안에서 고칠 수 없다. 매매 이력 모달은 읽기 전용이고 일지 카드는 사라진다. 정정하려면 백업 JSON 편집 후 가져오기
- **손대지 말 것**: `todayStr()`의 UTC 기준 (기존 항목 유지), 커밋 `08ecddc` `6216f9b` `668a7cb` 제목 50자 초과 (기존 항목 유지)
- 되돌리는 법: `index_kelly.html` 단일 파일 변경이고 저장 포맷을 안 바꾼다. `git revert` 후 push하면 10분 내 폰 반영, 데이터 손실 없음

- [ ] **Step 5: 커밋**

```sh
git add PRD.md docs/superpowers/browser-checklist-rejection-ledger.md docs/HANDOFF.md
git commit -m "docs: record liquidated-holding exclusion"
```

---

## 배포 전 최종 확인

- [ ] `node test_pipeline.js` 전부 PASS
- [ ] `node docs/superpowers/build-selfcheck.js && open _selfcheck.html` → `전부 통과` 초록색
- [ ] 손계산 대조 완료 (Task 2 Step 6) — `posSum` 어느 경우인지 명시하고 값 일치 확인
- [ ] 폰 폭에서 가로 스크롤이 없는가 (P3 모바일 우선)
- [ ] 허브(`index.html`)에서 다른 도구 3개 열어 콘솔 에러 없음
- [ ] `rm _selfcheck.html`
