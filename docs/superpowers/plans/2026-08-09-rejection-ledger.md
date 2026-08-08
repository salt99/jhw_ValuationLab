# 후보 파이프라인 (기각 원장) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** TOOL 04(`index_kelly.html`)에 "후보 파이프라인" 카드를 추가해 검토중 후보와 기각 판단을 기록하고, 3년 뒤 그 판단을 검증 가능하게 만든다.

**Architecture:** 기존 단일 파일 HTML에 ① 순수 계산 함수 블록, ② `kelly2y.candidates[]` 상태, ③ 렌더 함수 하나(`renderPipeline`), ④ 모달 3개(등록·기각·검증)를 추가한다. 순수 함수는 마커로 감싼 블록에 모아두고 Node 스크립트가 그 블록만 추출해 DOM 없이 단위 검증한다(P5).

**Tech Stack:** vanilla JS, `localStorage`, 빌드 없음, 의존성 없음. 검증은 `node test_pipeline.js` (Node 표준 라이브러리만).

**설계 정본:** `docs/superpowers/specs/2026-08-09-rejection-ledger-design.md`

## Global Constraints

- 파일 추가 금지 — 도구 코드는 전부 `index_kelly.html` 안에 인라인 (P7 플랫 파일 규칙). 예외는 루트의 검증 스크립트 `test_pipeline.js` 하나.
- 외부 CDN·프레임워크·패키지 매니저 금지 (P2 로컬 우선, 오프라인 원칙).
- 신규 CSS는 기존 토큰만 사용: `--bg --panel --panel-2 --ink --dim --faint --line --accent --accent-dim --good --warn --bad --cash --cash-dim --mono`. 새 토큰 정의 금지 (§6 VL 베이스 블록 불변).
- `localStorage` 키는 `kelly2y` 하나만 사용. 새 키 생성 금지 (P2 §5 키 레지스트리).
- 통화는 USD 고정. `load()`가 이미 `h.ccy='USD'; h.fx=1`을 강제한다(`index_kelly.html:1322`).
- 상수 고정값: `GRACE_MS = 14*864e5` (14일), `VERIFY_DAYS = 1095` (3년).
- 기각 사유 코드 6종: `factor` `circle` `premium` `valuation` `thesis` `abandoned`. `thesis`는 자동 등재 전용 — 수동 드롭다운에 넣지 않는다.
- 기존 사용자 데이터 무손실. 마이그레이션은 **추가만**, 변경·삭제 없음.
- 커밋 메시지: Conventional Commits (`<타입>(<범위>): <제목>`), 제목 명령형 50자 이내, 본문은 *왜*. AI 저작 표기 금지.

---

### Task 1: 순수 계산 함수 + 단위 검증 하네스

기각률·유예·소급·검증 D-day 계산을 DOM에서 분리하고, P5가 요구하는 Node 검증 경로를 만든다. 이후 모든 태스크가 이 함수들을 쓴다.

**Files:**
- Modify: `index_kelly.html` — `<script>` 안, `const KEY='kelly2y';` (521행) 바로 위에 블록 삽입
- Create: `test_pipeline.js` (저장소 루트)

**Interfaces:**
- Consumes: 없음
- Produces:
  - `GRACE_MS: number` — 14일 ms
  - `VERIFY_DAYS: number` — 1095
  - `isEditable(c, now) -> boolean`
  - `isSeeded(c) -> boolean`
  - `verifyDaysLeft(c, now) -> number|null`
  - `rejectionStats(candidates, holdings, introMs) -> {reviewing, rejected, punchesBack, adopted, rate}`
  - `migrateCandidates(d, nowMs) -> {candidates, rejIntroDate, needsSave}`

- [ ] **Step 1: 검증 스크립트를 먼저 작성한다**

`test_pipeline.js`를 새로 만든다:

```js
/* P5 단위 검증 — 실행: node test_pipeline.js
   index_kelly.html의 PIPELINE PURE 블록만 추출해 DOM 없이 실행한다. */
const fs = require('fs');
const src = fs.readFileSync(__dirname + '/index_kelly.html', 'utf8');
const m = src.match(/\/\* ===== PIPELINE PURE =====[\s\S]*?\/\* ===== \/PIPELINE PURE ===== \*\//);
if (!m) { console.error('PIPELINE PURE 블록을 찾지 못했습니다'); process.exit(1); }
const api = new Function(m[0] + `
  return {GRACE_MS, VERIFY_DAYS, isEditable, isSeeded, verifyDaysLeft, rejectionStats, migrateCandidates};
`)();

let pass = 0, fail = 0;
function eq(label, got, want) {
  if (JSON.stringify(got) === JSON.stringify(want)) { pass++; console.log('  ok   ' + label); }
  else { fail++; console.log('  FAIL ' + label + '\n       got  ' + JSON.stringify(got) + '\n       want ' + JSON.stringify(want)); }
}
function grp(t) { console.log('\n' + t); }

const DAY = 864e5;
const NOW = Date.parse('2026-08-09T00:00:00Z');
const INTRO = Date.parse('2026-08-01T00:00:00Z');
const hid = ms => ms.toString(36);

/* ---- rejectionStats ---- */
grp('rejectionStats');
{
  const cands = [
    { status:'reviewing' },
    { status:'reviewing' },
    { status:'rejected', rejectReason:'factor' },
    { status:'rejected', rejectReason:'valuation' },
    { status:'rejected', rejectReason:'circle' },
    { status:'rejected', rejectReason:'thesis' },
  ];
  const holds = [ {id:hid(INTRO + 1*DAY)}, {id:hid(INTRO + 2*DAY)}, {id:hid(INTRO + 3*DAY)} ];
  eq('thesis는 분자에서 빠지고 칸 회수로 따로 셈',
     api.rejectionStats(cands, holds, INTRO),
     {reviewing:2, rejected:3, punchesBack:1, adopted:3, rate:0.5});

  eq('도입 이전에 만든 holdings는 분모에서 제외',
     api.rejectionStats(cands, [{id:hid(INTRO - 30*DAY)}, {id:hid(INTRO + 1*DAY)}], INTRO).adopted,
     1);

  eq('base36으로 못 읽는 레거시 id는 분모에서 제외',
     api.rejectionStats(cands, [{id:'!!!'}, {id:'1'}], INTRO).adopted,
     0);

  eq('분모 0이면 rate는 null',
     api.rejectionStats([], [], INTRO).rate,
     null);

  eq('thesis만 있으면 분자 0 · rate null',
     api.rejectionStats([{status:'rejected', rejectReason:'thesis'}], [], INTRO),
     {reviewing:0, rejected:0, punchesBack:1, adopted:0, rate:null});
}

/* ---- isEditable ---- */
grp('isEditable (14일 유예)');
{
  eq('13일 23시간 전 등재 → 수정 가능',
     api.isEditable({rejectedAt: NOW - (14*DAY - 3600e3)}, NOW), true);
  eq('14일 1분 전 등재 → 잠김',
     api.isEditable({rejectedAt: NOW - (14*DAY + 60e3)}, NOW), false);
  eq('70일 전 후보 등록 + 방금 기각 → 유예 살아있음 (id 기준이면 실패하는 케이스)',
     api.isEditable({id: hid(NOW - 70*DAY), rejectedAt: NOW}, NOW), true);
  eq('rejectedDate를 1년 전으로 소급해도 유예는 안 늘어남',
     api.isEditable({rejectedAt: NOW - 15*DAY, rejectedDate:'2025-08-09'}, NOW), false);
}

/* ---- isSeeded ---- */
grp('isSeeded (소급 등록 배지)');
{
  eq('기각일 == 등재일 → 배지 없음',
     api.isSeeded({rejectedAt: NOW, rejectedDate:'2026-08-09'}), false);
  eq('기각일이 13일 전 → 배지 없음',
     api.isSeeded({rejectedAt: NOW, rejectedDate:'2026-07-27'}), false);
  eq('기각일이 15일 전 → 배지 있음',
     api.isSeeded({rejectedAt: NOW, rejectedDate:'2026-07-25'}), true);
  eq('날짜가 깨졌으면 배지 없음',
     api.isSeeded({rejectedAt: NOW, rejectedDate:'garbage'}), false);
}

/* ---- verifyDaysLeft ---- */
grp('verifyDaysLeft (3년 = 1095일)');
{
  eq('오늘 기각 → D-1095', api.verifyDaysLeft({rejectedDate:'2026-08-09'}, NOW), 1095);
  eq('정확히 1095일 전 기각 → 0', api.verifyDaysLeft({rejectedDate:'2023-08-11'}, NOW), 0);
  eq('1100일 전 기각 → 음수', api.verifyDaysLeft({rejectedDate:'2023-08-06'}, NOW), -5);
  eq('날짜가 깨졌으면 null', api.verifyDaysLeft({rejectedDate:''}, NOW), null);
}

/* ---- migrateCandidates ---- */
grp('migrateCandidates');
{
  eq('구버전 데이터 → 빈 배열 + 도입일 기록 + 저장 필요',
     api.migrateCandidates({}, NOW),
     {candidates:[], rejIntroDate:NOW, needsSave:true});
  eq('도입일이 이미 있으면 절대 갱신하지 않음',
     api.migrateCandidates({rejIntroDate: INTRO, candidates:[]}, NOW),
     {candidates:[], rejIntroDate:INTRO, needsSave:false});
  eq('기존 candidates는 그대로 보존',
     api.migrateCandidates({rejIntroDate: INTRO, candidates:[{name:'A'}]}, NOW).candidates,
     [{name:'A'}]);
}

console.log('\n' + (fail ? `FAILED  ${pass} pass / ${fail} fail` : `OK  ${pass} pass`));
process.exit(fail ? 1 : 0);
```

