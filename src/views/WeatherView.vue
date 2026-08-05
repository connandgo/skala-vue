<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import RegionMap from '@/components/weather/RegionMap.vue'
import CityPanel from '@/components/weather/CityPanel.vue'
import CityTable from '@/components/weather/CityTable.vue'
import { fetchAllCitiesWeather, fetchCityForecast } from '@/api/weather.js'
import { fxMode, modeFromWeatherId } from '@/utils/weatherFx.js'

/**
 * 지역별 날씨 대시보드.
 *
 * 화면을 좌우로 나눈다.
 *   왼쪽  고르는 곳 (검색 + 지도)
 *   오른쪽 보는 곳 (선택한 지역의 상세)
 *
 * 위아래로 두면 지역을 바꿀 때마다 스크롤해야 해서 비교가 안 된다.
 */

const router = useRouter()

const weatherList = ref([])
// onMounted에서 바로 조회하므로 처음부터 로딩 상태로 시작한다
const isLoading = ref(true)
const errorMessage = ref('')
const failedCities = ref([])
const updatedAt = ref('')

const searchQuery = ref('')
const selectedId = ref('')

const forecast = ref([])
const isForecastLoading = ref(false)

// 검색어로 걸러낸 목록 (지도 마커와 표가 함께 이 값을 쓴다)
const visibleCities = computed(() => {
  const query = searchQuery.value.trim()
  if (!query) return weatherList.value
  return weatherList.value.filter((item) => item.name.includes(query))
})

const selectedCity = computed(
  () => weatherList.value.find((c) => c.id === selectedId.value) ?? null,
)

/** 전국 평균/최고/최저 — 지금 한국이 어떤 상태인지 한 줄로 */
const summary = computed(() => {
  const list = weatherList.value
  if (!list.length) return null

  const temps = list.map((c) => c.temp)
  const hottest = list.reduce((a, b) => (a.temp > b.temp ? a : b))
  const coldest = list.reduce((a, b) => (a.temp < b.temp ? a : b))

  return {
    avg: (temps.reduce((s, t) => s + t, 0) / temps.length).toFixed(1),
    hottest,
    coldest,
    // 비/눈이 오는 지역 수 (id 5xx=비, 6xx=눈)
    wet: list.filter((c) => c.weatherId >= 500 && c.weatherId < 700).length,
  }
})

/** OpenWeather에서 전체 도시의 현재 날씨를 받아온다 */
const loadWeather = async () => {
  isLoading.value = true
  errorMessage.value = ''
  try {
    const { list, failed } = await fetchAllCitiesWeather()
    weatherList.value = list
    failedCities.value = failed
    updatedAt.value = new Date().toLocaleTimeString('ko-KR')

    // 선택이 없으면 첫 번째 지역을 자동 선택해 오른쪽이 비어 보이지 않게 한다
    if (!selectedId.value && list.length) selectCity(list[0])
  } catch (err) {
    console.error('[weather] 조회 실패:', err)
    errorMessage.value = 'API 호출에 실패했습니다. .env의 키와 네트워크를 확인하세요.'
  } finally {
    isLoading.value = false
  }
}

// 지금 전국이 맑을 때도 효과를 확인할 수 있도록 하는 수동 미리보기
const fxPreview = ref('')
const setPreview = (mode) => {
  fxPreview.value = mode
  fxMode.value = mode || modeFromWeatherId(selectedCity.value?.weatherId)
}

const selectCity = (item) => {
  selectedId.value = item.id
  // 선택한 지역이 비/눈이면 화면 전체에 그 효과를 켠다
  if (!fxPreview.value) fxMode.value = modeFromWeatherId(item.weatherId)
}

const goDetail = (item) => router.push(`/weather/${item.id}`)

// 선택이 바뀌면 그 지역의 예보를 새로 불러온다
watch(selectedId, async (id) => {
  const city = weatherList.value.find((c) => c.id === id)
  if (!city) return

  isForecastLoading.value = true
  forecast.value = []
  try {
    forecast.value = await fetchCityForecast(city)
  } catch (err) {
    console.error('[weather] 예보 조회 실패:', err)
  } finally {
    isForecastLoading.value = false
  }
})

// 화면이 붙은 직후가 API를 호출하기 가장 좋은 타이밍
onMounted(loadWeather)
</script>

