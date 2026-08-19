/* 자체 검사 페이지 생성기 — DevTools 없이 검사를 돌리기 위한 임시 HTML을 만든다.

   실행:  node docs/superpowers/build-selfcheck.js && open _selfcheck.html

   index_kelly.html 사본에 검사 스크립트를 주입한 _selfcheck.html 을 저장소 루트에 만든다.
   루트에 두는 이유는 file:// 오리진과 상대 경로를 원본과 동일하게 맞추기 위함이다.
   원본은 건드리지 않는다. _selfcheck.html 은 언제든 지워도 된다. */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const SRC = path.join(ROOT, 'index_kelly.html');
const CHECK = path.join(__dirname, 'selfcheck-rejection-ledger.js');
const OUT = path.join(ROOT, '_selfcheck.html');

const DEMO = process.argv.includes('--demo');

/* --demo: 눈으로 볼 화면용 데이터를 메모리에만 넣는다. save() 를 부르지 않으므로
   localStorage 는 그대로고, 새로고침하면 실제 데이터로 돌아온다.

   보유 종목은 **고정 픽스처**다(§7-D24). 값을 바꾸면 화면 비교의 기준이 사라지므로
   바꿀 이유가 생기면 아래 표를 함께 갱신한다. 한 화면에서 전부 확인되도록 골랐다:

     종목    켈리 f   목표비중   색     비고
     TSMC    3.7418   30.00%   --h1   상한에 걸린다
     Costco  1.3582   14.01%   --h2
     Visa    1.5848   16.35%   --h3
     ASML    1.6250   16.76%   --h4
     Novo    1.3844   14.28%   --h5
     Adyen        —        —   없음   Base 미입력 → 켈리 보류, 카드 띠 transparent

     주식 91.4% · 채권 8.6%   (원금 $100,000)

   즉 5색 · 개별 상한 · 채권 구간 · 보류 종목이 한 번에 렌더된다.

   startQ 만은 고정값이 아니라 currentQGuess() 다. 지난 분기를 박아두면 앱이 첫 매수 전
   시작 분기를 현재로 당기는 동작(§7-D26)과 어긋나 "8월인데 Q1 시작" 화면이 나온다.
   배분표는 startQ 와 무관하므로 이것만 움직여도 기준은 유지된다. */
