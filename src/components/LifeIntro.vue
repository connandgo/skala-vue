<script setup>
import { onMounted, onUnmounted, ref } from 'vue'

/**
 * 최초 진입 인트로.
 *
 *   1) 커널 패닉 덤프가 위에서부터 한 줄씩 찍힌다
 *   2) 이어서 SKALA가 블록 문자 배너로 출력된다
 *   3) 잠시 머문 뒤 사라진다
 *
 * 배너 글자는 아래 GLYPHS에 직접 그려 두었다.
 */

const emit = defineEmits(['done'])

const FONT_SIZE = 16 // 덤프 글자 크기
const LINE_H = 23 // 덤프 줄 간격
const PAD_X = 36
const PAD_Y = 28

const DUMP = 1700 // 덤프가 다 찍히는 시간(ms)
const TICK = 90 // 배너 한 줄 간격(ms)
const HOLD = 1000 // 완성 후 머무는 시간(ms)
const FADE = 600 // 사라지는 시간(ms)

const BG = '#0b0b0b'
const DIM = 'rgba(255,255,255,0.32)'
const CODE = 'rgba(255,255,255,0.72)'
const BRIGHT = '#ffffff'

// 배너 앞에 먼저 찍히는 줄들
const TAIL = ['', '[    0.483102]  ---[ end Kernel panic ]---', '']

const SEEN_KEY = 'skala-intro-seen'

const canvasRef = ref(null)
const visible = ref(true)
const fading = ref(false)

let ctx = null
let w = 0
let h = 0
let lines = []
let banner = []
let bannerFont = 20
let raf = null
let fadeTimer = null

/* ---------------------------------------------------------------- 덤프 */

const HEX = '0123456789abcdef'
const rand = (n) => Math.floor(Math.random() * n)
const hex = (n) => Array.from({ length: n }, () => HEX[rand(16)]).join('')

const TRACE = [
  '? __die_body+0x1a/0x60',
  '? page_fault_oops+0x15c/0x2b0',
  '? exc_page_fault+0x7f/0x180',
  '? skala_render+0x2f/0x120 [skala]',
  '? life_step+0x8c/0x1e0 [skala]',
  '? dither_bayer8+0x41/0x90 [skala]',
  'do_syscall_64+0x5c/0x90',
  'process_one_work+0x1f4/0x3b0',
]
const REGS = ['RAX', 'RBX', 'RCX', 'RDX', 'RSI', 'RDI']

let clock = 0.482913

/** 커널 패닉 로그처럼 보이는 한 줄 */
const makeLine = () => {
  clock += Math.random() * 0.000042
  const ts = `[${clock.toFixed(6).padStart(12)}]`
  const r = Math.random()

  if (r < 0.55) return `${ts}  ${TRACE[rand(TRACE.length)]}`
  if (r < 0.74) return `${REGS[rand(REGS.length)]}: ${hex(16)}  ${REGS[rand(REGS.length)]}: ${hex(16)}`
  if (r < 0.87) return `RIP: 0010:skala_render+0x${hex(2)}/0x${hex(3)} [skala]`
  return `RSP: 0018:ffff${hex(12)} EFLAGS: 000${hex(5)}`
}

/* ---------------------------------------------------------------- 배너 */

/**
 * SKALA 배너.
 * 캔버스 픽셀을 뽑아 쓰면 이 크기에선 글자가 뭉개져, 직접 그려 둔다.
 * 글자 하나는 6칸 x 7줄.
 */
const GLYPHS = {
  S: ['██████', '██    ', '██    ', '██████', '    ██', '    ██', '██████'],
  K: ['██  ██', '██ ██ ', '████  ', '███   ', '████  ', '██ ██ ', '██  ██'],
  A: [' ████ ', '██  ██', '██  ██', '██████', '██  ██', '██  ██', '██  ██'],
  L: ['██    ', '██    ', '██    ', '██    ', '██    ', '██    ', '██████'],
}

