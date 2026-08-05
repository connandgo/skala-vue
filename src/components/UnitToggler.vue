<script setup>
import { useConfigStore } from '@/stores/configStore'

/** 섭씨 / 화씨 전환. 지금 무엇이 선택돼 있는지 한눈에 보이도록 두 칸으로 둔다. */
const configStore = useConfigStore()
</script>

<template>
  <div class="unit" role="group" aria-label="온도 단위">
    <button
      type="button"
      :class="{ on: configStore.unit === 'celsius' }"
      :aria-pressed="configStore.unit === 'celsius'"
      @click="configStore.setUnit('celsius')"
    >
      ℃
    </button>
    <button
      type="button"
      :class="{ on: configStore.unit === 'fahrenheit' }"
      :aria-pressed="configStore.unit === 'fahrenheit'"
      @click="configStore.setUnit('fahrenheit')"
    >
      ℉
    </button>
  </div>
</template>

<style scoped>
.unit {
  display: inline-flex;
}

button {
  margin: 0;
  padding: 4px 10px;
  font-family: var(--font-mono);
  font-size: 0.78rem;
  font-weight: 600;
}

/* 두 칸 사이의 테두리가 겹쳐 두꺼워지지 않게 한 칸을 당겨 붙인다 */
button + button {
  margin-left: -1px;
}

button.on {
  position: relative; /* 겹친 테두리 위로 올라오도록 */
  border-color: var(--text);
  background: var(--text);
  color: var(--bg);
}
</style>
