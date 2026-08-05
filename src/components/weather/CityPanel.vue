<script setup>
import { computed, ref, watch } from 'vue'
import { compareToNormal } from '@/data/normals.js'
import { useConfigStore } from '@/stores/configStore'
import { toDisplayTemp } from '@/utils/temperature.js'
import { fetchAirQuality, toWeekly } from '@/api/weather.js'

/**
 * 선택한 지역 하나의 상세.
 *
 *   지금 기온 -> 시간별 그래프 -> 주간 예보 -> 지표 -> 대기질
 * 숫자만 늘어놓으면 "덥다/춥다"가 안 읽힌다. 그래프로 흐름을 먼저 보여 준다.
 */

const props = defineProps({
  cityItem: { type: Object, default: null },
  forecast: { type: Array, default: () => [] },
  isLoading: { type: Boolean, default: false },
})

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

/* ---------------------------------------------------------------- 그래프 */

/**
 * 시간별 기온을 꺾은선으로 그린다.
 * SVG 좌표를 직접 계산한다. 차트 라이브러리를 넣을 만큼 복잡하지 않다.
 */
const chart = computed(() => {
  const f = props.forecast
  if (f.length < 2) return null

  const temps = f.map((x) => x.temp)
  const min = Math.min(...temps)
  const max = Math.max(...temps)
  // 값이 모두 같으면 0으로 나눠 NaN이 된다
  const span = max - min || 1

  const W = 100
  const H = 34
  const points = f.map((x, i) => ({
    x: (i / (f.length - 1)) * W,
    y: H - ((x.temp - min) / span) * H,
    temp: x.temp,
    pop: x.pop,
    time: x.time,
  }))

  return {
    points,
    line: points.map((p) => `${p.x},${p.y}`).join(' '),
    // 아래를 채우면 흐름이 더 잘 읽힌다
    area: `0,${H} ${points.map((p) => `${p.x},${p.y}`).join(' ')} ${W},${H}`,
    min,
    max,
  }
})

/* ------------------------------------------------------------ 주간 예보 */

const weekly = computed(() => toWeekly(props.cityItem?._daily).slice(0, 7))

/** 주간 막대의 좌우 위치를 주간 최저~최고 범위에 맞춘다 */
const weekRange = computed(() => {
  if (!weekly.value.length) return null
  const lo = Math.min(...weekly.value.map((d) => d.min))
  const hi = Math.max(...weekly.value.map((d) => d.max))
  return { lo, hi, span: hi - lo || 1 }
})

/* ------------------------------------------------------------ 낮의 진행 */

/** 일출~일몰 사이에서 지금이 어디쯤인지 (0~1). 밤이면 null. */
const dayProgress = computed(() => {
  const c = props.cityItem
  if (!c?.sunrise || !c?.sunset) return null
  const now = Date.now() / 1000
  if (now < c.sunrise || now > c.sunset) return null
  return (now - c.sunrise) / (c.sunset - c.sunrise)
})

/* ---------------------------------------------------------------- 대기질 */

const air = ref(null)

// 유럽 기준(EAQI). 숫자만 두면 좋은지 나쁜지 알 수 없어 말로 붙인다.
const AQI_STEPS = [
  [20, '아주 좋음'],
  [40, '좋음'],
  [60, '보통'],
  [80, '나쁨'],
  [100, '매우 나쁨'],
]
const aqiLabel = (v) => AQI_STEPS.find(([limit]) => v <= limit)?.[1] ?? '위험'

watch(
  () => props.cityItem?.id,
  async () => {
    air.value = null
    if (!props.cityItem) return
    try {
      air.value = await fetchAirQuality(props.cityItem)
    } catch {
      // 대기질은 곁들이는 정보다. 실패해도 날씨 화면은 그대로 둔다.
      air.value = null
    }
  },
  { immediate: true },
)

/* ---------------------------------------------------------------- 지표 */

const metrics = computed(() => {
  const c = props.cityItem
  if (!c) return []
  return [
    { label: '체감', value: `${conv(c.feelsLike)}${configStore.unitSymbol}` },
    { label: '습도', value: `${c.humidity}%` },
    { label: '바람', value: `${toDirection(c.windDeg)} ${c.windSpeed} m/s` },
    { label: '구름', value: `${c.clouds}%` },
    { label: '강수', value: c.rain > 0 ? `${c.rain} mm` : '없음' },
    { label: '적설', value: c.snow > 0 ? `${c.snow} mm` : '없음' },
    { label: '기압', value: `${c.pressure} hPa` },
    { label: '자외선', value: c.uv == null ? '-' : `${c.uv}` },
  ]
})
</script>

