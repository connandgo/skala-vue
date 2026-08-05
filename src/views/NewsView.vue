<script setup>
import { computed, onMounted, ref } from 'vue'
import { fetchNews, timeAgo, RANGES, ALL_TOPICS, DAILY_ORDER } from '@/api/news.js'

/**
 * 뉴스
 *
 *   일간 - 구글 뉴스에서 모은 국내 AI 기사를 갈래별로
 *   주간 - GeekNews Weekly 최신 호를 그 구성 그대로
 *          (머리글 -> 에디터 글 -> 이번 주 주요 뉴스)
 */

const range = ref('weekly')
const daily = ref([])
const weekly = ref(null)
const fetchedAt = ref(null)
const isLoading = ref(true)
const errorMessage = ref('')

onMounted(async () => {
  try {
    const data = await fetchNews()
    daily.value = data.daily
    weekly.value = data.weekly
    fetchedAt.value = data.fetchedAt
  } catch (err) {
    console.error('[news] 조회 실패:', err)
    errorMessage.value = err.message
  } finally {
    isLoading.value = false
  }
})

/** 일간은 갈래별로 묶는다. 비어 있는 갈래는 내보내지 않는다. */
const dailyGroups = computed(() =>
  DAILY_ORDER.map((id) => {
    const topic = ALL_TOPICS.find((t) => t.id === id)
    return { ...topic, items: daily.value.filter((i) => i.topic === id) }
  }).filter((g) => g.items.length),
)

const today = computed(() =>
  new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' }),
)

/** 두 갈래가 무엇을 위한 것인지 한 줄로 알려 준다 */
const lede = computed(() =>
  range.value === 'daily'
    ? '오늘 나온 국내 AI 기사를 모은 실시간 뉴스입니다.'
    : '한 주의 흐름을 짚는 트렌드 뉴스레터입니다.',
)
</script>

<template>
  <div class="news">
    <!-- 머리글 -->
    <header class="masthead">
      <div>
        <span class="eyebrow">Digest</span>
        <h1 class="page-title">AI 뉴스</h1>
        <p class="period">
          {{ range === 'daily' ? `일간 · ${today}` : `주간 · ${weekly?.period ?? ''}` }}
        </p>
        <p class="lede">{{ lede }}</p>
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
        <span v-if="fetchedAt" class="stamp">
          {{
            fetchedAt.toLocaleString('ko-KR', {
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            })
          }}
          수집
        </span>
      </div>
    </header>

    <p v-if="errorMessage" class="state-msg error">{{ errorMessage }}</p>
    <p v-else-if="isLoading" class="state-msg">이번 호를 여는 중입니다…</p>

    <!-- ==================== 주간 ==================== -->
    <template v-else-if="range === 'weekly'">
      <template v-if="weekly">
        <!-- 대표 글: 이번 호 제목 + 에디터 글 -->
        <section class="lead">
          <a
            :href="weekly.headline.url"
            target="_blank"
            rel="noopener noreferrer"
            class="lead-title"
          >
            {{ weekly.headline.title }}
          </a>

          <div class="editorial">
            <p v-for="(p, i) in weekly.headline.editorial" :key="i">{{ p.text }}</p>
          </div>

          <!-- 에디터 글에서 언급된 글로 바로 갈 수 있게 -->
          <div v-if="weekly.headline.editorial.some((p) => p.links.length)" class="mentioned">
            <span class="mentioned-label">본문에 언급된 글</span>
            <template v-for="p in weekly.headline.editorial" :key="p.text">
              <a
                v-for="l in p.links"
                :key="l.url"
                :href="l.url"
                target="_blank"
                rel="noopener noreferrer"
              >
                {{ l.label }}
              </a>
            </template>
          </div>
        </section>

        <!-- 이번 주 주요 뉴스 -->
        <section class="topic">
          <h2 class="sec-title">
            이번 주 주요 뉴스
            <span class="sec-count">{{ weekly.items.length }}</span>
          </h2>
          <p class="sec-hint">{{ weekly.period }}</p>

          <ol class="list">
            <li v-for="item in weekly.items" :key="item.id">
              <a :href="item.url" target="_blank" rel="noopener noreferrer" class="item-title">
                {{ item.title }}
              </a>
              <p class="summary">{{ item.summary }}</p>
            </li>
          </ol>
        </section>

        <footer class="colophon">
          출처 ·
          <a :href="weekly.headline.url" target="_blank" rel="noopener noreferrer">
            GeekNews Weekly {{ weekly.headline.issue }}
          </a>
          <template v-if="weekly.headline.issue !== weekly.issue">
            ·
            <a :href="weekly.url" target="_blank" rel="noopener noreferrer">{{ weekly.issue }}</a>
          </template>
        </footer>
      </template>

      <p v-else class="state-msg">주간 호를 불러오지 못했습니다.</p>
    </template>

    <!-- ==================== 일간 ==================== -->
    <template v-else>
      <template v-if="daily.length">
        <section v-for="g in dailyGroups" :key="g.id" class="topic">
          <h2 class="sec-title">
            {{ g.label }}
            <span class="sec-count">{{ g.items.length }}</span>
          </h2>

          <ul class="plain">
            <li v-for="item in g.items" :key="item.id">
              <span class="source-col">{{ item.source }}</span>
              <div class="row-body">
                <a :href="item.url" target="_blank" rel="noopener noreferrer">{{ item.title }}</a>
                <p class="meta">{{ timeAgo(item.date) }}</p>
              </div>
            </li>
          </ul>
        </section>

        <footer class="colophon">
          출처 ·
          <a href="https://news.google.com" target="_blank" rel="noopener noreferrer">구글 뉴스</a>
        </footer>
      </template>

      <p v-else class="state-msg">오늘 수집된 기사가 없습니다.</p>
    </template>
  </div>