- [ ] **Step 2: 실패하는 것을 확인한다**

실행: `node test_pipeline.js`
예상: `PIPELINE PURE 블록을 찾지 못했습니다` 출력 후 exit code 1

- [ ] **Step 3: 순수 함수 블록을 구현한다**

`index_kelly.html`의 `const KEY='kelly2y';` (521행) **바로 위**에 삽입한다:

```js
/* ===== PIPELINE PURE ===== (test_pipeline.js가 이 블록을 추출해 DOM 없이 검증한다) */
const GRACE_MS = 14*864e5;     // 기각 등재 후 수정·삭제 유예 = 소급 배지 임계
const VERIFY_DAYS = 1095;      // 3년 검증

/* 기각 등재 시각 기준 유예 판정. id(후보 등록 시각)나 rejectedDate(소급 가능)를 쓰면 안 된다. */
function isEditable(c, now){
  return Number.isFinite(c.rejectedAt) && (now - c.rejectedAt) < GRACE_MS;
}
/* 주장한 기각일과 실제 등재 시각이 GRACE_MS 이상 벌어지면 기억 기반 소급 등록으로 본다. */
function isSeeded(c){
  const d = Date.parse(c.rejectedDate);
  if(!Number.isFinite(d) || !Number.isFinite(c.rejectedAt)) return false;
  return (c.rejectedAt - d) > GRACE_MS;
}
function verifyDaysLeft(c, now){
  const d = Date.parse(c.rejectedDate);
  if(!Number.isFinite(d)) return null;
  return Math.ceil((d + VERIFY_DAYS*864e5 - now)/864e5);
}
/* 기각률 분자에서 thesis를 뺀다 — 산 적 있는 종목이라 분모의 편입에도 들어가 비율이 부풀려진다. */
function rejectionStats(candidates, holdings, introMs){
  const cs = candidates||[];
  const rejectedAll = cs.filter(c=>c.status==='rejected');
  const punchesBack = rejectedAll.filter(c=>c.rejectReason==='thesis');
  const realRejects = rejectedAll.filter(c=>c.rejectReason!=='thesis');
  const adopted = (holdings||[]).filter(h=>{
    const t = parseInt(h.id,36);
    return Number.isFinite(t) && Number.isFinite(introMs) && t >= introMs;
  });
  const denom = realRejects.length + adopted.length;
  return {
    reviewing: cs.filter(c=>c.status==='reviewing').length,
    rejected: realRejects.length,
    punchesBack: punchesBack.length,
    adopted: adopted.length,
    rate: denom ? realRejects.length/denom : null
  };
}
/* rejIntroDate는 한 번 기록되면 갱신하지 않는다 — 갱신되면 기각률 분모가 매번 리셋된다. */
function migrateCandidates(d, nowMs){
  const had = Number.isFinite(d.rejIntroDate);
  return {
    candidates: d.candidates || [],
    rejIntroDate: had ? d.rejIntroDate : nowMs,
    needsSave: !had
  };
}
/* ===== /PIPELINE PURE ===== */
```

- [ ] **Step 4: 통과하는 것을 확인한다**

실행: `node test_pipeline.js`
예상: `OK  20 pass`, exit code 0

- [ ] **Step 5: 브라우저에서 회귀가 없는지 확인한다**

`index_kelly.html`을 브라우저에서 연다. 기존 화면이 그대로 뜨고 콘솔에 에러가 없어야 한다. (전역 상수 추가만 했으므로 동작 변화 없음)

- [ ] **Step 6: 커밋**

```bash
git add index_kelly.html test_pipeline.js
git commit -m "feat(kelly): add pipeline pure functions with node harness

기각률·유예·소급 판정은 배포 전 손계산과 대조해야 하는 로직인데
단일 파일 HTML 안에 있으면 검증할 방법이 없다. 마커로 감싼 블록만
추출해 DOM 없이 실행하는 하네스를 둬서 P5를 충족시킨다."
```

---

### Task 2: 상태 배선과 v4 마이그레이션

`candidates`·`rejIntroDate`를 전역 상태로 올리고 저장·로드·백업 경로에 태운다. 화면 변화는 없다.

**Files:**
- Modify: `index_kelly.html:522` 부근 (전역 선언), `:1300-1302` (`dataSnapshot`), `:1312-1344` (`load`)

**Interfaces:**
- Consumes: `migrateCandidates(d, nowMs)` (Task 1)
- Produces: 전역 `candidates: Array`, 전역 `rejIntroDate: number`

- [ ] **Step 1: 전역 변수를 선언한다**

`index_kelly.html:522`의 `let holdings=[];` 선언 **직후**에 추가:

```js
let candidates=[];    // {id,name,status,startDate, rejectedDate,rejectedAt,rejectPrice,
                      //  rejectReason,trigger,note,linkedHoldingId,verify}
let rejIntroDate=0;   // 후보 파이프라인 도입 시각(ms) — 기각률 분모 필터. 1회만 기록.
```

- [ ] **Step 2: `dataSnapshot()`을 v4로 올린다**

`index_kelly.html:1300-1302`을 교체:

```js
function dataSnapshot(){
  return {v:4, holdings, candidates, rejIntroDate,
          usdHolding, krwHolding, cashLog, baseFx, totalLocked, amtFixedUSD:true};
}
```

- [ ] **Step 3: `load()`에 복원·마이그레이션을 붙인다**

`index_kelly.html:1341`의 `lastBackup = d.lastBackup||null;` **바로 위**에 삽입:

```js
  const mig = migrateCandidates(d, Date.now());
  candidates = mig.candidates;
  rejIntroDate = mig.rejIntroDate;
```

그리고 같은 함수의 `1342`행을 교체 — 도입일이 새로 생겼을 때도 즉시 영속화해야 한다:

```js
  if(ver<2 || !d.amtFixedUSD || mig.needsSave) save();
```

- [ ] **Step 4: 기존 데이터가 보존되는지 수동 확인한다**

브라우저에서 `index_kelly.html`을 열고 DevTools 콘솔에서:

```js
const before = JSON.parse(localStorage.getItem('kelly2y'));
console.log('holdings', before.holdings.length, 'v', before.v,
            'intro', before.rejIntroDate, 'cands', before.candidates);
```

기대: `v` = 4, `cands` = `[]`, `intro`에 숫자가 들어 있고, `holdings` 개수가 리로드 전과 같다.

