<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { fetchBoxOffice, bookingLinks, formatDt, toTargetDt, yesterday } from '@/api/boxoffice.js'
import { fetchPoster, hasTmdbKey } from '@/api/tmdb.js'

const type = ref('daily') // 'daily' | 'weekly'
const date = ref(yesterday())

const result = ref(null)
const isLoading = ref(true)
const errorMessage = ref('')

const load = async () => {
  isLoading.value = true
  errorMessage.value = ''
  try {
    result.value = await fetchBoxOffice(type.value, date.value)
    console.log(
      `🎬 [KOFIC] ${result.value.label} ${result.value.range} · ${result.value.movies.length}편`,
    )

    // 포스터는 부가 정보라 목록을 먼저 보여주고 나중에 채운다 (있으면)
    if (hasTmdbKey) loadPosters(result.value.movies)
  } catch (err) {
    console.error('❌ [KOFIC] 조회 실패:', err)
    errorMessage.value = err.message
    result.value = null
  } finally {
    isLoading.value = false
  }
}

/** 포스터를 병렬로 받아 각 영화에 채워 넣는다 */
const loadPosters = async (movies) => {
  await Promise.all(
    movies.map(async (m) => {
      const info = await fetchPoster(m.name, m.openDt)
      if (info?.poster) m.poster = info.poster
    }),
  )
}

onMounted(load)
// 구분(일별/주간)이나 날짜가 바뀌면 다시 조회한다
watch([type, date], load)

/** <input type="date"> 와 연결하기 위한 "YYYY-MM-DD" 문자열 */
const dateInput = computed({
  get: () => formatDt(toTargetDt(date.value)),
  set: (v) => {
    if (v) date.value = new Date(v)
  },
})

// 오늘 날짜는 아직 집계 전이므로 어제까지만 선택 가능
const maxDate = computed(() => formatDt(toTargetDt(yesterday())))

const nf = new Intl.NumberFormat('ko-KR')

// 1~3위는 카드로 크게, 4위부터는 목록으로 나눠 보여준다
const top3 = computed(() => result.value?.movies.slice(0, 3) ?? [])
const rest = computed(() => result.value?.movies.slice(3) ?? [])

/** 4위 이하 막대는 4위를 기준으로 잡아야 길이 차이가 보인다 */
const restMax = computed(() =>
  rest.value.length ? Math.max(...rest.value.map((m) => m.audiAcc)) : 0,
)
</script>

