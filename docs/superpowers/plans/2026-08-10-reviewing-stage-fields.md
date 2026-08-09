# 검토중 단계 정보 입력 — 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 검토중 후보에 계기·진행 체크·작업 메모를 담고, 계기를 편입 시 보유 종목의 원 논지로 승계한다.

**Architecture:** `index_kelly.html` 단일 파일에 필드 3개(`origin`·`stage`·`reviewNote`)와 `holdings.thesis` 1개를 추가한다. 분기 로직은 `PIPELINE PURE` 블록의 순수 함수 2개(`stageOf`·`stripReviewFields`)로 빼서 `test_pipeline.js`가 DOM 없이 검증하고, DOM 경로는 `selfcheck-rejection-ledger.js`가 headless Chrome에서 검증한다. 모든 신규 필드는 선택적이라 스냅샷 버전은 v4 그대로이고 마이그레이션이 없다.

**Tech Stack:** vanilla JS · 빌드 없음 · 의존성 없음. 테스트는 `node test_pipeline.js`(순수)와 headless Chrome DOM 덤프(`selfcheck`).

**설계 정본:** `docs/superpowers/specs/2026-08-10-reviewing-stage-fields-design.md`

## Global Constraints

- **파일을 새로 만들지 않는다.** 모든 코드 변경은 `index_kelly.html` 한 파일 안이다 (PRD §7-D2 플랫 규칙).
- **외부 CDN·프레임워크·패키지 추가 금지.** 오프라인 단일파일 원칙.
- **신규 필드는 전부 선택적.** 스냅샷 `v:4` 유지, `migrateCandidates`를 건드리지 않는다.
- **사용자 입력 문자열은 렌더 시 `escapeHtml()` 필수.** 파일 내 기존 관행이다.
- **디자인 토큰만 쓴다**: `var(--ink)` `var(--dim)` `var(--faint)` `var(--line)` `var(--accent)`(`#00d4a0`) `var(--mono)`. 새 색상 리터럴 금지.
- **커밋 메시지**: Conventional Commits, 제목 명령형 50자 이내, 본문은 *왜*. AI 저작 푸터 없음.
- **각 태스크는 커밋으로 끝난다.** 사용자가 별도로 push를 요청하기 전까지 push하지 않는다.
- **`todayStr()`의 UTC 기준을 바꾸지 않는다** (PRD §8 — 파일 내 5곳과 같은 관행).

---

### Task 1: 순수 헬퍼 2개 — `stageOf` · `stripReviewFields`

**Files:**
- Modify: `index_kelly.html:662-737` (`PIPELINE PURE` 블록 안, `needsPunchBack` 뒤)
- Modify: `test_pipeline.js:7-9` (export 목록)
- Test: `test_pipeline.js` (신규 그룹 2개)

**Interfaces:**
- Produces: `stageOf(c) -> {circle:boolean, premium:boolean, val:boolean}` — `c.stage`가 없거나 부분적이어도 항상 세 키를 채운 새 객체를 준다.
- Produces: `stripReviewFields(c, editing) -> c` — `editing`이 거짓일 때만 `c.stage`와 `c.reviewNote`를 삭제한다. `c.origin`은 절대 건드리지 않는다. 인자를 그대로 변형하고 반환한다.

- [ ] **Step 1: export 목록에 두 이름을 추가한다**

`test_pipeline.js:7-9`의 `return {...}` 를 아래로 바꾼다:

```js
  return {GRACE_MS, VERIFY_DAYS, isEditable, isSeeded, verifyDaysLeft, rejectionStats, migrateCandidates,
          isThesisBroken, isThesisReject, livePlanHoldings, pctClamp, needsPunchBack,
          stageOf, stripReviewFields};
```

- [ ] **Step 2: 실패하는 테스트를 쓴다**

`test_pipeline.js` 맨 아래 결과 출력부(`console.log('\nOK ...')` 등) **바로 앞**에 붙인다:

```js
/* ---- stageOf ---- */
grp('stageOf (검토 진행 체크)');
{
  eq('stage 없으면 전부 false', api.stageOf({}), {circle:false, premium:false, val:false});
  eq('부분 지정은 나머지 false', api.stageOf({stage:{circle:true}}),
     {circle:true, premium:false, val:false});
  eq('truthy를 불리언으로 정규화', api.stageOf({stage:{circle:1, premium:'y', val:0}}),
     {circle:true, premium:true, val:false});
  const src0 = {stage:{circle:true}};
  const out = api.stageOf(src0);
  out.circle = false;
  eq('원본을 변형하지 않는다 (새 객체)', src0.stage.circle, true);
}

/* ---- stripReviewFields ---- */
grp('stripReviewFields (기각 시 작업 기억 폐기)');
{
  const c = {id:'a', name:'X', origin:'해자', stage:{circle:true}, reviewNote:'메모'};
  api.stripReviewFields(c, false);
  eq('stage 삭제', c.stage, undefined);
  eq('reviewNote 삭제', c.reviewNote, undefined);
  eq('origin 유지', c.origin, '해자');
  eq('name 유지', c.name, 'X');

  const d = {id:'b', origin:'해자', stage:{circle:true}, reviewNote:'메모'};
  api.stripReviewFields(d, true);
  eq('수정(editing)이면 stage 유지', d.stage, {circle:true});
  eq('수정(editing)이면 reviewNote 유지', d.reviewNote, '메모');

  const e = {id:'c', origin:'해자'};
  api.stripReviewFields(e, false);
  eq('없는 필드를 지워도 안전하다', e, {id:'c', origin:'해자'});
}
```

- [ ] **Step 3: 실패를 확인한다**

Run: `node test_pipeline.js`
Expected: FAIL — `api.stageOf is not a function` 로 예외가 나거나, export 추가 단계에서 `stageOf is not defined` 로 죽는다. 둘 중 무엇이든 **통과가 아니면 된다.**

- [ ] **Step 4: 최소 구현을 넣는다**

`index_kelly.html`의 `needsPunchBack` 함수 정의 **뒤**, `/* ===== /PIPELINE PURE ===== */`(`:737`) **앞**에 붙인다:

```js
/* 검토 진행 체크 — 없거나 부분적이어도 세 키를 채워 돌려준다.
   렌더와 토글 핸들러가 같은 모양을 보게 하려고 한 곳에 모았다. */
function stageOf(c){
  const s=(c&&c.stage)||{};
  return {circle:!!s.circle, premium:!!s.premium, val:!!s.val};
}

/* 기각 등재 시 검토용 작업 기억을 버린다(PRD §7-D19). 편입 때 버리는 것과 대칭이다.
   기존 기각 기록을 수정할 때는 애초에 이 필드들이 없으므로 건드리지 않는다. */
function stripReviewFields(c, editing){
  if(!editing){ delete c.stage; delete c.reviewNote; }
  return c;
}
```

- [ ] **Step 5: 통과를 확인한다**

Run: `node test_pipeline.js`
Expected: PASS — 마지막 줄이 `OK  67 pass` (기존 56 + 신규 11). 숫자가 다르면 테스트를 빠뜨린 것이다.

- [ ] **Step 6: 커밋**

```bash
git add index_kelly.html test_pipeline.js
git commit -m "feat(kelly): add stageOf and stripReviewFields helpers

검토 진행 체크와 기각 시 작업 기억 폐기 로직을 PIPELINE PURE 블록에 둔다.
이벤트 핸들러 안에 두면 test_pipeline.js가 DOM 없이 검증할 수 없다."
```

---

### Task 2: 후보 등록 팝업 — 계기(`origin`) 입력

**Files:**
- Modify: `index_kelly.html:559` (plModal 입력란 추가)
- Modify: `index_kelly.html:1789-1792` (`openAddCandidate` 리셋)
- Modify: `index_kelly.html:1794-1798` (`newCandidate` 시그니처)
- Modify: `index_kelly.html:1802-1809` (`pl-save-review` 핸들러)
- Test: `docs/superpowers/selfcheck-rejection-ledger.js` (신규 섹션 14)

**Interfaces:**
- Consumes: 없음
- Produces: `newCandidate(name, origin) -> candidate` — `origin`이 빈 문자열이거나 없으면 **필드를 만들지 않는다**. 기존 1인자 호출과 호환된다.
- Produces: `candidates[].origin` — trim 된 문자열. 없을 수 있다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`docs/superpowers/selfcheck-rejection-ledger.js`의 `} catch (e) {` **바로 앞**에 붙인다:

```js
    /* ---------- 14. 후보 등록 — 계기(origin) ----------
       계기는 선택 입력이다. 비우면 필드를 만들지 않아야 기존 데이터와 모양이 같다. */
    const cnt14 = candidates.length;
    openAddCandidate();
    $('pl-name').value = '__계기테스트';
    $('pl-origin').value = '  창고형 리테일 해자  ';
    $('pl-save-review').click();
    const c14 = candidates[candidates.length - 1];
    ok('계기가 trim 되어 저장된다', c14 && c14.origin === '창고형 리테일 해자',
       c14 && c14.origin);
    ok('후보가 1개 늘었다', candidates.length === cnt14 + 1,
       cnt14 + ' → ' + candidates.length);

    openAddCandidate();
    ok('팝업을 다시 열면 계기 칸이 비어 있다', $('pl-origin').value === '',
       $('pl-origin').value);
    $('pl-name').value = '__계기없음';
    $('pl-save-review').click();
    const c14b = candidates[candidates.length - 1];
    ok('계기를 비우면 필드를 만들지 않는다', !('origin' in c14b), JSON.stringify(c14b));
```

- [ ] **Step 2: 실패를 확인한다**

```sh
node docs/superpowers/build-selfcheck.js
python3 -m http.server 8765 --bind 127.0.0.1 &
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --disable-gpu --no-first-run --user-data-dir=/tmp/cp-t2 \
  --dump-dom http://127.0.0.1:8765/_selfcheck.html > /tmp/dom-t2.html
```

Chrome은 DOM을 뱉은 뒤에도 종료하지 않으므로 백그라운드로 돌리고 죽인다.
`/tmp/dom-t2.html` 에서 `id="selfcheck-panel"` 이후를 읽는다.
Expected: FAIL — `스크립트 실행 중 예외` 가 뜬다 (`$('pl-origin')` 이 `null` 이라 `.value` 접근에서 죽는다).

- [ ] **Step 3: 입력란을 추가한다**

`index_kelly.html:559` 의 종목명 줄 **뒤**에 붙인다:

```html
    <div class="fld" style="margin-top:10px;"><label>왜 보나 (선택)</label>
      <input class="txt" id="pl-origin" placeholder="예: 창고형 리테일 해자"></div>
```

- [ ] **Step 4: 리셋에 계기를 넣는다**

`index_kelly.html:1790` 의 `$('pl-name').value='';` **뒤**에 한 줄 추가:

```js
  $('pl-origin').value='';
```

- [ ] **Step 5: `newCandidate` 가 계기를 받게 한다**

`index_kelly.html:1794-1798` 를 아래로 바꾼다:

```js
function newCandidate(name, origin){
  const c={id:Date.now().toString(36), name, status:'reviewing', startDate:todayStr()};
  const o=(origin||'').trim();
  if(o) c.origin=o;          // 빈 값이면 필드를 만들지 않는다 — 기존 데이터와 모양을 맞춘다
  candidates.push(c);
  return c;
}
```

- [ ] **Step 6: 등록 핸들러가 계기를 넘기게 한다**

`index_kelly.html:1805` 의 `newCandidate(name);` 를 바꾼다:

```js
  newCandidate(name, $('pl-origin').value);
```

- [ ] **Step 7: 통과를 확인한다**

Step 2 와 같은 절차로 다시 돌린다.
Expected: PASS — 패널 머리글이 `전부 통과 · 62건` (기존 58 + 신규 4).

- [ ] **Step 8: 커밋**

```bash
git add index_kelly.html docs/superpowers/selfcheck-rejection-ledger.js
git commit -m "feat(kelly): capture why a candidate is being reviewed

며칠 지나면 후보에 넣은 이유가 기억나지 않는다. 발견한 순간이 가장 정확하므로
등록 시점에 받되, 선택 입력으로 두어 \"일단 이름만 적어두기\"의 가벼움을 지킨다."
```

