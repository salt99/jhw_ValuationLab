# 켈리 3-시나리오 확장 — 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 켈리 플래너가 Bull/Base/Bear 세 시나리오와 세 확률을 받아 3-결과 켈리 닫힌해로 `f` 를 계산한다.

**Architecture:** 순수 수식 `kelly3(rs, ps)` 를 `PIPELINE PURE` 블록에 두어 `test_pipeline.js` 가 DOM 없이 검증하고, `kellyOf(h)` 는 그것을 호출하는 얇은 껍데기가 된다. 신규 필드 `base`·`pBase` 는 저장하고 `pBear` 는 도출한다. v4 데이터는 `base` 가 없으므로 켈리가 보류되며 마이그레이션은 아무것도 채우지 않는다.

**Tech Stack:** vanilla JS · 빌드 없음 · 의존성 없음. 테스트는 `node test_pipeline.js`(순수)와 headless Chrome DOM 덤프(`selfcheck`).

**설계 정본:** `docs/superpowers/specs/2026-08-13-kelly-three-scenario-design.md`

## Global Constraints

- **파일을 새로 만들지 않는다.** 코드 변경은 `index_kelly.html` 한 파일 (PRD §7-D2 플랫 규칙).
- **외부 CDN·프레임워크·패키지 추가 금지.**
- **`kellyOf` 의 선언 형태 `function kellyOf(h){` 를 바꾸지 않는다.** `test_pipeline.js` 의 `grab()` 이 이 형태를 중괄호 균형으로 찾는다. 화살표 함수·`const kellyOf =` 로 바꾸면 추출이 깨진다.
- **`kelly3` 는 `PIPELINE PURE` 블록(`index_kelly.html:687-776`) 안에 둔다.** 밖에 두면 `api.kelly3` 로 단위 검증할 수 없다.
- **디자인 토큰만 쓴다**: `var(--ink)` `var(--dim)` `var(--faint)` `var(--line)` `var(--accent)` `var(--good)` `var(--bad)` `var(--warn)` `var(--mono)`. 새 색상 리터럴 금지.
- **사용자 입력 문자열은 렌더 시 `escapeHtml()`.**
- **커밋 메시지**: Conventional Commits, 제목 명령형 50자 이내, 본문은 *왜*. AI 저작 푸터 없음.
- **각 태스크는 커밋으로 끝난다.** push 는 사용자가 요청할 때만.
- **Task 2 부터 Task 6 까지는 기존 종목의 켈리가 보류 상태다.** 의도된 것이며 배포하지 않는다. Task 7 까지 끝낸 뒤 배포 여부를 사용자가 정한다.

---

### Task 1: 순수 수식 `kelly3`

**Files:**
- Modify: `index_kelly.html:687-776` (`PIPELINE PURE` 블록 안, `stripReviewFields` 뒤)
- Modify: `test_pipeline.js:7-10` (PURE export 목록), `test_pipeline.js:30-34` (`alloc` 배열)
- Test: `test_pipeline.js` (신규 그룹 2개)

**Interfaces:**
- Produces: `kelly3(rs, ps) -> number | null`
  - `rs = [r_bull, r_base, r_bear]` — 각 시나리오의 수익률 `(목표가 − 현재가)/현재가`
  - `ps = [p_bull, p_base, p_bear]` — 합이 1인 확률
  - 반환: 성장최적 비율 `f`. 퇴화(정의역 안에 근 없음 / `α≈0 ∧ β≈0` / 판별식 음수)면 `null`
  - **순서를 강제하지 않는다.** 순서 검증은 `kellyOf` 의 책임 (Task 2)

- [ ] **Step 1: export 목록 두 곳에 이름을 추가한다**

`test_pipeline.js:8-10` 의 `return {...}` 마지막 줄을 바꾼다:

```js
          stageOf, stripReviewFields, kelly3};
```

`test_pipeline.js:30-34` 의 `alloc` 정의를 **두 군데** 고친다 — `grab` 목록과 `return` 문 둘 다:

```js
const alloc = new Function('var holdings=[], candidates=[];\n' + [
  constOf('HALF'), constOf('MAX_SINGLE'), constOf('THIN_DOWNSIDE'),
  grab('isThesisReject'), grab('livePlanHoldings'), grab('kelly3'), grab('kellyOf'), grab('compute'),
  'return { compute, kellyOf, kelly3, setState(h, c){ holdings = h; candidates = c; } };'
].join('\n'))();
```

- `grab('kelly3')` 를 빠뜨리면 Task 2 이후 `compute` 검증이 `kelly3 is not defined` 로 통째로 죽는다
- `return` 문에 `kelly3` 를 빠뜨리면 Task 2 의 `alloc.kelly3(...)` 테스트가 `undefined is not a function` 으로 죽는다

같은 이름이 `api`(PURE 블록 추출)와 `alloc`(grab 샌드박스) 양쪽에 있는 것은 의도된 것이다.
`api.kelly3` 로는 수식만, `alloc.kelly3` 로는 `kellyOf` 와 대조하며 검증한다.

- [ ] **Step 2: 실패하는 테스트를 쓴다**

`test_pipeline.js` 의 마지막 `console.log('\n' + (fail ? ...` **바로 앞**에 붙인다:

```js
/* ---- kelly3 ---- */
grp('kelly3 — 2-결과 축퇴 (기존 f = p/a − q/b 와 일치)');
{
  // Base 를 현재가(r=0)·확률 0 으로 두면 α=0 이라 1차식이 되고 기존 공식으로 환원된다.
  [[400,264,200,0.55],[300,100,60,0.4],[150,90,50,0.7]].forEach(([up,px,dn,p])=>{
    const b=(up-px)/px, a=(px-dn)/px;
    eq(`상단 ${up} · 현재가 ${px} · 하단 ${dn} · p ${p}`,
       api.kelly3([b,0,-a],[p,0,1-p]), p/a-(1-p)/b);
  });
}

grp('kelly3 — 3-결과 (수치 최대화와 대조)');
{
  // 브레인스토밍 단계에서 무식한 격자 탐색으로 확인한 값. 소수 4자리까지 고정.
  const near=(label,got,want)=>eq(label, Math.round(got*1e4)/1e4, want);
  near('TSMC PBR 5.0 매수 (8.04/5.70/3.05, 25/50/25)',
       api.kelly3([(8.04-5)/5,(5.70-5)/5,(3.05-5)/5],[0.25,0.50,0.25]), 0.9729);
  near('상방 치우침 (1.2/0.3/−0.4, 20/50/30)',
       api.kelly3([1.2,0.3,-0.4],[0.2,0.5,0.3]), 1.1084);
  near('하방 치우침 (0.5/−0.1/−0.6, 30/40/30)',
       api.kelly3([0.5,-0.1,-0.6],[0.3,0.4,0.3]), -0.3796);
  near('얕은 하방 폭발 (0.5/0.1/−0.03, 25/50/25)',
       api.kelly3([0.5,0.1,-0.03],[0.25,0.50,0.25]), 23.2938);
}

grp('kelly3 — 퇴화 입력은 null');
{
  eq('p_base=1 (확실히 제자리) → α=β=γ=0', api.kelly3([0.5,0,-0.3],[0,1,0]), null);
  eq('세 수익률이 전부 0', api.kelly3([0,0,0],[0.3,0.4,0.3]), null);
}

grp('kelly3 — 근 선택이 log 정의역 안인가');
{
  const rs=[0.5,0.1,-0.4], ps=[0.3,0.4,0.3];
  const f=api.kelly3(rs,ps);
  eq('정의역 안 (모든 1+f·r > 0)', rs.every(r=>1+f*r>0), true);
  // 정의역 안에서는 도함수가 0 이어야 한다
  const dg=rs.reduce((s,r,i)=>s+ps[i]*r/(1+f*r),0);
  eq('도함수 ≈ 0', Math.round(dg*1e9)/1e9, 0);
}
```