<template>
  <div class="weather">
    <header class="page-banner">
      <div class="banner-text">
        <span class="eyebrow">Dashboard</span>
        <h1 class="page-title">지역별 날씨</h1>
        <p v-if="summary" class="page-desc">
          전국 평균 <b>{{ summary.avg }}°C</b> · 가장 더운 곳
          <b>{{ summary.hottest.name }} {{ summary.hottest.temp }}°</b> · 가장 추운 곳
          <b>{{ summary.coldest.name }} {{ summary.coldest.temp }}°</b>
          <template v-if="summary.wet"> · 비·눈 {{ summary.wet }}곳</template>
        </p>
        <p v-else class="page-desc">지도에서 지역을 선택하면 상세 정보를 볼 수 있습니다.</p>
      </div>

      <div class="banner-actions">
        <span v-if="updatedAt" class="stamp">{{ updatedAt }} 기준</span>
        <button :disabled="isLoading" @click="loadWeather">
          {{ isLoading ? '불러오는 중…' : '새로고침' }}
        </button>
      </div>
    </header>

    <p v-if="errorMessage" class="state-msg error">{{ errorMessage }}</p>

    <!-- 좌: 고르는 곳 / 우: 보는 곳 -->
    <div class="split">
      <section class="pane pane-map">
        <div class="pane-head">
          <h2>지역 선택</h2>
          <input
            v-model="searchQuery"
            class="search"
            type="search"
            placeholder="지역 검색"
            aria-label="지역 검색"
          />
        </div>

        <p v-if="isLoading && !weatherList.length" class="state-msg">
          날씨 데이터를 불러오는 중입니다…
        </p>
        <RegionMap
          v-else
          :city-items="visibleCities"
          :selected-id="selectedId"
          @select-city="selectCity"
        />

        <p v-if="failedCities.length" class="state-msg small">
          일부 지역을 못 받았습니다: {{ failedCities.join(', ') }}
        </p>
      </section>

      <section class="pane pane-detail">
        <CityPanel
          :city-item="selectedCity"
          :forecast="forecast"
          :is-loading="isForecastLoading"
        />
        <button
          v-if="selectedCity"
          class="detail-link"
          type="button"
          @click="goDetail(selectedCity)"
        >
          {{ selectedCity.name }} 상세 페이지 →
        </button>
      </section>
    </div>

    <!-- 전체 지역은 표로. 열을 눌러 정렬할 수 있다. -->
    <details class="all" open>
      <summary>전체 지역 ({{ visibleCities.length }})</summary>
      <CityTable
        :items="visibleCities"
        :selected-id="selectedId"
        @select="selectCity"
        @detail="goDetail"
      />
    </details>

    <!-- 지금 날씨가 맑아도 화면 효과를 확인할 수 있게 하는 보조 장치 -->
    <details class="fx">
      <summary>화면 효과 미리보기</summary>
      <div class="fx-row">
        <button :class="{ on: fxPreview === '' }" @click="setPreview('')">자동</button>
        <button :class="{ on: fxPreview === 'rain' }" @click="setPreview('rain')">비</button>
        <button :class="{ on: fxPreview === 'snow' }" @click="setPreview('snow')">눈</button>
        <span class="stamp">자동은 선택한 지역의 실제 날씨를 따릅니다.</span>
      </div>
    </details>
  </div>
</template>

<style scoped>
/* ---------------- 배너 ---------------- */
.page-banner {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
  flex-wrap: wrap;
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

.page-desc b {
  color: var(--text);
  font-weight: 600;
}

.banner-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.banner-actions button {
  margin: 0;
}

.stamp {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  color: var(--text-muted);
}

/* ---------------- 2단 ---------------- */
.split {
  display: grid;
  /* 지도가 조금 더 넓다. 상세는 세로로 긴 정보라 좁아도 읽힌다. */
  grid-template-columns: 1.15fr 1fr;
  gap: 20px;
  align-items: start;
}

.pane {
  padding: 16px;
  border: 1px solid var(--border);
  background: var(--bg-subtle);
}

.pane-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.pane-head h2 {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
}

.search {
  width: 150px;
  padding: 5px 9px;
  font-size: 0.8rem;
}

.detail-link {
  width: 100%;
  margin: 16px 0 0;
  padding: 8px;
  font-size: 0.78rem;
}

/* ---------------- 접히는 영역 ---------------- */
.all,
.fx {
  margin-top: 20px;
  border: 1px solid var(--border);
}

.all > summary,
.fx > summary {
  padding: 11px 16px;
  font-family: var(--font-mono);
  font-size: 0.75rem;
  letter-spacing: 0.06em;
  color: var(--text-muted);
  list-style: none;
  cursor: pointer;
  user-select: none;
}

summary::-webkit-details-marker {
  display: none;
}

summary::before {
  content: '+ ';
}

details[open] > summary::before {
  content: '− ';
}

summary:hover {
  color: var(--text);
  background: var(--bg-hover);
}

details[open] > summary {
  border-bottom: 1px solid var(--border);
}

.fx-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 14px 16px;
}

.fx-row button {
  margin: 0;
  padding: 4px 12px;
  font-size: 0.75rem;
}

.fx-row button.on {
  border-color: var(--text);
  background: var(--text);
  color: var(--bg);
}

/* ---------------- 상태 메시지 ---------------- */
.state-msg {
  padding: 16px 0;
  font-family: var(--font-mono);
  font-size: 0.82rem;
  color: var(--text-muted);
}

.state-msg.small {
  padding: 10px 0 0;
  font-size: 0.72rem;
}

.state-msg.error {
  margin-bottom: 20px;
  padding: 12px;
  border-left: 2px solid var(--text);
  background: var(--bg-subtle);
  color: var(--text);
}

@media (max-width: 860px) {
  .split {
    grid-template-columns: 1fr;
  }
  .page-title {
    font-size: 1.7rem;
  }
}
</style>
