<script setup>
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { tempColor, readableInk, tempLegend } from '@/utils/tempScale.js'

// 1. 부모로부터 지도에 찍을 날씨 목록과 선택된 도시를 전달받는다 (props)
const props = defineProps({
  cityItems: {
    type: Array,
    default: () => [],
  },
  selectedId: {
    type: String,
    default: '',
  },
})

// 2. 마커를 클릭하면 부모에게 알린다 (emits)
const emit = defineEmits(['select-city'])

const mapEl = ref(null)
let map = null
let markerLayer = null

// 다크 모드 여부 (색상 스케일이 모드별로 다르므로 추적한다)
const isDark = ref(document.documentElement.classList.contains('theme-dark'))
let themeObserver = null

const legend = ref(tempLegend(isDark.value))

/** 기온 색을 입힌 사각 마커를 만든다 (이미지 대신 HTML을 쓴다) */
const makeIcon = (item, active) => {
  const bg = tempColor(item.temp, isDark.value)
  const ink = readableInk(bg)
  return L.divIcon({
    className: 'weather-pin-wrap',
    html: `
      <div class="weather-pin${active ? ' active' : ''}"
           style="background:${bg};color:${ink}">
        <span class="pin-temp">${item.temp}°</span>
        <span class="pin-name">${item.name}</span>
      </div>`,
    iconSize: [56, 38],
    iconAnchor: [28, 38],
  })
}

/** 현재 목록으로 마커를 다시 그린다 */
const renderMarkers = () => {
  if (!map) return
  markerLayer.clearLayers()

  props.cityItems.forEach((item) => {
    const marker = L.marker([item.lat, item.lon], {
      icon: makeIcon(item, item.id === props.selectedId),
      keyboard: true,
      title: `${item.name} ${item.temp}°C ${item.status}`,
    })
    marker.on('click', () => emit('select-city', item))
    marker.addTo(markerLayer)
  })

  // 마커가 모두 보이도록 지도 범위를 맞춘다
  if (props.cityItems.length > 0) {
    const bounds = L.latLngBounds(props.cityItems.map((i) => [i.lat, i.lon]))
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 8 })
  }
}

onMounted(async () => {
  await nextTick()

  // await 사이에 컴포넌트가 사라졌을 수 있으므로 반드시 확인한다
  if (!mapEl.value) return

  map = L.map(mapEl.value, {
    zoomControl: true,
    scrollWheelZoom: false, // 페이지 스크롤을 방해하지 않도록 휠 확대는 끔
  })

  // 흑백 타일 (키 불필요). 마커 색이 돋보이도록 배경 지도는 무채색으로 둔다.
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    maxZoom: 19,
  }).addTo(map)

  markerLayer = L.layerGroup().addTo(map)
  renderMarkers()
  map.invalidateSize()

  // html 태그의 theme-dark 클래스가 바뀌면 색상 스케일을 갈아끼운다
  themeObserver = new MutationObserver(() => {
    const dark = document.documentElement.classList.contains('theme-dark')
    if (dark !== isDark.value) {
      isDark.value = dark
      legend.value = tempLegend(dark)
      renderMarkers()
    }
  })
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  })
})

// 목록이나 선택이 바뀌면 마커를 다시 그린다
watch(() => [props.cityItems, props.selectedId], renderMarkers, { deep: true })

// ⚠️ 컴포넌트가 사라질 때 지도와 감시자를 반드시 정리한다 (메모리 누수 방지)
onUnmounted(() => {
  themeObserver?.disconnect()
  if (map) {
    map.remove()
    map = null
  }
})
</script>

<template>
  <div class="map-box">
    <div ref="mapEl" class="map-canvas"></div>

    <!-- 색상 범례: 색만으로 값을 읽지 않도록 구간 라벨을 함께 둔다 -->
    <div class="legend">
      <span class="legend-title">기온</span>
      <div class="legend-scale">
        <span
          v-for="l in legend"
          :key="l.label"
          class="legend-step"
          :style="{ background: l.hex }"
          :title="l.label"
        ></span>
      </div>
      <span class="legend-ends">0°C 미만 → 35°C 이상</span>
    </div>

    <p class="map-hint">지도의 마커를 클릭하면 해당 지역의 상세 날씨가 표시됩니다.</p>
  </div>
</template>

<style scoped>
.map-box {
  margin-top: 6px;
}

.map-canvas {
  height: 360px;
  border: 1px solid var(--border);
  background: var(--bg-subtle);
}

/* ---------------- 범례 ---------------- */
.legend {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
  flex-wrap: wrap;
}

.legend-title {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-muted);
}

.legend-scale {
  display: flex;
  border: 1px solid var(--border);
}

.legend-step {
  width: 26px;
  height: 12px;
}

.legend-ends {
  font-family: var(--font-mono);
  font-size: 0.68rem;
  color: var(--text-muted);
}

.map-hint {
  margin-top: 8px;
  font-size: 0.78rem;
  color: var(--text-muted);
}
</style>

<style>
/* 배경 지도만 무채색으로 (마커는 필터 영향을 받지 않도록 타일 레이어에만 적용) */
.map-canvas .leaflet-tile-pane {
  filter: grayscale(1) contrast(0.9);
}

.theme-dark .map-canvas .leaflet-tile-pane {
  filter: grayscale(1) invert(1) contrast(0.85) brightness(0.95);
}

/* 마커 - 기온 색이 채워지고, 테두리로 형태를 보장한다 */
.weather-pin {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 38px;
  border: 1px solid var(--text);
  font-family: var(--font-mono);
  line-height: 1.15;
  cursor: pointer;
  transition: transform 0.15s ease;
}

.weather-pin:hover {
  transform: translateY(-2px);
}

/* 선택된 마커는 색이 아니라 굵은 테두리로 표시한다 (색은 기온 전용) */
.weather-pin.active {
  outline: 2px solid var(--text);
  outline-offset: 2px;
  transform: translateY(-2px);
}

.pin-temp {
  font-size: 0.82rem;
  font-weight: 700;
}

.pin-name {
  font-size: 0.62rem;
  letter-spacing: 0.02em;
}

/* Leaflet 기본 UI를 디자인에 맞춰 각지게 */
.leaflet-container {
  font-family: var(--font-body);
  background: var(--bg-subtle);
}

.leaflet-bar,
.leaflet-bar a {
  border-radius: 0 !important;
  border-color: var(--border) !important;
  background: var(--bg) !important;
  color: var(--text) !important;
}

.leaflet-control-attribution {
  background: var(--bg) !important;
  color: var(--text-muted) !important;
  font-size: 0.65rem !important;
}

.leaflet-control-attribution a {
  color: var(--text-muted) !important;
}
</style>
