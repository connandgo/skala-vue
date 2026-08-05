<script setup>
// 요구사항 1) 단위 설정을 변경하는 UI
import { useConfigStore } from '@/stores/configStore'

const configStore = useConfigStore()
</script>

<template>
  <div class="unit-toggler">
    <span class="unit-label">{{ configStore.unitSymbol }}</span>
    <button
      class="unit-btn"
      :title="configStore.unit === 'celsius' ? '화씨로 변경' : '섭씨로 변경'"
      @click="configStore.toggleUnit"
    >
      단위변경
    </button>
  </div>
</template>

<style scoped>
.unit-toggler {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.unit-label {
  font-family: var(--font-mono);
  font-size: 0.85rem;
  font-weight: 700;
  min-width: 1.4em;
  text-align: center;
}

.unit-btn {
  margin: 0;
  padding: 4px 9px;
  font-size: 0.75rem;
}
</style>