<template>
  <header class="page-banner">
    <p class="eyebrow">Box Office · KOFIC</p>
    <h1 class="page-title">실시간 영화 순위</h1>
    <p class="page-desc">영화진흥위원회 공식 집계입니다. 예매처 버튼으로 바로 이동할 수 있습니다.</p>
  </header>

  <div class="dashboard-wrapper">
    <!-- 조회 조건 -->
    <div class="controls">
      <div class="seg">
        <button :class="{ on: type === 'daily' }" @click="type = 'daily'">일별</button>
        <button :class="{ on: type === 'weekly' }" @click="type = 'weekly'">주간</button>
      </div>
      <input v-model="dateInput" type="date" :max="maxDate" />
      <span v-if="result" class="range">{{ result.range }}</span>
    </div>

    <p v-if="isLoading" class="state-msg">불러오는 중입니다…</p>
    <p v-else-if="errorMessage" class="state-msg error">{{ errorMessage }}</p>

    <template v-else-if="result">
      <!-- ============ TOP 3 ============ -->
      <section class="top-section">
        <p class="section-label">TOP 3</p>
        <div class="podium">
          <article v-for="m in top3" :key="m.code" class="card" :class="`rank-${m.rank}`">
            <div class="card-head">
              <span class="big-rank">{{ m.rank }}</span>
              <span v-if="m.isNew" class="badge-new">NEW</span>
              <span v-else-if="m.rankInten > 0" class="inten">▲{{ m.rankInten }}</span>
              <span v-else-if="m.rankInten < 0" class="inten">▼{{ -m.rankInten }}</span>
              <span v-else class="inten flat">–</span>
            </div>

            <div class="card-poster">
              <img v-if="m.poster" :src="m.poster" :alt="`${m.name} 포스터`" loading="lazy" />
              <div v-else class="poster-empty">No Image</div>
            </div>

            <h3 class="card-title">{{ m.name }}</h3>

            <dl class="card-stats">
              <div>
                <dt>누적 관객</dt>
                <dd class="strong">{{ nf.format(m.audiAcc) }}명</dd>
              </div>
              <div>
                <dt>해당 기간</dt>
                <dd>{{ nf.format(m.audiCnt) }}명</dd>
              </div>
              <div>
                <dt>점유율</dt>
                <dd>{{ m.salesShare }}%</dd>
              </div>
              <div>
                <dt>스크린</dt>
                <dd>{{ nf.format(m.scrnCnt) }}개</dd>
              </div>
            </dl>

            <p class="card-open">개봉 {{ m.openDt || '-' }}</p>

            <div class="links">
              <a
                v-for="l in bookingLinks(m.name)"
                :key="l.name"
                :href="l.url"
                target="_blank"
                rel="noopener noreferrer"
                class="link"
              >
                {{ l.name }}
              </a>
            </div>
          </article>
        </div>
      </section>

      <!-- ============ 4위 이하 ============ -->
      <section v-if="rest.length" class="rest-section">
        <p class="section-label">4 – {{ result.movies.length }}위</p>
        <ol class="chart">
          <li v-for="m in rest" :key="m.code" class="row">
            <div class="rank">
              <span class="rank-no">{{ m.rank }}</span>
              <span v-if="m.isNew" class="badge-new sm">NEW</span>
              <span v-else-if="m.rankInten > 0" class="inten">▲{{ m.rankInten }}</span>
              <span v-else-if="m.rankInten < 0" class="inten">▼{{ -m.rankInten }}</span>
              <span v-else class="inten flat">–</span>
            </div>

            <img v-if="m.poster" :src="m.poster" :alt="`${m.name} 포스터`" class="poster-sm" loading="lazy" />

            <div class="info">
              <h3 class="title">{{ m.name }}</h3>
              <p class="meta">
                개봉 {{ m.openDt || '-' }} · 스크린 {{ nf.format(m.scrnCnt) }}개 · 점유율
                {{ m.salesShare }}%
              </p>

              <div class="bar-row">
                <div class="bar-track">
                  <div class="bar-fill" :style="{ width: (m.audiAcc / restMax) * 100 + '%' }"></div>
                </div>
                <span class="bar-label">누적 {{ nf.format(m.audiAcc) }}명</span>
              </div>
              <p class="sub">해당 기간 {{ nf.format(m.audiCnt) }}명</p>

              <div class="links">
                <a
                  v-for="l in bookingLinks(m.name)"
                  :key="l.name"
                  :href="l.url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="link"
                >
                  {{ l.name }}
                </a>
              </div>
            </div>
          </li>
        </ol>
      </section>
    </template>
  </div>
</template>

<style scoped>
.page-banner {
  padding: 40px 0 24px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 28px;
}

.page-title {
  font-size: 2rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  margin: 6px 0 0;
}

.page-desc {
  margin-top: 8px;
  font-size: 0.9rem;
  color: var(--text-muted);
}

/* ---------------- 조회 조건 ---------------- */
.controls {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border);
}

.seg {
  display: flex;
}

.seg button {
  margin: 0 0 0 -1px;
  padding: 5px 14px;
  font-size: 0.8rem;
}

.seg button.on {
  background: var(--text);
  border-color: var(--text);
  color: var(--bg);
}

.range {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  color: var(--text-muted);
}

.state-msg {
  padding: 40px 0;
  text-align: center;
  font-family: var(--font-mono);
  font-size: 0.85rem;
  color: var(--text-muted);
}

.state-msg.error {
  color: var(--text);
  border-left: 2px solid var(--text);
  padding-left: 12px;
  text-align: left;
}

/* ---------------- 섹션 라벨 ---------------- */
.section-label {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: var(--text-meta);
  margin: 28px 0 12px;
}

/* ---------------- TOP 3 ---------------- */
.podium {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
}