---

### Task 3: 검토중 카드 — 계기 표시 + 진행 체크박스

**Files:**
- Modify: `index_kelly.html:179-193` 부근 (CSS 2줄 추가)
- Modify: `index_kelly.html:1763-1773` (검토중 카드 렌더)
- Modify: `index_kelly.html:1848-1878` (`bindPipeline` 에 토글 핸들러)
- Test: `docs/superpowers/selfcheck-rejection-ledger.js` (신규 섹션 15)

**Interfaces:**
- Consumes: `stageOf(c)` (Task 1), `candidates[].origin` (Task 2)
- Produces: `[data-plstage="<id>"][data-k="circle|premium|val"]` 체크박스 — `change` 시 `c.stage[k]` 를 갱신하고 `save()` 만 부른다.
- Produces: `.pl-origin` `.pl-stage` CSS 클래스

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`selfcheck-rejection-ledger.js` 의 `} catch (e) {` **바로 앞**에 붙인다:

```js
    /* ---------- 15. 검토중 카드 — 계기 표시 · 진행 체크 ---------- */
    candidates = [
      { id:'sg1', name:'AAA진행', status:'reviewing', startDate: iso(now - 30*D),
        origin:'창고형 리테일 해자', stage:{circle:true, premium:false, val:false} },
      { id:'sg2', name:'BBB무계기', status:'reviewing', startDate: iso(now - 10*D) }
    ];
    render();

    const card1 = [...document.querySelectorAll('#pl-body .pl-item')]
      .find(e => e.textContent.includes('AAA진행'));
    ok('계기가 카드에 렌더된다',
       !!card1 && card1.querySelector('.pl-origin')
       && card1.querySelector('.pl-origin').textContent.includes('창고형 리테일 해자'),
       card1 ? card1.textContent.slice(0, 60) : '카드 없음');

    const card2 = [...document.querySelectorAll('#pl-body .pl-item')]
      .find(e => e.textContent.includes('BBB무계기'));
    ok('계기가 없으면 그 줄이 없다',
       !!card2 && !card2.querySelector('.pl-origin'), '있음');

    const boxes = card1.querySelectorAll('[data-plstage="sg1"]');
    ok('체크박스 3개', boxes.length === 3, boxes.length);
    const circle = card1.querySelector('[data-plstage="sg1"][data-k="circle"]');
    const val    = card1.querySelector('[data-plstage="sg1"][data-k="val"]');
    ok('저장된 체크가 반영된다', circle.checked === true && val.checked === false,
       'circle=' + circle.checked + ' val=' + val.checked);

    val.checked = true;
    val.dispatchEvent(new Event('change', {bubbles:true}));
    ok('토글이 stage에 반영된다',
       candidates.find(c => c.id === 'sg1').stage.val === true,
       JSON.stringify(candidates.find(c => c.id === 'sg1').stage));
    ok('토글해도 다른 체크는 그대로',
       candidates.find(c => c.id === 'sg1').stage.circle === true, 'circle 꺼짐');

    const box2 = card2.querySelector('[data-plstage="sg2"][data-k="premium"]');
    box2.checked = true;
    box2.dispatchEvent(new Event('change', {bubbles:true}));
    ok('stage 없던 후보도 토글되면 생긴다',
       candidates.find(c => c.id === 'sg2').stage.premium === true,
       JSON.stringify(candidates.find(c => c.id === 'sg2').stage));
```

- [ ] **Step 2: 실패를 확인한다**

Task 2 Step 2 와 같은 절차 (`--user-data-dir=/tmp/cp-t3`).
Expected: FAIL — `계기가 카드에 렌더된다` 부터 여러 건 FAIL, 또는 `boxes.length` 가 0.

- [ ] **Step 3: CSS 를 추가한다**

`index_kelly.html:186` 의 `.pl-trigger{...}` 줄 **뒤**에 붙인다:

```css
  .pl-origin{font-size:11px;color:var(--dim);margin-top:5px;line-height:1.5;font-style:italic;}
  .pl-stage{display:flex;gap:10px;margin-top:7px;flex-wrap:wrap;}
  .pl-stage label{display:flex;align-items:center;gap:4px;font-size:11px;
    color:var(--dim);cursor:pointer;}
  .pl-stage input{accent-color:var(--accent);margin:0;}
```

`flex-wrap:wrap` 이 폰 폭에서 넘칠 때를 받아준다 (P3).

- [ ] **Step 4: 카드 렌더를 바꾼다**

`index_kelly.html:1763-1773` 의 `reviewing.forEach(...)` 블록 전체를 바꾼다:

```js
    reviewing.forEach(c=>{
      const days=Math.floor((now-Date.parse(c.startDate))/864e5);
      const st=stageOf(c);
      const box=(k,label)=>`<label><input type="checkbox" data-plstage="${c.id}" `
        +`data-k="${k}"${st[k]?' checked':''}>${label}</label>`;
      html+=`<div class="pl-item">
        <div class="pl-top"><span class="pl-name">${escapeHtml(c.name)}</span>
          <span class="pl-date">${days}일 · ${escapeHtml(c.startDate||'')}</span></div>
        ${c.origin?`<div class="pl-origin">“${escapeHtml(c.origin)}”</div>`:''}
        <div class="pl-stage">${box('circle','능력범위')}${box('premium','프리미엄')}${box('val','밸류에이션')}</div>
        <div class="pl-act">
          <button class="btn ghost" data-plrej="${c.id}">기각</button>
          <button class="btn ghost" data-pladopt="${c.id}">편입</button>
          <button class="btn ghost" data-plmemo="${c.id}">✎ 메모</button>
          <button class="btn ghost" data-pldel="${c.id}">삭제</button>
        </div></div>`;
    });
```

`data-plmemo` 버튼은 지금 아무 데도 안 물린다 — Task 4 에서 핸들러를 붙인다. 눌러도 아무 일이 없을 뿐 에러는 안 난다.

- [ ] **Step 5: 토글 핸들러를 붙인다**

`index_kelly.html` 의 `bindPipeline()` 안, `[data-plhist]` 핸들러 **뒤**에 붙인다:

