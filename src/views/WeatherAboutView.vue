<script setup>
import { RouterLink } from 'vue-router'
import LifeDemo from '@/components/LifeDemo.vue'

/**
 * 소개.
 *
 * 이 사이트가 무엇인지 -> 어떤 결로 만들었는지 -> 어디로 갈 수 있는지 순으로 읽힌다.
 * 페이지 카드는 좌우를 번갈아 놓아, 훑을 때 시선이 지그재그로 내려가게 한다.
 */

// 카드 순서는 상단 네비와 같게 둔다. 두 곳이 다르면 어디가 기준인지 헷갈린다.
const PAGES = [
  {
    to: '/news',
    label: 'AI 뉴스',
    lede: '국내 AI 기사 일간 정리와 GeekNews 주간 요약',
    body: '국내 언론사 AI 기사를 갈래별로 모은 일간과, GeekNews Weekly를 그 구성 그대로 옮긴 주간을 함께 봅니다. 두 곳 다 CORS가 막혀 있어 GitHub Actions가 6시간마다 미리 받아 둡니다.',
    tags: ['구글 뉴스 RSS', 'GeekNews', 'Actions 수집'],
  },
  {
    to: '/effects',
    label: '디자인 이펙트',
    lede: '프론트엔드 시각 효과 24가지와 그 코드',
    body: '프론트엔드에서 자주 쓰는 시각 효과 24가지를 다섯 갈래로 묶었습니다. 데모는 전부 실제로 동작하고, 코드는 눌러서 그대로 복사할 수 있습니다.',
    tags: ['효과 24가지', '동작하는 데모', '코드 복사'],
  },
  {
    to: '/movies',
    label: '영화 순위',
    lede: '어제 가장 많이 본 영화와 예매 링크',
    body: '영화진흥위원회 박스오피스를 일별·주간으로 보여 줍니다. 포스터는 TMDB에서 가져오고, 각 영화마다 예매 사이트로 바로 갈 수 있습니다.',
    tags: ['KOFIC', 'TMDB 포스터', '예매 링크'],
  },
  {
    to: '/weather',
    label: '날씨 대시보드',
    lede: '전국 10개 지역의 현재 날씨와 예보',
    body: '10개 지역을 지도에 올리고 기온을 색으로 나타냅니다. 지역을 고르면 24시간 기온 그래프, 주간 예보, 대기질까지 이어집니다. 비나 눈이 오는 지역을 고르면 화면에도 내립니다.',
    tags: ['Open-Meteo', 'Leaflet 지도', '즐겨찾기'],
  },
]
</script>