</template>

<style scoped>
/* ---------------- 머리글 ---------------- */
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

.lede {
  margin-top: 10px;
  font-size: 0.85rem;
  line-height: 1.7;
  color: var(--text-muted);
}

.actions {
  display: flex;
  align-items: center;
  gap: 10px;
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

.stamp {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  color: var(--text-muted);
}

/* ---------------- 주간 대표 글 ---------------- */
.lead {
  padding: 34px 0 30px;
  border-bottom: 1px solid var(--border);
}

.lead-title {
  display: block;
  max-width: 22ch;
  margin: 0 auto;
  color: var(--text);
  text-decoration: none;
  font-size: 1.7rem;
  font-weight: 800;
  line-height: 1.35;
  letter-spacing: -0.03em;
  text-align: center;
}

.lead-title:hover {
  text-decoration: underline;
}

.editorial {
  max-width: 62ch;
  margin: 28px auto 0;
}

.editorial p {
  margin-bottom: 16px;
  font-size: 0.95rem;
  line-height: 1.85;
}

.editorial p:last-child {
  margin-bottom: 0;
}

.mentioned {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  max-width: 62ch;
  margin: 22px auto 0;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}

.mentioned-label {
  margin-right: 4px;
  font-family: var(--font-mono);
  font-size: 0.68rem;
  letter-spacing: 0.06em;
  color: var(--text-muted);
}

.mentioned a {
  padding: 3px 9px;
  border: 1px solid var(--border);
  font-size: 0.75rem;
  color: var(--text-muted);
  text-decoration: none;
}

.mentioned a:hover {
  border-color: var(--hover-border);
  color: var(--text);
}

/* ---------------- 섹션 ---------------- */
.sec-title {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin: 44px 0 0;
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
  text-wrap: balance;
  margin: 8px 0 0;
  font-family: var(--font-mono);
  font-size: 0.74rem;
  color: var(--text-muted);
}

/* ---------------- 주간 목록 ---------------- */
.list {
  margin: 20px 0 0;
  padding-left: 2.4em;
}

.list > li {
  margin-bottom: 24px;
}

.list > li::marker {
  font-family: var(--font-mono);
  font-size: 0.8rem;
  color: var(--text-muted);
}

.item-title {
  display: block;
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.45;
  letter-spacing: -0.01em;
  color: var(--text);
  text-decoration: none;
}

.item-title:hover {
  text-decoration: underline;
}

.summary {
  margin: 7px 0 0;
  font-size: 0.86rem;
  line-height: 1.75;
  color: var(--text-muted);
}

/* ---------------- 일간 목록 ---------------- */
.plain {
  margin: 12px 0 0;
  padding: 0;
  list-style: none;
}

.plain li {
  display: flex;
  gap: 14px;
  padding: 10px 0;
  border-bottom: 1px solid var(--border);
}

.source-col {
  flex: 0 0 7em;
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

.meta {
  margin-top: 5px;
  font-family: var(--font-mono);
  font-size: 0.7rem;
  color: var(--text-muted);
}

/* ---------------- 상태 / 판권 ---------------- */
.state-msg {
  padding: 48px 0;
  font-family: var(--font-mono);
  font-size: 0.85rem;
  color: var(--text-muted);
  text-align: center;
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
  margin-top: 44px;
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
    font-size: 1.35rem;
  }
}
</style>