<template>
  <!-- 아직 아무 지역도 안 골랐을 때 -->
  <div v-if="!cityItem" class="empty">
    <p>지도에서 지역을 선택하면 상세 날씨가 표시됩니다.</p>
  </div>

  <div v-else class="detail">
    <!-- 헤드라인 -->
    <div class="head">
      <div>
        <h3 class="city">{{ cityItem.name }}</h3>
        <p class="status">{{ cityItem.status }}</p>
        <p class="range">
          최저 {{ conv(cityItem.todayMin) }}° · 최고 {{ conv(cityItem.todayMax) }}°
        </p>
        <p
          v-if="normalDiff"
          class="normal"
          :class="{ hot: normalDiff.diff > 0, cold: normalDiff.diff < 0 }"
        >
          {{ normalDiff.diff > 0 ? '▲' : normalDiff.diff < 0 ? '▼' : '＝' }}
          {{ normalDiff.text }}
        </p>
      </div>
      <div class="now">
        <span class="now-value">{{ conv(cityItem.temp) }}</span>
        <span class="now-unit">{{ configStore.unitSymbol }}</span>
      </div>
    </div>

    <!-- 낮의 진행 -->
    <div class="sun">
      <span class="sun-time">{{ toTime(cityItem.sunrise) }}</span>
      <div class="sun-track">
        <div v-if="dayProgress !== null" class="sun-dot" :style="{ left: `${dayProgress * 100}%` }"></div>
        <span v-else class="sun-night">밤</span>
      </div>
      <span class="sun-time">{{ toTime(cityItem.sunset) }}</span>
    </div>

    <!-- 시간별 기온 -->
    <section class="block">
      <p class="block-title">
        24시간 기온
        <span v-if="chart" class="block-sub">{{ conv(chart.min) }}° ~ {{ conv(chart.max) }}°</span>
      </p>

      <p v-if="isLoading" class="muted">예보를 불러오는 중…</p>
      <template v-else-if="chart">
        <svg class="chart" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
          <polygon :points="chart.area" class="chart-area" />
          <polyline :points="chart.line" class="chart-line" />
          <circle v-for="(p, i) in chart.points" :key="i" :cx="p.x" :cy="p.y" r="0.9" />
        </svg>

        <ul class="hours">
          <li v-for="(p, i) in chart.points" :key="i">
            <span class="h-temp">{{ conv(p.temp) }}°</span>
            <span class="h-time">{{ p.time }}</span>
            <span class="h-pop" :class="{ wet: p.pop >= 30 }">{{ p.pop }}%</span>
          </li>
        </ul>
      </template>
      <p v-else class="muted">예보 데이터가 없습니다.</p>
    </section>

    <!-- 주간 예보 -->
    <section v-if="weekly.length" class="block">
      <p class="block-title">주간 예보</p>
      <ul class="week">
        <li v-for="(d, i) in weekly" :key="d.date">
          <span class="w-day" :class="{ today: i === 0 }">{{ i === 0 ? '오늘' : d.label }}</span>
          <span class="w-pop" :class="{ wet: d.pop >= 30 }">{{ d.pop }}%</span>
          <span class="w-min">{{ conv(d.min) }}°</span>
          <!-- 막대의 시작과 길이를 주간 전체 범위에 맞춰 온도 폭을 눈으로 비교하게 한다 -->
          <span class="w-bar">
            <span
              class="w-fill"
              :style="{
                left: `${((d.min - weekRange.lo) / weekRange.span) * 100}%`,
                width: `${((d.max - d.min) / weekRange.span) * 100}%`,
              }"
            ></span>
          </span>
          <span class="w-max">{{ conv(d.max) }}°</span>
        </li>
      </ul>
    </section>

    <!-- 지표 -->
    <section class="block">
      <p class="block-title">상세 지표</p>
      <dl class="metrics">
        <div v-for="m in metrics" :key="m.label">
          <dt>{{ m.label }}</dt>
          <dd>{{ m.value }}</dd>
        </div>
      </dl>
    </section>

    <!-- 대기질 -->
    <section v-if="air" class="block">
      <p class="block-title">
        대기질
        <span class="block-sub">{{ aqiLabel(air.aqi) }}</span>
      </p>
      <dl class="metrics">
        <div>
          <dt>지수</dt>
          <dd>{{ air.aqi }}</dd>
        </div>
        <div>
          <dt>초미세먼지</dt>
          <dd>{{ air.pm25 }} ㎍/㎥</dd>
        </div>
        <div>
          <dt>미세먼지</dt>
          <dd>{{ air.pm10 }} ㎍/㎥</dd>
        </div>
      </dl>
    </section>
  </div>
</template>

<style scoped>
.empty {
  padding: 40px 0;
  text-align: center;
  font-family: var(--font-mono);
  font-size: 0.85rem;
  color: var(--text-muted);
}

/* ---------------- 헤드라인 ---------------- */
.head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border);
}

