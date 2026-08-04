<script setup>
import { ref, computed, watch, watchEffect, onMounted } from 'vue'
// 1. 컴포넌트 파일명 국룰 표기법(PascalCase) 매칭 수입
import BaseDashboardCard from './BaseDashboardCard.vue'
import SearchBar from './SearchBar.vue'
import WeatherCard from './WeatherCard.vue'
import WeatherMap from './WeatherMap.vue'
import WeatherDetail from './WeatherDetail.vue'
import { fetchAllCitiesWeather, fetchCityForecast } from '@/api/weather.js'
import { fxMode, modeFromWeatherId } from '@/utils/weatherFx.js'

// 서버에서 받아온 날씨 목록 (처음엔 비어 있다)
const weatherList = ref([])
// onMounted에서 바로 조회하므로 처음부터 로딩 상태로 시작한다
const isLoading = ref(true)
const errorMessage = ref('')
const failedCities = ref([])
const updatedAt = ref('')

const searchQuery = ref('')
const selectedCityInfo = ref('지도에서 지역을 선택해 보세요.')
const selectedId = ref('')

// 선택된 지역의 단기 예보
const forecast = ref([])
const isForecastLoading = ref(false)

// 목록은 기본으로 접어 둔다 (한 번에 다 보이면 오히려 산만하므로)
const showList = ref(false)

// 검색어로 걸러낸 목록 (지도 마커와 목록이 함께 이 값을 쓴다)
const filteredWeatherList = computed(() => {
  const query = searchQuery.value.trim()
  if (!query) return weatherList.value
  return weatherList.value.filter((item) => item.name.includes(query))
})

// 선택된 지역 객체 (상세 패널에 넘길 값)
const selectedCity = computed(
  () => weatherList.value.find((c) => c.id === selectedId.value) ?? null,
)

watch(selectedCityInfo, (newInfo) => {
  console.log(`👁️‍🗨️ [watch 감지] 상태 바 문구가 업데이트되었습니다 -> "${newInfo}"`)
})

watchEffect(() => {
  console.log(
    `🤖 [watchEffect 자동 호출] 현재 검색어 '${searchQuery.value}'에 매칭되는 데이터를 필터링합니다.`,
  )
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
    console.log(`✅ [API] ${list.length}개 도시 날씨 수신 완료`)

    // 선택이 없으면 첫 번째 도시를 자동 선택해 화면이 비어 보이지 않게 한다
    if (!selectedId.value && list.length) selectCity(list[0])
  } catch (err) {
    console.error('❌ [API] 날씨 조회 실패:', err)
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

/** 지도 마커나 카드에서 지역이 선택됐을 때 */
const selectCity = (item) => {
  selectedId.value = item.id
  selectedCityInfo.value = `${item.name}이 선택되었습니다. (${item.temp}°C, ${item.status})`

  // 선택한 지역이 비/눈이면 화면 전체에 그 효과를 켠다
  if (!fxPreview.value) fxMode.value = modeFromWeatherId(item.weatherId)
}


// 선택이 바뀌면 그 지역의 예보를 새로 불러온다
watch(selectedId, async (id) => {
  const city = weatherList.value.find((c) => c.id === id)
  if (!city) return

  isForecastLoading.value = true
  forecast.value = []
  try {
    forecast.value = await fetchCityForecast(city)
    console.log(`📈 [API] ${city.name} 예보 ${forecast.value.length}건 수신`)
  } catch (err) {
    console.error('❌ [API] 예보 조회 실패:', err)
  } finally {
    isForecastLoading.value = false
  }
})

// 화면이 붙은 직후가 API를 호출하기 가장 좋은 타이밍
onMounted(loadWeather)

const showDetail = (cityName, status) => {
  window.alert(`${cityName}의 현재 날씨는 [${status}] 상태입니다.`)
}
</script>

<template>
  <div class="dashboard-wrapper">
    <BaseDashboardCard>
      <SearchBar :current-query="searchQuery" @update-query="(val) => (searchQuery = val)" />
    </BaseDashboardCard>

    <!-- 지도: 지역을 고르는 곳 -->
    <BaseDashboardCard>
      <div class="box-head">
        <h3>🗺️ 지역 선택</h3>
        <div class="box-actions">
          <span class="stamp">효과</span>
          <div class="fx-toggle">
            <button :class="{ on: fxPreview === '' }" @click="setPreview('')">자동</button>
            <button :class="{ on: fxPreview === 'rain' }" @click="setPreview('rain')">비</button>
            <button :class="{ on: fxPreview === 'snow' }" @click="setPreview('snow')">눈</button>
          </div>
          <span v-if="updatedAt" class="stamp">{{ updatedAt }} 기준</span>
          <button :disabled="isLoading" @click="loadWeather">
            {{ isLoading ? '불러오는 중…' : '새로고침' }}
          </button>
        </div>
      </div>

      <p v-if="isLoading && weatherList.length === 0" class="state-msg">
        날씨 데이터를 불러오는 중입니다…
      </p>
      <p v-else-if="errorMessage" class="state-msg error">{{ errorMessage }}</p>
      <WeatherMap
        v-else
        :city-items="filteredWeatherList"
        :selected-id="selectedId"
        @select-city="selectCity"
      />

      <p v-if="failedCities.length" class="state-msg">
        ⚠️ 일부 도시를 못 받았습니다: {{ failedCities.join(', ') }}
      </p>
    </BaseDashboardCard>

    <!-- 상세: 선택한 지역 하나만 -->
    <BaseDashboardCard>
      <WeatherDetail
        :city-item="selectedCity"
        :forecast="forecast"
        :is-loading="isForecastLoading"
      />
    </BaseDashboardCard>

    <!-- 전체 목록은 접어 두고 필요할 때만 펼친다 -->
    <BaseDashboardCard>
      <div class="box-head">
        <h3>🏙️ 전체 지역 목록</h3>
        <button @click="showList = !showList">
          {{ showList ? '접기' : `펼치기 (${filteredWeatherList.length})` }}
        </button>
      </div>

      <template v-if="showList">
        <WeatherCard
          v-for="item in filteredWeatherList"
          :key="item.id"
          :city-item="item"
          @select-card="selectCity"
          @click-detail="showDetail"
        />

        <p v-if="!isLoading && filteredWeatherList.length === 0" class="empty-result">
          😭 검색 결과와 일치하는 도시가 없습니다.
        </p>
      </template>
    </BaseDashboardCard>

    <div class="status-bar">
      {{ selectedCityInfo }}
    </div>
  </div>
</template>

<style scoped>
.box-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.box-head h3 {
  margin: 0;
}

.box-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.stamp {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  color: var(--text-muted);
}

.box-head button {
  margin: 0;
}

.fx-toggle {
  display: flex;
}

.fx-toggle button {
  margin: 0 0 0 -1px;
  padding: 3px 9px;
  font-size: 0.72rem;
}

.fx-toggle button.on {
  background: var(--text);
  border-color: var(--text);
  color: var(--bg);
}

.state-msg {
  padding: 16px 0;
  font-family: var(--font-mono);
  font-size: 0.82rem;
  color: var(--text-muted);
}

.state-msg.error {
  color: var(--text);
  border-left: 2px solid var(--text);
  padding-left: 12px;
}
</style>
