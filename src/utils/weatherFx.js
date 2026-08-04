import { ref } from 'vue'

/**
 * 화면 전체 날씨 효과 상태.
 * 컴포넌트 밖에 ref를 두면 어디서 import하든 같은 값을 공유한다
 * (규모가 커지면 Pinia로 옮기면 된다).
 */
export const fxMode = ref('none') // 'rain' | 'snow' | 'none'

/**
 * OpenWeather의 날씨 코드(weather[0].id)를 효과로 변환한다.
 * 2xx 뇌우 / 3xx 이슬비 / 5xx 비 -> rain, 6xx 눈 -> snow, 그 외 -> none
 */
export const modeFromWeatherId = (id) => {
  if (id == null) return 'none'
  const group = Math.floor(id / 100)
  if (group === 2 || group === 3 || group === 5) return 'rain'
  if (group === 6) return 'snow'
  return 'none'
}
