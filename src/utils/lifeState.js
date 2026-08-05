import { ref } from 'vue'

/**
 * 배경 라이프 게임의 현재 단계.
 *
 * 'running' 동안에는 비/눈 효과를 잠시 멈춰 배경이 겹쳐 보이지 않게 한다.
 * 3초 뒤 'idle' 이 되면 배경은 정지하고 날씨 효과가 다시 시작된다.
 */
export const lifePhase = ref('idle') // 'running' | 'idle'