- [ ] **Step 3: 실패를 확인한다**

Run: `node test_pipeline.js`
Expected: FAIL — `ReferenceError: kelly3 is not defined` 로 `api` 생성 시점에 죽는다.

- [ ] **Step 4: 구현을 넣는다**

`index_kelly.html` 의 `stripReviewFields` 함수 **뒤**, `/* ===== /PIPELINE PURE ===== */` **앞**에 붙인다:

```js
/* 3-결과 켈리 — E[log(1+f·r)] 최대화의 닫힌해.
   Σ pᵢrᵢ/(1+f·rᵢ)=0 의 분모를 걷어내면 f 에 대한 2차식이 된다:
     α = r₁r₂r₃ · β = Σ pᵢrᵢ(rⱼ+rₖ) · γ = E[r]
   log 정의역 안에서 목적함수가 오목하므로 정류점은 하나뿐이다.
   rs=[bull,base,bear] 수익률 · ps=합이 1인 확률. 퇴화면 null. */
function kelly3(rs, ps){
  const [r1,r2,r3]=rs, [p1,p2,p3]=ps;
  const A=r1*r2*r3;
  const B=p1*r1*(r2+r3)+p2*r2*(r1+r3)+p3*r3*(r1+r2);
  const C=p1*r1+p2*r2+p3*r3;
  const inDomain=f=>rs.every(r=>1+f*r>1e-9);
  if(Math.abs(A)<1e-12){
    // 1차 축퇴. β까지 0이면 베팅 대상이 없다 (p_base=1 등) — 0/0 을 막는다.
    if(Math.abs(B)<1e-12) return null;
    const f=-C/B;
    return inDomain(f)?f:null;
  }
  const D=B*B-4*A*C;
  if(D<0) return null;
  const s=Math.sqrt(D);
  const cand=[(-B+s)/(2*A),(-B-s)/(2*A)].filter(inDomain);
  if(!cand.length) return null;
  if(cand.length===1) return cand[0];
  // 수학적으로는 안 일어나지만 경계 부동소수점 오차의 안전망: E[log]가 큰 쪽
  const g=f=>ps.reduce((acc,p,i)=>acc+p*Math.log(1+f*rs[i]),0);
  return g(cand[0])>=g(cand[1])?cand[0]:cand[1];
}
```

- [ ] **Step 5: 통과를 확인한다**

Run: `node test_pipeline.js`
Expected: PASS — 마지막 줄 `OK  78 pass` (기존 67 + 신규 11: 축퇴 3 · 3-결과 4 · 퇴화 2 · 근 선택 2).

- [ ] **Step 6: 커밋**

```bash
git add index_kelly.html test_pipeline.js
git commit -m "feat(kelly): add closed-form three-outcome kelly

E[log(1+f·r)] 최대화는 3-결과에서 f 에 대한 2차식이 되어 닫힌해가 있다.
수치 반복이 필요 없고, Base 를 현재가·확률 0 으로 두면 기존 f = p/a − q/b 로
정확히 환원되므로 마이그레이션 안전성이 수식 자체로 보장된다."
```

---

### Task 2: `kellyOf` 를 3-시나리오로 교체

**Files:**
- Modify: `index_kelly.html:875-883` (`kellyOf` 본문)
- Modify: `index_kelly.html:977-990` (`updatePreview` — `k.a`·`k.b` 소비처)
- Modify: `index_kelly.html:2469-2470` (재평가 미리보기 호출부)
- Test: `test_pipeline.js` (신규 그룹 1개)

**Interfaces:**
- Consumes: `kelly3(rs, ps)` (Task 1)
- Produces: `kellyOf(h) -> {rs, f, thinDown, err}`
  - `rs`: `[r_bull, r_base, r_bear]` 를 소수 3자리로 반올림한 배열. 오류 시에도 가능하면 채운다
  - `f`: 숫자 또는 `null`
  - `thinDown`: `Math.abs(Math.min(...rs)) < THIN_DOWNSIDE` 일 때 `true`
  - `err`: `f===null` 일 때만 존재하는 한국어 문구
  - **`a`·`b` 를 더 이상 반환하지 않는다** — 소비처는 `rs` 를 쓴다

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`test_pipeline.js` 의 마지막 `console.log('\n' + (fail ? ...` **바로 앞**에 붙인다:

```js
/* ---- kellyOf — 3-시나리오 래퍼 ---- */
grp('kellyOf — err 경로');
{
  const H=(o)=>Object.assign({price:100,up:150,base:120,down:70,prob:0.25,pBase:0.5},o);
  eq('Base 미입력', alloc.kellyOf(H({base:undefined})).err, 'Base 미입력 — 켈리 보류');
  eq('pBase 미입력', alloc.kellyOf(H({pBase:undefined})).err, 'Base 미입력 — 켈리 보류');
  eq('순서 위반 (Base < 하단)', alloc.kellyOf(H({base:60})).err, '상단 ≥ Base ≥ 하단이 아닙니다');
  eq('하방 없음 (전부 현재가 이상)', alloc.kellyOf(H({down:110})).err, '하방 시나리오가 없습니다');
  eq('확률 합 초과', alloc.kellyOf(H({prob:0.8,pBase:0.5})).err, '확률 합이 1을 넘습니다');
  eq('퇴화 (p_base=1)', alloc.kellyOf(H({base:100,prob:0,pBase:1})).err, '시나리오가 퇴화했습니다');
}

grp('kellyOf — 정상 반환');
{
  const k=alloc.kellyOf({price:100,up:150,base:120,down:70,prob:0.25,pBase:0.5});
  eq('rs 세 개', k.rs, [0.5,0.2,-0.3]);
  eq('err 없음', k.err, undefined);
  eq('f 가 kelly3 와 일치', Math.round(k.f*1e6)/1e6,
     Math.round(alloc.kelly3([0.5,0.2,-0.3],[0.25,0.5,0.25])*1e6)/1e6);
}

grp('kellyOf — thinDown 은 가장 나쁜 시나리오 기준');
{
  // 하단 칸이 최악이 아닌 입력은 순서 검증에 걸리므로, 하단이 최악이되 얕은 경우로 본다.
  const shallow=alloc.kellyOf({price:100,up:150,base:110,down:97,prob:0.25,pBase:0.5});
  eq('최악 −3% → thinDown', shallow.thinDown, true);
  const deep=alloc.kellyOf({price:100,up:150,base:120,down:70,prob:0.25,pBase:0.5});
  eq('최악 −30% → 평상', deep.thinDown, false);
  eq('얕은 하방의 f 가 폭발한다', Math.round(shallow.f), 23);
}
```

- [ ] **Step 2: 실패를 확인한다**

Run: `node test_pipeline.js`
Expected: FAIL — `Base 미입력` 등 여러 건. 기존 `kellyOf` 는 `base` 를 모르므로 `NaN` 이나 옛 err 문구를 낸다.

- [ ] **Step 3: `kellyOf` 를 바꾼다**

`index_kelly.html:875-883` 전체를 아래로 교체한다. **선언 형태를 유지한다.**

