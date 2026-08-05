<script setup>
import { ref, watch, onMounted, onUnmounted, computed } from 'vue'
import { lifePhase } from '@/utils/lifeState.js'

// 'rain' | 'snow' | 'none'
const props = defineProps({
  mode: {
    type: String,
    default: 'none',
  },
})

// 배경 라이프가 도는 동안에는 입자를 그리지 않는다 (배경끼리 겹치지 않도록)
const active = computed(() => props.mode !== 'none' && lifePhase.value === 'idle')

const canvasRef = ref(null)
let ctx = null
let raf = null
let particles = []
let w = 0
let h = 0

const resize = () => {
  const c = canvasRef.value
  if (!c) return
  w = c.width = window.innerWidth
  h = c.height = window.innerHeight
}

/** 현재 모드에 맞는 입자를 만든다 */
const seed = () => {
  const count = props.mode === 'rain' ? 160 : props.mode === 'snow' ? 90 : 0
  particles = Array.from({ length: count }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    // 비는 길고 빠르게, 눈은 작고 느리게 떨어진다
    len: props.mode === 'rain' ? 14 + Math.random() * 20 : 2.5 + Math.random() * 4,
    speed: props.mode === 'rain' ? 5 + Math.random() * 6 : 0.5 + Math.random() * 1.1,
    drift: props.mode === 'rain' ? 0.8 : Math.random() * 0.8 - 0.4,
    phase: Math.random() * Math.PI * 2,
    alpha: 0.4 + Math.random() * 0.45,
    // 굵기를 입자마다 조금씩 다르게 줘서 원근감을 만든다
    weight: props.mode === 'rain' ? 1.5 + Math.random() * 2 : 1,
  }))
}

const step = () => {
  if (!ctx) return
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

const start = () => {
  stop()
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
