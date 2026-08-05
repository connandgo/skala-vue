<script setup>
import { onMounted, onUnmounted, ref } from 'vue'

/**
 * 최초 진입 인트로.
 *
 * SKALA 글자를 격자에 심어 두고 잠깐 멈춘 뒤,
 * 라이프 게임 규칙을 적용하면 글자가 스스로 흩어진다.
 * (흩어지는 연출을 따로 만들 필요 없이 규칙이 알아서 해 준다)
 *
 * 배경(DitherBackdrop)과 같은 도트 스타일을 쓴다.
 */

const emit = defineEmits(['done'])

const PX = 5 // 도트 한 칸 크기
const SKY_TOP = '#8a8a8a'
const SKY_BOTTOM = '#565656'
const LIGHT = '#ffffff'

const HOLD = 700 // 글자를 읽을 시간(ms)
const TICK = 90 // 세대 간격(ms). 짧을수록 격하게 흩어진다
const SPREAD = 1900 // 흩어지는 시간(ms)
const FADE = 700 // 사라지는 시간(ms)

const SEEN_KEY = 'skala-intro-seen'

const canvasRef = ref(null)
const visible = ref(true)
const fading = ref(false)

let ctx = null
let cols = 0
let rows = 0
let w = 0
let h = 0
let grid = new Uint8Array(0)
let raf = null
let fadeTimer = null

/* ---------------------------------------------------------------- 격자 */

/** SKALA 글자를 격자에 심는다 */
const seedText = () => {
  const off = document.createElement('canvas')
  off.width = cols
  off.height = rows
  const octx = off.getContext('2d', { willReadFrequently: true })

  octx.fillStyle = '#fff'
  octx.textAlign = 'center'
  octx.textBaseline = 'middle'
  // 화면이 좁아도 글자가 잘리지 않도록 가로 폭도 함께 고려한다
  const size = Math.min(rows * 0.42, cols * 0.17)
  octx.font = `800 ${size}px "IBM Plex Mono", monospace`
  octx.fillText('SKALA', cols / 2, rows / 2)

  const data = octx.getImageData(0, 0, cols, rows).data
  grid = new Uint8Array(cols * rows)
  for (let i = 0; i < grid.length; i++) {
    grid[i] = data[i * 4 + 3] > 110 ? 1 : 0
  }
}

/** 한 세대 진행 (B3/S23, 가장자리는 토러스) */
const step = () => {
  const next = new Uint8Array(grid.length)
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      let n = 0
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue
          n += grid[((y + dy + rows) % rows) * cols + ((x + dx + cols) % cols)]
        }
      }
      const idx = y * cols + x
      next[idx] = grid[idx] ? (n === 2 || n === 3 ? 1 : 0) : n === 3 ? 1 : 0
    }
  }
  grid = next
}

const render = () => {
  const sky = ctx.createLinearGradient(0, 0, 0, h)
  sky.addColorStop(0, SKY_TOP)
  sky.addColorStop(1, SKY_BOTTOM)
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, w, h)

  ctx.fillStyle = LIGHT
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (grid[y * cols + x]) ctx.fillRect(x * PX, y * PX, PX, PX)
    }
  }
}

/* ---------------------------------------------------------------- 흐름 */

const finish = () => {
  if (raf) cancelAnimationFrame(raf)
  raf = null
  fading.value = true
  clearTimeout(fadeTimer)
  fadeTimer = setTimeout(() => {
    visible.value = false
    emit('done')
  }, FADE)
}

const run = () => {
  const canvas = canvasRef.value
  if (!canvas) return

  w = window.innerWidth
  h = window.innerHeight
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  canvas.width = Math.floor(w * dpr)
  canvas.height = Math.floor(h * dpr)
  ctx = canvas.getContext('2d')
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

  cols = Math.ceil(w / PX)
  rows = Math.ceil(h / PX)

  seedText()
  render()

  const startedAt = performance.now()
  let lastTick = 0

  const loop = (now) => {
    const elapsed = now - startedAt

    if (elapsed >= HOLD + SPREAD) {
      finish()
      return
    }
    // HOLD 동안은 글자를 그대로 두고 읽을 시간을 준다
    if (elapsed > HOLD && now - lastTick >= TICK) {
      lastTick = now
      step()
      render()
    }
    raf = requestAnimationFrame(loop)
  }
  raf = requestAnimationFrame(loop)
}

onMounted(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  let seen = false
  try {
    seen = sessionStorage.getItem(SEEN_KEY) === '1'
  } catch {
    // 사생활 보호 모드 등에서 접근이 막히면 그냥 재생한다
  }

  // 이미 본 세션이거나 모션을 줄이는 설정이면 인트로를 건너뛴다
  if (seen || reduceMotion) {
    visible.value = false
    emit('done')
    return
  }

  try {
    sessionStorage.setItem(SEEN_KEY, '1')
  } catch {
    /* 저장 실패는 무시 */
  }
  run()
})

onUnmounted(() => {
  if (raf) cancelAnimationFrame(raf)
  clearTimeout(fadeTimer)
})
</script>

<template>
  <div v-if="visible" class="intro" :class="{ fading }">
    <canvas ref="canvasRef"></canvas>
    <button class="skip" @click="finish">SKIP</button>
  </div>
</template>

<style scoped>
.intro {
  position: fixed;
  inset: 0;
  z-index: 2000;
  background: var(--bg);
  transition: opacity 0.7s ease;
}

.intro.fading {
  opacity: 0;
  pointer-events: none;
}

.intro canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.skip {
  position: absolute;
  right: 24px;
  bottom: 24px;
  margin: 0;
  padding: 6px 14px;
  font-family: var(--font-mono);
  font-size: 0.75rem;
  letter-spacing: 0.1em;
  border: 1px solid var(--bg);
  background: transparent;
  color: var(--bg);
}

.skip:hover {
  background: var(--bg);
  color: var(--text);
}

@media (prefers-reduced-motion: reduce) {
  .intro {
    transition: none;
  }
}
</style>