```js
function kellyOf(h){
  if(h.base===undefined||h.base===null||h.base===''||h.pBase===undefined||h.pBase===null)
    return {rs:null,f:null,err:'Base 미입력 — 켈리 보류'};
  const rr=t=>(t-h.price)/h.price;
  const rs=[rr(h.up), rr(h.base), rr(h.down)];
  const round=rs.map(x=>+x.toFixed(3));
  const pBull=h.prob, pBase=h.pBase, pBear=1-pBull-pBase;
  if(pBear<-1e-9) return {rs:round,f:null,err:'확률 합이 1을 넘습니다'};
  if(!(rs[0]>=rs[1] && rs[1]>=rs[2]))
    return {rs:round,f:null,err:'상단 ≥ Base ≥ 하단이 아닙니다'};
  if(Math.min(...rs)>=0) return {rs:round,f:null,err:'하방 시나리오가 없습니다'};
  const f=kelly3(rs,[pBull,pBase,pBear]);
  if(f===null) return {rs:round,f:null,err:'시나리오가 퇴화했습니다'};
  // 가장 나쁜 시나리오가 얕으면 켈리가 폭발한다 (실측: 최악 −3% → f≈23)
  const thinDown = Math.abs(Math.min(...rs))<THIN_DOWNSIDE;
  return {rs:round,f,thinDown};
}
```

**검증 순서가 중요하다.** 확률 합을 순서보다 먼저 본다 — 확률이 깨진 상태에서 순서 오류를 보고하면 사용자가 엉뚱한 칸을 고친다.

- [ ] **Step 4: 통과를 확인한다**

Run: `node test_pipeline.js`
Expected: PASS — `OK  90 pass` (78 + 신규 12: err 6 · 정상 3 · thinDown 3).

- [ ] **Step 5: 미리보기 표시를 고친다**

`index_kelly.html:977-990` 의 `updatePreview()` 를 아래로 바꾼다. `k.a`·`k.b` 가 사라졌으므로 이 단계를 건너뛰면 화면에 `undefined` 가 뜬다:

```js
function updatePreview(){
  const price=numVal('i-price'),up=numVal('i-up'),down=numVal('i-down'),base=numVal('i-base');
  const P=readProbs();
  $('prob-val').textContent = P===null?'합 —':'합 '+Math.round((P.pBull+P.pBase+P.pBear)*100)+'%';
  if(isNaN(price)||isNaN(up)||isNaN(down)||isNaN(base)||P===null){
    $('kelly-preview').textContent='가격·세 시나리오·확률 입력 시 켈리 미리보기';return;
  }
  const k=kellyOf({price,up,down,base,prob:P.pBull,pBase:P.pBase});
  if(k.f===null){$('kelly-preview').innerHTML='<span style="color:var(--bad)">'+k.err+'</span>';return;}
  const col=k.f>0?'var(--good)':'var(--bad)';
  let html=`Bull ${fmtPct(k.rs[0])} · Base ${fmtPct(k.rs[1])} · Bear ${fmtPct(k.rs[2])}`
    +` · 켈리 f=<span style="color:${col}">${fmtPct(k.f)}</span>`;
  if(k.thinDown){
    html+=`<br><span style="color:var(--warn);font-size:11px">⚠ 최악 시나리오가 `
      +`${fmtPct(Math.min(...k.rs))} — 하방이 얕아 켈리 과대평가. 실제 최악 하락(−20~40%) 권장</span>`;
  }
  $('kelly-preview').innerHTML=html;
}
```

`readProbs()` 는 Task 3 에서 만든다. 이 태스크 시점에는 미정의라 **미리보기가 콘솔 오류를 낸다** — Task 3 에서 해소된다. 순수 함수 검증(`node test_pipeline.js`)은 영향받지 않는다.

- [ ] **Step 6: 재평가 미리보기 호출부를 고친다**

`index_kelly.html:2469-2470` 은 `reDelta()`(`:2461` 부터) 안에 있다. 그 함수의 값 읽기
부분(`:2463-2464`)과 호출부를 함께 바꾼다:

```js
  const up=numVal('re-up'), down=numVal('re-down'), base=numVal('re-base');
  const prob=parseFloat($('re-prob').value)/100, pBase=parseFloat($('re-pbase').value)/100;
```
```js
  const kNew=kellyOf({price:h.price,up,down,base,prob,pBase});
  const kOld=kellyOf(h);
```

`re-base`·`re-pbase` 입력란은 Task 4 에서 생긴다. 이 시점에는 `$('re-base')` 가 `null` 이라
**재평가 모달을 열면 콘솔 오류가 난다** — Task 4 에서 해소된다. 순수 함수 검증
(`node test_pipeline.js`)은 DOM 을 안 보므로 영향받지 않는다.

- [ ] **Step 7: 커밋**

```bash
git add index_kelly.html test_pipeline.js
git commit -m "feat(kelly): compute kelly from three scenarios"
```

본문:
```
밸류에이션 분석이 Bear/Base/Bull 세 적정가로 끝나는데 입력은 둘뿐이었다.
셋을 둘로 줄이면 기준선이 사라지거나 하방이 사라진다.

thinDown 은 하단 칸이 아니라 가장 나쁜 시나리오 기준이다 — 3-시나리오에서
하단이 최악이라는 보장이 없다.
```

---

### Task 3: 종목 추가 폼 — 3행 입력과 검증

**Files:**
- Modify: `index_kelly.html:354-360` (입력란)
- Modify: `index_kelly.html:991` (`input` 리스너 목록)
- Modify: `index_kelly.html` (`readProb` 근처에 `readProbs` 추가)
- Modify: `index_kelly.html:1078-1143` (`addBtn` 핸들러)
- Modify: `index_kelly.html:1597` (`dataSnapshot` v5), `index_kelly.html:1631` (`load` 버전 분기)
- Test: `docs/superpowers/selfcheck-rejection-ledger.js` (신규 섹션 20)

**Interfaces:**
- Consumes: `kellyOf(h)` (Task 2)
- Produces: `readProbs() -> {pBull, pBase, pBear} | null` — 세 확률 입력을 읽어 0~1 로 변환. 하나라도 비었거나 합이 100 이 아니면 `null`
- Produces: `holdings[].base`(숫자) · `holdings[].pBase`(0~1). `pBear` 는 저장하지 않는다
- Produces: 스냅샷 `v:5`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`selfcheck-rejection-ledger.js` 의 `} catch (e) {` **바로 앞**에 붙인다:

```js
    /* ---------- 20. 종목 추가 — 3-시나리오 입력 ---------- */
    const hBefore20 = holdings.length;
    $('i-name').value   = '__3시나리오';
    $('i-price').value  = '100';
    $('i-up').value     = '150';
    $('i-base').value   = '120';
    $('i-down').value   = '70';
    $('i-prob').value   = '25';
    $('i-pbase').value  = '50';
    $('i-pbear').value  = '25';
    $('addBtn').click();
    ok('3-시나리오 종목이 추가된다', holdings.length === hBefore20 + 1,
       hBefore20 + ' → ' + holdings.length);
    const h20 = holdings[holdings.length - 1];
    ok('base 가 저장된다', h20.base === 120, h20.base);
    ok('pBase 가 0~1 로 저장된다', Math.abs(h20.pBase - 0.5) < 1e-9, h20.pBase);
    ok('pBear 는 저장하지 않는다', !('pBear' in h20), JSON.stringify(h20));
    ok('prob 은 Bull 확률', Math.abs(h20.prob - 0.25) < 1e-9, h20.prob);

    /* 확률 합이 100 이 아니면 저장 거부 */
    const hCnt = holdings.length;
    $('i-name').value  = '__합틀림';
    $('i-price').value = '100'; $('i-up').value = '150';
    $('i-base').value  = '120'; $('i-down').value = '70';
    $('i-prob').value  = '25'; $('i-pbase').value = '50'; $('i-pbear').value = '30';
    $('addBtn').click();
    ok('확률 합 ≠ 100 이면 저장 거부', holdings.length === hCnt,
       hCnt + ' → ' + holdings.length);

    /* 순서 위반이면 저장 거부 */
    $('i-name').value  = '__순서틀림';
    $('i-base').value  = '60';          // 하단 70 보다 낮다
    $('i-pbear').value = '25';
    $('addBtn').click();
    ok('Bull ≥ Base ≥ Bear 위반 시 저장 거부', holdings.length === hCnt,
       hCnt + ' → ' + holdings.length);

    /* 폼 리셋 */
    $('i-name').value  = '__리셋확인';
    $('i-base').value  = '120';
    $('addBtn').click();
    ok('폼 리셋으로 Base 칸이 비워진다', $('i-base').value === '', $('i-base').value);
    ok('폼 리셋으로 Base 확률 칸이 비워진다', $('i-pbase').value === '', $('i-pbase').value);

    /* 스냅샷 버전 */
    ok('스냅샷이 v5', dataSnapshot().v === 5, dataSnapshot().v);
```