const demoScript = [
  '(function(){',
  '  var D=864e5, n=Date.now();',
  '  var iso=function(m){return new Date(m).toISOString().slice(0,10);};',
  '  totalCapital=100000;',
  '  holdings=[',
  '    {id:"h1",name:"TSMC",  price:210, up:420, base:300, down:160,prob:0.50,pBase:0.42,',
  '     startQ:currentQGuess(),ccy:"USD",fx:1,thesis:"파운드리 독점 · 3nm 전환",ledger:[]},',
  '    {id:"h2",name:"Costco",price:920, up:1400,base:1150,down:700,prob:0.25,pBase:0.35,',
  '     startQ:currentQGuess(),ccy:"USD",fx:1,thesis:"멤버십 갱신율",ledger:[]},',
  '    {id:"h3",name:"Visa",  price:340, up:560, base:440, down:260,prob:0.25,pBase:0.35,',
  '     startQ:currentQGuess(),ccy:"USD",fx:1,thesis:"결제 네트워크 효과",ledger:[]},',
  '    {id:"h4",name:"ASML",  price:780, up:1300,base:1000,down:600,prob:0.25,pBase:0.35,',
  '     startQ:currentQGuess(),ccy:"USD",fx:1,thesis:"EUV 독점",ledger:[]},',
  '    {id:"h5",name:"Novo",  price:58,  up:105, base:80,  down:42, prob:0.22,pBase:0.38,',
  '     startQ:currentQGuess(),ccy:"USD",fx:1,thesis:"GLP-1 파이프라인",ledger:[]},',
  '    {id:"h6",name:"Adyen", price:1400,up:2600,          down:900,prob:0.30,',
  '     startQ:currentQGuess(),ccy:"USD",fx:1,thesis:"",ledger:[]}];',
  '  candidates=[',
  // 적정가 세 경로가 한 화면에 나오게 맞췄다 — 신선(d1) · 낡음+이력(d2) · 기각(d3, 배지 없음)
  '    {id:"d1",name:"Ferrari",status:"reviewing",startDate:iso(n-70*D),',
  '     origin:"브랜드 가격결정력",thesis:"대기자 명단이 경기와 무관하게 2년치 — 판매량이 아니라 가격이 성장한다",',
  '     fairLow:310,fairHigh:420,fairBasis:"PBR 2.1~2.8 · BASE ROE 24% · N=10",fairDate:iso(n-12*D)},',
  '    {id:"d2",name:"Hermes",status:"reviewing",startDate:iso(n-20*D),',
  '     thesis:"버킨 배급제가 재고 위험을 소비자에게 넘긴다",',
  '     fairLow:1400,fairHigh:1900,fairBasis:"PBR 3.0~4.1",fairDate:iso(n-150*D),',
  '     fairLog:[{date:iso(n-400*D),low:1300,high:1750},{date:iso(n-700*D),low:1150,high:1600}]},',
  '    {id:"d3",name:"Arista",status:"rejected",startDate:iso(n-10*D),',
  '     thesis:"화이트박스 대비 EOS 소프트웨어 락인",fairLow:95,fairHigh:130,fairDate:iso(n-30*D),',
  '     rejectedDate:iso(n-D),rejectedAt:n-D,rejectPrice:142,rejectReason:"factor",',
  '     trigger:"반도체 노출 줄면 재검토",note:"",linkedHoldingId:null,verify:null},',
  '    {id:"d4",name:"Broadcom",status:"rejected",startDate:iso(n-1200*D),',
  '     rejectedDate:iso(n-1200*D),rejectedAt:n-40*D,rejectPrice:210,rejectReason:"valuation",',
  '     trigger:"PBR 6배 이하 재검토",note:"",linkedHoldingId:null,verify:null},',
  '    {id:"d5",name:"Nvidia",status:"rejected",startDate:iso(n-200*D),',
  '     rejectedDate:iso(n-5*D),rejectedAt:n-5*D,rejectPrice:890,rejectReason:"thesis",',
  '     trigger:"데이터센터 재가속 시 재검토",note:"",linkedHoldingId:null,verify:null}];',
  '  render();',
  '  var b=document.createElement("div");',
  '  b.style.cssText="position:fixed;left:0;right:0;bottom:0;z-index:9998;padding:9px 14px;'
    + 'background:#1b1f28;border-top:1px solid #2a2f3a;color:#8a93a5;'
    + 'font:12px/1.6 ui-monospace,Menlo,monospace;text-align:center";',
  '  b.textContent="화면 확인용 데모 데이터 (메모리에만 존재 · 저장 안 됨 · 새로고침하면 사라집니다)";',
  '  document.body.appendChild(b);',
  '})();',
].join('\n');

const html = fs.readFileSync(SRC, 'utf8');
const check = DEMO ? demoScript : fs.readFileSync(CHECK, 'utf8');

const marker = '</body>';
const at = html.lastIndexOf(marker);
if (at === -1) {
  console.error('index_kelly.html 에서 </body> 를 찾지 못했습니다.');
  process.exit(1);
}

// 원본 스크립트가 전부 실행되고 load()/render() 가 끝난 뒤에 돌아야 한다.
const injected =
  '<script>\n/* === 자동 생성됨: build-selfcheck.js' + (DEMO ? ' --demo' : '') + ' === */\n' +
  'setTimeout(function(){\n' + check + '\n}, 0);\n</script>\n';

fs.writeFileSync(OUT, html.slice(0, at) + injected + html.slice(at), 'utf8');

console.log('생성: ' + path.relative(ROOT, OUT));
console.log('열기: open ' + path.relative(ROOT, OUT));
console.log('삭제: rm ' + path.relative(ROOT, OUT));