.card {
  display: flex;
  flex-direction: column;
  padding: 16px;
  border: 1px solid var(--border);
  background: var(--bg);
}

/* 1위만 테두리를 굵게 해서 시선을 잡는다 */
.card.rank-1 {
  border-color: var(--text);
  border-width: 2px;
  padding: 15px;
}

.card-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 10px;
}

.big-rank {
  font-family: var(--font-mono);
  font-size: 2.6rem;
  font-weight: 700;
  line-height: 0.9;
  letter-spacing: -0.04em;
}

.card-poster {
  aspect-ratio: 2 / 3;
  border: 1px solid var(--border);
  background: var(--bg-subtle);
  overflow: hidden;
}

.card-poster img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.poster-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  font-family: var(--font-mono);
  font-size: 0.7rem;
  color: var(--text-muted);
}

.card-title {
  font-size: 1.05rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  margin: 12px 0 0;
  line-height: 1.3;
}

.card-stats {
  margin: 12px 0 0;
  border-top: 1px solid var(--border);
}

.card-stats > div {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  padding: 5px 0;
  border-bottom: 1px solid var(--border);
}

.card-stats dt {
  font-size: 0.74rem;
  color: var(--text-muted);
}

.card-stats dd {
  margin: 0;
  font-family: var(--font-mono);
  font-size: 0.8rem;
}

.card-stats dd.strong {
  font-size: 0.92rem;
  font-weight: 700;
}

.card-open {
  margin-top: 10px;
  font-family: var(--font-mono);
  font-size: 0.7rem;
  color: var(--text-muted);
}

/* ---------------- 4위 이하 ---------------- */
.chart {
  list-style: none;
  padding: 0;
  margin: 0;
}

.row {
  display: flex;
  gap: 14px;
  padding: 16px 0;
  border-bottom: 1px solid var(--border);
}

.row:first-child {
  border-top: 1px solid var(--border);
}

.rank {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  min-width: 40px;
}

.rank-no {
  font-family: var(--font-mono);
  font-size: 1.35rem;
  font-weight: 700;
  line-height: 1;
}

.poster-sm {
  width: 60px;
  height: 88px;
  object-fit: cover;
  border: 1px solid var(--border);
  background: var(--bg-subtle);
  flex-shrink: 0;
}

.info {
  flex: 1;
  min-width: 0;
}

.title {
  font-size: 0.95rem;
  font-weight: 700;
  margin: 0;
}

.meta {
  margin-top: 3px;
  font-size: 0.76rem;
  color: var(--text-muted);
}

.bar-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 9px;
}

.bar-track {
  flex: 1;
  height: 6px;
  background: var(--bg-subtle);
  border: 1px solid var(--border);
}

.bar-fill {
  height: 100%;
  background: var(--text);
}

.bar-label {
  font-family: var(--font-mono);
  font-size: 0.76rem;
  font-weight: 600;
  white-space: nowrap;
}

.sub {
  margin-top: 4px;
  font-family: var(--font-mono);
  font-size: 0.7rem;
  color: var(--text-muted);
}

/* ---------------- 공통 ---------------- */
.inten,
.badge-new {
  font-family: var(--font-mono);
  font-size: 0.68rem;
  letter-spacing: 0.02em;
}

.inten.flat {
  color: var(--text-muted);
}

.badge-new {
  padding: 1px 5px;
  background: var(--text);
  color: var(--bg);
  font-weight: 700;
}

.badge-new.sm {
  font-size: 0.6rem;
}

.links {
  display: flex;
  gap: 5px;
  margin-top: 12px;
  flex-wrap: wrap;
}

.link {
  padding: 4px 9px;
  border: 1px solid var(--border);
  font-size: 0.73rem;
  font-weight: 500;
  color: var(--text-muted);
}

.link:hover {
  border-color: var(--hover-border);
  background: var(--bg-hover);
  color: var(--text);
}

/* ---------------- 반응형 ---------------- */
@media (max-width: 760px) {
  .podium {
    grid-template-columns: 1fr;
  }
  .card.rank-1 {
    border-width: 1px;
    padding: 16px;
  }
  .big-rank {
    font-size: 2rem;
  }
}
</style>