- [ ] **Step 2: 실패를 확인한다**

```sh
node docs/superpowers/build-selfcheck.js
python3 -m http.server 8765 --bind 127.0.0.1 &
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --disable-gpu --no-first-run --user-data-dir=/tmp/cp-t3 \
  --dump-dom http://127.0.0.1:8765/_selfcheck.html > /tmp/dom-t3.html
```

Chrome 151 은 DOM 을 뱉은 뒤 종료하지 않으므로 백그라운드로 돌리고 죽인다.
`/tmp/dom-t3.html` 에서 `id="selfcheck-panel"` 이후를 읽는다.
Expected: FAIL — `스크립트 실행 중 예외` (`$('i-base')` 가 `null`).

- [ ] **Step 3: 입력란을 추가한다**

`index_kelly.html:354` 의 상단목표 줄부터 승률 블록까지를 아래 형태로 바꾼다.
`i-up`·`i-down`·`i-prob` 의 **id 는 유지**하고 라벨과 신규 칸만 더한다:

```html
    <div class="fld"><label>상단 Bull</label><input id="i-up" inputmode="decimal" placeholder="400">
      <input type="number" id="i-prob" min="0" max="100" step="1" placeholder="25" class="prob-in"></div>
    <div class="fld"><label>Base</label><input id="i-base" inputmode="decimal" placeholder="300">
      <input type="number" id="i-pbase" min="0" max="100" step="1" placeholder="50" class="prob-in"></div>
    <div class="fld"><label>하단 Bear</label><input id="i-down" inputmode="decimal" placeholder="200">
      <input type="number" id="i-pbear" min="0" max="100" step="1" placeholder="25" class="prob-in"></div>
```

CSS 는 `index_kelly.html` 의 `.pl-stage` 정의 근처에 추가한다:

```css
  .prob-in{width:64px;margin-left:8px;background:var(--panel-2);border:1px solid var(--line);
    color:var(--ink);border-radius:8px;padding:9px;font-size:13px;
    font-family:var(--mono);text-align:right;}
  .re-sum{font-family:var(--mono);font-size:11px;color:var(--dim);margin-top:6px;text-align:right;}
```

`.re-sum` 은 Task 4·5 의 재평가·수정 모달이 확률 합을 표시하는 데 쓴다. 여기서 한 번에 만든다.

기존 `i-prob` 의 인라인 `style` 속성은 제거하고 `class="prob-in"` 으로 통일한다.

- [ ] **Step 4: `readProbs()` 를 만든다**

`index_kelly.html` 의 `readProb()` 정의 **뒤**에 붙인다 (`readProb` 은 재평가·수정 모달이 계속 쓰므로 지우지 않는다):

```js
/* 세 확률 입력을 읽는다. 하나라도 비었거나 합이 100 이 아니면 null.
   Bear 는 검증에만 쓰고 저장하지 않는다 — 셋을 저장하면 합이 깨졌을 때
   어느 값이 진실인지 알 수 없다. */
function readProbs(){
  const a=parseFloat($('i-prob').value), b=parseFloat($('i-pbase').value),
        c=parseFloat($('i-pbear').value);
  if(isNaN(a)||isNaN(b)||isNaN(c)) return null;
  if(Math.abs(a+b+c-100)>1e-9) return null;
  return {pBull:a/100, pBase:b/100, pBear:c/100};
}
```

- [ ] **Step 5: `input` 리스너 목록을 넓힌다**

`index_kelly.html:991` 을 바꾼다:

```js
['i-price','i-up','i-down','i-base','i-prob','i-pbase','i-pbear']
  .forEach(id=>$(id).addEventListener('input',updatePreview));
```

- [ ] **Step 6: `addBtn` 핸들러를 고친다**

`index_kelly.html:1079-1082` 의 값 읽기 부분을 바꾼다:

```js
  const name=$('i-name').value.trim();
  const price=numVal('i-price'),up=numVal('i-up'),down=numVal('i-down'),base=numVal('i-base');
  const P=readProbs();
```

`if(prob===null){setStatus('승률을 입력하세요',true);return;}` 줄을 아래로 교체한다:

```js
  if(isNaN(base)){setStatus('Base 목표가를 입력하세요',true);return;}
  if(P===null){setStatus('세 확률을 입력하고 합을 100%로 맞추세요',true);return;}
  if(!(up>=base && base>=down)){setStatus('상단 ≥ Base ≥ 하단 순서여야 합니다',true);return;}
```

`isNaN(price)||isNaN(up)||isNaN(down)` 검사는 그대로 둔다. holding 생성부는 현재 이렇다:

```js
  const h={id:Date.now().toString(36),name,price,up,down,prob,startQ,ccy:useCcy,fx,ledger:[]};
  const th=$('i-thesis').value.trim();
  if(th) h.thesis=th;
  holdings.push(h);
```

**첫 줄만** 바꾼다. 아래 세 줄(논지 승계)은 건드리지 않는다 — 지우면 직전 기능이 깨진다:

```js
  const h={id:Date.now().toString(36),name,price,up,down,base,prob:P.pBull,pBase:P.pBase,
           startQ,ccy:useCcy,fx,ledger:[]};
```

폼 리셋 줄(`$('i-name').value='';…`)에 세 칸을 더한다:

```js
  $('i-base').value='';$('i-pbase').value='';$('i-pbear').value='';
```

- [ ] **Step 7: 스냅샷을 v5 로 올린다**

`index_kelly.html:1597` 의 `dataSnapshot()` 에서 `v:4` → `v:5`.

`index_kelly.html:1631` 의 `const ver=d.v||1;` 아래, `if(ver<2){…}` **뒤**에 붙인다:

```js
  // v5: 3-시나리오. 기존 종목은 base 가 없어 켈리가 보류된다 — 기본값을 채우지 않는다.
  // 아무도 생각한 적 없는 숫자가 목표 배분을 움직이는 것보다 빈 칸이 정직하다.
```

**코드는 없다.** 주석만 남긴다 — v4 백업을 열면 `base` 가 없는 채로 그대로 로드되고,
`kellyOf` 가 `Base 미입력` 을 반환하는 것이 의도된 동작이다.

- [ ] **Step 8: 통과를 확인한다**

Step 2 와 같은 절차로 다시 돌린다.
Expected: PASS — 패널 머리글 `전부 통과 · 107건` (기존 97 + 신규 10).

- [ ] **Step 9: 커밋**

```bash
git add index_kelly.html docs/superpowers/selfcheck-rejection-ledger.js
git commit -m "feat(kelly): add three-scenario inputs to add form"
```

본문:
```
확률은 셋 다 입력받아 합을 검증하되 둘만 저장한다. 셋을 저장하면 마이그레이션
버그로 합이 깨졌을 때 어느 값이 진실인지 알 수 없다.

순서 검증(Bull ≥ Base ≥ Bear)을 넣는다 — 수식은 순서와 무관하게 돌아가서
Base 와 Bear 를 바꿔 적어도 조용히 통과하고, 그러면 라벨이 거짓말을 한다.
```

---

### Task 4: 재평가 모달 — 3행 입력

