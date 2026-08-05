<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { fetchAiNews, timeAgo, RANGES, ALL_TOPICS } from '@/api/news.js'

/**
 * AI 뉴스 - 일간 / 주간 다이제스트
 *
 * 뉴스레터처럼 읽히게 만든다.
 *   머리기사 3건 -> 이번 호 한눈에 -> 갈래별 묶음
 * 점수순으로 쭉 늘어놓기만 하면 훑기는 쉬워도 "무슨 일이 있었는지"가 안 남는다.
 */

const range = ref('weekly')
const items = ref([])
const failedQueries = ref([])
const isLoading = ref(true)
const errorMessage = ref('')

const load = async () => {
  isLoading.value = true
  errorMessage.value = ''
  try {
    const { list, failed } = await fetchAiNews(range.value)
    items.value = list
    failedQueries.value = failed
  } catch (err) {
    console.error('[news] 조회 실패:', err)
    errorMessage.value = err.message
    items.value = []
  } finally {
    isLoading.value = false
  }
}

watch(range, load)
onMounted(load)

const fmt = (d) => `${d.getMonth() + 1}월 ${d.getDate()}일`

/** "8월 1일 – 8월 5일" 처럼 이번 호가 다루는 기간 */
const period = computed(() => {
  const now = new Date()
  const from = new Date(Date.now() - RANGES[range.value].hours * 3600 * 1000)
  return range.value === 'daily' ? fmt(now) : `${fmt(from)} – ${fmt(now)}`
})

// 머리기사와 본문을 나눈다
const headline = computed(() => items.value.slice(0, 3))
const body = computed(() => items.value.slice(3))

/** 갈래별로 묶는다. 비어 있는 갈래는 내보내지 않는다. */
const groups = computed(() =>
  ALL_TOPICS.map((t) => ({
    ...t,
    items: body.value.filter((i) => i.topic === t.id),
  })).filter((g) => g.items.length),
)

const digest = computed(() => {
  if (!items.value.length) return null

  // 가장 많이 실린 갈래 (머리기사까지 포함해서 센다)
  const tally = {}
  for (const i of items.value) tally[i.topic] = (tally[i.topic] ?? 0) + 1
  const topId = Object.entries(tally).sort((a, b) => b[1] - a[1])[0][0]

  // 가장 자주 등장한 언론사
  const sources = {}
  for (const i of items.value) {
    if (i.source) sources[i.source] = (sources[i.source] ?? 0) + 1
  }

  return {
    count: items.value.length,
    topTopic: ALL_TOPICS.find((t) => t.id === topId)?.label ?? '-',
    topTopicCount: tally[topId],
    topSources: Object.entries(sources)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3),
  }
})
</script>

<template>
  <div class="news">
    <!-- 발행 머리말 -->
    <header class="masthead">
      <div>
        <span class="eyebrow">AI Digest</span>
        <h1 class="page-title">AI 뉴스</h1>
        <p class="period">{{ RANGES[range].label }} · {{ period }}</p>
      </div>

      <div class="actions">
        <div class="range">
          <button
            v-for="(r, key) in RANGES"
            :key="key"
            type="button"
            :class="{ on: range === key }"
            @click="range = key"
          >
            {{ r.label }}
          </button>
        </div>
        <button :disabled="isLoading" @click="load">
          {{ isLoading ? '수집 중…' : '새로고침' }}
        </button>
      </div>
    </header>

    <p v-if="errorMessage" class="state-msg error">{{ errorMessage }}</p>
    <p v-else-if="isLoading" class="state-msg">이번 호를 모으는 중입니다…</p>

    <template v-else-if="items.length">
      <!-- 이번 호 한눈에 -->
      <section v-if="digest" class="digest">
        <p class="digest-line">
          이번 호는 <b>{{ digest.count }}건</b>입니다. 가장 많이 다뤄진 갈래는
          <b>{{ digest.topTopic }}</b>({{ digest.topTopicCount }}건)입니다.
        </p>
        <p class="digest-src">
          자주 등장한 언론사 —
          <span v-for="([name, n], i) in digest.topSources" :key="name">
            <template v-if="i">, </template>{{ name }} ({{ n }})
          </span>
        </p>
      </section>

      <!-- 머리기사 -->
      <section class="lead">
        <h2 class="sec-title">머리기사</h2>
        <article v-for="(item, i) in headline" :key="item.id" class="lead-item">
          <span class="rank">{{ i + 1 }}</span>
          <div>
            <a :href="item.url" target="_blank" rel="noopener noreferrer" class="lead-title">
              {{ item.title }}
            </a>
            <p class="meta">
              <span class="source">{{ item.source }}</span>
              <span>{{ timeAgo(item.date) }}</span>
            </p>
          </div>
        </article>
      </section>

      <!-- 갈래별 -->
      <section v-for="g in groups" :key="g.id" class="topic">
        <h2 class="sec-title">
          {{ g.label }}
          <span class="sec-count">{{ g.items.length }}</span>
        </h2>
        <p class="sec-hint">{{ g.hint }}</p>

        <ul>
          <li v-for="item in g.items" :key="item.id">
            <span class="source-col">{{ item.source }}</span>
            <div class="row-body">
              <a :href="item.url" target="_blank" rel="noopener noreferrer">{{ item.title }}</a>
              <p class="meta">
                <span>{{ timeAgo(item.date) }}</span>
              </p>
            </div>
          </li>
        </ul>
      </section>

      <p v-if="failedQueries.length" class="state-msg small">
        일부 검색어를 못 받았습니다: {{ failedQueries.join(', ') }}
      </p>
    </template>

    <p v-else class="state-msg">이 기간에 해당하는 글이 없습니다.</p>

    <footer class="colophon">
      출처 ·
      <a href="https://news.google.com" target="_blank" rel="noopener noreferrer">구글 뉴스</a>
      RSS (rss2json 경유). 국내 언론사 기사를 모아 제목의 낱말로 주제를 나누고 최신순으로 정렬합니다.
    </footer>
  </div>
