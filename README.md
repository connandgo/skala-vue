# skala-vue

뉴스 · 디자인 이펙트 · 영화 순위 · 날씨를 한자리에 모은 Vue 3 단일 페이지 앱입니다.

**배포 주소** — https://connandgo.github.io/skala-vue/

`main` 브랜치에 push하면 GitHub Actions가 빌드해 GitHub Pages로 올립니다.
뉴스는 6시간마다 자동으로 다시 모아 재배포합니다.

## 화면

| 경로 | 화면 | 내용 |
| --- | --- | --- |
| `/` | 소개 | 각 페이지 안내. 라이프 게임이 실제로 도는 데모를 함께 둔다 |
| `/news` | AI 뉴스 | 일간(구글 뉴스 RSS) / 주간(GeekNews Weekly). 주제 6갈래로 자동 분류 |
| `/effects` | 디자인 이펙트 | 프론트엔드 시각 효과 카탈로그. 각 효과의 코드를 함께 본다 |
| `/movies` | 영화 순위 | 영화진흥위원회(KOFIC) 일별·주간 박스오피스 + TMDB 포스터 |
| `/weather` | 날씨 대시보드 | 국내 10개 지역. 지도에서 고르면 오른쪽에 상세가 뜬다 |
| `/weather/:cityId` | 지역 상세 | 동적 경로. 시간별·주간 예보와 대기질 |
| 그 밖의 모든 경로 | 404 | Catch-all 라우트 |

## 기술

- **Vue 3** — 모든 컴포넌트가 `<script setup>` Composition API
- **Vue Router 5** — 전 라우트 지연 로딩, 동적 경로, Catch-all
- **Pinia 3** — `authStore`(계정·선호 설정), `configStore`(온도 단위). 두 스토어 모두 setup 문법
- **Axios** — KOFIC·TMDB 호출. API별로 인스턴스를 나눠 baseURL·timeout·헤더를 따로 잡는다
- **Element Plus** — 빈 상태(`el-empty`)와 로딩 자리(`el-skeleton`). 전체 등록은 번들이 1MB 가까이 늘어 쓰는 것만 직접 가져온다. 기본 테마가 이 사이트의 흑백 톤과 부딪혀 `assets/element-theme.css`에서 `--el-*` 변수만 덮어썼다
- **Leaflet** — 지역 선택 지도
- **Vite 8** — 번들러

### 외부 API

| API | 인증 | 비고 |
| --- | --- | --- |
| [Open-Meteo](https://open-meteo.com/en/docs) | 불필요 | 날씨·대기질. 키가 필요 없어서 골랐다 |
| [KOFIC](https://www.kobis.or.kr/kobisopenapi) | 키 필요 | 박스오피스 |
| [TMDB](https://developer.themoviedb.org/) | v4 토큰 (선택) | 포스터. 없으면 포스터만 빠지고 나머지는 그대로 동작한다 |
| 구글 뉴스 RSS / GeekNews | 불필요 | CORS가 없어 브라우저에서 못 읽는다. GitHub Actions가 빌드 전에 받아 `public/news.json`으로 저장한다 |

## 실행

### 요구 버전

Node **20.19+** 또는 **22.12+** (`package.json`의 `engines` 참고). Node 18에서는 Vite가 뜨지 않습니다.

```sh
node -v   # v22.x 확인
```

### 설치와 실행

```sh
npm install
npm run dev     # http://localhost:3000 자동 실행
```

### 환경 변수

`.env.example`을 복사해 `.env`를 만들고 본인 키를 넣습니다.

```sh
cp .env.example .env
```

```ini
VITE_KOFIC_API_KEY=발급받은_키
VITE_TMDB_TOKEN=발급받은_v4_읽기_토큰
```

키를 넣지 않아도 앱은 뜹니다. 영화 순위 페이지에서 조회 실패 메시지가 뜨고, 포스터가 빠집니다.

> **주의** — `VITE_` 로 시작하는 값은 빌드할 때 문자열로 치환되어 번들에 그대로 들어갑니다.
> 정적 사이트라 서버에 숨길 곳이 없기 때문입니다. 배포된 JS를 열면 누구나 읽을 수 있으므로,
> **여기에는 사용량이 제한된 데모용 키만 넣으세요.** 실제 서비스 키를 넣으면 안 됩니다.
> 날씨를 Open-Meteo로 고른 이유도 이것입니다 — 키가 없으면 새어 나갈 것도 없습니다.

### 그 밖의 명령

```sh
npm run build     # dist/ 로 프로덕션 빌드
npm run preview   # 빌드 결과 미리보기
npm run lint      # oxlint + eslint (--fix 포함)
npm run format    # prettier
npm run news      # 뉴스를 새로 모아 public/news.json 갱신
```

## 구조

```
src/
├── api/            외부 API 호출 (weather, boxoffice, tmdb, news)
├── assets/         전역 CSS (element-theme.css 는 Element Plus 톤 맞추기)
├── components/
│   ├── weather/    날씨 전용 (RegionMap, CityTable, CityPanel)
│   ├── effects/    이펙트 카드
│   └── ...         공용 (UnitToggler, AuthMenu, LifeDemo, DitherBackdrop …)
├── data/           도시 좌표, 평년값, 이펙트 정의
├── router/         라우트 정의
├── stores/         Pinia 스토어
├── utils/          기상 코드 해석, 온도 변환 등
└── views/          라우트별 페이지
```

## 배포

`.github/workflows/deploy.yml` 이 처리합니다.

1. 뉴스 수집 (`npm run news`) — 실패해도 배포는 계속되고 직전 `news.json`을 씁니다
2. 빌드 — API 키는 저장소 Secrets(`VITE_KOFIC_API_KEY`, `VITE_TMDB_TOKEN`)에서 주입합니다
3. `index.html`을 `404.html`로 복사 — GitHub Pages는 정적 호스팅이라 `/news` 같은 경로를 모릅니다. 404로 떨어뜨려도 앱이 부팅되면 라우터가 경로를 처리합니다

하위 경로(`/skala-vue/`)로 서비스되므로 `vite.config.js`의 `base`와 라우터의 `createWebHistory(import.meta.env.BASE_URL)`가 짝을 이룹니다. 루트 도메인에 올린다면 `base`를 `'/'` 로 바꾸면 됩니다.

## 개발 환경 권장 설정

VS Code + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) 확장 (Vetur는 끄세요).

## 배경 이미지 출처

`public/sky.jpg` — Wikimedia Commons, "Cloudscape, 2022-06-22, 01 bw.jpg" (CC0, 퍼블릭 도메인)