```js
  document.querySelectorAll('[data-plstage]').forEach(b=>b.addEventListener('change',()=>{
    const c=candidates.find(x=>x.id===b.dataset.plstage); if(!c) return;
    c.stage=stageOf(c);                 // 없으면 세 키를 채워서 만든다
    c.stage[b.dataset.k]=b.checked;
    save();   // render()는 부르지 않는다 — 목록을 다시 그리면 모바일에서 스크롤이 튄다
  }));
```

- [ ] **Step 6: 통과를 확인한다**

Expected: PASS — `전부 통과 · 69건` (62 + 신규 7).

- [ ] **Step 7: 커밋**

```bash
git add index_kelly.html docs/superpowers/selfcheck-rejection-ledger.js
git commit -m "feat(kelly): show review progress on candidate cards"
```

본문:
```
목록에서 어느 종목이 어디까지 검토됐는지 안 보였다. TOOL 01/02/03 은 도구별
키가 분리돼 있어 자동 연동이 불가능하므로 수동 체크로 둔다.
```

---

### Task 4: 메모 모달 — `origin`·`reviewNote` 편집

**Files:**
- Modify: `index_kelly.html:626` 부근 (histModal **뒤**에 신규 모달 마크업)
- Modify: `index_kelly.html` (`openHistModal` 정의 뒤에 `openMemoModal` 추가)
- Modify: `index_kelly.html` (`bindPipeline` 에 `[data-plmemo]` 핸들러)
- Test: `docs/superpowers/selfcheck-rejection-ledger.js` (신규 섹션 16)

**Interfaces:**
- Consumes: `[data-plmemo="<id>"]` 버튼 (Task 3)
- Produces: `openMemoModal(cid)` — `memoModal` 을 열고 `mm-origin`·`mm-note` 를 채운다.
- Produces: `candidates[].reviewNote` — trim 된 문자열. 비면 필드를 지운다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`selfcheck-rejection-ledger.js` 의 `} catch (e) {` **바로 앞**에 붙인다:

```js
    /* ---------- 16. 메모 모달 — 계기·작업 메모 편집 ---------- */
    candidates = [
      { id:'mm1', name:'MMM메모', status:'reviewing', startDate: iso(now - 5*D),
        origin:'원래 계기', reviewNote:'원래 메모' }
    ];
    render();
    document.querySelector('[data-plmemo="mm1"]').click();
    ok('메모 모달이 열린다', $('memoModal').style.display === 'flex',
       $('memoModal').style.display);
    ok('계기가 채워져 있다', $('mm-origin').value === '원래 계기', $('mm-origin').value);
    ok('메모가 채워져 있다', $('mm-note').value === '원래 메모', $('mm-note').value);

    $('mm-origin').value = '  고친 계기  ';
    $('mm-note').value   = '  고친 메모  ';
    $('mm-save').click();
    const mm = candidates.find(c => c.id === 'mm1');
    ok('계기가 trim 되어 저장된다', mm.origin === '고친 계기', mm.origin);
    ok('메모가 trim 되어 저장된다', mm.reviewNote === '고친 메모', mm.reviewNote);
    ok('저장하면 모달이 닫힌다', $('memoModal').style.display === 'none',
       $('memoModal').style.display);
    ok('카드에 고친 계기가 반영된다',
       $('pl-body').textContent.includes('고친 계기'), $('pl-body').textContent.slice(0,60));

    document.querySelector('[data-plmemo="mm1"]').click();
    $('mm-origin').value = '';
    $('mm-note').value   = '';
    $('mm-save').click();
    const mm2 = candidates.find(c => c.id === 'mm1');
    ok('비우면 origin 필드를 지운다', !('origin' in mm2), JSON.stringify(mm2));
    ok('비우면 reviewNote 필드를 지운다', !('reviewNote' in mm2), JSON.stringify(mm2));

    document.querySelector('[data-plmemo="mm1"]').click();
    $('memoModal').click();      // 배경 클릭 — 강제가 아니므로 닫힌다
    ok('배경 클릭으로 닫힌다', $('memoModal').style.display === 'none',
       $('memoModal').style.display);
```

- [ ] **Step 2: 실패를 확인한다**

Expected: FAIL — `스크립트 실행 중 예외` (`$('memoModal')` 이 `null`).

- [ ] **Step 3: 모달 마크업을 추가한다**

`index_kelly.html` 의 histModal 닫는 `</div>`(`:626`) **뒤**에 붙인다:

```html
<!-- 검토 메모 모달 — 계기와 작업 메모. 작업 기억이라 잠금이 없다(PRD §7-D19) -->
<div class="modal-bg" id="memoModal" style="display:none">
  <div class="modal" style="max-width:400px;">
    <div class="modal-head">
      <span id="mm-title">검토 메모</span>
      <span class="modal-x" id="mm-close">✕</span>
    </div>
    <div class="fld" style="margin-top:12px;"><label>왜 보나</label>
      <input class="txt" id="mm-origin" placeholder="예: 창고형 리테일 해자"></div>
    <div class="fld" style="margin-top:10px;"><label>메모</label>
      <textarea id="mm-note" rows="3" placeholder="예: 10-K 3장까지 읽음"></textarea></div>
    <button class="btn primary" id="mm-save">저장</button>
  </div>
</div>
```

- [ ] **Step 4: 열기·저장 함수를 추가한다**

`index_kelly.html` 의 `$('histModal').addEventListener(...)` 줄 **뒤**에 붙인다:

```js
/* 검토 메모 — 계기와 작업 메모를 함께 고친다. 편입되면 계기만 h.thesis로 넘어간다. */
let memoCid=null;
function openMemoModal(cid){
  const c=candidates.find(x=>x.id===cid); if(!c) return;
  memoCid=cid;
  $('mm-title').textContent=`${c.name} · 검토 메모`;
  $('mm-origin').value=c.origin||'';
  $('mm-note').value=c.reviewNote||'';
  $('memoModal').style.display='flex';
}
$('mm-close').addEventListener('click',()=>{ $('memoModal').style.display='none'; });
$('memoModal').addEventListener('click',e=>{
  if(e.target===$('memoModal')) $('memoModal').style.display='none';
});
$('mm-save').addEventListener('click',()=>{
  const c=candidates.find(x=>x.id===memoCid); if(!c) return;
  const o=$('mm-origin').value.trim();
  const n=$('mm-note').value.trim();
  if(o) c.origin=o; else delete c.origin;          // 빈 값은 필드를 지운다
  if(n) c.reviewNote=n; else delete c.reviewNote;
  save(); render();
  $('memoModal').style.display='none';
  setStatus('검토 메모 저장됨: '+c.name);
});
```

