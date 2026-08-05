import { ref } from 'vue'

/**
 * 화면 전체 날씨 효과 상태.
 * 컴포넌트 밖에 ref를 두면 어디서 import하든 같은 값을 공유한다
 * (규모가 커지면 Pinia로 옮기면 된다).
 */
export const fxMode = ref('none') // 'rain' | 'snow' | 'none'

/**
 * WMO 날씨 코드를 화면 효과로 변환한다.
 * 판단 규칙은 utils/wmo.js 한 곳에만 둔다.
 */
export { wmoMode as modeFromWeatherCode } from './wmo.js'
