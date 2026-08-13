/* 후보 파이프라인 자체 검사 — index_kelly.html을 브라우저에서 연 뒤
   DevTools 콘솔에 이 파일 전체를 붙여넣고 엔터.

   안전: 시작할 때 kelly2y 원본을 통째로 백업하고, 끝나면 무슨 일이 있어도 되돌린다.
   실패해도 실제 데이터는 건드리지 않는다. */
(function () {
  const KEY = 'kelly2y';
  const RAW = localStorage.getItem(KEY);
  const BK_CANDS = JSON.parse(JSON.stringify(candidates));
  const BK_HOLDS = JSON.parse(JSON.stringify(holdings));
  const BK_INTRO = rejIntroDate;
  const realConfirm = window.confirm;

  const R = [];
  const ok = (n, cond, got) => R.push({ n, pass: !!cond, got: cond ? '' : String(got) });
  const D = 864e5;

  try {
    window.confirm = () => true;               // 삭제 확인창 자동 승인
    const now = Date.now();
    const iso = (ms) => new Date(ms).toISOString().slice(0, 10);

    /* ---------- 1. 저장 포맷 ----------
       실데이터가 있을 때만 검사한다. 로컬 파일(file://)은 배포본(github.io)과 오리진이
       달라 저장소가 비어 있는 것이 정상이며, 그건 결함이 아니다. */
    if (RAW === null) {
      R.push({ n: '저장 포맷 (v4 · candidates · rejIntroDate)', pass: true,
               got: '건너뜀 — 이 오리진에 저장된 데이터 없음' });
    } else {
      const snap = JSON.parse(RAW);
      ok('스냅샷 v4', snap.v === 4, 'v=' + snap.v);
      ok('candidates 배열', Array.isArray(snap.candidates), typeof snap.candidates);
      ok('rejIntroDate 숫자', Number.isFinite(snap.rejIntroDate), snap.rejIntroDate);
    }

    /* ---------- 2. 도입일 불변 ---------- */
    const m1 = migrateCandidates({ candidates: [], rejIntroDate: 111 }, 999);
    ok('도입일 있으면 유지', m1.rejIntroDate === 111 && m1.needsSave === false, JSON.stringify(m1));
    const m2 = migrateCandidates({}, 999);
    ok('도입일 없으면 신규+저장요청', m2.rejIntroDate === 999 && m2.needsSave === true, JSON.stringify(m2));
    const m3 = migrateCandidates({ candidates: 'corrupt' }, 999);
    ok('candidates 오염 시 빈 배열', Array.isArray(m3.candidates), JSON.stringify(m3.candidates));

    /* ---------- 3. 기각률 회계 ---------- */
    const INTRO = now - 100 * D;
    const hid = (ms) => ms.toString(36);
    const st = rejectionStats(
      [{ status: 'reviewing' },
       { status: 'rejected', rejectReason: 'factor' },
       { status: 'rejected', rejectReason: 'valuation' },
       { status: 'rejected', rejectReason: 'thesis' }],
      [{ id: hid(INTRO + D) }, { id: hid(INTRO - 50 * D) }, { id: '!!!' }],
      INTRO
    );
    ok('thesis는 기각 분자에서 제외', st.rejected === 2, 'rejected=' + st.rejected);
    ok('thesis는 칸 회수로 계상', st.punchesBack === 1, 'punchesBack=' + st.punchesBack);
    ok('도입 이전·레거시 id는 분모 제외', st.adopted === 1, 'adopted=' + st.adopted);
    ok('기각률 2/3', Math.round(st.rate * 100) === 67, 'rate=' + st.rate);
    ok('분모 0이면 비율 없음', rejectionStats([], [], INTRO).rate === null, 'not null');

    /* ---------- 4. 유예·소급·검증 판정 ---------- */
    ok('유예 13일 → 수정 가능', isEditable({ rejectedAt: now - 13 * D }, now), 'false');
    ok('유예 15일 → 잠김', !isEditable({ rejectedAt: now - 15 * D }, now), 'true');
    ok('소급 20일 → 배지', isSeeded({ rejectedAt: now, rejectedDate: iso(now - 20 * D) }), 'false');
    ok('당일 등재 → 배지 없음', !isSeeded({ rejectedAt: now, rejectedDate: iso(now) }), 'true');
    ok('오늘 기각 → D-1095', verifyDaysLeft({ rejectedDate: iso(now) }, now) === 1095,
       verifyDaysLeft({ rejectedDate: iso(now) }, now));
    ok('1095일 전 → 만기', verifyDaysLeft({ rejectedDate: iso(now - 1095 * D) }, now) <= 0, 'not due');

    /* ---------- 5. 렌더: 섹션 분리와 헤더 일치 ---------- */
    candidates = [
      { id: 'zz1', name: 'AAA검토', status: 'reviewing', startDate: iso(now - 30 * D) },
      { id: 'zz2', name: 'BBB검토', status: 'reviewing', startDate: iso(now - 3 * D) },
      { id: 'zz3', name: 'CCC기각', status: 'rejected', startDate: iso(now - 40 * D),
        rejectedDate: iso(now - 2 * D), rejectedAt: now - 2 * D, rejectPrice: 142,
        rejectReason: 'factor', trigger: 'T', note: '', linkedHoldingId: null, verify: null },
      { id: 'zz4', name: 'DDD회수', status: 'rejected', startDate: iso(now - 60 * D),
        rejectedDate: iso(now - 5 * D), rejectedAt: now - 5 * D, rejectPrice: 890,
        rejectReason: 'thesis', trigger: 'T', note: '', linkedHoldingId: null, verify: null }
    ];
    render();

    const groups = [...document.querySelectorAll('#pl-body .pl-group')].map(e => e.textContent.trim());
    ok('세 섹션 렌더', groups.length === 3, groups.join(' | '));
    ok('칸 회수 섹션 분리', groups.some(g => g.startsWith('▸ 칸 회수')), groups.join(' | '));

    const statB = [...document.querySelectorAll('#pl-stat b')].map(e => e.textContent);
    ok('헤더 검토중 2', statB[0] === '2', statB.join(','));
    ok('헤더 기각 1 (thesis 제외)', statB[1] === '1', statB.join(','));
    ok('헤더 칸 회수 1', statB[3] === '1', statB.join(','));

    const secOf = (label) => {
      const nodes = [...document.querySelectorAll('#pl-body > *')];
      const i = nodes.findIndex(e => e.classList.contains('pl-group') && e.textContent.includes(label));
      let n = 0;
      for (let j = i + 1; j < nodes.length && !nodes[j].classList.contains('pl-group'); j++) n++;
      return n;
    };
    ok('기각 섹션 카드 1장 = 헤더', secOf('기각 (최신') === 1, secOf('기각 (최신'));
    ok('칸 회수 섹션 카드 1장 = 헤더', secOf('칸 회수') === 1, secOf('칸 회수'));

    const revNames = [...document.querySelectorAll('#pl-body .pl-item .pl-name')].map(e => e.textContent);
    ok('검토중 오래된 순', revNames[0] === 'AAA검토', revNames.join(','));

    /* ---------- 6. 유예 내 기각은 삭제 가능 ---------- */
    ok('유예 내 삭제 버튼 있음', !!document.querySelector('[data-pldel="zz3"]'), '없음');

    /* ---------- 7. 잠긴 기각: UI가 아니라 데이터가 막히는가 (핵심) ---------- */
    candidates.find(c => c.id === 'zz3').rejectedAt = now - 15 * D;
    render();
    ok('잠금 후 삭제 버튼 없음', !document.querySelector('[data-pldel="zz3"]'), '아직 있음');

    document.querySelector('[data-pledit="zz3"]').click();
    ok('잠금 시 주가 입력 비활성', $('rj-price').disabled, 'enabled');
    ok('잠금 시 사유 입력 비활성', $('rj-reason').disabled, 'enabled');
    ok('잠금 안내 표시', $('rj-locked').style.display === 'block', $('rj-locked').style.display);

    $('rj-price').disabled = false;          // DevTools로 강제 활성화하는 상황 재현
    $('rj-price').value = '99999';
    $('rj-trigger').value = '트리거만 수정';
    $('rj-save').click();

    const z3 = candidates.find(c => c.id === 'zz3');
    ok('잠긴 주가 안 바뀜 (데이터 계층 강제)', z3.rejectPrice === 142, 'rejectPrice=' + z3.rejectPrice);
    ok('잠긴 사유 안 바뀜', z3.rejectReason === 'factor', z3.rejectReason);
    ok('잠긴 등재시각 안 바뀜 (유예 연장 불가)', z3.rejectedAt === now - 15 * D, 'changed');
    ok('트리거는 수정됨', z3.trigger === '트리거만 수정', z3.trigger);

    /* ---------- 8. 검증 실패 시 유령 후보가 안 생기는가 ---------- */
    const before = candidates.length;
    openRejectModal(null, { name: '유령테스트' });
    $('rj-trigger').value = '트리거 있음';
    $('rj-price').value = '';                 // 주가 비움 → 저장 거부되어야 함
    $('rj-save').click();
    ok('가격 미입력 저장 거부 시 후보 미생성', candidates.length === before,
       before + ' → ' + candidates.length);
    $('rjModal').style.display = 'none';

    /* ---------- 9. rj-intro 오염 (교차 태스크 결함) ---------- */
    $('rj-intro').textContent = 'thesis 파기로 청산했습니다.';   // 칸 회수 경로가 덮어쓴 상태 재현
    openRejectModal(null, { name: '오염테스트' });
    ok('모달 문구가 매번 초기화됨', $('rj-intro').textContent.indexOf('thesis') === -1,
       $('rj-intro').textContent);
    $('rjModal').style.display = 'none';

    /* ---------- 10. thesis 자동 등재 경로의 드롭다운 ---------- */
    openRejectModal(null, { name: '칸회수테스트', reason: 'thesis', price: 100 });
    ok('thesis 사유가 드롭다운에 선택됨', $('rj-reason').value === 'thesis', $('rj-reason').value);
    ok('thesis일 때 사유 변경 불가', $('rj-reason').disabled, 'enabled');
    $('rjModal').style.display = 'none';

    /* ---------- 11. 청산 종목 계획 제외 ----------
       kellyOf()는 원장을 보지 않으므로, 전량 청산해도 켈리가 양수면 계획에 남는다.
       칸 회수 등재가 그 종목을 계획에서 빼는지를 등재 전후로 직접 비교한다. */
    const deadId = '__t_dead';
    holdings.push({ id: deadId, name: '__TEST_DEAD', price: 100, up: 200, base: 100, pBase: 0,
      down: 50, prob: 0.6, startQ: currentQGuess(), ccy: 'USD', fx: 1,
      ledger: [{ type: 'buy',  shares: 3, price: 100, amount: 300, quarter: currentQGuess() },
               { type: 'sell', shares: 3, price: 110, amount: 330, sellReason: 'thesis',
                 quarter: currentQGuess() }] });
    const beforeA = compute();
    const t0 = {};
    beforeA.pos.forEach(r => { t0[r.h.id] = r.rel * beforeA.equityScale; });
    ok('등재 전에는 계획에 남아 있다 (켈리 양수)',
       beforeA.pos.some(r => r.h.id === deadId), '이미 빠져 있음');
    candidates.push({ id: '__t_c', name: '__TEST_DEAD', status: 'rejected', rejectReason: 'thesis',
      linkedHoldingId: deadId, rejectedAt: now, rejectedDate: iso(now), startDate: iso(now),
      trigger: 't', note: '', verify: null });
    const afterA = compute();
    ok('칸 회수 등재 후 rows에서 빠진다',
       afterA.rows.every(r => r.h.id !== deadId), '남아있음');
    ok('칸 회수 등재 후 pos에서 빠진다',
       afterA.pos.every(r => r.h.id !== deadId), '남아있음');
    /* posSum≥1이면 커지고 posSum<1이면 그대로다. 단언은 "줄지 않는다"여야 한다. */
    ok('남은 종목 목표가 줄지 않는다',
       afterA.pos.every(r => r.rel * afterA.equityScale >= (t0[r.h.id] || 0) - 1e-9), '줄어듦');
    ok('순매수 음수에서 진행 바가 0%', pctClamp(-0.25) === 0, String(pctClamp(-0.25)));

    /* ---------- 12. 칸 회수 모달: 닫기 차단 ----------
       칸 회수는 트리거를 적어야만 닫힌다. ✕ 숨김과 배경클릭 차단은 DOM 상태라
       순수 함수 테스트로는 안 잡힌다. rjIsForced() 가 두 경로 모두를 막는지 본다. */
    const cntBefore12 = candidates.length;
    openRejectModal(null, { name: '__강제테스트', reason: 'thesis', price: 100 });
    ok('강제 모달: ✕ 숨김', $('rj-close').style.display === 'none',
       $('rj-close').style.display || '(보임)');
    $('rjModal').click();                       // 배경 클릭 — target === rjModal
    ok('강제 모달: 배경 클릭으로 안 닫힘', $('rjModal').style.display === 'flex',
       $('rjModal').style.display);
    $('rj-trigger').value = '';                 // 트리거 비움 → 저장 거부되어야 함
    $('rj-save').click();
    ok('강제 모달: 트리거 없으면 안 닫힘', $('rjModal').style.display === 'flex',
       $('rjModal').style.display);
    ok('저장 거부 시 후보 미생성', candidates.length === cntBefore12,
       cntBefore12 + ' → ' + candidates.length);
    $('rjModal').style.display = 'none';

    /* 회귀: 수동 기각 모달은 여전히 닫힌다. 강제 차단이 전 경로로 새면 안 된다. */
    openRejectModal(null, { name: '__일반테스트' });
    ok('일반 모달: ✕ 보임', $('rj-close').style.display !== 'none', 'none');
    $('rjModal').click();
    ok('일반 모달: 배경 클릭으로 닫힘', $('rjModal').style.display === 'none',
       $('rjModal').style.display);

    /* ---------- 13. 매매 이력 모달 (읽기 전용) ----------
       청산 종목은 계획에서 사라지므로 원장을 볼 곳이 여기뿐이다.
       11번이 만들어 둔 __t_dead(매수 1·매도 1)와 그 칸 회수 등재를 그대로 쓴다. */
    render();
    const histBtn = document.querySelector('[data-plhist="' + deadId + '"]');
    ok('칸 회수 카드에 매매 이력 버튼', !!histBtn, '없음');
    const rejCard = [...document.querySelectorAll('#pl-body .pl-item')]
      .find(e => e.textContent.includes('CCC기각'));
    ok('기각 카드에는 매매 이력 버튼 없음',
       !!rejCard && !rejCard.querySelector('[data-plhist]'), rejCard ? '있음' : '카드 못 찾음');

    if (histBtn) {
      histBtn.click();
      ok('매매 이력 모달 열림', $('histModal').style.display === 'flex',
         $('histModal').style.display);
      ok('제목이 종목명으로 채워짐', $('hist-title').textContent.indexOf('__TEST_DEAD') === 0,
         $('hist-title').textContent);
      const entries = document.querySelectorAll('#hist-body .lg-entry').length;
      ok('원장 2건 렌더 (매수·매도)', entries === 2, entries);
      ok('요약에 매수 1회 · 매도 1회',
         /매수\s*1회/.test($('hist-sum').textContent) && /매도\s*1회/.test($('hist-sum').textContent),
         $('hist-sum').textContent);
      ok('매도 사유가 보인다', $('hist-body').textContent.indexOf('매도사유') !== -1,
         $('hist-body').textContent.slice(0, 60));
      /* 읽기 전용이 의도다 (PRD §7-D18). 편집 요소가 생기면 여기서 걸린다. */
      const edits = $('histModal').querySelectorAll('input,select,textarea,button').length;
      ok('읽기 전용 — 편집 요소 없음', edits === 0, edits);

      $('histModal').click();                   // 강제가 아니므로 배경 클릭으로 닫힌다
      ok('배경 클릭으로 닫힘', $('histModal').style.display === 'none',
         $('histModal').style.display);
      histBtn.click();
      $('hist-close').click();
      ok('✕로 닫힘', $('histModal').style.display === 'none', $('histModal').style.display);
    }

    /* 원본 종목이 없으면 (백업 편집 등으로 끊긴 링크) 모달을 열지 않고 안내만 한다 */
    openHistModal('__존재하지않는id');
    ok('원본 없으면 모달 안 열림', $('histModal').style.display === 'none',
       $('histModal').style.display);

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
       !!card1 && !!card1.querySelector('.pl-origin')
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
    $('i-base').value  = '120';
    $('i-down').value  = '50';
    $('i-prob').value  = '60';
    $('i-pbase').value = '25';
    $('i-pbear').value = '15';
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
    $('i-base').value   = '120';
    $('i-down').value   = '50';
    $('i-prob').value   = '60';
    $('i-pbase').value  = '25';
    $('i-pbear').value  = '15';
    $('addBtn').click();
    const hDirect = holdings[holdings.length - 1];
    ok('직접 추가도 논지가 trim 되어 저장된다', hDirect.thesis === '생태계 잠금효과',
       hDirect.thesis);

    /* 논지를 비우면 필드를 만들지 않는다 */
    $('i-name').value  = '__논지없음';
    $('i-price').value = '100';
    $('i-up').value    = '200';
    $('i-base').value  = '120';
    $('i-down').value  = '50';
    $('i-prob').value  = '60';
    $('i-pbase').value = '25';
    $('i-pbear').value = '15';
    $('addBtn').click();
    const hNo = holdings[holdings.length - 1];
    ok('논지를 비우면 필드를 만들지 않는다', !('thesis' in hNo), JSON.stringify(hNo));

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
    holdings.push({ id: noId, name:'__논지없음2', price:100, up:200, down:50, prob:0.6,
      startQ: currentQGuess(), ccy:'USD', fx:1, ledger:[] });
    openRejectModal(null, { name:'__논지없음2', reason:'thesis', price:100, holdingId: noId });
    ok('논지가 없으면 그 줄이 안 뜬다', $('rj-thesis').style.display === 'none',
       $('rj-thesis').style.display);
    $('rjModal').style.display = 'none';

    /* 수동 기각(보유 종목 없음)에서도 안 뜬다 */
    openRejectModal(null, { name:'__수동' });
    ok('수동 기각에는 원 논지 줄이 없다', $('rj-thesis').style.display === 'none',
       $('rj-thesis').style.display);
    $('rjModal').style.display = 'none';

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

    /* 합이 100 이어도 개별 음수는 거부 */
    $('i-prob').value  = '150'; $('i-pbase').value = '-50'; $('i-pbear').value = '0';
    $('addBtn').click();
    ok('개별 확률이 음수면 저장 거부', holdings.length === hCnt,
       hCnt + ' → ' + holdings.length);
    $('i-prob').value  = '25'; $('i-pbase').value = '50'; $('i-pbear').value = '25';

    /* 하단이 음수여도 순서·합만 맞으면 저장되어선 안 된다 (F1) */
    $('i-name').value  = '__하단음수';
    $('i-down').value  = '-10';
    $('addBtn').click();
    ok('하단이 음수면 저장 거부', holdings.length === hCnt,
       hCnt + ' → ' + holdings.length);
    $('i-down').value  = '70';

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

    /* ---------- 23. Base 미입력 배너 ---------- */
    holdings = [
      {id:'nb1',name:'__배너대상',price:100,up:150,down:70,prob:0.55,
       startQ:currentQGuess(),ccy:'USD',fx:1,ledger:[]},
      {id:'nb2',name:'__정상',price:100,up:150,base:120,down:70,prob:0.25,pBase:0.5,
       startQ:currentQGuess(),ccy:'USD',fx:1,ledger:[]}
    ];
    viewMode='alloc';   // 배너는 목표 배분 분기에서만 렌더된다 — 앞 섹션이 바꿨을 수 있다
    render();
    const banners=[...document.querySelectorAll('.hold-nobase')];
    ok('Base 미입력 종목에 배너가 뜬다', banners.length === 1, banners.length);
    ok('배너 문구에 수정 안내가 있다',
       banners.length === 1 && banners[0].textContent.includes('수정'),
       banners.length ? banners[0].textContent : '배너 없음');

    /* ---------- 24. Bear확률 상승만으로도 논지훼손 판별 (F5) ---------- */
    holdings = [{
      id:'f5t', name:'__베어확률상승', price:100, up:150, down:70, base:120,
      prob:0.25, pBase:0.15,                 // pBear = 0.60 → 켈리 음수(비활성)
      startQ:currentQGuess(), ccy:'USD', fx:1,
      ledger:[{
        id:'f5le', quarter:currentQGuess(), date:'2026-01-01', type:'reassess',
        up:150, down:70, base:120, prob:0.25, pBase:0.15,
        prevUp:150, prevDown:70, prevBase:120, prevProb:0.25, prevPBase:0.50,  // prevPBear 0.25 → 0.60
        reason:'베어 확률 상승'
      }]
    }];
    /* 배너는 두 UI 상태를 동시에 만족해야 렌더된다 — 매매일지 분기(alloc 아님)이고,
       그 종목 카드가 펼쳐져 있어야 한다(index_kelly.html:1470 의 ${isExpanded ? ...}). */
    viewMode='journal';
    expandedJournal['f5t']=true;
    render();
    const f5Banners=[...document.querySelectorAll('.inactive-banner')];
    ok('승률·상단은 그대로여도 비활성 배너가 뜬다', f5Banners.length === 1,
       f5Banners.length);
    ok('Bear확률 상승이 논지훼손으로 잡힌다',
       f5Banners.length === 1 && f5Banners[0].textContent.includes('논지 훼손'),
       f5Banners.length ? f5Banners[0].textContent.trim() : '배너 없음');

    /* ---------- 25. 종목 식별색 — 배분바와 카드가 같은 색을 쓴다 ----------
       바는 pos(켈리 양수만)를, 카드는 rows(보류·음수 포함)를 돈다. 각자 인덱스로
       색을 매기면 보류 종목이 끼는 순간 그 뒤가 통째로 밀린다. 색이 밀려도 예외가
       안 나고 화면만 조용히 거짓말하므로 자동 검사가 아니면 못 잡는다. */
    const noBase = { id:'cB', name:'__색cB', price:100, up:200, down:50, prob:0.6,
                     startQ:currentQGuess(), ccy:'USD', fx:1, ledger:[] };  // base 없음 → 켈리 보류
    const mkC = (id) => ({ id, name:'__색'+id, price:100, up:200, base:100, pBase:0,
                           down:50, prob:0.6, startQ:currentQGuess(), ccy:'USD', fx:1, ledger:[] });
    holdings = [mkC('cA'), noBase, mkC('cC'), mkC('cD')];
    viewMode = 'alloc';
    render();

    const barColor = {};
    document.querySelectorAll('#allocbar .allocbar-seg').forEach(function (sg) {
      const nm = sg.getAttribute('title');
      if (nm) barColor[nm] = getComputedStyle(sg).backgroundColor;
    });
    const cards = [...document.querySelectorAll('#body .hold')].map(function (c) {
      return { nm: c.querySelector('.hold-name').textContent,
               col: getComputedStyle(c).borderLeftColor };
    });

    ok('보류 종목은 배분바에 없다', barColor['__색cB'] === undefined, Object.keys(barColor).join());
    ok('배분바 종목마다 색이 다르다',
       new Set(Object.values(barColor)).size === Object.keys(barColor).length,
       JSON.stringify(barColor));
    const mismatched = cards.filter(function (c) {
      return barColor[c.nm] ? barColor[c.nm] !== c.col : c.col !== 'rgba(0, 0, 0, 0)';
    });
    ok('카드 왼쪽 띠가 배분바 색과 일치한다 (보류 종목이 끼어도)',
       mismatched.length === 0,
       mismatched.map(function (c) { return c.nm + ' 카드=' + c.col + ' 바=' + barColor[c.nm]; }).join(' / '));
    ok('보류 종목 카드에는 색이 안 붙는다',
       (cards.find(function (c) { return c.nm === '__색cB'; }) || {}).col === 'rgba(0, 0, 0, 0)',
       (cards.find(function (c) { return c.nm === '__색cB'; }) || {}).col);

  } catch (e) {
    R.push({ n: '스크립트 실행 중 예외', pass: false, got: e && e.message });
    console.error(e);
  } finally {
    window.confirm = realConfirm;
    candidates = BK_CANDS;
    holdings = BK_HOLDS;
    rejIntroDate = BK_INTRO;
    if (RAW !== null) localStorage.setItem(KEY, RAW); else localStorage.removeItem(KEY);
    try { render(); } catch (e) {}
  }

  const fail = R.filter(r => !r.pass);
  const skip = R.filter(r => r.pass && r.got.indexOf('건너뜀') === 0);

  console.table(R.map(r => ({ 항목: r.n, 결과: r.pass ? 'PASS' : 'FAIL', 실제: r.got })));
  console.log(
    '%c' + (fail.length ? `FAIL ${fail.length}건 / ${R.length}건` : `전부 통과 (${R.length}건)`),
    'font-size:15px;font-weight:bold;color:' + (fail.length ? '#e05252' : '#00d4a0')
  );
  if (fail.length) console.log('실패 항목:', fail.map(f => f.n));

  /* 화면에도 결과를 띄운다 — DevTools를 열지 않아도 보이도록 */
  try {
    const old = document.getElementById('selfcheck-panel');
    if (old) old.remove();
    const p = document.createElement('div');
    p.id = 'selfcheck-panel';
    p.style.cssText = 'position:fixed;inset:0;z-index:9999;overflow:auto;padding:24px 16px;' +
      'background:#0c0e12;color:#e6e9ef;font:13px/1.7 ui-monospace,SFMono-Regular,Menlo,monospace;';
    const head = fail.length
      ? '<div style="font-size:19px;font-weight:700;color:#e05252">FAIL ' + fail.length + '건 / 전체 ' + R.length + '건</div>'
      : '<div style="font-size:19px;font-weight:700;color:#00d4a0">전부 통과 · ' + R.length + '건</div>';
    const rows = R.map(function (r) {
      const skipped = r.pass && r.got.indexOf('건너뜀') === 0;
      const mark = skipped ? '<span style="color:#8a93a5">SKIP</span>'
        : r.pass ? '<span style="color:#00d4a0">PASS</span>'
                 : '<span style="color:#e05252;font-weight:700">FAIL</span>';
      const detail = r.got ? '<span style="color:#8a93a5"> — ' + r.got + '</span>' : '';
      return '<tr><td style="padding:3px 14px 3px 0;vertical-align:top">' + mark +
             '</td><td style="padding:3px 0">' + r.n + detail + '</td></tr>';
    }).join('');
    p.innerHTML = head +
      '<div style="color:#8a93a5;margin:6px 0 18px">데이터는 원상복구되었습니다. ' +
      (skip.length ? 'SKIP ' + skip.length + '건은 이 오리진에 저장 데이터가 없어서입니다(정상). ' : '') +
      '남은 것은 눈으로 볼 항목 — 체크리스트 2단계.</div>' +
      '<table style="border-collapse:collapse">' + rows + '</table>' +
      '<button id="selfcheck-close" style="margin-top:22px;padding:9px 16px;border:none;' +
      'border-radius:9px;background:#00d4a0;color:#04140f;font-weight:600;cursor:pointer">' +
      '닫고 도구 보기</button>';
    document.body.appendChild(p);
    document.getElementById('selfcheck-close').onclick = function () { p.remove(); };
  } catch (e) {
    console.warn('결과 패널을 그리지 못했습니다. 위 표를 보세요.', e);
  }
})();
