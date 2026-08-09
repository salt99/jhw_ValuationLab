/* P5 단위 검증 — 실행: node test_pipeline.js
   index_kelly.html의 PIPELINE PURE 블록만 추출해 DOM 없이 실행한다. */
const fs = require('fs');
const src = fs.readFileSync(__dirname + '/index_kelly.html', 'utf8');
const m = src.match(/\/\* ===== PIPELINE PURE =====[\s\S]*?\/\* ===== \/PIPELINE PURE ===== \*\//);
if (!m) { console.error('PIPELINE PURE 블록을 찾지 못했습니다'); process.exit(1); }
const api = new Function(m[0] + `
  return {GRACE_MS, VERIFY_DAYS, isEditable, isSeeded, verifyDaysLeft, rejectionStats, migrateCandidates,
          isThesisBroken, isThesisReject, livePlanHoldings, pctClamp, needsPunchBack};
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

console.log('\n' + (fail ? `FAILED  ${pass} pass / ${fail} fail` : `OK  ${pass} pass`));
process.exit(fail ? 1 : 0);
