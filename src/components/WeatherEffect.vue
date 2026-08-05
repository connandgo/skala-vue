<script setup>
import { ref, watch, onMounted, onUnmounted, computed } from 'vue'

/**
 * 화면 전체에 내리는 비 / 눈.
 *
 * 선택한 지역이 비나 눈이면 켜진다. 날씨를 숫자로만 보는 것보다
 * 화면에 실제로 내리는 편이 지금 상태가 빨리 읽힌다.
 *
 * DOM 요소를 입자 수만큼 만들면 수백 개가 매 프레임 다시 그려져 버벅인다.
 * 그래서 canvas 한 장에 직접 찍는다.
 *
 * 입자 값은 반응형으로 두지 않았다. 매 프레임 바뀌는 값을 ref에 담으면
 * Vue가 그때마다 화면 갱신을 검토하는데, 어차피 그리는 건 canvas라 의미가 없다.
 */

// 'rain' | 'snow' | 'none'
const props = defineProps({
  mode: {
    type: String,
    default: 'none',
  },
})

const active = computed(() => props.mode !== 'none')

const canvasRef = ref(null)
let ctx = null
let raf = null // requestAnimationFrame 핸들 (멈출 때 필요하다)
let particles = []
let w = 0
let h = 0

/** 캔버스를 창 크기에 맞춘다 */
const resize = () => {
  const c = canvasRef.value
  if (!c) return
  // width/height 속성을 넣어야 실제 그리기 영역이 바뀐다.
  // CSS 크기만 바꾸면 그림이 늘어나 뭉갠다.
  w = c.width = window.innerWidth
  h = c.height = window.innerHeight
}

/**
 * 현재 모드에 맞는 입자를 만든다.
 *
 * 비가 눈보다 많은 이유는 굵기 때문이다. 비는 가는 선이라 성기면 티가 안 나고,
 * 눈은 동그라미라 같은 수를 뿌리면 화면이 가려진다.
 */
const seed = () => {
  const count = props.mode === 'rain' ? 160 : props.mode === 'snow' ? 90 : 0
  particles = Array.from({ length: count }, () => ({
    // 처음부터 화면 전체에 흩어 둔다. 위에서만 시작하면 첫 1초가 비어 보인다.
    x: Math.random() * w,
    y: Math.random() * h,
    // 비는 길고 빠르게, 눈은 작고 느리게 떨어진다
    len: props.mode === 'rain' ? 14 + Math.random() * 20 : 2.5 + Math.random() * 4,
    speed: props.mode === 'rain' ? 5 + Math.random() * 6 : 0.5 + Math.random() * 1.1,
    // 비는 다 같은 방향으로 비스듬히, 눈은 제각각 좌우로 흔들린다
    drift: props.mode === 'rain' ? 0.8 : Math.random() * 0.8 - 0.4,
    // 눈이 흔들리는 sin 곡선의 시작 지점. 입자마다 달라야 줄 맞춰 움직이지 않는다.
    phase: Math.random() * Math.PI * 2,
    alpha: 0.4 + Math.random() * 0.45,
    // 굵기를 입자마다 조금씩 다르게 줘서 원근감을 만든다
    weight: props.mode === 'rain' ? 1.5 + Math.random() * 2 : 1,
  }))
}

/** 한 프레임을 그리고 다음 프레임을 예약한다 */
const step = () => {
  if (!ctx) return
  // 지우지 않으면 이전 프레임이 남아 선이 화면에 눌어붙는다
  ctx.clearRect(0, 0, w, h)

  // 배경 도트가 흑백이므로 입자도 같은 톤(현재 글자색)으로 그린다
  const ink = getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || '#000'

  if (props.mode === 'rain') {
    ctx.strokeStyle = ink
    ctx.lineCap = 'round'
    for (const p of particles) {
      ctx.globalAlpha = p.alpha
      ctx.lineWidth = p.weight
      ctx.beginPath()
      ctx.moveTo(p.x, p.y)
      ctx.lineTo(p.x - p.drift * 2, p.y + p.len)
      ctx.stroke()

      p.y += p.speed
      p.x -= p.drift
      // 바닥에 닿은 입자는 버리지 않고 위로 되돌려 다시 쓴다 (계속 새로 만들면 낭비다)
      if (p.y > h) {
        p.y = -p.len
        p.x = Math.random() * w
      }
    }
  } else if (props.mode === 'snow') {
    ctx.fillStyle = ink
    for (const p of particles) {
      ctx.globalAlpha = p.alpha
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.len, 0, Math.PI * 2)
      ctx.fill()

      // sin 곡선을 태워 좌우로 흔들리게 한다. 곧게 떨어지면 눈으로 안 보인다.
      p.phase += 0.02
      p.y += p.speed
      p.x += Math.sin(p.phase) * 0.6 + p.drift
      if (p.y > h) {
        p.y = -4
        p.x = Math.random() * w
      }
    }
  }

  ctx.globalAlpha = 1
  raf = requestAnimationFrame(step)
}

/** 입자를 새로 뿌리고 돌린다. 꺼진 모드면 화면만 지우고 끝낸다. */
const start = () => {
  stop() // 이전 루프가 남아 있으면 두 벌이 겹쳐 돈다
  if (!active.value) {
    if (ctx) ctx.clearRect(0, 0, w, h)
    return
  }
  seed()
  raf = requestAnimationFrame(step)
}

const stop = () => {
  if (raf) cancelAnimationFrame(raf)
  raf = null
}

// 창 크기가 바뀌면 캔버스를 다시 잡고 입자도 새 범위로 뿌린다
const onResize = () => {
  resize()
  if (props.mode !== 'none') seed()
}

onMounted(() => {
  ctx = canvasRef.value.getContext('2d')
  resize()
  start()
  window.addEventListener('resize', onResize)
})

// 날씨가 바뀌거나 라이프가 멈추면 다시 판단한다
watch(active, start)

// 애니메이션 루프와 이벤트를 반드시 정리한다 (메모리 누수 방지)
onUnmounted(() => {
  stop()
  window.removeEventListener('resize', onResize)
})
</script>

<template>
  <canvas ref="canvasRef" class="weather-fx" aria-hidden="true"></canvas>
</template>

<style scoped>
.weather-fx {
  position: fixed;
  inset: 0;
  z-index: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
</style>
