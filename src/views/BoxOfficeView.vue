<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import {
  fetchBoxOffice,
  bookingLinks,
  formatDt,
  toTargetDt,
  yesterday,
} from '@/api/boxoffice.js'

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
    console.log(`🎬 [KOFIC] ${result.value.label} ${result.value.range} · ${result.value.movies.length}편`)
  } catch (err) {
    console.error('❌ [KOFIC] 조회 실패:', err)
    errorMessage.value = err.message
    result.value = null
  } finally {
    isLoading.value = false
  }
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

/** 누적 관객이 가장 많은 영화 (막대 길이 기준) */
const topAcc = computed(() =>
  result.value ? Math.max(...result.value.movies.map((m) => m.audiAcc)) : 0,
)
</script>

<template>
  <header class="page-banner">
    <p class="eyebrow">Box Office · KOFIC</p>
    <h1 class="page-title">실시간 영화 순위</h1>
    <p class="page-desc">영화진흥위원회 공식 집계입니다. 제목을 누르면 예매처로 이동합니다.</p>
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

    <ol v-else-if="result" class="chart">
      <li v-for="m in result.movies" :key="m.code" class="row">
        <!-- 순위 + 등락 -->
        <div class="rank">
          <span class="rank-no">{{ m.rank }}</span>
          <span v-if="m.isNew" class="badge-new">NEW</span>
          <span v-else-if="m.rankInten > 0" class="inten up">▲{{ m.rankInten }}</span>
          <span v-else-if="m.rankInten < 0" class="inten down">▼{{ -m.rankInten }}</span>
          <span v-else class="inten flat">–</span>
        </div>

        <!-- 본문 -->
        <div class="info">
          <h3 class="title">{{ m.name }}</h3>
          <p class="meta">
            개봉 {{ m.openDt || '-' }} · 스크린 {{ nf.format(m.scrnCnt) }}개 · 점유율
            {{ m.salesShare }}%
          </p>

          <!-- 누적 관객을 막대로 (숫자도 함께 표기) -->
          <div class="bar-row">
            <div class="bar-track">
              <div class="bar-fill" :style="{ width: (m.audiAcc / topAcc) * 100 + '%' }"></div>
            </div>
            <span class="bar-label">누적 {{ nf.format(m.audiAcc) }}명</span>
          </div>
          <p class="sub">해당 기간 {{ nf.format(m.audiCnt) }}명</p>

          <!-- 예매 바로가기 -->
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
  margin-bottom: 4px;
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

/* ---------------- 순위 목록 ---------------- */
.chart {
  list-style: none;
  padding: 0;
  margin: 0;
}

.row {
  display: flex;
  gap: 16px;
  padding: 18px 0;
  border-bottom: 1px solid var(--border);
}

.rank {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  min-width: 44px;
}

.rank-no {
  font-family: var(--font-mono);
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1;
}

.inten,
.badge-new {
  font-family: var(--font-mono);
  font-size: 0.66rem;
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

.info {
  flex: 1;
  min-width: 0;
}

.title {
  font-size: 1rem;
  font-weight: 700;
  margin: 0;
}

.meta {
  margin-top: 3px;
  font-size: 0.78rem;
  color: var(--text-muted);
}

/* 누적 관객 막대 */
.bar-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
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
  font-size: 0.78rem;
  font-weight: 600;
  white-space: nowrap;
}

.sub {
  margin-top: 4px;
  font-family: var(--font-mono);
  font-size: 0.72rem;
  color: var(--text-muted);
}

/* 예매 링크 */
.links {
  display: flex;
  gap: 6px;
  margin-top: 12px;
  flex-wrap: wrap;
}

.link {
  padding: 4px 10px;
  border: 1px solid var(--border);
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-muted);
}

.link:hover {
  border-color: var(--hover-border);
  background: var(--bg-hover);
  color: var(--text);
}

@media (max-width: 560px) {
  .row {
    gap: 10px;
  }
  .rank-no {
    font-size: 1.2rem;
  }
}
</style>
