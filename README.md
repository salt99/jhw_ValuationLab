# jhw_ValuationLab

가치투자 분석 도구 모음. 정성 분석(능력범위)과 정량 분석(밸류에이션)을 하나의 사이트로 묶었습니다.

## 파일 구성 (단일 폴더)

| 파일 | 내용 |
|---|---|
| `index_main.html` | 허브 (두 도구로 가는 관문) |
| `index_circle.html` | 능력범위 체크리스트 |
| `index_roe.html` | 밸류에이션 4-모드 분석기 |

## ⚠️ 업로드 후 반드시 할 일 — 허브 파일명 변경

GitHub Pages는 **`index.html`을 사이트 첫 화면으로 자동 인식**합니다.
따라서 업로드 후 **`index_main.html`을 `index.html`로 rename** 하세요.

- rename 전: `salt99.github.io/jhw_ValuationLab/index_main.html` 로 접속해야 허브가 열림
- rename 후: `salt99.github.io/jhw_ValuationLab/` 만 쳐도 허브가 열림 (권장)

`index_circle.html`과 `index_roe.html`은 그대로 두면 됩니다 — 허브 안의 링크가 이 이름들을 가리키고 있습니다.

## 접속 주소 (허브를 index.html로 rename 후 기준)

- 허브: `https://salt99.github.io/jhw_ValuationLab/`
- 능력범위: `https://salt99.github.io/jhw_ValuationLab/index_circle.html`
- 분석기: `https://salt99.github.io/jhw_ValuationLab/index_roe.html`

## 도구 1 — 능력범위 체크리스트

투자 거장이 실제로 말한 것으로 검증된 6개 항목: 린치(2분 설명)·버핏(10년 예측)·멍거(인버전)·그레이엄(1차자료)·피셔(스커틀벗)·포퍼/소로스(반증가능성).

## 도구 2 — 밸류에이션 4-모드 분석기

```
적정 PBR = 1 + Σ [(ROE − r)·(1+ROE)^(t−1)] / (1+r)^t   (전액 유보 가정)
장기수익률 = [(1+ROE)^N · (청산PBR/진입PBR)]^(1/N) − 1
```

네 모드: ① 적정 PBR ② 내재 ROE ③ 내재 지속기간(moat 수명) ④ 장기 기대수익률

## GitHub Pages 켜기

1. **Settings → Pages** → Branch: `main`, 폴더: `/ (root)` → **Save**
2. 위 "업로드 후 반드시 할 일"대로 허브를 `index.html`로 rename

## 주의

- 모든 데이터는 `localStorage` 기반으로 본인 기기 브라우저에만 저장됩니다(서버 전송 없음).
- 기존 `jhw_CircleOfCompetence` 저장소의 진단 기록은 주소가 달라 이 사이트에서는 보이지 않습니다.