페이지를 한 번 더 새로고침한 뒤 같은 명령을 실행해 **`intro` 값이 바뀌지 않는지** 확인한다. 바뀌면 기각률 분모가 매번 리셋되는 버그다.

- [ ] **Step 5: export/import 왕복을 확인한다**

`내보내기`로 JSON을 받아 `candidates`·`rejIntroDate` 키가 들어 있는지 확인하고, 그 파일을 다시 `가져오기` 한 뒤 종목 목록이 그대로인지 본다.

- [ ] **Step 6: 커밋**

```bash
git add index_kelly.html
git commit -m "feat(kelly): wire candidates state into v4 snapshot

기각률 분모(편입 건수)가 kelly2y 안에 있어야 계산되므로 후보
데이터를 같은 스냅샷에 넣는다. 도입일을 1회만 기록해 두지 않으면
분모가 새로고침마다 리셋된다."
```

---

### Task 3: 후보 파이프라인 카드 (읽기 전용 렌더)

카드 마크업·CSS·렌더 함수를 넣는다. 버튼은 아직 붙이지 않는다 — 데이터가 화면에 정확히 나오는지 먼저 고정한다.

**Files:**
- Modify: `index_kelly.html` — `<style>` 블록 끝부분(`.inactive-advice` 규칙 뒤, 170행 부근), `:366` 뒤 마크업, `:934` `render()` 내부, 스크립트 하단

**Interfaces:**
- Consumes: `rejectionStats`, `isSeeded`, `verifyDaysLeft`, `isEditable` (Task 1), `candidates`/`rejIntroDate` (Task 2), 기존 `escapeHtml(s)`(`:1294`), `fmtNum(n)`(`:1295`)
- Produces: `renderPipeline() -> void`, `REJECT_LABELS: Record<string,string>`, `VERDICT_LABELS: Record<string,string>`

> 이 태스크에서 렌더되는 `기각`·`편입`·`삭제`·`검증`·`✎` 버튼은 **아직 아무 동작도 하지 않는다.** 핸들러는 Task 4~7에서 붙인다. 여기서는 데이터가 화면에 정확히 나오는 것만 확인한다.

- [ ] **Step 1: CSS를 추가한다**

`index_kelly.html:170`의 `.inactive-advice{...}` 규칙 **바로 뒤**에 삽입:

```css
  .pl-stat{font-size:11.5px;color:var(--dim);font-family:var(--mono);margin:2px 0 12px;line-height:1.8;}
  .pl-stat b{color:var(--ink);}
  .pl-group{font-size:11px;color:var(--faint);margin:16px 0 7px;letter-spacing:.04em;}
  .pl-item{border:1px solid var(--line);border-radius:10px;padding:10px 12px;
    margin-bottom:8px;background:var(--panel-2);}
  .pl-top{display:flex;align-items:baseline;gap:8px;font-size:13px;}
  .pl-name{font-weight:700;}
  .pl-date{margin-left:auto;font-family:var(--mono);font-size:10.5px;color:var(--faint);
    white-space:nowrap;}
  .pl-meta{font-family:var(--mono);font-size:11px;color:var(--dim);margin-top:5px;}
  .pl-trigger{font-size:11px;color:var(--ink);margin-top:5px;line-height:1.5;}
  .pl-badge{display:inline-block;font-size:10px;padding:1px 7px;border-radius:999px;
    border:1px solid var(--line);color:var(--faint);font-family:var(--mono);}
  .pl-badge.due{border-color:var(--warn);color:var(--warn);}
  .pl-badge.done{border-color:var(--good);color:var(--good);}
  .pl-badges{display:flex;gap:5px;margin-top:7px;flex-wrap:wrap;align-items:center;}
  .pl-act{display:flex;gap:6px;margin-top:9px;flex-wrap:wrap;}
  .pl-act .btn{font-size:11px;padding:6px 11px;}
  .pl-locked{font-size:10.5px;color:var(--faint);margin-top:7px;}
```

- [ ] **Step 2: 카드 마크업을 넣는다**

`index_kelly.html:366`의 `<div class="status" id="status"></div>` **바로 뒤**에 삽입:

```html
<div class="card">
  <h2>후보 파이프라인</h2>
  <div class="pl-stat" id="pl-stat"></div>
  <button class="btn ghost" id="pl-add" style="width:100%;">+ 후보 등록</button>
  <div id="pl-body"></div>
</div>
```

- [ ] **Step 3: 렌더 함수를 구현한다**

`index_kelly.html`의 `function renderBackupStatus(){` (1414행) **바로 위**에 삽입:

```js
/* ---- 후보 파이프라인 ---- */
const REJECT_LABELS={
  factor:'팩터 중복 (이미 뚫린 칸)',
  circle:'능력범위 밖',
  premium:'프리미엄 자격 미달',
  valuation:'밸류에이션',
  thesis:'thesis 파기 청산',
  abandoned:'결론 보류·중단'
};
const VERDICT_LABELS={right:'기각이 옳았음', wrong:'기각이 틀렸음', unclear:'판단 보류'};

function renderPipeline(){
  const st=rejectionStats(candidates, holdings, rejIntroDate);
  const rateStr = st.rate===null ? '—'
    : `${st.rejected}/${st.rejected+st.adopted} = ${Math.round(st.rate*100)}%`;
  $('pl-stat').innerHTML =
    `검토중 <b>${st.reviewing}</b> · 기각 <b>${st.rejected}</b> · `+
    `편입 <b>${st.adopted}</b> · 칸 회수 <b>${st.punchesBack}</b><br>기각률 ${rateStr}`;

  const now=Date.now();
  const reviewing=candidates.filter(c=>c.status==='reviewing')
    .sort((a,b)=>Date.parse(a.startDate)-Date.parse(b.startDate));   // 오래된 순
  const rejected=candidates.filter(c=>c.status==='rejected')
    .sort((a,b)=>Date.parse(b.rejectedDate)-Date.parse(a.rejectedDate)); // 최신 순

  let html='';
  if(!candidates.length){
    html=`<div class="empty">후보를 등록하면 대기열과 기각 이력이 여기 쌓입니다.</div>`;
  }

  if(reviewing.length){
    html+=`<div class="pl-group">▸ 검토중 (오래된 순)</div>`;
    reviewing.forEach(c=>{
      const days=Math.floor((now-Date.parse(c.startDate))/864e5);
      html+=`<div class="pl-item">
        <div class="pl-top"><span class="pl-name">${escapeHtml(c.name)}</span>
          <span class="pl-date">${days}일 · ${c.startDate}</span></div>
        <div class="pl-act">
          <button class="btn ghost" data-plrej="${c.id}">기각</button>
          <button class="btn ghost" data-pladopt="${c.id}">편입</button>
          <button class="btn ghost" data-pldel="${c.id}">삭제</button>
        </div></div>`;
    });
  }

  if(rejected.length){
    html+=`<div class="pl-group">▸ 기각 (최신 순)</div>`;
    rejected.forEach(c=>{
      const left=verifyDaysLeft(c, now);
      let vBadge, vAct='';
      if(c.verify){
        vBadge=`<span class="pl-badge done">✓ 검증 완료</span>`;
      } else if(left!==null && left<=0){
        vBadge=`<span class="pl-badge due">🔍 검증 필요</span>`;
        vAct=`<button class="btn ghost" data-plvf="${c.id}">검증</button>`;
      } else {
        vBadge=`<span class="pl-badge">⏳ 검증 D-${left===null?'?':left}</span>`;
      }
      const seeded=isSeeded(c)?`<span class="pl-badge">소급 등록</span>`:'';

      let vLine='';
      if(c.verify){
        const pct=c.rejectPrice?Math.round((c.verify.price/c.rejectPrice-1)*100):null;
        vLine=`<div class="pl-meta">$${fmtNum(c.rejectPrice)} → $${fmtNum(c.verify.price)}`+
              `${pct===null?'':` (${pct>=0?'+':''}${pct}%)`} · ${VERDICT_LABELS[c.verify.verdict]||''}</div>`;
      }

      const editable=isEditable(c, now);
      html+=`<div class="pl-item">
        <div class="pl-top"><span class="pl-name">${escapeHtml(c.name)}</span>
          <span class="pl-date">${c.rejectedDate||''}</span></div>
        <div class="pl-meta">$${fmtNum(c.rejectPrice)} · ${REJECT_LABELS[c.rejectReason]||c.rejectReason}</div>
        ${c.trigger?`<div class="pl-trigger">↻ ${escapeHtml(c.trigger)}</div>`:''}
        ${c.note?`<div class="pl-trigger">${escapeHtml(c.note)}</div>`:''}
        ${vLine}
        <div class="pl-badges">${vBadge}${seeded}</div>
        <div class="pl-act">
          ${vAct}
          <button class="btn ghost" data-pledit="${c.id}">✎ ${editable?'수정':'트리거·메모'}</button>
          ${editable?`<button class="btn ghost" data-pldel="${c.id}">삭제</button>`:''}
        </div>
        ${editable?'':`<div class="pl-locked">등재 14일 경과 — 기각일·주가·사유는 잠겼습니다.</div>`}
      </div>`;
    });
  }
  $('pl-body').innerHTML=html;
}
```