const BANNER_ROWS = 7

/** 글자를 가로로 이어 붙여 배너 줄을 만든다 */
const makeBanner = () => {
  const word = 'SKALA'.split('')
  return Array.from({ length: BANNER_ROWS }, (_, y) =>
    word.map((ch) => GLYPHS[ch][y]).join('  ').replace(/\s+$/, ''),
  )
}

// 배너 가로 문자 수 (글자 6칸 + 사이 2칸)
const BANNER_COLS = 5 * 6 + 4 * 2

/* ---------------------------------------------------------------- 렌더 */

/**
 * 화면은 고정한 채 위에서부터 쌓아 올린다.
 * 배너는 블록이 서로 붙도록 줄 간격을 글자 크기에 맞춘다.
 */
const renderFrame = (dumpCount, tailCount, bannerCount) => {
  ctx.fillStyle = BG
  ctx.fillRect(0, 0, w, h)
  ctx.textBaseline = 'top'

  ctx.font = `${FONT_SIZE}px "IBM Plex Mono", monospace`
  const shown = Math.min(dumpCount, lines.length)
  for (let i = 0; i < shown; i++) {
    // 방금 찍힌 줄은 밝게
    ctx.fillStyle = i > shown - 4 ? CODE : DIM
    ctx.fillText(lines[i], PAD_X, PAD_Y + i * LINE_H)
  }

  for (let i = 0; i < tailCount; i++) {
    ctx.fillStyle = CODE
    ctx.fillText(TAIL[i], PAD_X, PAD_Y + (lines.length + i) * LINE_H)
  }

  if (bannerCount > 0) {
    const top = PAD_Y + (lines.length + TAIL.length) * LINE_H
    ctx.font = `${bannerFont}px "IBM Plex Mono", monospace`
    ctx.fillStyle = BRIGHT
    for (let i = 0; i < bannerCount; i++) {
      ctx.fillText(banner[i], PAD_X, top + i * bannerFont)
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

  banner = makeBanner()

  // 배너가 가로로 넘치지 않게 글자 크기를 맞춘다
  ctx.font = `${bannerFont}px "IBM Plex Mono", monospace`
  const charW = ctx.measureText('█').width || bannerFont * 0.6
  const maxW = w - PAD_X * 2
  if (charW * BANNER_COLS > maxW) {
    bannerFont = Math.max(6, Math.floor((bannerFont * maxW) / (charW * BANNER_COLS)))
  }

  // 배너까지 들어갈 자리를 남겨 두고 덤프 줄 수를 정한다
  const bannerH = BANNER_ROWS * bannerFont
  const room = h - PAD_Y * 2 - bannerH - TAIL.length * LINE_H
  const dumpCount = Math.max(5, Math.floor(room / LINE_H))

  lines = Array.from({ length: dumpCount }, makeLine)
  lines[0] = '[    0.482913]  Kernel panic - not syncing: Fatal exception'
  lines[1] = '[    0.482914]  CPU: 0 PID: 1 Comm: skala Not tainted 6.8.0-skala'
  lines[2] = '[    0.482915]  Call Trace:'

  const startedAt = performance.now()
  const totalSteps = TAIL.length + BANNER_ROWS

  const loop = (now) => {
    const elapsed = now - startedAt

    if (elapsed < DUMP) {
      // 1단계: 덤프가 한 줄씩 찍힌다
      renderFrame(Math.ceil((elapsed / DUMP) * lines.length), 0, 0)
    } else {
      // 2단계: 종료 줄에 이어 SKALA 배너가 한 줄씩 출력된다
      const step = Math.min(totalSteps, Math.floor((elapsed - DUMP) / TICK))
      renderFrame(lines.length, Math.min(TAIL.length, step), step - TAIL.length)

      if (elapsed >= DUMP + TICK * totalSteps + HOLD) {
        finish()
        return
      }
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