**Files:**
- Modify: `index_kelly.html:521-527` (재평가 입력란)
- Modify: `index_kelly.html:2444-2470` (`openReassessModal`)
- Modify: `index_kelly.html:2495-2521` (`re-save`)
- Modify: `index_kelly.html:1420-1426` (재평가 이력 렌더)
- Test: `docs/superpowers/selfcheck-rejection-ledger.js` (신규 섹션 21)

**Interfaces:**
- Consumes: `kellyOf(h)` (Task 2), `holdings[].base`·`pBase` (Task 3)
- Produces: 원장 `reassess` 엔트리에 `base`·`pBase`·`prevBase`·`prevPBase` 추가

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`selfcheck-rejection-ledger.js` 의 `} catch (e) {` **바로 앞**에 붙인다:

```js
    /* ---------- 21. 재평가 — Base 변경과 이력 ---------- */
    const rid='__t_re';
    holdings.push({id:rid,name:'__재평가테스트',price:100,up:150,base:120,down:70,
      prob:0.25,pBase:0.5,startQ:currentQGuess(),ccy:'USD',fx:1,ledger:[]});
    render();
    openReassessModal(rid);
    ok('재평가 모달에 Base 가 채워진다', $('re-base').value === '120', $('re-base').value);
    ok('재평가 모달에 Base 확률이 채워진다', $('re-pbase').value === '50', $('re-pbase').value);
    ok('재평가 모달에 Bear 확률이 채워진다', $('re-pbear').value === '25', $('re-pbear').value);

    $('re-base').value   = '130';
    $('re-reason').value = '';
    $('re-save').click();
    ok('근거 없으면 저장 거부', holdings.find(h=>h.id===rid).base === 120,
       holdings.find(h=>h.id===rid).base);

    $('re-reason').value = 'Base 상향 — 가격 인상 반영';
    $('re-save').click();
    const rh = holdings.find(h=>h.id===rid);
    ok('Base 가 갱신된다', rh.base === 130, rh.base);
    const last = rh.ledger[rh.ledger.length-1];
    ok('원장에 이전 Base 가 남는다', last.prevBase === 120, last.prevBase);
    ok('원장에 새 Base 가 남는다', last.base === 130, last.base);
    ok('원장에 이전 Base 확률이 남는다', Math.abs(last.prevPBase - 0.5) < 1e-9, last.prevPBase);

    /* 순서·확률 검증이 재평가에도 걸린다 */
    openReassessModal(rid);
    $('re-base').value   = '60';        // 하단 70 보다 낮다
    $('re-reason').value = '순서 위반 테스트';
    $('re-save').click();
    ok('재평가도 순서 위반을 막는다', holdings.find(h=>h.id===rid).base === 130,
       holdings.find(h=>h.id===rid).base);
```

- [ ] **Step 2: 실패를 확인한다**

Task 3 Step 2 와 같은 절차 (`--user-data-dir=/tmp/cp-t4`).
Expected: FAIL — `스크립트 실행 중 예외` (`$('re-base')` 가 `null`).

- [ ] **Step 3: 입력란을 추가한다**

`index_kelly.html:521-527` 을 아래로 바꾼다:

```html
      <div class="fld"><label id="re-up-label">상단 Bull</label><input id="re-up" inputmode="numeric">
        <input type="number" id="re-prob" min="0" max="100" step="1" class="prob-in"></div>
      <div class="fld"><label id="re-base-label">Base</label><input id="re-base" inputmode="numeric">
        <input type="number" id="re-pbase" min="0" max="100" step="1" class="prob-in"></div>
      <div class="fld"><label id="re-down-label">하단 Bear</label><input id="re-down" inputmode="numeric">
        <input type="number" id="re-pbear" min="0" max="100" step="1" class="prob-in"></div>
```

`re-prob` 이 있던 별도 승률 `<div>` 는 위로 흡수됐으므로 제거하되, **그 안의
`<span id="re-prob-val">` 은 남긴다** — 코드가 `$('re-prob-val').textContent` 를
참조하므로 지우면 `null` 접근으로 죽는다. 세 확률 입력 아래로 옮기고 용도를
"패배 %" 에서 "합 %" 로 바꾼다:

```html
      <div class="re-sum">확률 합 <span id="re-prob-val">—</span></div>
```

- [ ] **Step 4: 모달 열기를 고친다**

`index_kelly.html:2455` 의 `$('re-prob').value=Math.round(h.prob*100);` **뒤**에 붙이고,
바로 다음 줄인 `$('re-prob-val').textContent='패배 '+…` 는 아래로 **교체**한다:

```js
  $('re-base').value  = h.base!==undefined ? h.base : '';
  $('re-pbase').value = h.pBase!==undefined ? Math.round(h.pBase*100) : '';
  $('re-pbear').value = (h.pBase!==undefined && h.prob!==undefined)
    ? Math.round((1-h.prob-h.pBase)*100) : '';
  $('re-prob-val').textContent = reProbSum();
```

같은 파일에 헬퍼를 하나 더한다 (`openReassessModal` 정의 **앞**):

```js
/* 재평가 모달의 확률 합 표시 — 100%가 아니면 눈에 띄어야 한다 */
function reProbSum(){
  const a=parseFloat($('re-prob').value), b=parseFloat($('re-pbase').value),
        c=parseFloat($('re-pbear').value);
  if(isNaN(a)||isNaN(b)||isNaN(c)) return '—';
  return (a+b+c)+'%';
}
```

`['re-up','re-down','re-base','re-prob','re-pbase','re-pbear']` 각각에
`input` 리스너를 붙여 `$('re-prob-val').textContent=reProbSum(); reDelta();` 를 부른다.
기존에 `re-up`·`re-down`·`re-prob` 에 걸려 있던 `reDelta` 리스너가 있으면 이것으로 통합한다.

`:2450` 의 `re-cur` 문구도 세 시나리오를 보여주도록 바꾼다:

```js
  $('re-cur').textContent=`현재 상단 ${sym}${fmtNum(h.up)} · Base ${h.base!==undefined?sym+fmtNum(h.base):'—'} · 하단 ${sym}${fmtNum(h.down)}`;
```

- [ ] **Step 5: 저장을 고친다**

`index_kelly.html:2497-2518` 을 아래로 바꾼다:

```js
  const up=numVal('re-up'), down=numVal('re-down'), base=numVal('re-base');
  const pb=parseFloat($('re-prob').value), pm=parseFloat($('re-pbase').value),
        pw=parseFloat($('re-pbear').value);
  let quarter=$('re-quarter').value.trim().toUpperCase();
  const reason=$('re-reason').value.trim();
  if(isNaN(up)||isNaN(down)||isNaN(base)){ setStatus('세 시나리오를 입력하세요',true); return; }
  if(up<=0||down<=0||base<=0){ setStatus('목표가는 0보다 커야 합니다',true); return; }
  if(isNaN(pb)||isNaN(pm)||isNaN(pw)){ setStatus('세 확률을 입력하세요',true); return; }
  if(Math.abs(pb+pm+pw-100)>1e-9){ setStatus('확률 합을 100%로 맞추세요',true); return; }
  if(!(up>=base && base>=down)){ setStatus('상단 ≥ Base ≥ 하단 순서여야 합니다',true); return; }
  if(!reason){ setStatus('재평가 근거를 적어주세요',true); return; }
  const prob=pb/100, pBase=pm/100;
  if(!parseQ(quarter)) quarter=currentQGuess();
  const entry={
    id:Date.now().toString(36), quarter, date:new Date().toISOString().slice(0,10),
    type:'reassess',
    up, down, base, prob, pBase,
    prevUp:h.up, prevDown:h.down, prevBase:h.base, prevProb:h.prob, prevPBase:h.pBase,
    reason
  };
  if(!h.ledger) h.ledger=[];
  h.ledger.push(entry);
  h.up=up; h.down=down; h.base=base; h.prob=prob; h.pBase=pBase;
```

