/* 후보 파이프라인 자체 검사 — index_kelly.html을 브라우저에서 연 뒤
   DevTools 콘솔에 이 파일 전체를 붙여넣고 엔터.

   안전: 시작할 때 kelly2y 원본을 통째로 백업하고, 끝나면 무슨 일이 있어도 되돌린다.
   실패해도 실제 데이터는 건드리지 않는다. */
(function () {
  const KEY = 'kelly2y';
  const RAW = localStorage.getItem(KEY);
  const BK_CANDS = JSON.parse(JSON.stringify(candidates));
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

  } catch (e) {
    R.push({ n: '스크립트 실행 중 예외', pass: false, got: e && e.message });
    console.error(e);
  } finally {
    window.confirm = realConfirm;
    candidates = BK_CANDS;
    rejIntroDate = BK_INTRO;
    if (RAW !== null) localStorage.setItem(KEY, RAW); else localStorage.removeItem(KEY);
    try { render(); } catch (e) {}
  }

  const fail = R.filter(r => !r.pass);
  console.table(R.map(r => ({ 항목: r.n, 결과: r.pass ? 'PASS' : 'FAIL', 실제: r.got })));
  console.log(
    '%c' + (fail.length ? `FAIL ${fail.length}건 / ${R.length}건` : `전부 통과 (${R.length}건)`),
    'font-size:15px;font-weight:bold;color:' + (fail.length ? '#e05252' : '#00d4a0')
  );
  if (fail.length) console.log('실패 항목:', fail.map(f => f.n));
  console.log('%c데이터는 원상복구되었습니다. 남은 것은 눈으로 볼 항목뿐입니다 — 체크리스트 §시각 확인.',
    'color:#8a93a5');
})();
