<script setup>
import { computed } from 'vue'
import { compareToNormal } from '@/data/normals.js'
import { useConfigStore } from '@/stores/configStore'
import { toDisplayTemp } from '@/utils/temperature.js'

// 선택된 도시 하나의 상세 정보만 표시한다 (props)
const props = defineProps({
  cityItem: {
    type: Object,
    default: null,
  },
  forecast: {
    type: Array,
    default: () => [],
  },
  isLoading: {
    type: Boolean,
    default: false,
  },
})

// 요구사항 3) 상세 화면의 모든 기온을 설정 단위로 표시
const configStore = useConfigStore()
const conv = (c) => toDisplayTemp(c, configStore.unit)

/** 유닉스 시간(초) -> "HH:MM" */
const toTime = (unix) =>
  unix
    ? new Date(unix * 1000).toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
    : '-'

/** 풍향 각도 -> 8방위 */
const toDirection = (deg) => {
  const dirs = ['북', '북동', '동', '남동', '남', '남서', '서', '북서']
  return dirs[Math.round(deg / 45) % 8]
}

// 평년 대비 (과거 실측 API는 유료라 근사 평년값과 비교한다)
const normalDiff = computed(() =>
  props.cityItem ? compareToNormal(props.cityItem.id, props.cityItem.temp) : null,
)

// 가장 가까운 예보 시점의 강수확률
const nextPop = computed(() => (props.forecast.length ? props.forecast[0].pop : null))

/**
 * 24시간 최저/최고 기온
 *
 * ⚠️ OpenWeather 현재날씨의 temp_min/temp_max는 "하루 최저/최고"가 아니다.
 *    같은 시각 도시 영역 안 관측소들의 편차라서, 관측소가 하나인 국내 도시는
 *    temp와 항상 같은 값이 나온다. 그래서 예보(3시간 간격)로 직접 계산한다.
 */
const range = computed(() => {
  if (!props.forecast.length) return null
  const temps = props.forecast.map((f) => f.temp)
  return { min: Math.min(...temps), max: Math.max(...temps) }
})

// 표에 뿌릴 항목들
const metrics = computed(() => {
  const c = props.cityItem
  if (!c) return []
  return [
    { label: '체감온도', value: `${conv(c.feelsLike)}${configStore.unitSymbol}` },
    {
      label: '24시간 최저/최고',
      value: range.value
        ? `${conv(range.value.min)}° / ${conv(range.value.max)}°`
        : '-',
    },
    { label: '강수량', value: c.rain > 0 ? `${c.rain} mm` : '없음' },
    { label: '적설량', value: c.snow > 0 ? `${c.snow} mm` : '없음' },
    { label: '강수확률', value: nextPop.value == null ? '-' : `${nextPop.value}%` },
    { label: '습도', value: `${c.humidity}%` },
    { label: '바람', value: `${toDirection(c.windDeg)} ${c.windSpeed} m/s` },
    { label: '구름량', value: `${c.clouds}%` },
    { label: '기압', value: `${c.pressure} hPa` },
    { label: '가시거리', value: c.visibility ? `${(c.visibility / 1000).toFixed(1)} km` : '-' },
    { label: '일출', value: toTime(c.sunrise) },
    { label: '일몰', value: toTime(c.sunset) },
  ]
})
</script>