- [ ] **Step 4: `render()`에서 호출한다**

`index_kelly.html:939`의 `renderBackupStatus();` **바로 뒤**에 추가:

```js
  renderPipeline();
```

- [ ] **Step 5: 시드 데이터를 넣어 눈으로 확인한다**

브라우저에서 파일을 열고 DevTools 콘솔에 붙여넣는다:

```js
const s = JSON.parse(localStorage.getItem('kelly2y'));
const D = 864e5, now = Date.now();
s.candidates = [
  {id:(now-70*D).toString(36), name:'Costco',   status:'reviewing', startDate:'2026-06-01'},
  {id:(now-20*D).toString(36), name:'Visa',     status:'reviewing', startDate:'2026-07-20'},
  {id:(now-1*D).toString(36),  name:'Arista',   status:'rejected',  startDate:'2026-08-05',
   rejectedDate:'2026-08-09', rejectedAt:now-1*D, rejectPrice:142, rejectReason:'factor',
   trigger:'반도체 노출 줄면 재검토', note:'', linkedHoldingId:null, verify:null},
  {id:(now-40*D).toString(36), name:'TSMC',     status:'rejected',  startDate:'2023-05-01',
   rejectedDate:'2023-05-02', rejectedAt:now-40*D, rejectPrice:210, rejectReason:'valuation',
   trigger:'PBR 6배 이하 재검토', note:'', linkedHoldingId:null, verify:null}
];
localStorage.setItem('kelly2y', JSON.stringify(s)); location.reload();
```

기대 화면:
- 헤더 `검토중 2 · 기각 2 · 편입 N · 칸 회수 0`
- 검토중은 Costco(70일)가 Visa(20일)보다 **위**
- Arista에 `⏳ 검증 D-1094` 부근, `삭제` 버튼 있음(14일 이내)
- TSMC에 `🔍 검증 필요` + `검증` 버튼, `소급 등록` 배지(등재가 기각일보다 3년 늦음), `삭제` 버튼 **없음**, 잠김 안내문 있음

확인 후 `s.candidates = []`로 되돌려 둔다.

- [ ] **Step 6: 커밋**

```bash
git add index_kelly.html
git commit -m "feat(kelly): render candidate pipeline card

기각 이력과 대기열을 화면에 세워 둔다. 검토중을 오래된 순으로
올리는 것은 결론을 안 낸 항목이 위쪽을 차지해 압력을 유지하게
하려는 것이다."
```

---

### Task 4: 후보 등록과 검토중 삭제

**Files:**
- Modify: `index_kelly.html` — 모달 마크업(`keepModal` 뒤, 517행 부근), 스크립트(`renderPipeline` 뒤)

**Interfaces:**
- Consumes: `renderPipeline` (Task 3), `isEditable` (Task 1), 기존 `save()`(`:1303`), `setStatus(m,err)`(`:1296`)
- Produces:
  - `todayStr() -> string` — `'YYYY-MM-DD'`
  - `newCandidate(name) -> candidate` — `status:'reviewing'`, `startDate` 오늘, `id`는 base36 타임스탬프. 배열에 push하고 그 객체를 돌려준다.
  - `openAddCandidate() -> void`
  - `bindPipeline() -> void` — `renderPipeline()` 끝에서 호출되어 카드 안 버튼에 핸들러를 붙인다

- [ ] **Step 1: 등록 모달 마크업을 넣는다**

`index_kelly.html:517`의 keep 모달 닫는 `</div>` **바로 뒤**(같은 레벨)에 삽입:

```html
<!-- 후보 등록 모달 -->
<div class="modal-bg" id="plModal" style="display:none">
  <div class="modal" style="max-width:400px;">
    <div class="modal-head">
      <span>후보 등록</span>
      <span class="modal-x" id="pl-close">✕</span>
    </div>
    <div class="fld" style="margin-top:12px;"><label>종목명</label><input class="txt" id="pl-name"></div>
    <div class="keep-note" style="margin-top:10px;">
      검토 시작일은 <b>등록 시각</b>으로 자동 기록됩니다. 과거 날짜는 입력하지 않습니다 —
      기억으로 적은 날짜는 부정확하고 진척을 아는 상태에서 유리하게 적힐 수 있습니다.
    </div>
    <button class="btn primary" id="pl-save-review">검토중으로 등록</button>
    <button class="btn ghost" id="pl-save-reject" style="width:100%;margin-top:8px;">바로 기각 등재</button>
  </div>
</div>
```

- [ ] **Step 2: 등록·삭제 로직을 구현한다**

`renderPipeline()` 함수 **바로 뒤**에 삽입:

```js
function todayStr(){ return new Date().toISOString().slice(0,10); }

function openAddCandidate(){
  $('pl-name').value='';
  $('plModal').style.display='flex';
  $('pl-name').focus();
}
function newCandidate(name){
  const c={id:Date.now().toString(36), name, status:'reviewing', startDate:todayStr()};
  candidates.push(c);
  return c;
}
$('pl-add').addEventListener('click', openAddCandidate);
$('pl-close').addEventListener('click', ()=>{ $('plModal').style.display='none'; });
$('pl-save-review').addEventListener('click', ()=>{
  const name=$('pl-name').value.trim();
  if(!name){ setStatus('종목명을 입력하세요',true); return; }
  newCandidate(name);
  save(); render();
  $('plModal').style.display='none';
  setStatus('검토중 등록됨: '+name);
});

function bindPipeline(){
  document.querySelectorAll('[data-pldel]').forEach(b=>b.addEventListener('click',()=>{
    const c=candidates.find(x=>x.id===b.dataset.pldel); if(!c) return;
    if(c.status==='rejected' && !isEditable(c, Date.now())){
      setStatus('등재 14일이 지난 기각은 삭제할 수 없습니다',true); return;
    }
    if(!confirm(`${c.name} 항목을 삭제할까요?`)) return;
    candidates=candidates.filter(x=>x.id!==c.id);
    save(); render(); setStatus('삭제됨: '+c.name);
  }));
}
```

`renderPipeline()`의 마지막 줄 `$('pl-body').innerHTML=html;` **바로 뒤**에 추가:

```js
  bindPipeline();
```

- [ ] **Step 3: 동작을 확인한다**

브라우저에서:
1. `+ 후보 등록` → 종목명 비운 채 `검토중으로 등록` → `종목명을 입력하세요` 경고
2. `Progressive` 입력 → 등록 → 검토중 목록에 `0일 · <오늘>`로 나타남, 헤더 검토중 카운트 +1
3. 새로고침 → 그대로 남아 있음
4. `삭제` → 확인창 → 사라짐, 카운트 −1

- [ ] **Step 4: 커밋**

```bash
git add index_kelly.html
git commit -m "feat(kelly): add candidate registration and removal

검토중 항목은 아직 결론이 아니므로 자유 삭제를 허용한다.
시작일 입력을 받지 않는 것은 소급 날짜의 신뢰도 문제 때문이다."
```

---

### Task 5: 기각 등재 모달과 유예 기반 수정