<template>
  <div class="about">
    <header class="page-banner">
      <span class="eyebrow">about</span>
      <h1 class="page-title">Vue 3 실습 프로젝트</h1>
      <p class="page-desc">뉴스, 디자인 이펙트, 영화 순위, 날씨 — 네 개의 페이지로 만들었습니다.</p>
    </header>

    <!-- 디자인 소개 -->
    <section class="concept">
      <h2 class="concept-title">디자인 소개</h2>

      <div class="concept-grid">
        <div class="concept-item">
          <h3>배경 — 라이프 게임</h3>

          <!-- 글로만 설명하면 와닿지 않아, 규칙이 도는 것을 그대로 보여 준다 -->
          <LifeDemo />

          <p>
            위에서 도는 것이 콘웨이의 라이프 게임입니다. 칸마다 이웃이 2~3이면 살아남고, 정확히
            3이면 새로 태어납니다. 이 규칙만으로 점들이 저절로 꿈틀거립니다.
          </p>
        </div>

        <div class="concept-item">
          <h3>인트로 — 커널 패닉</h3>
          <p>
            처음 들어오면 커널 패닉 덤프가 한 줄씩 찍히다가, 그 글자들이 무너져 SKALA로 다시
            모입니다. 세션당 한 번만 재생되고, 모션을 줄이도록 설정한 분에게는 아예 나오지 않습니다.
          </p>
          <p class="concept-sub">오른쪽 아래 SKIP으로 건너뛸 수 있습니다.</p>
        </div>
      </div>
    </section>

    <!-- 페이지 카드 -->
    <section class="pages">
      <h2 class="pages-title">둘러보기</h2>

      <RouterLink
        v-for="(p, i) in PAGES"
        :key="p.to"
        :to="p.to"
        class="card"
        :class="i % 2 ? 'right' : 'left'"
      >
        <!-- 미리보기: 각 페이지의 화면 구성을 도형으로 줄인 것 -->
        <div class="preview">
          <svg viewBox="0 0 120 80" aria-hidden="true">
            <!-- AI 뉴스 - 머리기사와 본문 단 -->
            <template v-if="p.to === '/news'">
              <rect class="fill-strong" x="10" y="10" width="52" height="5" />
              <rect class="fill-mid" x="10" y="20" width="72" height="3" />
              <rect class="fill-mid" x="10" y="26" width="64" height="3" />
              <line class="stroke-line" x1="10" y1="36" x2="110" y2="36" />
              <rect class="fill-mid" x="10" y="43" width="30" height="3" />
              <rect class="fill-soft" x="10" y="49" width="44" height="2" />
              <rect class="fill-soft" x="10" y="54" width="38" height="2" />
              <rect class="fill-mid" x="66" y="43" width="30" height="3" />
              <rect class="fill-soft" x="66" y="49" width="44" height="2" />
              <rect class="fill-soft" x="66" y="54" width="34" height="2" />
              <rect class="fill-soft" x="10" y="64" width="26" height="2" />
            </template>

            <!-- 디자인 이펙트 - 효과 격자 -->
            <template v-else-if="p.to === '/effects'">
              <rect class="stroke-line" x="8" y="10" width="32" height="26" fill="none" />
              <circle class="fill-strong" cx="24" cy="23" r="7" />
              <rect class="stroke-line" x="46" y="10" width="32" height="26" fill="none" />
              <path class="stroke-line" d="M50 34 L74 12 M56 34 L78 14 M62 34 L78 20" />
              <rect class="stroke-line" x="84" y="10" width="28" height="26" fill="none" />
              <g class="fill-mid">
                <rect v-for="n in 9" :key="n" :x="90 + ((n - 1) % 3) * 7" :y="16 + Math.floor((n - 1) / 3) * 7" width="2" height="2" />
              </g>
              <rect class="stroke-line" x="8" y="44" width="32" height="26" fill="none" />
              <path class="stroke-line" d="M14 62 Q24 46 34 62" fill="none" />
              <rect class="stroke-line" x="46" y="44" width="66" height="26" fill="none" />
              <rect class="fill-strong" x="52" y="54" width="22" height="6" />
              <rect class="fill-mid" x="80" y="54" width="26" height="6" />
            </template>

            <!-- 영화 순위 - 필름과 순위 막대 -->
            <template v-else-if="p.to === '/movies'">
              <rect class="fill-mid" x="6" y="8" width="108" height="18" />
              <g class="fill-bg">
                <rect v-for="n in 9" :key="n" :x="9 + (n - 1) * 12" y="11" width="5" height="4" />
                <rect v-for="n in 9" :key="`b${n}`" :x="9 + (n - 1) * 12" y="19" width="5" height="4" />
              </g>
              <rect class="fill-strong" x="10" y="36" width="16" height="22" />
              <rect class="fill-mid" x="32" y="36" width="46" height="4" />
              <rect class="fill-soft" x="32" y="44" width="34" height="3" />
              <rect class="fill-soft" x="32" y="50" width="28" height="3" />
              <rect class="stroke-line" x="84" y="36" width="26" height="10" fill="none" />
              <rect class="fill-soft" x="10" y="64" width="100" height="2" />
            </template>

            <!-- 날씨 - 지도 핀과 기온 곡선 -->
            <template v-else>
              <rect class="stroke-line" x="8" y="8" width="60" height="46" fill="none" />
              <g class="fill-strong">
                <rect x="18" y="16" width="9" height="6" />
                <rect x="38" y="24" width="9" height="6" />
                <rect x="26" y="36" width="9" height="6" />
                <rect x="50" y="40" width="9" height="6" />
              </g>
              <polyline class="stroke-line" points="76,44 84,32 92,36 100,22 110,26" fill="none" />
              <g class="fill-mid">
                <circle cx="76" cy="44" r="1.6" />
                <circle cx="84" cy="32" r="1.6" />
                <circle cx="92" cy="36" r="1.6" />
                <circle cx="100" cy="22" r="1.6" />
                <circle cx="110" cy="26" r="1.6" />
              </g>
              <rect class="fill-soft" x="8" y="62" width="46" height="3" />
              <rect class="fill-soft" x="60" y="62" width="50" height="3" />
            </template>
          </svg>
        </div>

        <!-- 설명 -->
        <div class="text">
          <h3>{{ p.label }}</h3>
          <p class="lede">{{ p.lede }}</p>
          <p class="body">{{ p.body }}</p>
          <ul class="tags">
            <li v-for="t in p.tags" :key="t">{{ t }}</li>
          </ul>
          <span class="go">바로 가기 →</span>
        </div>
      </RouterLink>
    </section>

    <footer class="colophon">Vue 3 · Vue Router · Pinia · axios · Leaflet · Canvas</footer>
  </div>