- [ ] **Step 6: 이력 렌더를 고친다**

`index_kelly.html:1422-1426` 의 `parts` 블록을 바꾼다:

```js
                const parts=[];
                if(e.prevUp!==undefined && e.prevUp!==e.up) parts.push(`상단 ${fmtNum(e.prevUp)}→${fmtNum(e.up)}`);
                if(e.prevBase!==undefined && e.prevBase!==e.base) parts.push(`Base ${fmtNum(e.prevBase)}→${fmtNum(e.base)}`);
                if(e.prevDown!==undefined && e.prevDown!==e.down) parts.push(`하단 ${fmtNum(e.prevDown)}→${fmtNum(e.down)}`);
                if(e.prevProb!==undefined && Math.round(e.prevProb*100)!==Math.round(e.prob*100)) parts.push(`Bull ${Math.round(e.prevProb*100)}→${Math.round(e.prob*100)}%`);
                if(e.prevPBase!==undefined && Math.round(e.prevPBase*100)!==Math.round(e.pBase*100)) parts.push(`Base확률 ${Math.round(e.prevPBase*100)}→${Math.round(e.pBase*100)}%`);
                const changeStr=parts.length?parts.join(' · ')
                  :`상단 ${fmtNum(e.up)} · Base ${fmtNum(e.base)} · 하단 ${fmtNum(e.down)}`;
```

- [ ] **Step 7: 통과를 확인한다**

Expected: PASS — `전부 통과 · 116건` (107 + 신규 9).

- [ ] **Step 8: 커밋**

```bash
git add index_kelly.html docs/superpowers/selfcheck-rejection-ledger.js
git commit -m "feat(kelly): reassess all three scenarios with rationale"
```

---

### Task 5: 수정(✎) 모달 — 3행 입력

**Files:**
- Modify: `index_kelly.html:481-487` (수정 입력란)
- Modify: `index_kelly.html` (`openEditModal` 의 값 채우기)
- Modify: `index_kelly.html:2422-2440` (`em-save`)
- Test: `docs/superpowers/selfcheck-rejection-ledger.js` (신규 섹션 22)

**Interfaces:**
- Consumes: `holdings[].base`·`pBase` (Task 3)
- Produces: 없음 (원장에 이력을 남기지 않는다)

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`selfcheck-rejection-ledger.js` 의 `} catch (e) {` **바로 앞**에 붙인다:

```js
    /* ---------- 22. 수정(✎) — 마이그레이션으로 Base 를 처음 채우는 경로 ---------- */
    const eid='__t_edit';
    holdings.push({id:eid,name:'__수정테스트',price:100,up:150,down:70,prob:0.55,
      startQ:currentQGuess(),ccy:'USD',fx:1,ledger:[]});   // v4 모양 — base·pBase 없음
    render();
    ok('Base 없는 종목은 켈리가 보류된다', kellyOf(holdings.find(h=>h.id===eid)).f === null,
       String(kellyOf(holdings.find(h=>h.id===eid)).f));

    openEditModal(eid);
    ok('수정 모달의 Base 칸이 비어 있다', $('em-base').value === '', $('em-base').value);
    $('em-base').value  = '120';
    $('em-prob').value  = '25';
    $('em-pbase').value = '50';
    $('em-pbear').value = '25';
    $('em-save').click();
    const eh = holdings.find(h=>h.id===eid);
    ok('수정으로 Base 가 채워진다', eh.base === 120, eh.base);
    ok('수정으로 pBase 가 채워진다', Math.abs(eh.pBase - 0.5) < 1e-9, eh.pBase);
    ok('수정은 원장에 이력을 남기지 않는다', (eh.ledger||[]).length === 0,
       (eh.ledger||[]).length);
    ok('채운 뒤 켈리가 계산된다', kellyOf(eh).f !== null, 'null');

    /* 검증은 수정 경로에도 걸린다 */
    openEditModal(eid);
    $('em-base').value  = '60';
    $('em-save').click();
    ok('수정도 순서 위반을 막는다', holdings.find(h=>h.id===eid).base === 120,
       holdings.find(h=>h.id===eid).base);
```

- [ ] **Step 2: 실패를 확인한다**

Expected: FAIL — `스크립트 실행 중 예외` (`$('em-base')` 가 `null`).

- [ ] **Step 3: 입력란을 추가한다**

`index_kelly.html:481-487` 을 아래로 바꾼다:

```html
      <div class="fld"><label>상단 Bull</label><input id="em-up" inputmode="numeric">
        <input type="number" id="em-prob" min="0" max="100" step="1" class="prob-in"></div>
      <div class="fld"><label>Base</label><input id="em-base" inputmode="numeric">
        <input type="number" id="em-pbase" min="0" max="100" step="1" class="prob-in"></div>
      <div class="fld"><label>하단 Bear</label><input id="em-down" inputmode="numeric">
        <input type="number" id="em-pbear" min="0" max="100" step="1" class="prob-in"></div>
```

`em-prob` 이 있던 별도 승률 블록은 제거하되 **`<span id="em-prob-val">` 은 남긴다**
(`$('em-prob-val').textContent` 참조가 있다). 세 확률 아래로 옮기고 용도를 합 표시로 바꾼다:

```html
      <div class="re-sum">확률 합 <span id="em-prob-val">—</span></div>
```

- [ ] **Step 4: 모달 열기를 고친다**

`index_kelly.html:2399` 의 `$('em-prob').value=Math.round(h.prob*100);` **뒤**에 붙이고,
다음 줄 `$('em-prob-val').textContent='패배 '+…`(`:2400`) 를 아래로 **교체**한다:

```js
  $('em-base').value  = h.base!==undefined ? h.base : '';
  $('em-pbase').value = h.pBase!==undefined ? Math.round(h.pBase*100) : '';
  $('em-pbear').value = (h.pBase!==undefined && h.prob!==undefined)
    ? Math.round((1-h.prob-h.pBase)*100) : '';
  $('em-prob-val').textContent = emProbSum();
```

`openEditModal` 정의 **앞**에 헬퍼를 더한다:

```js
/* 수정 모달의 확률 합 표시 */
function emProbSum(){
  const a=parseFloat($('em-prob').value), b=parseFloat($('em-pbase').value),
        c=parseFloat($('em-pbear').value);
  if(isNaN(a)||isNaN(b)||isNaN(c)) return '—';
  return (a+b+c)+'%';
}
```

`['em-prob','em-pbase','em-pbear']` 에 `input` 리스너를 붙여
`$('em-prob-val').textContent=emProbSum();` 을 부른다.

- [ ] **Step 5: 저장을 고친다**

`index_kelly.html:2425-2436` 의 값 읽기·검증·적용을 바꾼다:

```js
  const price=numVal('em-price'), up=numVal('em-up'), down=numVal('em-down'), base=numVal('em-base');
  const pb=parseFloat($('em-prob').value), pm=parseFloat($('em-pbase').value),
        pw=parseFloat($('em-pbear').value);
  let startQ=$('em-startq').value.trim().toUpperCase();
  if(!name){ setStatus('종목명을 입력하세요',true); return; }
  if(isNaN(price)||isNaN(up)||isNaN(down)||isNaN(base)){ setStatus('가격·세 시나리오를 모두 입력하세요',true); return; }
  if(price<=0){ setStatus('현재가는 0보다 커야 합니다',true); return; }
  if(isNaN(pb)||isNaN(pm)||isNaN(pw)){ setStatus('세 확률을 입력하세요',true); return; }
  if(Math.abs(pb+pm+pw-100)>1e-9){ setStatus('확률 합을 100%로 맞추세요',true); return; }
  if(!(up>=base && base>=down)){ setStatus('상단 ≥ Base ≥ 하단 순서여야 합니다',true); return; }
  if(!parseQ(startQ)) startQ=h.startQ||currentQGuess();
  const fx = emCtx.ccy==='USD' ? (numVal('em-fx')||1400) : 1;
  // apply — ledger untouched
  h.name=name; h.price=price; h.up=up; h.down=down; h.base=base;
  h.prob=pb/100; h.pBase=pm/100;
```