- [ ] **Step 5: 버튼을 물린다**

`bindPipeline()` 안, Task 3 에서 넣은 `[data-plstage]` 핸들러 **뒤**에 붙인다:

```js
  document.querySelectorAll('[data-plmemo]').forEach(b=>b.addEventListener('click',()=>{
    openMemoModal(b.dataset.plmemo);
  }));
```

- [ ] **Step 6: 통과를 확인한다**

Expected: PASS — `전부 통과 · 79건` (69 + 신규 10).

- [ ] **Step 7: 커밋**

```bash
git add index_kelly.html docs/superpowers/selfcheck-rejection-ledger.js
git commit -m "feat(kelly): add review memo modal for candidates"
```

---

### Task 5: 기각 — 계기 유지 · 작업 기억 폐기

**Files:**
- Modify: `index_kelly.html:1688` 부근 (`rejectCard` 에 계기 한 줄)
- Modify: `index_kelly.html:1933-1938` (`pl-save-reject` 가 origin 전달)
- Modify: `index_kelly.html:1881-1892` (`rjCtx` 에 origin)
- Modify: `index_kelly.html:1940-1972` (`rj-save` 에서 `newCandidate(name, origin)` · `stripReviewFields`)
- Test: `docs/superpowers/selfcheck-rejection-ledger.js` (신규 섹션 17)

**Interfaces:**
- Consumes: `stripReviewFields(c, editing)` (Task 1), `newCandidate(name, origin)` (Task 2)
- Produces: `openRejectModal(cid, {name, origin, reason, price})` — `opts.origin` 을 `rjCtx.origin` 에 담는다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`selfcheck-rejection-ledger.js` 의 `} catch (e) {` **바로 앞**에 붙인다:

```js
    /* ---------- 17. 기각 — 계기는 남고 작업 기억은 버린다 (§7-D19) ---------- */
    candidates = [
      { id:'rv1', name:'RRR기각', status:'reviewing', startDate: iso(now - 20*D),
        origin:'원 계기', stage:{circle:true, premium:true, val:false}, reviewNote:'작업 메모' }
    ];
    render();
    document.querySelector('[data-plrej="rv1"]').click();
    $('rj-price').value   = '100';
    $('rj-trigger').value = '트리거';
    $('rj-save').click();
    const rv = candidates.find(c => c.id === 'rv1');
    ok('기각 후 계기는 남는다', rv.origin === '원 계기', rv.origin);
    ok('기각 후 stage는 지워진다', rv.stage === undefined, JSON.stringify(rv.stage));
    ok('기각 후 reviewNote는 지워진다', rv.reviewNote === undefined, rv.reviewNote);
    ok('기각 카드에 계기가 보인다',
       $('pl-body').textContent.includes('원 계기'), $('pl-body').textContent.slice(0,80));
    const rvCard = [...document.querySelectorAll('#pl-body .pl-item')]
      .find(e => e.textContent.includes('RRR기각'));
    ok('기각 카드에는 체크박스가 없다',
       !!rvCard && !rvCard.querySelector('[data-plstage]'), '있음');

    /* 기각 기록 수정은 아무것도 지우지 않는다 */
    rv.stage = {circle:true, premium:false, val:false};
    rv.reviewNote = '수정 테스트';
    document.querySelector('[data-pledit="rv1"]').click();
    $('rj-trigger').value = '트리거 수정';
    $('rj-save').click();
    const rv2 = candidates.find(c => c.id === 'rv1');
    ok('수정 시 stage를 지우지 않는다', !!rv2.stage && rv2.stage.circle === true,
       JSON.stringify(rv2.stage));
    ok('수정 시 reviewNote를 지우지 않는다', rv2.reviewNote === '수정 테스트', rv2.reviewNote);

    /* 바로 기각 등재 경로도 계기를 넘긴다 */
    const cnt17 = candidates.length;
    openAddCandidate();
    $('pl-name').value   = '__바로기각';
    $('pl-origin').value = '바로 계기';
    $('pl-save-reject').click();
    $('rj-price').value   = '50';
    $('rj-trigger').value = '트리거';
    $('rj-save').click();
    const dr = candidates[candidates.length - 1];
    ok('바로 기각 등재도 계기를 넘긴다', dr.origin === '바로 계기', dr.origin);
    ok('바로 기각으로 후보가 1개 늘었다', candidates.length === cnt17 + 1,
       cnt17 + ' → ' + candidates.length);
```

- [ ] **Step 2: 실패를 확인한다**

Expected: FAIL — `기각 후 stage는 지워진다` 등 여러 건.

- [ ] **Step 3: 기각 카드에 계기를 렌더한다**

`rejectCard()` 안의 `.pl-top` 줄(`index_kelly.html:1713`)은 지금 이렇다:

```js
    <div class="pl-top"><span class="pl-name">${escapeHtml(c.name)}</span>
```

이 줄이 닫히는 `</div>` **바로 뒤**, `<div class="pl-meta">`(`:1715`) **앞**에 한 줄 넣는다.
검토중 카드(Task 3)와 똑같은 마크업이다:

```js
    ${c.origin?`<div class="pl-origin">“${escapeHtml(c.origin)}”</div>`:''}
```

- [ ] **Step 4: `rjCtx` 가 계기를 나르게 한다**

`index_kelly.html:1881` 의 `rjCtx` 초기값에 `origin` 을 넣는다:

```js
let rjCtx={cid:null, name:'', holdingId:null, editing:false, forceReason:null, origin:null};
```

`openRejectModal` 안의 `rjCtx` 대입(`index_kelly.html:1888-1892`)은 지금 이렇다:

```js
  rjCtx={cid,
         name: (c&&c.name) || opts.name || '',
         holdingId: opts.holdingId || (c&&c.linkedHoldingId) || null,
         editing,
         forceReason: opts.reason || null};
```

마지막 줄에 `origin` 을 더한다:

```js
  rjCtx={cid,
         name: (c&&c.name) || opts.name || '',
         holdingId: opts.holdingId || (c&&c.linkedHoldingId) || null,
         editing,
         forceReason: opts.reason || null,
         origin: opts.origin || null};
```

- [ ] **Step 5: `pl-save-reject` 가 계기를 넘기게 한다**

`index_kelly.html:1936` 의 `openRejectModal(null, {name});` 를 바꾼다:

```js
  openRejectModal(null, {name, origin: $('pl-origin').value});
```

- [ ] **Step 6: `rj-save` 를 고친다**

`index_kelly.html:1955` 의 `c = newCandidate(rjCtx.name);` 를 바꾼다:

```js
    c = newCandidate(rjCtx.name, rjCtx.origin);
```

같은 핸들러 안, `c.note=$('rj-note').value.trim();`(`:1964`) **뒤**에 한 줄 추가:

```js
  stripReviewFields(c, rjCtx.editing);   // 기각되면 작업 기억은 역할이 끝난다 (§7-D19)
```

- [ ] **Step 7: 통과를 확인한다**

Expected: PASS — `전부 통과 · 88건` (79 + 신규 9).

- [ ] **Step 8: 커밋**

```bash
git add index_kelly.html docs/superpowers/selfcheck-rejection-ledger.js
git commit -m "feat(kelly): keep origin but drop review notes on rejection"
```

본문:
```
계기는 3년 검증 때 맥락이 되므로 남기고, 진행 체크와 작업 메모는 편입 때와
대칭으로 버린다. 남길 가치가 있는 내용은 기각 메모(rj-note)에 옮겨 적는다.
```

---

### Task 6: 논지 승계 — 종목 추가 폼 · 편입 자동 채움

**Files:**
- Modify: `index_kelly.html:345` 부근 (논지 입력란)
- Modify: `index_kelly.html:1079-1104` (제출 핸들러 · 폼 리셋)
- Modify: `index_kelly.html:1873-1877` (`data-pladopt` 자동 채움)
- Test: `docs/superpowers/selfcheck-rejection-ledger.js` (신규 섹션 18)

**Interfaces:**
- Consumes: `candidates[].origin` (Task 2)
- Produces: `holdings[].thesis` — trim 된 문자열. 비면 필드를 만들지 않는다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`selfcheck-rejection-ledger.js` 의 `} catch (e) {` **바로 앞**에 붙인다:

```js
    /* ---------- 18. 논지 승계 — 편입 · 직접 추가 ---------- */
    candidates = [
      { id:'ad1', name:'__편입테스트', status:'reviewing', startDate: iso(now - 3*D),
        origin:'창고형 리테일 해자' }
    ];
    render();
    document.querySelector('[data-pladopt="ad1"]').click();
    ok('편입 시 논지가 폼에 자동으로 채워진다',
       $('i-thesis').value === '창고형 리테일 해자', $('i-thesis').value);

    const hBefore = holdings.length;
    $('i-price').value = '100';
    $('i-up').value    = '200';
    $('i-down').value  = '50';
    $('i-prob').value  = '60';
    $('addBtn').click();
    ok('보유 종목이 1개 늘었다', holdings.length === hBefore + 1,
       hBefore + ' → ' + holdings.length);
    const hNew = holdings[holdings.length - 1];
    ok('논지가 holdings.thesis 로 들어간다', hNew.thesis === '창고형 리테일 해자',
       hNew.thesis);
    ok('폼 리셋으로 논지 칸이 비워진다', $('i-thesis').value === '', $('i-thesis').value);

    /* 직접 추가 — 후보를 안 거쳐도 논지를 적을 수 있다 */
    $('i-name').value   = '__직접추가';
    $('i-thesis').value = '  생태계 잠금효과  ';
    $('i-price').value  = '100';
    $('i-up').value     = '200';
    $('i-down').value   = '50';
    $('i-prob').value   = '60';
    $('addBtn').click();
    const hDirect = holdings[holdings.length - 1];
    ok('직접 추가도 논지가 trim 되어 저장된다', hDirect.thesis === '생태계 잠금효과',
       hDirect.thesis);

    /* 논지를 비우면 필드를 만들지 않는다 */
    $('i-name').value  = '__논지없음';
    $('i-price').value = '100';
    $('i-up').value    = '200';
    $('i-down').value  = '50';
    $('i-prob').value  = '60';
    $('addBtn').click();
    const hNo = holdings[holdings.length - 1];
    ok('논지를 비우면 필드를 만들지 않는다', !('thesis' in hNo), JSON.stringify(hNo));
```

- [ ] **Step 2: 실패를 확인한다**

Expected: FAIL — `스크립트 실행 중 예외` (`$('i-thesis')` 가 `null`).

추가 버튼 id 는 `addBtn` 이다(`index_kelly.html:370`, 핸들러 `:1078`). `i-add` 가 아니다.

- [ ] **Step 3: 논지 입력란을 추가한다**

`index_kelly.html:345` 의 종목명 줄 **뒤**에 붙인다:

```html
    <div class="fld"><label>논지 (선택)</label>
      <input class="txt" id="i-thesis" placeholder="예: 창고형 리테일 해자"></div>
```

- [ ] **Step 4: 제출 시 논지를 저장한다**

`index_kelly.html:1097` 은 지금 객체 리터럴을 바로 push 한다:

```js
  holdings.push({id:Date.now().toString(36),name,price,up,down,prob,startQ,ccy:useCcy,fx,ledger:[]});
```

이 한 줄을 아래 네 줄로 바꾼다. 리터럴을 변수로 빼야 빈 값일 때 필드를 **안 만들** 수 있다:

```js
  const h={id:Date.now().toString(36),name,price,up,down,prob,startQ,ccy:useCcy,fx,ledger:[]};
  const th=$('i-thesis').value.trim();
  if(th) h.thesis=th;        // 빈 값이면 필드를 만들지 않는다
  holdings.push(h);
```

