<script setup>
import { onMounted, onUnmounted, ref } from 'vue'

/**
 * 최초 진입 인트로.
 *
 *   1) 터미널에 코드가 빠르게 올라간다
 *   2) 글자들이 흩어진 점으로 무너지면서 SKALA 형태로 모인다
 *   3) 잠시 머문 뒤 사라진다
 *
 * 모이는 방식은 배경(DitherBackdrop)과 같다.
 * 칸마다 난수 순서를 두고 그 순서대로 잠가, 한꺼번에 나타나지 않게 한다.
 */

const emit = defineEmits(['done'])

const PX = 5 // 도트 한 칸 크기
const SCROLL = 1300 // 코드가 올라가는 시간(ms)
const ASSEMBLE = 1500 // SKALA로 모이는 시간(ms)
const HOLD = 600 // 완성 후 머무는 시간(ms)
const FADE = 600 // 사라지는 시간(ms)
const TICK = 70 // 라이프 세대 간격(ms)

const BG = '#0b0b0b'
const CODE = 'rgba(255,255,255,0.62)'
const CODE_DIM = 'rgba(255,255,255,0.24)'
const LIGHT = '#ffffff'
const DOT = 'rgba(255,255,255,0.5)'

const SEEN_KEY = 'skala-intro-seen'

const canvasRef = ref(null)
const visible = ref(true)
const fading = ref(false)

let ctx = null
let cols = 0
let rows = 0
let w = 0
let h = 0

let grid = new Uint8Array(0) // 흩어져 떠도는 점
let lockMap = new Uint8Array(0) // SKALA 형태로 굳은 칸
let lockOrder = new Float32Array(0)
let target = new Uint8Array(0)

let lines = []
let raf = null
let fadeTimer = null

/* ---------------------------------------------------------------- 코드 */

const HEX = '0123456789abcdef'

const rand = (n) => Math.floor(Math.random() * n)
const hex = (n) => Array.from({ length: n }, () => HEX[rand(16)]).join('')

// 커널 패닉 덤프에 나오는 줄들
const TRACE = [
  '? __die_body+0x1a/0x60',
  '? page_fault_oops+0x15c/0x2b0',
  '? exc_page_fault+0x7f/0x180',
  '? asm_exc_page_fault+0x27/0x30',
  '? skala_render+0x2f/0x120 [skala]',
  '? life_step+0x8c/0x1e0 [skala]',
  '? dither_bayer8+0x41/0x90 [skala]',
  'do_syscall_64+0x5c/0x90',
  'entry_SYSCALL_64_after_hwframe+0x78/0xe2',
  'process_one_work+0x1f4/0x3b0',
]

const REGS = ['RAX', 'RBX', 'RCX', 'RDX', 'RSI', 'RDI', 'RBP', 'R08', 'R12', 'R15']

let clock = 0.482913

/** 커널 패닉 로그처럼 보이는 한 줄 */
const makeLine = () => {
  clock += Math.random() * 0.000042
  const ts = `[${clock.toFixed(6).padStart(12)}]`
  const r = Math.random()

  if (r < 0.5) return `${ts}  ${TRACE[rand(TRACE.length)]}`
  if (r < 0.68) return `${REGS[rand(REGS.length)]}: ${hex(16)}  ${REGS[rand(REGS.length)]}: ${hex(16)}`
  if (r < 0.78) return `RIP: 0010:skala_render+0x${hex(2)}/0x${hex(3)} [skala]`
  if (r < 0.86) return `RSP: 0018:ffff${hex(12)} EFLAGS: 000${hex(5)}`
  if (r < 0.93) return `CR2: ${hex(16)} CR3: ${hex(15)}4 CR4: 00${hex(6)}`
  return `${ts}  Kernel panic - not syncing: Fatal exception`
}

/* ---------------------------------------------------------------- 격자 */

/** SKALA 글자를 격자로 바꿔 목표로 삼는다 */
const buildTarget = () => {
  const off = document.createElement('canvas')
  off.width = cols
  off.height = rows
  const octx = off.getContext('2d', { willReadFrequently: true })

  octx.fillStyle = '#fff'
  octx.textAlign = 'center'
  octx.textBaseline = 'middle'
  // 화면이 좁아도 잘리지 않도록 가로 폭도 함께 본다
  const size = Math.min(rows * 0.4, cols * 0.16)
  octx.font = `800 ${size}px "IBM Plex Mono", monospace`
  octx.fillText('SKALA', cols / 2, rows / 2)

  const data = octx.getImageData(0, 0, cols, rows).data
  target = new Uint8Array(cols * rows)
  for (let i = 0; i < target.length; i++) {
    target[i] = data[i * 4 + 3] > 110 ? 1 : 0
  }
}

