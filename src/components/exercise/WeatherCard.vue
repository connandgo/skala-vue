<script setup>
import { computed } from 'vue'
import { useConfigStore } from '@/stores/configStore'
import { toDisplayTemp } from '@/utils/temperature.js'

// 1. 상위로부터 단방향 주입받을 객체 데이터 규격 검수 (매크로)
const props = defineProps({
  cityItem: {
    type: Object,
    required: true,
  },
})

// 2. 상위로 송신할 두 가지 경로의 커스텀 이벤트 식별자 등록 (매크로)
// 선택 이벤트는 도시 객체를 통째로 올려보낸다 (지도 마커와 동일한 규격)
const emit = defineEmits(['select-card', 'click-detail'])

// 요구사항 3) 설정된 단위로 변환해서 표시 (원본 데이터는 항상 섭씨)
const configStore = useConfigStore()
const displayTemp = computed(() => toDisplayTemp(props.cityItem.temp, configStore.unit))
const displayFeels = computed(() => toDisplayTemp(props.cityItem.feelsLike, configStore.unit))
</script>

<template>
  <div class="weather-card" @click="emit('select-card', cityItem)">
    <h4>{{ cityItem.name }} ({{ cityItem.status }})</h4>
    <p>
      현재 기온: {{ displayTemp }}{{ configStore.unitSymbol }}
      <span v-if="cityItem.feelsLike != null"> · 체감 {{ displayFeels }}{{ configStore.unitSymbol }}</span>
      <span v-if="cityItem.humidity != null"> · 습도 {{ cityItem.humidity }}%</span>
    </p>

    <span v-if="cityItem.temp >= 25" class="badge hot">더움</span>
    <span v-else class="badge cool">선선함</span>

    <button class="btn-detail" @click.stop="emit('click-detail', cityItem)">
      상세보기
    </button>
  </div>
</template>

<style scoped>
/* 날씨 카드 고유 디자인 (컴포넌트별 scoped 분리) */
.weather-card {
  position: relative;
  border: 1px solid var(--border);
  padding: 15px 17px;
  margin-bottom: -1px;
  background: var(--bg);
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    background-color 0.15s ease;
}

.weather-card:hover {
  border-color: var(--hover-border);
  background: var(--bg-hover);
  z-index: 1;
}

.weather-card h4 {
  font-size: 0.95rem;
  font-weight: 700;
}

.weather-card p {
  font-family: var(--font-mono);
  font-size: 0.8rem;
  color: var(--text-muted);
  margin: 4px 0 10px;
}

.badge {
  display: inline-block;
  padding: 2px 8px;
  border: 1px solid var(--border);
  background: var(--bg-hover);
  font-family: var(--font-mono);
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.badge.hot {
  border-color: var(--text);
  background: var(--text);
  color: var(--bg);
}

.badge.cool {
  border-color: var(--border-strong);
  color: var(--text-meta);
}

.btn-detail {
  position: absolute;
  top: 14px;
  right: 15px;
  margin: 0;
  padding: 4px 10px;
  font-size: 0.75rem;
}
</style>
