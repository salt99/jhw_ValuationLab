/* P5 단위 검증 — 실행: node test_pipeline.js
   index_kelly.html의 PIPELINE PURE 블록만 추출해 DOM 없이 실행한다. */
const fs = require('fs');
const src = fs.readFileSync(__dirname + '/index_kelly.html', 'utf8');
const m = src.match(/\/\* ===== PIPELINE PURE =====[\s\S]*?\/\* ===== \/PIPELINE PURE ===== \*\//);
if (!m) { console.error('PIPELINE PURE 블록을 찾지 못했습니다'); process.exit(1); }
const api = new Function(m[0] + `
  return {GRACE_MS, VERIFY_DAYS, isEditable, isSeeded, verifyDaysLeft, rejectionStats, migrateCandidates,
          isThesisBroken, isThesisReject, livePlanHoldings, pctClamp, needsPunchBack,
          stageOf, stripReviewFields, kelly3};
`)();

/* compute()는 PURE 블록 밖에 있고 holdings/candidates를 전역으로 읽는다. 배분 수식도
   P5 대상이므로, 중괄호 균형으로 선언만 잘라내 전역을 갈아끼울 수 있는 샌드박스에 올린다. */
function grab(name) {
  const start = src.indexOf('function ' + name + '(');
  if (start < 0) throw new Error('not found: ' + name);
  let i = src.indexOf('{', start), depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) return src.slice(start, i + 1); }
  }
  throw new Error('unbalanced: ' + name);
}
function constOf(n) {
  const mm = src.match(new RegExp('const\\s+' + n + '\\s*=\\s*([^;]+);'));
  if (!mm) throw new Error('const not found: ' + n);
  return 'const ' + n + ' = ' + mm[1] + ';';
}
const alloc = new Function('var holdings=[], candidates=[];\n' + [
  constOf('HALF'), constOf('MAX_SINGLE'), constOf('THIN_DOWNSIDE'),
  grab('isThesisReject'), grab('livePlanHoldings'), grab('kelly3'), grab('kellyOf'), grab('compute'),
  'return { compute, kellyOf, kelly3, setState(h, c){ holdings = h; candidates = c; } };'
].join('\n'))();

