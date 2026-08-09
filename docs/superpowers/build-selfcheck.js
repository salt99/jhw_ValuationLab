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
   localStorage 는 그대로고, 새로고침하면 실제 데이터로 돌아온다. */
const demoScript = [
  '(function(){',
  '  var D=864e5, n=Date.now();',
  '  var iso=function(m){return new Date(m).toISOString().slice(0,10);};',
  '  candidates=[',
  '    {id:"d1",name:"Costco",status:"reviewing",startDate:iso(n-70*D)},',
  '    {id:"d2",name:"Visa",status:"reviewing",startDate:iso(n-20*D)},',
  '    {id:"d3",name:"Arista",status:"rejected",startDate:iso(n-10*D),',
  '     rejectedDate:iso(n-D),rejectedAt:n-D,rejectPrice:142,rejectReason:"factor",',
  '     trigger:"반도체 노출 줄면 재검토",note:"",linkedHoldingId:null,verify:null},',
  '    {id:"d4",name:"TSMC",status:"rejected",startDate:iso(n-1200*D),',
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