**Files:**
- Modify: `index_kelly.html` — 모달 마크업(`plModal` 뒤), 스크립트(`bindPipeline` 뒤)

**Interfaces:**
- Consumes: `isEditable` (Task 1), `newCandidate`/`todayStr`/`bindPipeline` (Task 4), `REJECT_LABELS` (Task 3), 기존 `numVal(id)`(`:537`)
- Produces: `openRejectModal(cid, opts) -> void`
  - `cid: string|null` — `null`이면 신규. **후보 객체는 모달을 열 때가 아니라 저장할 때 만든다.** 열면서 만들면 사용자가 닫았을 때 유령 `reviewing` 항목이 남는다.
  - `opts: {name?, price?, date?, reason?, holdingId?}` — 전부 선택. `reason`은 `rjCtx.forceReason`으로 들어가 드롭다운보다 우선한다(`thesis` 자동 등재용).

- [ ] **Step 1: 기각 모달 마크업을 넣는다**

`plModal` 닫는 `</div>` **바로 뒤**에 삽입:

```html
<!-- 기각 등재 모달 -->
<div class="modal-bg" id="rjModal" style="display:none">
  <div class="modal">
    <div class="modal-head">
      <span id="rj-title">기각 등재</span>
      <span class="modal-x" id="rj-close">✕</span>
    </div>
    <div class="re-intro" id="rj-intro">기각 판단을 기록합니다. 3년 뒤 이 판단이 옳았는지 검증합니다.</div>
    <div class="add-grid" style="grid-template-columns:1fr 1fr;margin-top:12px;">
      <div class="fld"><label>기각일</label>
        <input id="rj-date" type="date" style="font-family:var(--mono);"></div>
      <div class="fld"><label>당시 주가 ($)</label><input id="rj-price" inputmode="decimal"></div>
    </div>
    <div class="fld" style="margin-top:10px;">
      <label>기각 사유</label>
      <select id="rj-reason" style="background:var(--panel-2);border:1px solid var(--line);
        color:var(--ink);border-radius:8px;padding:9px;font-size:12.5px;">
        <option value="factor">팩터 중복 (이미 뚫린 칸)</option>
        <option value="circle">능력범위 밖</option>
        <option value="premium">프리미엄 자격 미달</option>
        <option value="valuation">밸류에이션</option>
        <option value="abandoned">결론 보류·중단</option>
      </select>
    </div>
    <div class="fld" style="margin-top:10px;">
      <label>재검토 트리거 (필수 — 구체적 숫자로)</label>
      <textarea id="rj-trigger" rows="2" placeholder="예: PBR 6배 이하로 오면 재검토"
        style="background:var(--panel-2);border:1px solid var(--line);color:var(--ink);
        border-radius:8px;padding:10px;font-size:12.5px;font-family:inherit;resize:vertical;"></textarea>
    </div>
    <div class="fld" style="margin-top:10px;">
      <label>메모 (선택)</label>
      <textarea id="rj-note" rows="2"
        style="background:var(--panel-2);border:1px solid var(--line);color:var(--ink);
        border-radius:8px;padding:10px;font-size:12.5px;font-family:inherit;resize:vertical;"></textarea>
    </div>
    <div class="keep-note" id="rj-locked" style="margin-top:10px;display:none;">
      등재 14일이 지나 <b>기각일·주가·사유는 잠겼습니다.</b> 트리거와 메모만 수정됩니다.
    </div>
    <button class="btn primary" id="rj-save">기각 등재</button>
  </div>
</div>
```

- [ ] **Step 2: 기각 등재·수정 로직을 구현한다**

`bindPipeline()` 함수 **바로 뒤**에 삽입:

```js
let rjCtx={cid:null, name:'', holdingId:null, editing:false, forceReason:null};

function openRejectModal(cid, opts){
  opts=opts||{};
  const c = cid ? candidates.find(x=>x.id===cid) : null;
  const editing = !!(c && c.status==='rejected');
  const locked = editing && !isEditable(c, Date.now());
  rjCtx={cid,
         name: (c&&c.name) || opts.name || '',
         holdingId: opts.holdingId || (c&&c.linkedHoldingId) || null,
         editing,
         forceReason: opts.reason || null};

  $('rj-title').textContent = editing ? `${c.name} · 기각 기록 수정`
                                      : `${rjCtx.name||'후보'} · 기각 등재`;
  $('rj-date').value  = (c&&c.rejectedDate) || opts.date || todayStr();
  $('rj-price').value = (c&&c.rejectPrice!=null?c.rejectPrice:(opts.price!=null?opts.price:''));
  $('rj-reason').value= (c&&c.rejectReason) || opts.reason || 'factor';
  $('rj-trigger').value=(c&&c.trigger) || '';
  $('rj-note').value  = (c&&c.note) || '';

  // thesis는 자동 등재 전용이라 드롭다운에 없다. 수정 모드에서만 임시 옵션으로 노출한다.
  const sel=$('rj-reason');
  const tmp=sel.querySelector('option[value="thesis"]');
  if(tmp) tmp.remove();
  if(c && c.rejectReason==='thesis'){
    const o=document.createElement('option');
    o.value='thesis'; o.textContent=REJECT_LABELS.thesis;
    sel.appendChild(o); sel.value='thesis';
  }

  ['rj-date','rj-price','rj-reason'].forEach(id=>{ $(id).disabled=locked; });
  $('rj-locked').style.display = locked ? 'block' : 'none';
  $('rj-save').textContent = editing ? '수정 저장' : '기각 등재';
  $('rjModal').style.display='flex';
}

$('rj-close').addEventListener('click', ()=>{ $('rjModal').style.display='none'; });

$('pl-save-reject').addEventListener('click', ()=>{
  const name=$('pl-name').value.trim();
  if(!name){ setStatus('종목명을 입력하세요',true); return; }
  $('plModal').style.display='none';
  openRejectModal(null, {name});
});

$('rj-save').addEventListener('click', ()=>{
  const trigger=$('rj-trigger').value.trim();
  if(!trigger){ setStatus('재검토 트리거를 적어주세요 — 없으면 3년 뒤 검증할 대상이 없습니다',true); return; }
  let c = rjCtx.cid ? candidates.find(x=>x.id===rjCtx.cid) : null;
  if(!c){
    // 후보 객체는 여기서 만든다 — 모달을 열 때 만들면 닫았을 때 유령 검토중 항목이 남는다
    if(!rjCtx.name){ setStatus('종목명이 없습니다',true); return; }
    c = newCandidate(rjCtx.name);
    rjCtx.cid = c.id;
  }

  const locked = rjCtx.editing && !isEditable(c, Date.now());
  if(!locked){
    const price=numVal('rj-price');
    if(isNaN(price)||price<=0){ setStatus('당시 주가를 입력하세요',true); return; }
    if(!$('rj-date').value){ setStatus('기각일을 입력하세요',true); return; }
    c.rejectedDate=$('rj-date').value;
    c.rejectPrice=price;
    c.rejectReason = rjCtx.forceReason || $('rj-reason').value;   // thesis는 드롭다운에 없다
  }
  c.trigger=trigger;
  c.note=$('rj-note').value.trim();
  if(!rjCtx.editing){
    c.status='rejected';
    c.rejectedAt=Date.now();          // 유예·소급 판정의 유일한 기준
    c.linkedHoldingId=rjCtx.holdingId;
    c.verify=null;
  }
  save(); render();
  $('rjModal').style.display='none';
  setStatus((rjCtx.editing?'기각 기록 수정됨: ':'기각 등재됨: ')+c.name);
});
```

`bindPipeline()` 안에 핸들러 두 개를 추가한다 (기존 `data-pldel` 블록 뒤):

```js
  document.querySelectorAll('[data-plrej]').forEach(b=>b.addEventListener('click',()=>{
    openRejectModal(b.dataset.plrej);
  }));
  document.querySelectorAll('[data-pledit]').forEach(b=>b.addEventListener('click',()=>{
    openRejectModal(b.dataset.pledit);
  }));
```

- [ ] **Step 3: 동작을 확인한다**