.city {
  margin: 0;
  font-size: 1.45rem;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.status {
  margin-top: 2px;
  font-size: 0.85rem;
  color: var(--text-muted);
}

.range {
  margin-top: 4px;
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--text-muted);
}

.normal {
  display: inline-block;
  margin-top: 8px;
  padding: 2px 7px;
  border: 1px solid var(--border);
  font-family: var(--font-mono);
  font-size: 0.72rem;
}

.normal.hot,
.normal.cold {
  border-color: var(--text);
}

.now {
  display: flex;
  align-items: baseline;
  flex: 0 0 auto;
}

.now-value {
  font-family: var(--font-mono);
  font-size: 3rem;
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.04em;
  font-variant-numeric: tabular-nums;
}

.now-unit {
  margin-left: 2px;
  font-size: 1rem;
  color: var(--text-muted);
}

/* ---------------- 낮의 진행 ---------------- */
.sun {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 0;
  border-bottom: 1px solid var(--border);
}

.sun-time {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  color: var(--text-muted);
}

.sun-track {
  position: relative;
  flex: 1;
  height: 1px;
  background: var(--border-strong);
}

.sun-dot {
  position: absolute;
  top: -3px;
  width: 7px;
  height: 7px;
  margin-left: -3px;
  border-radius: 50%;
  background: var(--text);
}

.sun-night {
  position: absolute;
  top: -8px;
  left: 50%;
  transform: translateX(-50%);
  padding: 0 6px;
  background: var(--bg-subtle);
  font-family: var(--font-mono);
  font-size: 0.65rem;
  color: var(--text-muted);
}

/* ---------------- 블록 ---------------- */
.block {
  padding-top: 18px;
  margin-top: 18px;
  border-top: 1px solid var(--border);
}

.block:first-of-type {
  border-top: 0;
}

.block-title {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin: 0 0 10px;
  font-family: var(--font-mono);
  font-size: 0.7rem;
  letter-spacing: 0.1em;
  color: var(--text-muted);
}

.block-sub {
  font-family: var(--font-mono);
  font-size: 0.7rem;
}

.muted {
  padding: 14px 0;
  font-family: var(--font-mono);
  font-size: 0.78rem;
  color: var(--text-muted);
}

/* ---------------- 기온 그래프 ---------------- */
.chart {
  display: block;
  width: 100%;
  height: 64px;
  overflow: visible;
}

.chart-area {
  fill: var(--bg-hover);
}

.chart-line {
  fill: none;
  stroke: var(--text);
  stroke-width: 1;
  /* viewBox를 눌러 그리므로 선 굵기가 왜곡된다. 이 값이 그걸 막는다. */
  vector-effect: non-scaling-stroke;
}

.chart circle {
  fill: var(--text);
}

.hours {
  display: flex;
  justify-content: space-between;
  margin: 6px 0 0;
  padding: 0;
  list-style: none;
}

.hours li {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  font-family: var(--font-mono);
  font-size: 0.66rem;
}

.h-temp {
  font-size: 0.74rem;
  font-weight: 600;
}

.h-time,
.h-pop {
  color: var(--text-muted);
}

.h-pop.wet {
  color: var(--text);
  font-weight: 600;
}

/* ---------------- 주간 예보 ---------------- */
.week {
  margin: 0;
  padding: 0;
  list-style: none;
}

.week li {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 0;
  font-family: var(--font-mono);
  font-size: 0.75rem;
}

.w-day {
  flex: 0 0 2.4em;
  color: var(--text-muted);
}

.w-day.today {
  color: var(--text);
  font-weight: 600;
}

.w-pop {
  flex: 0 0 2.6em;
  text-align: right;
  color: var(--text-muted);
}

.w-pop.wet {
  color: var(--text);
}

.w-min,
.w-max {
  flex: 0 0 2.4em;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.w-min {
  color: var(--text-muted);
}

.w-bar {
  position: relative;
  flex: 1;
  height: 4px;
  background: var(--bg-hover);
}

.w-fill {
  position: absolute;
  top: 0;
  height: 100%;
  background: var(--text);
}

/* ---------------- 지표 ---------------- */
.metrics {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0;
  margin: 0;
}

.metrics > div {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 0;
  border-bottom: 1px solid var(--border);
  font-size: 0.78rem;
}

.metrics dt {
  color: var(--text-muted);
}

.metrics dd {
  margin: 0;
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}

/* 두 칸 그리드라 홀수 개면 마지막 줄만 선이 남는다 */
.metrics > div:nth-last-child(-n + 2) {
  border-bottom: 0;
}

@media (max-width: 520px) {
  .metrics {
    grid-template-columns: 1fr;
  }
  .now-value {
    font-size: 2.4rem;
  }
}
</style>
