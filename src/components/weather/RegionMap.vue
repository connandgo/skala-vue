<script setup>
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { tempColor, readableInk, tempLegend } from '@/utils/tempScale.js'
import { useConfigStore } from '@/stores/configStore'
import { toDisplayTemp } from '@/utils/temperature.js'

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

// 요구사항 3) 마커에 찍히는 기온도 설정 단위를 따른다
const configStore = useConfigStore()

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
      <div class="weather-pin${active ? ' active' : ''}">
        <span class="pin-chip" style="background:${bg};color:${ink}">${toDisplayTemp(item.temp, configStore.unit)}°</span>
        <span class="pin-name">${item.name}</span>
      </div>`,
    iconSize: [50, 42],
    iconAnchor: [25, 21],
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
      title: `${item.name} ${toDisplayTemp(item.temp, configStore.unit)}${configStore.unitSymbol} ${item.status}`,
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
  // 글자 없는 타일. 지도가 들고 있는 지명은 우리 마커와 겹쳐 지저분해진다.
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
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

// 단위 전환 시 마커 라벨을 다시 그린다
watch(() => configStore.unit, renderMarkers)

// 컴포넌트가 사라질 때 지도와 감시자를 반드시 정리한다 (메모리 누수 방지)
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

    <!-- 색상 범례. 지도 위에 얹어 세로 공간을 아끼고, 색만으로 읽지 않도록 값을 함께 둔다 -->
    <div class="legend">
      <span class="legend-end">0°</span>
      <div class="legend-scale">
        <span
          v-for="l in legend"
          :key="l.label"
          class="legend-step"
          :style="{ background: l.hex }"
          :title="l.label"
        ></span>
      </div>
      <span class="legend-end">35°+</span>
    </div>
  </div>
</template>

<style scoped>
.map-box {
  position: relative;
}

.map-canvas {
  height: 460px;
  border: 1px solid var(--border);
  background: var(--bg-subtle);
}

/* ---------------- 범례 ---------------- */
/* 지도 위에 얹는다. 아래에 두면 지도가 그만큼 낮아진다. */
.legend {
  position: absolute;
  left: 12px;
  bottom: 12px;
  z-index: 500;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 8px;
  border: 1px solid var(--border);
  background: var(--nav-bg);
  backdrop-filter: blur(6px);
}

.legend-end {
  font-family: var(--font-mono);
  font-size: 0.65rem;
  color: var(--text-muted);
}

.legend-scale {
  display: flex;
}

.legend-step {
  width: 18px;
  height: 8px;
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

/*
 * 마커 - 온도 칩과 지역명을 위아래로 나눈다.
 * 예전처럼 한 상자에 둘을 욱여넣으면 열 개가 모여 글씨가 뭉갠다.
 */
.weather-pin {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  font-family: var(--font-mono);
  line-height: 1;
  cursor: pointer;
  transition: transform 0.15s ease;
}

.weather-pin:hover {
  transform: translateY(-2px);
}

.pin-chip {
  padding: 3px 6px;
  border: 1px solid var(--text);
  font-size: 0.76rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.pin-name {
  padding: 1px 4px;
  background: var(--bg);
  color: var(--text);
  font-size: 0.62rem;
  letter-spacing: 0.02em;
  /* 지도 위에서도 읽히도록 바탕을 깐다 */
  border: 1px solid var(--border);
}

/* 선택된 마커는 색이 아니라 형태로 표시한다 (색은 기온 전용) */
.weather-pin.active {
  transform: translateY(-3px) scale(1.12);
  z-index: 600;
}

.weather-pin.active .pin-chip {
  outline: 2px solid var(--text);
  outline-offset: 2px;
}

.weather-pin.active .pin-name {
  border-color: var(--text);
  background: var(--text);
  color: var(--bg);
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