<template>
  <!-- 아직 아무 지역도 안 골랐을 때 -->
  <div v-if="!cityItem" class="detail-empty">
    <p>지도에서 지역을 선택하면 상세 날씨가 표시됩니다.</p>
  </div>

  <div v-else class="detail">
    <!-- 헤드라인: 지역명 + 현재 기온 -->
    <div class="detail-head">
      <div>
        <p class="eyebrow">Selected Region</p>
        <h3 class="detail-city">{{ cityItem.name }}</h3>
        <p class="detail-status">{{ cityItem.status }}</p>
        <p v-if="normalDiff" class="normal-diff" :class="{ hot: normalDiff.diff > 0, cold: normalDiff.diff < 0 }">
          <span class="nd-arrow">{{ normalDiff.diff > 0 ? '▲' : normalDiff.diff < 0 ? '▼' : '＝' }}</span>
          {{ normalDiff.text }}
          <span class="nd-base">(평년 {{ normalDiff.normal }}°C)</span>
        </p>
      </div>
      <div class="detail-temp">
        <span class="temp-value">{{ conv(cityItem.temp) }}</span>
        <span class="temp-unit">{{ configStore.unitSymbol }}</span>
      </div>
    </div>

    <!-- 상세 지표 표 -->
    <dl class="metrics">
      <div v-for="m in metrics" :key="m.label" class="metric">
        <dt>{{ m.label }}</dt>
        <dd>{{ m.value }}</dd>
      </div>
    </dl>

    <!-- 단기 예보 -->
    <div class="forecast">
      <p class="eyebrow">Forecast · 3h</p>
      <p v-if="isLoading" class="forecast-loading">예보를 불러오는 중…</p>
      <div v-else-if="forecast.length" class="forecast-row">
        <div v-for="(f, i) in forecast" :key="i" class="forecast-item">
          <span class="f-time">{{ f.time }}</span>
          <span class="f-temp">{{ conv(f.temp) }}°</span>
          <span class="f-pop" :class="{ wet: f.pop >= 30 }">{{ f.pop }}%</span>
        </div>
      </div>
      <p v-else class="forecast-loading">예보 데이터가 없습니다.</p>
    </div>
  </div>
</template>

<style scoped>
.detail-empty {
  padding: 40px 0;
  text-align: center;
  font-family: var(--font-mono);
  font-size: 0.85rem;
  color: var(--text-muted);
}

/* ---------------- 헤드라인 ---------------- */
.detail-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding-bottom: 18px;
  border-bottom: 1px solid var(--border);
}

.detail-city {
  font-size: 1.5rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  margin: 4px 0 0;
}

.detail-status {
  margin-top: 2px;
  font-size: 0.85rem;
  color: var(--text-muted);
}

.normal-diff {
  display: inline-flex;
  align-items: baseline;
  gap: 5px;
  margin-top: 8px;
  padding: 3px 9px;
  border: 1px solid var(--border);
  font-family: var(--font-mono);
  font-size: 0.74rem;
}

.nd-arrow {
  font-size: 0.66rem;
}

.normal-diff.hot .nd-arrow {
  color: #d94f48;
}

.normal-diff.cold .nd-arrow {
  color: #2a78d6;
}

.nd-base {
  color: var(--text-muted);
}

.detail-temp {
  display: flex;
  align-items: flex-start;
  font-family: var(--font-mono);
  line-height: 1;
}

.temp-value {
  font-size: 3.2rem;
  font-weight: 700;
  letter-spacing: -0.03em;
}

.temp-unit {
  font-size: 1rem;
  margin-top: 6px;
  color: var(--text-muted);
}

/* ---------------- 지표 표 ---------------- */
.metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  margin: 0;
  border-top: 1px solid var(--border);
}

.metric {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  padding: 9px 12px;
  margin: -1px 0 0 -1px;
  border: 1px solid var(--border);
}

.metric dt {
  font-size: 0.78rem;
  color: var(--text-muted);
}

.metric dd {
  margin: 0;
  font-family: var(--font-mono);
  font-size: 0.85rem;
  font-weight: 600;
}

/* ---------------- 예보 ---------------- */
.forecast {
  margin-top: 22px;
}

.forecast-loading {
  margin-top: 8px;
  font-family: var(--font-mono);
  font-size: 0.8rem;
  color: var(--text-muted);
}

.forecast-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(72px, 1fr));
  margin-top: 8px;
}

.forecast-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 10px 4px;
  margin-left: -1px;
  border: 1px solid var(--border);
  font-family: var(--font-mono);
}

.f-time {
  font-size: 0.7rem;
  color: var(--text-muted);
}

.f-temp {
  font-size: 0.95rem;
  font-weight: 700;
}

.f-pop {
  font-size: 0.68rem;
  color: var(--text-muted);
}

/* 강수확률이 높으면 반전으로 강조 */
.f-pop.wet {
  background: var(--text);
  color: var(--bg);
  padding: 0 4px;
}
</style>