브라우저에서:
1. 검토중 항목의 `기각` → 모달, 기각일 오늘, 트리거 비운 채 저장 → 경고
2. 주가 `142`, 사유 `팩터 중복`, 트리거 입력 → 저장 → 기각 목록으로 이동, 헤더 카운트 이동
3. `✎ 수정` → 기각일·주가·사유가 **활성**(14일 이내), 값 바꿔 저장 → 반영
4. `+ 후보 등록` → 이름 입력 → `바로 기각 등재` → 기각 모달이 바로 뜨고 저장 시 기각으로 등재

잠김 경로 확인 — 콘솔에서 등재 시각을 15일 전으로 되돌린다:

```js
const s=JSON.parse(localStorage.getItem('kelly2y'));
s.candidates.find(c=>c.status==='rejected').rejectedAt = Date.now()-15*864e5;
localStorage.setItem('kelly2y',JSON.stringify(s)); location.reload();
```

기대: `삭제` 버튼 사라짐, `✎ 트리거·메모`로 라벨 변경, 모달 열면 기각일·주가·사유가 비활성 + 잠김 안내, 트리거만 저장됨.

- [ ] **Step 4: 커밋**

```bash
git add index_kelly.html
git commit -m "feat(kelly): add rejection entry with 14-day grace lock

트리거를 필수로 둔 것은 구체적 숫자가 없으면 3년 뒤 검증할
대상 자체가 없기 때문이다. 유예 기준을 rejectedAt으로 잡은 것은
후보 등록 시각을 쓰면 오래 검토한 종목이 기각 즉시 잠기기 때문."
```

---

### Task 6: 3년 검증 모달

**Files:**
- Modify: `index_kelly.html` — 모달 마크업(`rjModal` 뒤), 스크립트(`rj-save` 핸들러 뒤)

**Interfaces:**
- Consumes: `verifyDaysLeft` (Task 1), `bindPipeline`·`todayStr` (Task 4), `VERDICT_LABELS` (Task 3), 기존 `fmtNum(n)`(`:1295`), `escapeHtml(s)`(`:1294`), `numVal(id)`(`:537`)
- Produces: `openVerifyModal(cid) -> void`

- [ ] **Step 1: 검증 모달 마크업을 넣는다**

`rjModal` 닫는 `</div>` **바로 뒤**에 삽입:

```html
<!-- 3년 검증 모달 -->
<div class="modal-bg" id="vfModal" style="display:none">
  <div class="modal" style="max-width:400px;">
    <div class="modal-head">
      <span id="vf-title">3년 검증</span>
      <span class="modal-x" id="vf-close">✕</span>
    </div>
    <div class="re-intro" id="vf-intro"></div>
    <div class="fld" style="margin-top:12px;"><label>현재가 ($)</label>
      <input id="vf-price" inputmode="decimal"></div>
    <div class="fld" style="margin-top:10px;">
      <label>판정</label>
      <select id="vf-verdict" style="background:var(--panel-2);border:1px solid var(--line);
        color:var(--ink);border-radius:8px;padding:9px;font-size:12.5px;">
        <option value="right">기각이 옳았다</option>
        <option value="wrong">기각이 틀렸다</option>
        <option value="unclear">판단 보류</option>
      </select>
    </div>
    <div class="fld" style="margin-top:10px;">
      <label>메모</label>
      <textarea id="vf-note" rows="2"
        style="background:var(--panel-2);border:1px solid var(--line);color:var(--ink);
        border-radius:8px;padding:10px;font-size:12.5px;font-family:inherit;resize:vertical;"></textarea>
    </div>
    <div class="keep-note" style="margin-top:10px;">
      기각이 틀렸다면 <b>TOOL 03의 r·N 가정</b>을 재검토하세요.
      요구수익률이나 moat 지속기간 추정이 실제와 어긋났다는 신호입니다.
    </div>
    <button class="btn primary" id="vf-save">검증 저장</button>
  </div>
</div>
```

- [ ] **Step 2: 검증 로직을 구현한다**

`$('rj-save').addEventListener(...)` 블록 **바로 뒤**에 삽입:

```js
let vfCid=null;

function openVerifyModal(cid){
  const c=candidates.find(x=>x.id===cid); if(!c) return;
  vfCid=cid;
  $('vf-title').textContent=`${c.name} · 3년 검증`;
  $('vf-intro').innerHTML=
    `기각 시점 <b>${c.rejectedDate}</b> · $${fmtNum(c.rejectPrice)}<br>`+
    `당시 트리거: ${escapeHtml(c.trigger||'—')}`;
  $('vf-price').value=(c.verify&&c.verify.price!=null)?c.verify.price:'';
  $('vf-verdict').value=(c.verify&&c.verify.verdict)||'right';
  $('vf-note').value=(c.verify&&c.verify.note)||'';
  $('vfModal').style.display='flex';
}

$('vf-close').addEventListener('click', ()=>{ $('vfModal').style.display='none'; });

$('vf-save').addEventListener('click', ()=>{
  const c=candidates.find(x=>x.id===vfCid); if(!c) return;
  const price=numVal('vf-price');
  if(isNaN(price)||price<=0){ setStatus('현재가를 입력하세요',true); return; }
  c.verify={date:todayStr(), price, verdict:$('vf-verdict').value, note:$('vf-note').value.trim()};
  save(); render();
  $('vfModal').style.display='none';
  setStatus('검증 기록됨: '+c.name);
});
```

`bindPipeline()` 안에 핸들러를 추가한다:

```js
  document.querySelectorAll('[data-plvf]').forEach(b=>b.addEventListener('click',()=>{
    openVerifyModal(b.dataset.plvf);
  }));
```

- [ ] **Step 3: 검증 완료 항목도 다시 열 수 있게 한다**

`renderPipeline()`에서 `if(c.verify){ vBadge=... }` 분기를 교체 — 검증 완료 후에도 재열람·수정이 가능해야 한다:

```js
      if(c.verify){
        vBadge=`<span class="pl-badge done">✓ 검증 완료</span>`;
        vAct=`<button class="btn ghost" data-plvf="${c.id}">검증 보기</button>`;
      } else if(left!==null && left<=0){
```

- [ ] **Step 4: 동작을 확인한다**

콘솔로 검증 기준일이 지난 항목을 만든다:

```js
const s=JSON.parse(localStorage.getItem('kelly2y'));
const c=s.candidates.find(x=>x.status==='rejected');
c.rejectedDate='2023-05-02'; c.rejectPrice=210;
localStorage.setItem('kelly2y',JSON.stringify(s)); location.reload();
```

기대:
1. `🔍 검증 필요` 배지 + `검증` 버튼
2. 모달에 기각 시점 `2023-05-02 · $210`과 당시 트리거가 표시됨
3. 현재가 `310`, 판정 `기각이 틀렸다` → 저장
4. 카드에 `$210 → $310 (+48%) · 기각이 틀렸음`, 배지가 `✓ 검증 완료`, 버튼은 `검증 보기`

- [ ] **Step 5: 커밋**

```bash
git add index_kelly.html
git commit -m "feat(kelly): add three-year rejection verification

기각 판단이 반증되어도 RIM 모델의 r·moat duration 가정으로
피드백이 돌아갈 경로가 없었다. 검증 모달에서 TOOL 03 재검토를
명시해 원장을 기록이 아니라 학습 장치로 만든다."
```

---

### Task 7: 편입 연결

**Files:**
- Modify: `index_kelly.html:856-873` (`addBtn` 핸들러), 스크립트(`bindPipeline` 내부)

**Interfaces:**
- Consumes: `bindPipeline` (Task 4)
- Produces: 전역 `pendingAdoptId: string|null`

- [ ] **Step 1: 전역 플래그를 선언한다**

`let rejIntroDate=0;` (Task 2) **바로 뒤**에 추가:

```js
let pendingAdoptId=null;   // 편입 진행 중인 후보 id — holdings 생성이 확정된 뒤에만 지운다
```

- [ ] **Step 2: 편입 버튼을 붙인다**

`bindPipeline()` 안에 추가:

```js
  document.querySelectorAll('[data-pladopt]').forEach(b=>b.addEventListener('click',()=>{
    const c=candidates.find(x=>x.id===b.dataset.pladopt); if(!c) return;
    pendingAdoptId=c.id;
    $('i-name').value=c.name;
    $('i-name').scrollIntoView({behavior:'smooth', block:'center'});
    $('i-price').focus();
    setStatus(`${c.name} 편입 — 가격·목표·승률을 입력하고 추가하세요`);
  }));
```

- [ ] **Step 3: 종목 추가가 성공한 뒤에만 후보를 지운다**

`index_kelly.html:869-872`의 `holdings.push(...)` 직후 블록을 교체한다. 폼 이동 시점에 지우면 사용자가 입력을 중단했을 때 후보가 소실된다:

```js
  holdings.push({id:Date.now().toString(36),name,price,up,down,prob,startQ,ccy:useCcy,fx,ledger:[]});
  if(pendingAdoptId){
    candidates=candidates.filter(x=>x.id!==pendingAdoptId);   // 편입 확정 후에만 제거
    pendingAdoptId=null;
  }
  save();render();
```

- [ ] **Step 4: 동작을 확인한다**

1. 검토중 항목의 `편입` → 종목 추가 폼으로 스크롤, 종목명 프리필, 상태 메시지
2. **여기서 아무것도 하지 않고 페이지 새로고침** → 후보가 검토중에 그대로 남아 있어야 한다
3. 다시 `편입` → 가격·목표·승률 입력 → `추가` → 보유 목록에 생기고 검토중에서 사라짐
4. 헤더: 검토중 −1, 편입 +1, 기각률 분모 +1

- [ ] **Step 5: 커밋**

```bash
git add index_kelly.html
git commit -m "feat(kelly): link candidate adoption to holding creation

후보 삭제를 폼 이동 시점이 아니라 holdings 생성 직후로 미룬다.
입력을 중단하면 후보가 증발해 대기열에서 사라지기 때문이다."
```

---

### Task 8: thesis 파기 자동 등재와 재진입 차단

교훈 4의 핵심 규율 — thesis 파기로 청산한 종목의 재진입은 새 1칸이다.

**Files:**
- Modify: `index_kelly.html:1632-1681` (`lm-save` 핸들러), `:856-873` (`addBtn`), `openLogModal` 진입부

**Interfaces:**
- Consumes: `openRejectModal(cid, opts)` (Task 5), `todayStr` (Task 4), 기존 `ledgerStats(h)`(`:625`)
- Produces: `normName(s) -> string`, `thesisRejectOf(holdingId) -> candidate|undefined`, `thesisRejectByName(name) -> candidate|undefined`

- [ ] **Step 1: 조회 헬퍼를 구현한다**

`renderPipeline()` **바로 앞**에 삽입:

```js
function normName(s){ return (s||'').replace(/\s+/g,'').toLowerCase(); }
function thesisRejectOf(holdingId){
  return candidates.find(c=>c.status==='rejected' && c.rejectReason==='thesis'
                           && c.linkedHoldingId===holdingId);
}
function thesisRejectByName(name){
  const n=normName(name);
  return candidates.find(c=>c.status==='rejected' && c.rejectReason==='thesis'
                           && normName(c.name)===n);
}
```

- [ ] **Step 2: 전량 청산 시 자동 등재한다**

`index_kelly.html:1678-1680`의 신규 엔트리 저장 블록을 교체:

```js
  h.ledger.push(entry);
  save(); $('logModal').style.display='none'; render();
  setStatus((type==='buy'?'매수':type==='sell'?'매도':'보류')+' 기록됨');

  // thesis 파기 + 전량 청산 = 칸 회수. 기각 원장에 등재한다.
  if(type==='sell'){
    const sr=entry.sellReason;
    const thesisBroken=(sr==='thesis'||sr==='criteria'||sr==='better');
    if(thesisBroken && ledgerStats(h).netShares<=0 && !thesisRejectOf(h.id)){
      openRejectModal(null, {name:h.name, price:entry.price, date:entry.date||todayStr(),
                             reason:'thesis', holdingId:h.id});
      $('rj-title').textContent=`${h.name} · 칸 회수`;
      $('rj-intro').textContent=
        'thesis 파기로 청산했습니다. 기각 원장에 등재됩니다. 재진입은 새 1칸입니다.';
      $('rj-reason').disabled=true;   // 사유는 rjCtx.forceReason='thesis'로 고정
    }
  }
```

Task 5의 `openRejectModal`이 이미 `opts.reason`을 `rjCtx.forceReason`으로 받고 `rj-save`가 그것을 드롭다운보다 우선하므로, 여기서 추가로 배선할 것은 없다. 모달을 닫아도 후보 객체가 생기지 않는다(Task 5) — 대신 청산 기록만 남고 칸 회수는 기록되지 않으므로, 취소했다면 `+ 후보 등록 → 바로 기각 등재`로 수동 등재한다.

- [ ] **Step 3: 재진입 시 새 항목을 강제한다**

`index_kelly.html:862`의 `if(!name){...}` 검사 **바로 뒤**에 삽입:

```js
  const prior=thesisRejectByName(name);
  if(prior && !confirm(
      `${name}은(는) ${prior.rejectedDate}에 thesis 파기로 청산한 종목입니다.\n\n`+
      `재진입은 새 1칸을 씁니다. 기존 기록에 이어 붙지 않고 새 항목으로 추가됩니다.\n`+
      `한 번 틀렸던 회사이므로 검증 기준을 더 높게 잡으세요.\n\n진행할까요?`)) return;
```

- [ ] **Step 4: 우회 경로를 막는다**

thesis 청산 후에도 원 종목은 historical 행으로 남고(`index_kelly.html:1012`) 그 행의 기록 모달에서 새 매수를 추가할 수 있다. 이 경로로 들어가면 Step 3의 경고가 발동하지 않는다.

`openLogModal(hid, qkey)` 함수 진입부 — `const h=holdings.find(...)` 다음 줄에 삽입:

```js
  if(thesisRejectOf(h.id)){
    setStatus('thesis 파기로 청산한 종목입니다 — 재진입은 [종목 추가]로 새로 등록하세요',true);
    return;
  }
```

기존 기록의 수정(`openLogModalEdit`)과 열람은 그대로 둔다. 새 기록만 막는다.

- [ ] **Step 5: 동작을 확인한다**

1. 종목을 하나 추가하고 매수 기록 → 전량 매도, 사유 `원 논지 훼손`
2. 매도 저장 직후 **칸 회수 모달**이 뜬다. 주가·날짜가 매도 기록에서 프리필됨
3. 트리거 입력 후 저장 → 기각 목록에 사유 `thesis 파기 청산`으로 등재, 헤더 `칸 회수 1`
4. 기각률은 변하지 않는다 (thesis는 분자 제외)
5. 같은 이름으로 `종목 추가` → 새 1칸 경고 확인창. 진행하면 **새 행**이 생긴다
6. 청산된 historical 행을 펼쳐 새 기록 시도 → 차단 메시지, 모달 안 열림
7. 그 행의 기존 기록 `✎ 수정`은 여전히 열린다

- [ ] **Step 6: 커밋**

```bash
git add index_kelly.html
git commit -m "feat(kelly): auto-log thesis liquidation as punch recovery

칸이 뚫리는 순간은 thesis 확정 시점이므로 thesis 파기 청산은
칸 회수다. 회수 사실이 남지 않으면 재진입이 공짜로 보이고,
8분기 동안 되돌릴 수 있다는 이 시스템의 우위가 소멸한다.
historical 행의 기록 모달도 막아야 경고를 우회할 수 없다."
```

---

### Task 9: PRD 갱신

**Files:**
- Modify: `PRD.md` — §2(원칙), §4.4, §5(키 레지스트리), §7(결정 기록), §8(드리프트), §9(백로그)

- [ ] **Step 1: §2에 P8을 추가한다**

`**P7. 플랫 파일 규칙**` 문단 **바로 뒤**에 삽입:

```markdown
**P8. 칸 회계** — 신규 편입 전 첫 질문은 "좋은 회사인가"가 아니라 **"이미 뚫린 칸과 다른 칸인가"**다. 인적자본(반도체 커리어·성과급)은 되돌릴 수 없는 1칸으로 계상한다 — 금융자본보다 큰 칸이며 이직 외에는 줄일 수단이 없다. 기각 판단은 기록되어야 반증 가능하다: 기각 사유·당시 주가·재검토 트리거가 남지 않으면 3년 뒤 밸류에이션 가정(§4.3의 `r`·`N`)으로 피드백이 돌아가지 못한다. *배경: TOOL 04 후보 파이프라인(§4.4).*
```

- [ ] **Step 2: §4.4에 후보 파이프라인 절을 추가한다**

`**저장**: 키 `kelly2y` (단일 통합 상태).` 줄 **바로 앞**에 삽입:

```markdown
**후보 파이프라인 계층** (기각 원장):
- `candidates[]`에 **안 산 것들**만 담는다 — `reviewing`(검토중) / `rejected`(기각). 편입되면 `candidates`에서 지우고 `holdings`로 옮기므로 같은 사실이 두 곳에 저장되지 않는다.
- 기각 사유 6종: `factor`(팩터 중복·이미 뚫린 칸) / `circle` / `premium` / `valuation` / `thesis`(자동 등재) / `abandoned`.
- **재검토 트리거 필수** — "PBR 6배 이하로 오면 재검토"처럼 구체적 숫자가 있어야 3년 뒤 검증이 판정 가능하다.
- **3년(1095일) 검증**: 기준일 도달 시 배지 전환 → 현재가·판정·메모 기록. 모달에 *"기각이 틀렸다면 TOOL 03의 r·N 가정을 재검토하세요"* 를 고정 표시한다.
- **기각률** = (thesis 제외 기각) / (thesis 제외 기각 + 도입 이후 편입). `thesis`는 산 적 있는 종목이라 분자·분모에 이중 계상되므로 제외하고, **칸 회수** 지표로 따로 센다. 분모의 "도입 이후"는 `parseInt(h.id,36)`로 생성 시각을 역산해 거른다.
- **14일 유예**: 기각 등재 후 14일 이내는 삭제·전체 수정 자유, 이후 트리거·메모만 수정 가능. 기준 시각은 `rejectedAt`(등재 시각)이다 — `id`(후보 등록 시각)를 쓰면 오래 검토한 종목이 기각 즉시 잠긴다. 같은 상수로 `rejectedAt`과 `rejectedDate`가 14일 이상 벌어지면 `[소급 등록]` 배지를 단다.
- **칸 회수 강제**: thesis 파기 전량 청산 시 기각 자동 등재. 같은 이름 재진입은 새 항목으로 강제하고, 청산된 historical 행에는 새 매수 기록을 막는다.
- **검토 시작일은 입력받지 않는다** — 등록 시각으로 자동 기록. 기억 기반 소급 날짜는 부정확하고 진척을 아는 상태에서 유리하게 적힐 수 있다.
```

- [ ] **Step 3: §5 키 레지스트리를 갱신한다**

켈리 플래너 행을 교체:

```markdown
| 켈리 플래너 | `kelly2y` | 포트폴리오·원장·후보 파이프라인(`candidates`)·도입일(`rejIntroDate`)·설정 통합 상태 (v4) |
```

- [ ] **Step 4: §7에 D15·D16을 추가한다**

결정 기록 표 마지막 행 뒤에 추가:

```markdown
| D15 | '1칸' 소모를 정의표로 명문화(아래) | 정의 없이 관행에 맡김 | 정의가 없으면 규율이 아니라 분위기다. 특히 "thesis 파기 후 재진입 = 새 1칸"이 규율의 전부 — "예전에 봤던 회사니까"는 칸을 아껴주지 않는다 |
| D16 | 후보를 `candidates[]` 별도 배열로 | `holdings[]`에 `status:'rejected'` 추가 | `holdings`는 `price`·`up`·`down`·`prob`가 필수인데 Circle 단계나 팩터 중복으로 기각한 후보는 그 숫자를 계산한 적이 없다. 억지로 채우면 거짓 데이터, 비우면 `kellyOf()`·정규화·40% 캡에 `null`이 흘러든다 |
| D17 | 칸 카운터 UI 기각 | "20칸 중 N칸 사용" 표시 | 펀치카드는 자본이 크고 아이디어가 희소해진 후기 버핏의 프레임이다. 성과급이 매년 유입되는 상황과 어긋나므로 20이라는 숫자를 UI에 박으면 이미 기각한 전제를 코드에 고정하게 된다. 추적할 것은 칸 개수가 아니라 **칸의 중복도** |
```

표 아래에 정의표를 추가:

```markdown
**D15 부속 — '1칸' 소모 정의표**

| 행위 | 칸 소모 |
|---|---|
| 새 기업 최초 편입 | **1칸** |
| 8분기 분할 매수 (같은 종목) | 0칸 — 1칸 안의 절차 |
| 밸류에이션 기반 분할 매도 후 재매수 | 0칸 — thesis 유지 중 |
| **thesis 파기 후 청산 → 나중에 재진입** | **새 1칸** |
| 매크로 ETF 바스켓 (예: 구리 4종) | 테마당 1칸, 종목당 아님 |

칸이 뚫리는 순간은 1차 매수 시점이 아니라 **thesis를 확정한 순간**이다. 따라서 분할매수 도중 tranche를 건너뛰는 것은 **칸을 회수하는 행위**다. 원본 펀치카드는 되돌릴 수 없지만 이 시스템은 8분기 동안 되돌릴 수 있다 — 회수를 한 번도 하지 않으면 그 우위가 소멸한다.
```

- [ ] **Step 5: §8 드리프트에 원장 삭제 항목을 추가한다**

`**문서 드리프트 (2026-07-10 기준)**` 문단 끝에 추가:

```markdown
§4.4의 *"과거 기록은 값 수정(✎)만 허용, 삭제 후 재입력 불가"* 는 **코드와 어긋난다.** `index_kelly.html:1144, 1153, 1169`에서 모든 원장 항목에 ✕ 버튼이 조건 없이 렌더되고 `1272-1276` 핸들러는 확인창도 없이 삭제한다. D8이 실제로 강제하는 것은 **분기 순서**뿐이다. 후보 파이프라인의 14일 유예(§4.4)는 이 기존 정책과의 일관성이 아니라 기각 원장에 특별히 필요한 증거력을 근거로 도입된 것이다.
```

- [ ] **Step 6: §9 백로그에 기각 조건을 추가한다**

백로그 목록 끝에 추가:

```markdown
- **후보 파이프라인 기각 조건 점검 (2029-08 예정)** — 도입 3년 시점에 ① 기각 건 0 ② 기각률 50% 미만 ③ 검토중 항목이 전부 1년 이상 미결 ④ 3년 검증 완료 0 중 하나라도 해당하면 이 기능은 규율이 아니라 사후 서사로 쓰이고 있는 것이므로 재검토한다
```

- [ ] **Step 7: 전체 회귀 검증**

```bash
node test_pipeline.js
```
예상: `OK  20 pass`

브라우저에서 `index.html` → 각 도구를 한 번씩 열어 콘솔 에러가 없는지 확인한다.

- [ ] **Step 8: 커밋**

```bash
git add PRD.md
git commit -m "docs(prd): record candidate pipeline decisions

칸 회계를 원칙으로 승격하고 '1칸' 정의를 명문화한다. 정의가
없으면 규율이 아니라 분위기다. 원장 삭제 서술이 코드와 어긋난
것도 드리프트로 기록한다."
```

---

## 완료 후

브랜치 `feat/rejection-ledger`를 `main`에 병합하면 GitHub Pages에 배포된다. 병합 전 마지막으로 확인할 것:

- `node test_pipeline.js` 통과
- 기존 `kelly2y` 데이터로 열었을 때 종목·원장 손실 없음
- 새로고침 두 번에 `rejIntroDate`가 불변
- export → import 왕복 후 `candidates` 보존