</template>

<style scoped>
/* ---------------- 머리말 ---------------- */
.page-banner {
  padding: 40px 0 24px;
  margin-bottom: 24px;
  border-bottom: 1px solid var(--border);
}

.eyebrow {
  font-family: var(--font-mono);
  font-size: 0.68rem;
  letter-spacing: 0.24em;
  color: var(--text-muted);
}

.page-title {
  margin: 6px 0 0;
  font-size: 2rem;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.page-desc {
  margin-top: 8px;
  font-size: 0.85rem;
  color: var(--text-muted);
}

/* ---------------- 디자인 소개 ---------------- */
.concept {
  padding-bottom: 40px;
  border-bottom: 1px solid var(--border);
}

/* 섹션 제목. 같은 층위라 한 곳에서 함께 정한다. */
.concept-title,
.pages-title {
  font-size: 1.5rem;
  font-weight: 800;
  letter-spacing: -0.01em;
  color: var(--text);
}

.concept-title {
  margin: 0 0 20px;
}

.concept-grid {
  display: grid;
  /* 라이프 데모가 들어간 쪽이 길어지므로 위를 맞춘다 */
  align-items: start;
  grid-template-columns: repeat(2, 1fr);
  gap: 24px;
}

.concept-item h3 {
  margin: 0 0 10px;
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.concept-item p {
  font-size: 0.85rem;
  line-height: 1.8;
  color: var(--text-muted);
}

.concept-sub {
  margin-top: 10px;
  padding-left: 10px;
  border-left: 2px solid var(--border);
  font-size: 0.78rem !important;
}

/* ---------------- 페이지 카드 ---------------- */
.pages-title {
  margin: 40px 0 20px;
}

.card {
  display: flex;
  align-items: center;
  gap: 24px;
  width: 90%;
  margin-bottom: 20px;
  padding: 20px;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text);
  text-decoration: none;
  transition:
    transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1),
    border-color 0.25s;
}

/* 좌우를 번갈아 놓아 훑을 때 시선이 지그재그로 내려간다 */
.card.left {
  margin-right: auto;
}

.card.right {
  margin-left: auto;
  flex-direction: row-reverse;
}

.card:hover {
  transform: translateY(-3px);
  border-color: var(--hover-border);
}

.preview {
  flex: 0 0 200px;
  padding: 10px;
  border: 1px solid var(--border);
  background: var(--bg-subtle);
}

.preview svg {
  display: block;
  width: 100%;
  height: auto;
}

/* 미리보기 도형의 톤. 지면처럼 강약을 준다. */
.preview :deep(.fill-strong) {
  fill: var(--text);
}
.preview :deep(.fill-mid) {
  fill: var(--text-muted);
}
.preview :deep(.fill-soft) {
  fill: var(--border);
}
.preview :deep(.fill-bg) {
  fill: var(--bg-subtle);
}
.preview :deep(.stroke-line) {
  stroke: var(--text-muted);
  stroke-width: 1;
  fill: none;
}

.text {
  min-width: 0;
}

.text h3 {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.lede {
  margin-top: 4px;
  font-size: 0.85rem;
  color: var(--text-muted);
}

.body {
  margin-top: 10px;
  font-size: 0.82rem;
  line-height: 1.75;
  color: var(--text-muted);
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 12px 0 0;
  padding: 0;
  list-style: none;
}

.tags li {
  padding: 2px 8px;
  border: 1px solid var(--border);
  font-family: var(--font-mono);
  font-size: 0.68rem;
  color: var(--text-muted);
}

.go {
  display: inline-block;
  margin-top: 12px;
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--text-muted);
}

.card:hover .go {
  color: var(--text);
}

/* ---------------- 판권 ---------------- */
.colophon {
  margin-top: 32px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
  font-family: var(--font-mono);
  font-size: 0.72rem;
  color: var(--text-muted);
}

@media (max-width: 760px) {
  .concept-grid {
    grid-template-columns: 1fr;
  }
  .card,
  .card.right {
    width: 100%;
    flex-direction: column;
    align-items: stretch;
  }
  .preview {
    flex: none;
  }
  .page-title {
    font-size: 1.7rem;
  }
}
</style>
