# jhw_ValuationLab

가치투자 분석 도구 모음. 정성(능력범위) → 프리미엄 평가 → 정량(밸류에이션) 3단계를 하나의 사이트로 묶었습니다.

## 파일 구성 (단일 폴더)

| 파일 | 내용 |
|---|---|
| `index_main.html` | 허브 (세 도구로 가는 관문) |
| `index_circle.html` | 능력범위 체크리스트 |
| `index_premium.html` | 기업 프리미엄 평가 체크리스트 |
| `index_roe.html` | 밸류에이션 4-모드 분석기 |

## ⚠️ 업로드 후 반드시 할 일 — 허브 파일명 변경

GitHub Pages는 **`index.html`을 사이트 첫 화면으로 자동 인식**합니다.
업로드 후 **`index_main.html`을 `index.html`로 rename** 하세요.
나머지 세 파일(`index_circle.html`·`index_premium.html`·`index_roe.html`)은 그대로 두면 됩니다 — 허브 링크가 이 이름들을 가리킵니다.

## 접속 주소 (허브를 index.html로 rename 후)

- 허브: `https://salt99.github.io/jhw_ValuationLab/`
- 능력범위: `.../index_circle.html`
- 프리미엄: `.../index_premium.html`
- 분석기: `.../index_roe.html`

## 세 도구

**1. 능력범위 체크리스트** — 거장이 실제로 말한 6개 검증 항목(린치·버핏·멍거·그레이엄·피셔·포퍼/소로스).

**2. 기업 프리미엄 체크리스트** — 《거인의 어깨 2권》 기반 11개 프리미엄 요소 평가 + 자격×시장가격 3×3 매트릭스로 매수/매도 신호.

**3. 밸류에이션 4-모드 분석기** — PBR·초과ROE·지속기간·요구수익률 중 3개로 나머지 1개 역산.
```
적정 PBR = 1 + Σ [(ROE − r)·(1+ROE)^(t−1)] / (1+r)^t   (전액 유보 가정)
장기수익률 = [(1+ROE)^N · (청산PBR/진입PBR)]^(1/N) − 1
```

## 의도한 사용 흐름

① 판단할 자격이 있는 종목인지 (능력범위) → ② 프리미엄 받을 자격이 있는 사업인지 (프리미엄) → ③ 실제 숫자로 적정가·기대수익률 (밸류에이션)

## GitHub Pages 켜기

1. **Settings → Pages** → Branch: `main`, 폴더: `/ (root)` → **Save**
2. 허브를 `index.html`로 rename

## 주의

- 모든 데이터는 `localStorage` 기반, 본인 기기 브라우저에만 저장(서버 전송 없음). 세 도구는 서로 다른 저장 키를 써서 충돌하지 않습니다.
- 기존 `jhw_CircleOfCompetence` 저장소의 진단 기록은 주소가 달라 이 사이트에서는 보이지 않습니다.