/** 한 세대 진행 (B3/S23). 굳은 칸은 규칙에서 제외한다. */
const step = () => {
  const next = new Uint8Array(grid.length)
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const idx = y * cols + x
      if (lockMap[idx]) {
        next[idx] = 1
        continue
      }
      let n = 0
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue
          n += grid[((y + dy + rows) % rows) * cols + ((x + dx + cols) % cols)]
        }
      }
      next[idx] = grid[idx] ? (n === 2 || n === 3 ? 1 : 0) : n === 3 ? 1 : 0
    }
  }
  grid = next
}

/** 목표 글자를 progress만큼 굳힌다 (난수 순서라 흩뿌려지듯 모인다) */
const applyLock = (progress) => {
  for (let i = 0; i < target.length; i++) {
    if (target[i] && lockOrder[i] < progress) {
      lockMap[i] = 1
      grid[i] = 1
    }
  }
}

/* ---------------------------------------------------------------- 렌더 */

const LINE_H = 18

/** 1단계: 코드가 위로 흐르는 화면 */
const renderCode = (offset, alpha = 1) => {
  ctx.fillStyle = BG
  ctx.fillRect(0, 0, w, h)

  ctx.font = '13px "IBM Plex Mono", monospace'
  ctx.textBaseline = 'top'
  ctx.globalAlpha = alpha

  const visibleCount = Math.ceil(h / LINE_H) + 2
  for (let i = 0; i < visibleCount; i++) {
    const line = lines[i % lines.length]
    if (!line) continue
    // 최근 줄일수록 밝게 (터미널에서 방금 출력된 느낌)
    ctx.fillStyle = i > visibleCount - 6 ? CODE : CODE_DIM
    ctx.fillText(line, 28, h - offset - i * LINE_H)
  }
  ctx.globalAlpha = 1
}

/** 2단계: 점이 SKALA로 모이는 화면 */
const renderDots = (codeAlpha, offset) => {
  ctx.fillStyle = BG
  ctx.fillRect(0, 0, w, h)

  // 남은 코드가 옅게 비친다
  if (codeAlpha > 0.01) renderCode(offset, codeAlpha * 0.5)

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const idx = y * cols + x
      if (lockMap[idx]) {
        ctx.fillStyle = LIGHT
      } else if (grid[idx]) {
        ctx.fillStyle = DOT // 아직 떠도는 점은 흐리게
      } else {
        continue
      }
      ctx.fillRect(x * PX, y * PX, PX, PX)
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

  grid = new Uint8Array(cols * rows)
  lockMap = new Uint8Array(cols * rows)
  lockOrder = new Float32Array(cols * rows)
  for (let i = 0; i < lockOrder.length; i++) lockOrder[i] = Math.random()

  buildTarget()
  lines = Array.from({ length: Math.ceil(h / LINE_H) + 4 }, makeLine)
  // 맨 처음 눈에 들어오는 자리에 패닉 헤더를 박아 둔다
  lines[0] = '[    0.482913]  Kernel panic - not syncing: Fatal exception in interrupt'
  lines[1] = '[    0.482914]  CPU: 0 PID: 1 Comm: skala Not tainted 6.8.0-skala'
  lines[2] = '[    0.482915]  Call Trace:'

  const startedAt = performance.now()
  let lastTick = 0
  let seeded = false

  const loop = (now) => {
    const elapsed = now - startedAt

    if (elapsed >= SCROLL + ASSEMBLE + HOLD) {
      finish()
      return
    }

    if (elapsed < SCROLL) {
      // 1단계: 코드가 빠르게 위로 흐른다
      const offset = (elapsed / SCROLL) * h * 2.2
      // 줄이 다 지나가면 새 줄로 갈아 끼워 끝없이 흐르게 한다
      if (Math.random() < 0.35) lines[rand(lines.length)] = makeLine()
      renderCode(offset)
    } else {
      // 2단계: 글자가 점으로 무너지고 SKALA로 모인다
      if (!seeded) {
        seeded = true
        // 화면에 떠 있던 코드를 점으로 흩어 놓는다
        for (let i = 0; i < grid.length; i++) grid[i] = Math.random() < 0.22 ? 1 : 0
      }

      const t = Math.min(1, (elapsed - SCROLL) / ASSEMBLE)
      if (now - lastTick >= TICK) {
        lastTick = now
        step()
        applyLock(t * t) // 처음엔 천천히, 뒤로 갈수록 빠르게 모인다
      }
      renderDots(Math.max(0, 1 - t * 2.5), h * 2.2)
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

  // 이미 본 세션이거나 모션을 줄이는 설정이면 건너뛴다
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
  background: #0b0b0b;
  transition: opacity 0.6s ease;
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
  border: 1px solid rgba(255, 255, 255, 0.45);
  background: transparent;
  color: rgba(255, 255, 255, 0.7);
}

.skip:hover {
  border-color: #fff;
  background: #fff;
  color: #0b0b0b;
}

@media (prefers-reduced-motion: reduce) {
  .intro {
    transition: none;
  }
}
</style>
