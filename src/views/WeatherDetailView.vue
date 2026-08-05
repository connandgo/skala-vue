<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import CityPanel from '@/components/weather/CityPanel.vue'
import UnitToggler from '@/components/UnitToggler.vue'
import { CITIES, getMockWeather } from '@/data/cities.js'
import { fetchCityWeather, fetchCityForecast } from '@/api/weather.js'
import { fxMode, modeFromWeatherCode } from '@/utils/weatherFx.js'

// 요구사항 4) 동적 경로(/weather/:cityId)로 들어온 도시 ID를 읽는다
const route = useRoute()
const router = useRouter()
const cityId = route.params.cityId

const city = ref(null)
const forecast = ref([])
const isLoading = ref(true)
const errorMessage = ref('')
const isMock = ref(false) // Mock 데이터로 표시 중인지

onMounted(async () => {
  // ID로 도시 정보(좌표)를 찾는다. 없는 ID면 안내 후 종료.
  const target = CITIES.find((c) => c.id === cityId)
  if (!target) {
    errorMessage.value = `'${cityId}' 에 해당하는 지역을 찾을 수 없습니다.`
    isLoading.value = false
    return
  }

  try {
    // 마운트 시점에 해당 도시의 현재 날씨와 예보를 함께 조회
    const [current, fc] = await Promise.all([fetchCityWeather(target), fetchCityForecast(target)])
    city.value = current
    forecast.value = fc
    fxMode.value = modeFromWeatherCode(current.weatherCode)
  } catch (err) {
    // 통신이 실패하면 도시 코드에 해당하는 Mock Data로 대체해 화면을 채운다
    console.warn('[상세] API 실패 → Mock Data로 대체:', err.message)
    city.value = getMockWeather(cityId)
    isMock.value = true
    if (!city.value) errorMessage.value = '날씨 정보를 불러오지 못했습니다.'
  } finally {
    isLoading.value = false
  }
})

/** 뒤로 가기 (히스토리가 없으면 홈으로) */
const goBack = () => {
  if (window.history.length > 1) router.back()
  else router.push('/weather')
}
</script>

<template>
  <header class="page-banner">
    <div>
      <p class="eyebrow">Detail · {{ cityId }}</p>
      <h1 class="page-title">{{ city ? city.name : '지역 상세' }}</h1>
      <p class="page-desc">동적 경로 <code>/weather/:cityId</code> 로 전달된 지역입니다.</p>
    </div>
    <UnitToggler />
  </header>

  <div class="dashboard-wrapper">
    <p v-if="isLoading" class="state-msg">불러오는 중입니다…</p>
    <p v-else-if="errorMessage" class="state-msg error">{{ errorMessage }}</p>

    <template v-else-if="city">
      <p v-if="isMock" class="mock-notice">
        실시간 조회에 실패해 도시 코드({{ cityId }})의 임시 데이터(Mock)를 표시합니다.
      </p>
      <CityPanel :city-item="city" :forecast="forecast" />
    </template>

    <div class="actions">
      <button @click="goBack">← 뒤로</button>
      <RouterLink to="/weather" class="link-btn">대시보드로</RouterLink>
    </div>
  </div>
</template>

<style scoped>
.page-banner {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
  flex-wrap: wrap;
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
  text-wrap: balance;
  margin-top: 8px;
  font-size: 0.9rem;
  color: var(--text-muted);
}

.page-desc code {
  font-family: var(--font-mono);
  font-size: 0.85em;
  padding: 1px 5px;
  border: 1px solid var(--border);
}

.state-msg {
  padding: 40px 0;
  text-align: center;
  font-family: var(--font-mono);
  font-size: 0.85rem;
  color: var(--text-muted);
}

.mock-notice {
  margin-bottom: 16px;
  padding: 10px 14px;
  border: 1px solid var(--border);
  border-left: 2px solid var(--text);
  background: var(--bg-subtle);
  font-family: var(--font-mono);
  font-size: 0.78rem;
}

.actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid var(--border);
}

.actions button {
  margin: 0;
}

.link-btn {
  display: inline-block;
  padding: 6px 12px;
  border: 1px solid var(--border);
  font-size: 0.85rem;
  font-weight: 500;
}

.link-btn:hover {
  border-color: var(--hover-border);
  background: var(--bg-hover);
  color: var(--text);
}
</style>