let pass = 0, fail = 0;
function eq(label, got, want) {
  const same = (typeof want === 'number' && typeof got === 'number')
    ? Math.abs(got - want) < 1e-9
    : JSON.stringify(got) === JSON.stringify(want);
  if (same) { pass++; console.log('  ok   ' + label); }
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
  eq('정확히 1095일 전 기각 → 0', api.verifyDaysLeft({rejectedDate:'2023-08-10'}, NOW), 0);
  eq('기한을 5일 넘긴 기각 → -5', api.verifyDaysLeft({rejectedDate:'2023-08-05'}, NOW), -5);
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

/* ---- compute(): 청산 종목 제외와 배분 재정규화 (손계산 대조) ----
   켈리는 원장과 무관하게 price/up/down/prob로만 정해진다.
   base=price·pBase=0 으로 두면 r_base=0·p_base=0 이라 kelly3 가 옛 2-결과 공식으로 축퇴한다
   (kelly3 — 2-결과 축퇴 그룹과 같은 방식). 이 손계산 자체는 그대로 유효하다.
   A: a=0.5, b=1.0, p=0.6 → f = 0.6/0.5 - 0.4/1.0 = 0.8
   B: a=0.2, b=0.6, p=0.6 → f = 0.6/0.2 - 0.4/0.6 = 2.33333… */
const F_A = 0.8, F_B = 0.6/0.2 - 0.4/0.6;
const HOLD_A = {id:'A', name:'A', price:100, up:200, base:100, pBase:0, down:50, prob:0.6,
  ledger:[{type:'buy',shares:3,amount:300},{type:'sell',shares:3,amount:330,sellReason:'thesis'}]};
const HOLD_B = {id:'B', name:'B', price:100, up:160, base:100, pBase:0, down:80, prob:0.6, ledger:[]};
const PUNCH_A = {status:'rejected', rejectReason:'thesis', linkedHoldingId:'A'};

grp('compute — 켈리 손계산');
{
  eq('A의 f = 0.8', alloc.kellyOf(HOLD_A).f, F_A);
  eq('B의 f = 2.33333…', alloc.kellyOf(HOLD_B).f, F_B);
}

grp('compute — posSum >= 1 (목표가 커진다)');
{
  alloc.setState([HOLD_A, HOLD_B], []);
  const before = alloc.compute();
  eq('posSum = 3.13333…', before.posSum, F_A + F_B);
  eq('posSum>=1이라 equityScale은 HALF에 걸린다', before.equityScale, 0.5);
  eq('청산 종목도 등재 전에는 계획에 있다', before.pos.some(r=>r.h.id==='A'), true);
  const tB0 = before.pos.find(r=>r.h.id==='B').rel * before.equityScale;
  eq('등재 전 B 목표비중 = (2.3333/3.1333)×0.5 = 0.372340…', tB0, (F_B/(F_A+F_B))*0.5);

  alloc.setState([HOLD_A, HOLD_B], [PUNCH_A]);
  const after = alloc.compute();
  eq('등재 후 A가 rows에서 빠진다', after.rows.every(r=>r.h.id!=='A'), true);
  eq('등재 후 A가 pos에서 빠진다', after.pos.every(r=>r.h.id!=='A'), true);
  eq('등재 후 B의 rel = 1', after.pos.find(r=>r.h.id==='B').rel, 1);
  const tB1 = after.pos.find(r=>r.h.id==='B').rel * after.equityScale;
  eq('등재 후 B 목표비중 = 1×0.5 = 0.5', tB1, 0.5);
  eq('B 목표가 커졌다', tB1 > tB0, true);
}

grp('compute — posSum < 1 (목표가 안 변한다)');
{
  /* A2: p=0.35 → f = 0.35/0.5 - 0.65/1.0 = 0.05   B2: p=0.36 → f = 0.72-0.64 = 0.08
     posSum = 0.13 < 1 → equityScale = 0.13×0.5. rel 증가와 equityScale 감소가 상쇄된다. */
  const A2 = Object.assign({}, HOLD_A, {prob:0.35});
  const B2 = Object.assign({}, HOLD_B, {id:'B2', up:200, down:50, prob:0.36});
  alloc.setState([A2, B2], []);
  const before = alloc.compute();
  eq('posSum = 0.13', before.posSum, 0.13);
  eq('equityScale = posSum×HALF', before.equityScale, 0.13*0.5);
  const t0 = before.pos.find(r=>r.h.id==='B2').rel * before.equityScale;
  eq('등재 전 B2 목표비중 = (0.08/0.13)×0.065 = 0.04', t0, 0.04);

  alloc.setState([A2, B2], [PUNCH_A]);
  const after = alloc.compute();
  const t1 = after.pos.find(r=>r.h.id==='B2').rel * after.equityScale;
  eq('등재 후 B2 목표비중 = 1×(0.08×0.5) = 0.04 (불변)', t1, 0.04);
  eq('목표가 줄지 않았다', t1 >= t0 - 1e-9, true);
}

grp('compute — 전부 청산');
{
  alloc.setState([HOLD_A], [PUNCH_A]);
  const r = alloc.compute();
  eq('pos 비었다', r.pos.length, 0);
  eq('equityScale 0', r.equityScale, 0);
  eq('cashWeight 1', r.cashWeight, 1);
}

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
  // 모든 rᵢ<0 이면 f→−∞로 목적함수가 무계(無界)라 유효근이 없다 (TSMC 현재가 10.5 예시).
  // 두 근 다 정의역 밖이라 filter(inDomain) 이 빈 배열을 만드는 경로 — 근 선택을 건너뛰고
  // 무조건 cand[1] 을 반환하도록 바꾸면(돌연변이 A) 이 항목이 non-null 을 뱉으며 깨진다.
  eq('세 rᵢ 모두 음수 (TSMC 현재가 10.5) → 유효근 없음',
     api.kelly3([(8.04-10.5)/10.5,(5.70-10.5)/10.5,(3.05-10.5)/10.5],[0.25,0.50,0.25]), null);
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

console.log('\n' + (fail ? `FAILED  ${pass} pass / ${fail} fail` : `OK  ${pass} pass`));
process.exit(fail ? 1 : 0);