</template>

<style scoped>
/* ---------------- 머리말 ---------------- */
.masthead {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
  flex-wrap: wrap;
  padding: 40px 0 20px;
  border-bottom: 3px double var(--border-strong);
}

.eyebrow {
  font-family: var(--font-mono);
  font-size: 0.68rem;
  letter-spacing: 0.24em;
  color: var(--text-muted);
}

.page-title {
  margin: 6px 0 0;
  font-size: 2.2rem;
  font-weight: 800;
  letter-spacing: -0.03em;
}

.period {
  margin-top: 6px;
  font-family: var(--font-mono);
  font-size: 0.78rem;
  color: var(--text-muted);
}

.actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.actions > button {
  margin: 0;
}

.range {
  display: inline-flex;
}

.range button {
  margin: 0;
  padding: 4px 14px;
  font-size: 0.78rem;
}

.range button + button {
  margin-left: -1px;
}

.range button.on {
  position: relative;
  border-color: var(--text);
  background: var(--text);
  color: var(--bg);
}

/* ---------------- 이번 호 한눈에 ---------------- */
.digest {
  padding: 18px 20px;
  margin: 24px 0 8px;
  border-left: 3px solid var(--text);
  background: var(--bg-subtle);
}

.digest-line {
  margin: 0;
  font-size: 0.92rem;
  line-height: 1.75;
}

.digest-line b {
  font-weight: 700;
}

.digest-src {
  margin: 8px 0 0;
  font-family: var(--font-mono);
  font-size: 0.72rem;
  color: var(--text-muted);
}

/* ---------------- 섹션 ---------------- */
.sec-title {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin: 40px 0 0;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border-strong);
  font-size: 1.05rem;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.sec-count {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  font-weight: 400;
  color: var(--text-muted);
}

.sec-hint {
  margin: 8px 0 0;
  font-size: 0.78rem;
  color: var(--text-muted);
}

/* ---------------- 머리기사 ---------------- */
.lead-item {
  display: flex;
  gap: 16px;
  padding: 16px 0;
  border-bottom: 1px solid var(--border);
}

.rank {
  flex: 0 0 auto;
  font-family: var(--font-mono);
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1.2;
  color: var(--text-muted);
}

.lead-title {
  display: block;
  font-size: 1.05rem;
  font-weight: 600;
  line-height: 1.45;
  letter-spacing: -0.01em;
  color: var(--text);
  text-decoration: none;
}

.lead-title:hover {
  text-decoration: underline;
}

/* ---------------- 갈래별 목록 ---------------- */
.topic ul {
  margin: 12px 0 0;
  padding: 0;
  list-style: none;
}

.topic li {
  display: flex;
  gap: 14px;
  padding: 10px 0;
  border-bottom: 1px solid var(--border);
}

.source-col {
  flex: 0 0 6.5em;
  padding-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--font-mono);
  font-size: 0.7rem;
  text-align: right;
  color: var(--text-muted);
}

.row-body {
  min-width: 0;
}

.row-body > a {
  font-size: 0.9rem;
  line-height: 1.5;
  color: var(--text);
  text-decoration: none;
}

.row-body > a:hover {
  text-decoration: underline;
}

/* ---------------- 메타 ---------------- */
.meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 5px;
  font-family: var(--font-mono);
  font-size: 0.7rem;
  color: var(--text-muted);
}

.meta a {
  color: var(--text-muted);
}

.meta a:hover {
  color: var(--text);
}

.source {
  max-width: 18em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ---------------- 상태 / 판권 ---------------- */
.state-msg {
  padding: 48px 0;
  font-family: var(--font-mono);
  font-size: 0.85rem;
  color: var(--text-muted);
  text-align: center;
}

.state-msg.small {
  padding: 16px 0 0;
  font-size: 0.72rem;
  text-align: left;
}

.state-msg.error {
  margin-top: 24px;
  padding: 12px;
  border-left: 2px solid var(--text);
  background: var(--bg-subtle);
  color: var(--text);
  text-align: left;
}

.colophon {
  margin-top: 40px;
  padding-top: 16px;
  border-top: 3px double var(--border-strong);
  font-size: 0.74rem;
  line-height: 1.75;
  color: var(--text-muted);
}

@media (max-width: 620px) {
  .page-title {
    font-size: 1.8rem;
  }
  .lead-title {
    font-size: 0.95rem;
  }
}
</style>
