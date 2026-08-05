import { ref, computed, watch } from 'vue'
import { defineStore } from 'pinia'
import { useAuthStore } from './authStore'

export const useConfigStore = defineStore('config', () => {
  // 1. state: 단위를 저장하는 변수 (초기값은 'celsius')
  // 값은 오직 'celsius' 또는 'fahrenheit' 두 가지만 가집니다.
  const unit = ref('celsius')

  // 2. getters: 현재 단위 상태에 맞춰 화면에 뿌릴 기호(℃ / ℉)를 실시간 리턴
  const unitSymbol = computed(() => {
    return unit.value === 'celsius' ? '℃' : '℉'
  })

  // 3. actions: 버튼 클릭 시 'celsius'와 'fahrenheit'를 토글(스위칭)하는 함수
  function toggleUnit() {
    unit.value = unit.value === 'celsius' ? 'fahrenheit' : 'celsius'
  }

  // 4. 두 칸짜리 UI에서 쓴다. 누른 칸이 이미 켜져 있으면 아무 일도 없어야 한다.
  function setUnit(next) {
    if (next === 'celsius' || next === 'fahrenheit') unit.value = next
  }

  // 로그인해 있으면 단위를 계정에 남긴다.
  // 로그인 순간에는 계정에 저장된 값을 화면에 되살린다.
  const auth = useAuthStore()
  watch(unit, (v) => auth.savePref('unit', v))
  watch(
    () => auth.userId,
    (id) => {
      if (id && auth.prefs.unit) unit.value = auth.prefs.unit
    },
    { immediate: true },
  )

  return {
    unit,
    unitSymbol,
    toggleUnit,
    setUnit,
  }
})
