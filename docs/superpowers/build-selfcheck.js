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

const html = fs.readFileSync(SRC, 'utf8');
const check = fs.readFileSync(CHECK, 'utf8');

const marker = '</body>';
const at = html.lastIndexOf(marker);
if (at === -1) {
  console.error('index_kelly.html 에서 </body> 를 찾지 못했습니다.');
  process.exit(1);
}

// 원본 스크립트가 전부 실행되고 load()/render() 가 끝난 뒤에 돌아야 한다.
const injected =
  '<script>\n/* === 자동 생성됨: docs/superpowers/build-selfcheck.js === */\n' +
  'setTimeout(function(){\n' + check + '\n}, 0);\n</script>\n';

fs.writeFileSync(OUT, html.slice(0, at) + injected + html.slice(at), 'utf8');

console.log('생성: ' + path.relative(ROOT, OUT));
console.log('열기: open ' + path.relative(ROOT, OUT));
console.log('삭제: rm ' + path.relative(ROOT, OUT));