- [ ] **Step 6: 통과를 확인한다**

Expected: PASS — `전부 통과 · 123건` (116 + 신규 7).

- [ ] **Step 7: 커밋**

```bash
git add index_kelly.html docs/superpowers/selfcheck-rejection-ledger.js
git commit -m "feat(kelly): fill base via edit modal without ledger entry"
```

본문:
```
마이그레이션은 판단의 변경이 아니라 없던 차원을 처음 적는 것이다. 재평가로
처리하면 상단 400→400 같은 의미 없는 변경 이력이 종목마다 하나씩 쌓인다.
```

---

### Task 6: Base 미입력 배너와 배분 회귀

**Files:**
- Modify: `index_kelly.html:1258-1280` 부근 (보유 카드 렌더)
- Test: `test_pipeline.js` (신규 그룹 1개), `docs/superpowers/selfcheck-rejection-ledger.js` (신규 섹션 23)

**Interfaces:**
- Consumes: `kellyOf(h)` (Task 2)
- Produces: `.hold-nobase` 클래스의 배너

- [ ] **Step 1: 실패하는 순수 테스트를 쓴다**

`test_pipeline.js` 의 마지막 `console.log('\n' + (fail ? ...` **바로 앞**에 붙인다:

```js
/* ---- compute — Base 미입력 종목은 배분에서 빠진다 ---- */
grp('compute — Base 미입력 회귀');
{
  const full={id:'F',name:'채움',price:100,up:150,base:120,down:70,prob:0.25,pBase:0.5,
              startQ:'2026Q1',ccy:'USD',fx:1,ledger:[]};
  const bare={id:'B',name:'빔',price:100,up:150,down:70,prob:0.55,
              startQ:'2026Q1',ccy:'USD',fx:1,ledger:[]};   // base 없음
  alloc.setState([full,bare],[]);
  const r=alloc.compute();
  eq('rows 에는 둘 다 있다', r.rows.length, 2);
  eq('pos 에는 채운 종목만', r.pos.map(x=>x.h.id), ['F']);
  eq('빈 종목의 err 가 붙는다', r.rows.find(x=>x.h.id==='B').k.err, 'Base 미입력 — 켈리 보류');

  // §7-D18 의 희석 버그와 같은 형태: 계산 불가 종목이 posSum 에 끼면 안 된다
  const withBare=alloc.compute();
  const tW=withBare.pos.find(x=>x.h.id==='F');
  alloc.setState([full],[]);
  const alone=alloc.compute();
  const tA=alone.pos.find(x=>x.h.id==='F');
  eq('Base 없는 종목이 살아있는 종목을 희석하지 않는다',
     Math.abs(tW.rel*withBare.equityScale - tA.rel*alone.equityScale) < 1e-9, true);

  alloc.setState([bare],[]);
  const only=alloc.compute();
  eq('전부 미입력이면 pos 가 빈다', only.pos.length, 0);
  eq('전부 미입력이면 equityScale 0', only.equityScale, 0);
  eq('전부 미입력이면 현금 100%', only.cashWeight, 1);
}
```

- [ ] **Step 2: 실패를 확인한다**

Run: `node test_pipeline.js`
Expected: 이 그룹은 Task 2 구현으로 **이미 통과할 수 있다.** 통과하면 그대로 두고 Step 3 으로
간다 — 회귀 방지용 테스트이므로 실패가 목적이 아니다. 만약 FAIL 이면 `compute()` 가
`k.f===null` 을 거르지 않는 것이므로 그 자리를 고친다.

- [ ] **Step 3: 배너를 추가한다**

`index_kelly.html` 의 보유 카드 렌더에서 켈리 경고를 그리는 자리(`const thinWarn=…`,
`:1254` 부근) **앞**에 붙인다:

```js
      const noBase = k.err==='Base 미입력 — 켈리 보류'
        ? `<div class="hold-nobase">⚠ Base 미입력 — 켈리 보류. <b>✎ 수정</b>에서 Base 목표가와 세 확률을 채우세요</div>`
        : '';
```

`${thinWarn}` 을 쓰는 템플릿 자리 **앞**에 `${noBase}` 를 넣는다.

CSS 를 `.prob-in` 정의 근처에 추가한다:

```css
  .hold-nobase{font-size:11px;color:var(--warn);margin-top:6px;line-height:1.5;}
```

- [ ] **Step 4: DOM 테스트를 쓴다**

`selfcheck-rejection-ledger.js` 의 `} catch (e) {` **바로 앞**에 붙인다:

```js
    /* ---------- 23. Base 미입력 배너 ---------- */
    holdings = [
      {id:'nb1',name:'__배너대상',price:100,up:150,down:70,prob:0.55,
       startQ:currentQGuess(),ccy:'USD',fx:1,ledger:[]},
      {id:'nb2',name:'__정상',price:100,up:150,base:120,down:70,prob:0.25,pBase:0.5,
       startQ:currentQGuess(),ccy:'USD',fx:1,ledger:[]}
    ];
    render();
    const banners=[...document.querySelectorAll('.hold-nobase')];
    ok('Base 미입력 종목에 배너가 뜬다', banners.length === 1, banners.length);
    ok('배너 문구에 수정 안내가 있다',
       banners.length === 1 && banners[0].textContent.includes('수정'),
       banners.length ? banners[0].textContent : '배너 없음');
```

- [ ] **Step 5: 통과를 확인한다**

Run: `node test_pipeline.js` → `OK  97 pass` (90 + 신규 7)
selfcheck → `전부 통과 · 125건` (123 + 신규 2)

- [ ] **Step 6: 커밋**

```bash
git add index_kelly.html test_pipeline.js docs/superpowers/selfcheck-rejection-ledger.js
git commit -m "feat(kelly): flag holdings missing a base scenario"
```

---

### Task 7: 돌연변이 검사 · 문서 갱신

**Files:**
- Modify: `PRD.md` (§4.4 켈리 코어·필드, §5 v5, §7 D20, §9 기각 조건)
- Modify: `docs/superpowers/browser-checklist-rejection-ledger.md` (항목 수·커버리지·2단계)
- Modify: `docs/HANDOFF.md` (덮어씀)

**Interfaces:**
- Consumes: 없음. 검증과 문서만 다룬다.

- [ ] **Step 1: 전체 테스트를 돌린다**

```sh
node test_pipeline.js
```
Expected: `OK  97 pass`

selfcheck 는 Task 3 Step 2 절차로 돌린다.
Expected: `전부 통과 · 125건`

- [ ] **Step 2: 돌연변이 3개로 테스트가 무는지 확인한다**

`_selfcheck.html` **사본만** 변조한다. `index_kelly.html` 은 건드리지 않는다.
각 돌연변이마다 `node docs/superpowers/build-selfcheck.js` 로 다시 만든 뒤 주입한다.

- **A. 유효근 선택을 뒤집는다** — `kelly3` 의 `return g(cand[0])>=g(cand[1])?cand[0]:cand[1];` 를
  `return cand[1];` 로. 그리고 `filter(inDomain)` 을 지운다.
  Expected: `kelly3 — 2-결과 축퇴` 3건과 `kelly3 — 3-결과` 4건 FAIL
- **B. 순서 검증을 없앤다** — `kellyOf` 의 `if(!(rs[0]>=rs[1] && rs[1]>=rs[2]))` 줄을 지운다.
  Expected: `순서 위반 (Base < 하단)` FAIL