바로 아래 `if(pendingAdoptId){...}` 블록(`:1098-1102`)은 **건드리지 않는다.**

- [ ] **Step 5: 폼 리셋에 논지를 넣는다**

`index_kelly.html:1103` 의 리셋 줄에 추가한다:

```js
  $('i-thesis').value='';
```

**이걸 빠뜨리면 다음에 추가하는 종목에 이전 논지가 그대로 남는다.** 위 테스트의
`폼 리셋으로 논지 칸이 비워진다` 가 이걸 잡는다.

- [ ] **Step 6: 편입 시 자동으로 채운다**

`index_kelly.html:1874` 의 `$('i-name').value=c.name;` **뒤**에 한 줄 추가:

```js
    $('i-thesis').value=c.origin||'';   // 초기값일 뿐 — 고치면 고친 값이 저장된다
```

- [ ] **Step 7: 통과를 확인한다**

Expected: PASS — `전부 통과 · 94건` (88 + 신규 6).

- [ ] **Step 8: 커밋**

```bash
git add index_kelly.html docs/superpowers/selfcheck-rejection-ledger.js
git commit -m "feat(kelly): carry candidate origin into holding thesis"
```

본문:
```
매도 사유 '원 논지 훼손'의 원 논지가 어디에도 기록돼 있지 않았다. 편입 시
계기를 승계해 무엇이 깨졌는지 대조할 원문을 남긴다.
```

---

### Task 7: 칸 회수 모달에 원 논지 표시

**Files:**
- Modify: `index_kelly.html:570-580` 부근 (rjModal 에 원 논지 줄)
- Modify: `index_kelly.html:1885-1919` (`openRejectModal` 에서 채우기)
- Test: `docs/superpowers/selfcheck-rejection-ledger.js` (신규 섹션 19)

**Interfaces:**
- Consumes: `holdings[].thesis` (Task 6), `rjCtx.holdingId`
- Produces: `#rj-thesis` — `h.thesis` 가 있을 때만 보인다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`selfcheck-rejection-ledger.js` 의 `} catch (e) {` **바로 앞**에 붙인다:

```js
    /* ---------- 19. 칸 회수 모달 — 원 논지 대조 ---------- */
    const thId = '__t_thesis';
    holdings.push({ id: thId, name:'__논지있음', price:100, up:200, down:50, prob:0.6,
      startQ: currentQGuess(), ccy:'USD', fx:1, thesis:'창고형 리테일 해자', ledger:[] });
    openRejectModal(null, { name:'__논지있음', reason:'thesis', price:100, holdingId: thId });
    ok('원 논지가 모달에 표시된다',
       $('rj-thesis').style.display !== 'none'
       && $('rj-thesis').textContent.includes('창고형 리테일 해자'),
       $('rj-thesis').textContent);
    $('rjModal').style.display = 'none';

    const noId = '__t_nothesis';
    holdings.push({ id: noId, name:'__논지없음', price:100, up:200, down:50, prob:0.6,
      startQ: currentQGuess(), ccy:'USD', fx:1, ledger:[] });
    openRejectModal(null, { name:'__논지없음', reason:'thesis', price:100, holdingId: noId });
    ok('논지가 없으면 그 줄이 안 뜬다', $('rj-thesis').style.display === 'none',
       $('rj-thesis').style.display);
    $('rjModal').style.display = 'none';

    /* 수동 기각(보유 종목 없음)에서도 안 뜬다 */
    openRejectModal(null, { name:'__수동' });
    ok('수동 기각에는 원 논지 줄이 없다', $('rj-thesis').style.display === 'none',
       $('rj-thesis').style.display);
    $('rjModal').style.display = 'none';
```

`opts.holdingId` 는 이미 지원된다 — `rjCtx.holdingId = opts.holdingId || (c&&c.linkedHoldingId) || null`
(`index_kelly.html:1889`). 새 키를 만들 필요가 없다.

- [ ] **Step 2: 실패를 확인한다**

Expected: FAIL — `스크립트 실행 중 예외` (`$('rj-thesis')` 가 `null`).

- [ ] **Step 3: 마크업을 추가한다**

`index_kelly.html` 의 rjModal 안, `rj-intro` 줄 **뒤**에 붙인다:

```html
    <div class="keep-note" id="rj-thesis" style="margin-top:10px;display:none;"></div>
```

- [ ] **Step 4: `openRejectModal` 에서 채운다**

`index_kelly.html` 의 `openRejectModal` 안, `$('rj-close').style.display = ...` 줄 **앞**에 붙인다:

```js
  /* 원 논지 — 무엇이 깨졌는지 대조할 원문. 없는 종목은 줄 자체를 숨긴다. */
  const th = rjCtx.holdingId ? (holdings.find(h=>h.id===rjCtx.holdingId)||{}).thesis : null;
  if(th){
    $('rj-thesis').innerHTML = `원 논지: <b>“${escapeHtml(th)}”</b>`;
    $('rj-thesis').style.display = 'block';
  } else {
    $('rj-thesis').style.display = 'none';
  }
```

- [ ] **Step 5: 통과를 확인한다**

Expected: PASS — `전부 통과 · 97건` (94 + 신규 3).

- [ ] **Step 6: 커밋**

```bash
git add index_kelly.html docs/superpowers/selfcheck-rejection-ledger.js
git commit -m "feat(kelly): show original thesis when reclaiming a slot"
```

---

### Task 8: 돌연변이 검사 · 문서 갱신

**Files:**
- Modify: `PRD.md` (§4.4 후보 파이프라인 계층, §7 결정 기록 D19, §9 기각 조건)
- Modify: `docs/superpowers/browser-checklist-rejection-ledger.md` (항목 수 · 커버리지 · 2단계)
- Modify: `docs/HANDOFF.md` (덮어쓴다)

**Interfaces:**
- Consumes: 없음. 검증과 문서만 다룬다.

- [ ] **Step 1: 전체 테스트를 돌린다**

```sh
node test_pipeline.js
```
Expected: `OK  67 pass`

selfcheck 는 Task 2 Step 2 절차로 돌린다.
Expected: `전부 통과 · 97건`

- [ ] **Step 2: 돌연변이 2개로 테스트가 무는지 확인한다**

`_selfcheck.html` **사본만** 변조한다. `index_kelly.html` 은 절대 건드리지 않는다.

```sh
node docs/superpowers/build-selfcheck.js
# 돌연변이 A — 계기 승계를 끊는다
sed -i '' "s|\$('i-thesis').value=c.origin||'';|\$('i-thesis').value='';|" _selfcheck.html
```
Expected: `편입 시 논지가 폼에 자동으로 채워진다` 와 `논지가 holdings.thesis 로 들어간다` FAIL

```sh
node docs/superpowers/build-selfcheck.js
# 돌연변이 B — 기각 시 폐기를 뺀다
sed -i '' 's|stripReviewFields(c, rjCtx.editing);||' _selfcheck.html
```
Expected: `기각 후 stage는 지워진다` 와 `기각 후 reviewNote는 지워진다` FAIL

둘 다 FAIL 이 안 나오면 그 테스트는 아무것도 검사하지 않는 것이다 — 테스트를 고친다.

- [ ] **Step 3: 정리한다**

```sh
node docs/superpowers/build-selfcheck.js   # 깨끗한 상태로 재생성
rm -f _selfcheck.html
git status --short                          # index_kelly.html 이 목록에 없어야 한다
```

- [ ] **Step 4: PRD §4.4 를 갱신한다**

`PRD.md` 의 **후보 파이프라인 계층** 목록에 두 줄을 넣는다:

```markdown
- **검토 필드**: `origin`(왜 보나·등록 시 선택 입력) / `stage`(능력범위·프리미엄·밸류에이션 수동 체크) / `reviewNote`(작업 메모). 셋 다 선택적이라 스냅샷 버전이 안 바뀐다. 도구별 키 분리(§5) 때문에 TOOL 01/02/03 과 자동 연동은 불가능하며 수동 자기보고다.
- **논지 승계**: 편입 시 `origin` 이 `holdings.thesis` 로 넘어가 매도 사유 `원 논지 훼손` 판정 때 대조할 원문이 된다. 후보를 안 거친 직접 추가도 종목 추가 폼에서 논지를 받는다. 기존 보유 종목의 소급 입력은 허용하지 않는다 — 이미 주가를 아는 상태의 사후 서술이다.
```

- [ ] **Step 5: PRD §7 에 D19 를 추가한다**

표에 한 줄:

```markdown
| D19 | 검토 필드는 작업 기억이라 잠금·유예를 걸지 않고, 기각 시 `stage`·`reviewNote` 를 버린다 | 기각한 대안: ① 전부 보존 — 아무도 안 읽는 죽은 데이터 ② 기각 카드에 계속 표시 — 카드 비대 ③ 기각 원장처럼 14일 잠금 — 증거가 아니라 작업 메모라 과한 규율. `origin` 만은 3년 검증의 맥락이므로 남긴다 |
```

- [ ] **Step 6: PRD §9 기각 조건에 한 줄 얹는다**

기존 *후보 파이프라인 기각 조건 점검 (2029-08 예정)* 항목에 이어 붙인다:

```markdown
  ⑤ 체크박스가 전 항목에서 등록 시 상태 그대로 ⑥ `origin` 이 절반 이상 빔 ⑦ `reviewNote` 가 한 번도 안 쓰임 — 이 중 하나면 검토 필드는 규율이 아니라 장식이다. 필드가 전부 선택적이라 렌더만 걷어내면 되돌아간다
```

- [ ] **Step 7: 체크리스트 문서를 갱신한다**

`docs/superpowers/browser-checklist-rejection-ledger.md`:
- `58개 항목` → `97개 항목`
- 커버리지 목록에 세 줄 추가:
```markdown
- 계기(`origin`) 등록·편집·trim, 빈 값이면 필드 미생성
- 진행 체크 3개의 렌더·토글·저장, 기각 시 폐기
- 편입·직접 추가 양쪽의 논지 승계와 폼 리셋
```
- 2단계 **보기** 항목에 추가 (자동 검사가 못 보는 것만):
```markdown
- [ ] **체크박스 3개가 폰 폭에서 한 줄에 들어간다** — 넘치면 wrap 되고 가로 스크롤은 안 생긴다 (P3)
- [ ] 계기 줄이 회색 이탤릭으로 나머지 카드 텍스트와 구분된다
- [ ] 검토 메모 모달이 다른 모달과 색·폰트가 같다
```

- [ ] **Step 8: HANDOFF 를 덮어쓴다**

`docs/HANDOFF.md` 를 이번 작업 기준으로 새로 쓴다. 담을 것:
- 지금 상태: 검토 필드 구현 완료, 커밋됨, **push 는 사용자 요청 시에만**
- 손대지 말 것: `stripReviewFields` 의 `editing` 가드(기각 기록 수정 시 폐기하면 안 됨),
  체크박스 핸들러가 `render()` 를 안 부르는 이유(모바일 스크롤), `origin` 을 필수로 만들지 말 것
- 미결: 폰 실기 검증(CSS·레이아웃·실데이터), 그리고 이전 세션부터 밀린 청산 종목 기능의 폰 검증
- 되돌리는 법: 필드가 전부 선택적이라 렌더만 걷어내면 데이터가 그대로 살아 있다

- [ ] **Step 9: 커밋**

```bash
git add PRD.md docs/superpowers/browser-checklist-rejection-ledger.md docs/HANDOFF.md
git commit -m "docs: record review-field decision as D19"
```

---

## 검증 요약

| 무엇 | 어떻게 | 기대 |
|---|---|---|
| 순수 로직 | `node test_pipeline.js` | `OK  67 pass` |
| DOM 경로 | headless Chrome + `_selfcheck.html` | `전부 통과 · 97건` |
| 테스트가 무는가 | 돌연변이 2개 (Task 8 Step 2) | 각각 지정된 항목 FAIL |
| CSS·레이아웃 | 폰 실기 (자동 검사 불가) | 체크리스트 2단계 |

**항목 수가 예상과 다르면 멈춘다.** 테스트를 빠뜨렸거나 이전 태스크가 깨진 것이다.