- **C. `thinDown` 을 하단 칸 기준으로 되돌린다** — `Math.abs(Math.min(...rs))` 를
  `Math.abs(rs[2])` 로. Expected: 이 돌연변이는 **통과할 수도 있다** — 순서 검증이 있으면
  `rs[2]` 가 항상 최소이기 때문이다. 통과하면 방어적 코드임을 확인한 것이므로
  그대로 두고 넘어간다. FAIL 이 나오면 더 좋다

돌연변이 A·B 가 FAIL 을 안 내면 그 테스트는 아무것도 검사하지 않는 것이다 — 테스트를 고친다.

- [ ] **Step 3: 정리한다**

```sh
node docs/superpowers/build-selfcheck.js   # 깨끗한 상태로 재생성
rm -f _selfcheck.html
git status --short                          # index_kelly.html 이 없어야 한다
```

- [ ] **Step 4: PRD §4.4 를 갱신한다**

**켈리 코어** 문단을 아래로 교체한다:

```markdown
**켈리 코어**: 세 시나리오(Bull/Base/Bear)와 세 확률로 `E[log(1+f·r)]` 를 최대화한다. 3-결과에서는 닫힌해가 있다 — `Σ pᵢrᵢ/(1+f·rᵢ)=0` 의 분모를 걷어내면 `α f² + β f + γ = 0` (α=r₁r₂r₃, γ=E[r])이 되고, log 정의역 안의 근이 유일한 최대점이다. Base 를 현재가·확률 0 으로 두면 정확히 구 공식 `f = p/a − q/b` 로 환원된다(§7-D20). 음수 켈리 종목은 배분 제외(§7-D6). 상대 배분은 풀 켈리 정규화 — 하프 켈리는 정규화 시 약분되어 무의미하므로 총노출 결정에만 사용(§7-D5).
```

**후보 파이프라인 계층** 위에 필드 설명을 한 줄 넣는다:

```markdown
- **시나리오 필드**: `up`·`base`·`down`(목표가) + `prob`(P(Bull))·`pBase`. `pBear = 1−prob−pBase` 로 도출하며 저장하지 않는다. 입력은 셋 다 받아 합 100%와 `Bull ≥ Base ≥ Bear` 순서를 검증한다. `base` 없는 v4 종목은 켈리를 보류한다.
```

- [ ] **Step 5: PRD §5 를 갱신한다**

`kelly2y` 행의 `(v4)` 를 `(v5)` 로 바꾼다.

- [ ] **Step 6: PRD §7 에 D20 을 추가한다**

표에 한 줄:

```markdown
| D20 | 켈리를 3-시나리오(Bull/Base/Bear)로 확장, 마이그레이션은 기본값을 채우지 않음 | ① Base 를 선택 입력으로 — 두 계산 경로가 공존 ② 현재가·확률 0 으로 자동 채움 — 무변경이지만 판단을 건너뛰게 됨 ③ 상단·하단의 기하평균 — 아무도 생각한 적 없는 숫자가 배분을 움직임 ④ N-시나리오 일반화 — 4개부터 닫힌해가 사라짐 | 밸류에이션 분석이 Bear/Base/Bull 세 적정가로 끝나는데 입력이 둘이면 기준선이나 하방을 버려야 했다. 마이그레이션 직후 전 종목 켈리가 보류되는 것은 결함이 아니라 forcing function이다 — 빈 칸은 "아직 판단하지 않았다"는 정직한 상태다. 대가: Base 를 다 채울 때까지 목표 배분·매매일지가 빈다. 전제의 한계(기간 일관성·꼬리 절단·상관관계)는 설계 문서 «켈리 전제와 한계» 참조 |
```

- [ ] **Step 7: PRD §9 기각 조건에 한 줄 얹는다**

```markdown
- **켈리 3-시나리오 점검** — ① Base 와 Bull 이 늘 같은 값으로 적힌다 ② 확률 합 맞추기가 번거로워 입력을 회피한다 ③ 마이그레이션 후 한 분기 안에 Base 를 다 못 채운다 ④ 종목마다 도달 기간 관점이 제각각이라 f 비교가 무의미해진다 — 하나라도 해당하면 재검토한다. ④는 §7-D5(켈리를 상대 배분에 쓰는 결정)까지 소급된다
```

- [ ] **Step 8: 체크리스트 문서를 갱신한다**

`docs/superpowers/browser-checklist-rejection-ledger.md`:
- `97개 항목` → `125개 항목`
- 커버리지 목록에 세 줄 추가:
```markdown
- 3-시나리오 입력의 확률 합 100%·순서(Bull ≥ Base ≥ Bear) 검증 — 추가·재평가·수정 세 경로
- `pBear` 미저장·도출, v4 종목의 켈리 보류와 배너
- 재평가 원장의 Base 변화 이력
```
- 2단계 **보기** 항목에 추가:
```markdown
- [ ] **목표가 3칸 + 확률 3칸이 폰 폭에서 안 깨진다** — 가로 스크롤이 안 생긴다 (P3)
- [ ] 확률 합이 100이 아닐 때 오류 문구가 읽힌다
- [ ] `⚠ Base 미입력` 배너가 앰버색으로 눈에 띈다
```

- [ ] **Step 9: HANDOFF 를 덮어쓴다**

담을 것:
- 지금 상태: 3-시나리오 구현 완료, 커밋됨, **미배포**. 배포하면 폰에서 전 종목 켈리가
  보류되어 목표 배분이 빈다 — 사용자가 Base 를 채울 시간을 확보한 뒤 배포할지 판단 필요
- 손대지 말 것: `kellyOf` 선언 형태(`grab()` 추출), `kelly3` 의 `α≈0 ∧ β≈0` 가드,
  `thinDown` 의 `Math.min` 기준, 순서 검증(라벨이 거짓말하는 것을 막는 유일한 장치),
  마이그레이션에 기본값을 채우지 말 것
- 알아야 할 것: PBR 로 입력하면 켈리는 맞지만 **주수가 틀린다** — BPS 로 환산한 $ 를 넣을 것.
  종목 간 도달 기간 관점을 맞춰야 f 비교가 유효하다
- 미결: 폰 실기 검증(레이아웃·실데이터), 이전 세션부터 밀린 검토 필드 폰 검증
- 되돌리는 법: `kelly3` 에 `p_base=0, r_base=0` 을 넘기면 기존 동작으로 정확히 복귀.
  축퇴 성질이 롤백 경로를 겸한다

- [ ] **Step 10: 커밋**

```bash
git add PRD.md docs/superpowers/browser-checklist-rejection-ledger.md docs/HANDOFF.md
git commit -m "docs: record three-scenario kelly as D20"
```

---

## 검증 요약

| 무엇 | 어떻게 | 기대 |
|---|---|---|
| 순수 수식 | `node test_pipeline.js` | `OK  97 pass` |
| DOM 경로 | headless Chrome + `_selfcheck.html` | `전부 통과 · 125건` |
| 테스트가 무는가 | 돌연변이 A·B (Task 7 Step 2) | 각각 지정된 항목 FAIL |
| 레이아웃·실데이터 | 폰 실기 (자동 검사 불가) | 체크리스트 2단계 |

**항목 수가 예상과 다르면 멈춘다.** 테스트를 빠뜨렸거나 이전 태스크가 깨진 것이다.

## 태스크 간 중간 상태 주의

Task 2 를 마치면 기존 종목의 켈리가 전부 보류되고, Task 2 Step 5~6 이 `readProbs`·`base`
를 앞서 참조하므로 **Task 3~4 전에는 종목 추가 폼과 재평가 모달이 콘솔 오류를 낸다.**
의도된 중간 상태다. `node test_pipeline.js` 는 전 구간에서 통과해야 한다 —
순수 함수는 DOM 을 안 보기 때문이다. **Task 7 을 마치기 전에 배포하지 않는다.**
