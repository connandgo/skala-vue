<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { createLifeEngine } from '@/composables/useLifeEngine.js'
import { lifePhase } from '@/utils/lifeState.js'

/* ================================================================
   조정용 상수 - 눈으로 보고 여기만 만지면 된다
   ================================================================ */
const ALPHA = 0.16 // 배경 진하기. 0.2를 넘기면 콘텐츠와 경쟁한다
const CELL = 4 // 기본 칸 크기. 4 미만으로 내리면 계산량이 급증
const CELL_HEAVY = 6 // 지도가 있는 무거운 라우트용
const DURATION = 3000 // 애니메이션 길이(ms)
const TICK = 110 // 세대 간격(ms). 60fps로 돌릴 이유가 없다
const SEED_DENSITY = 0.3
const GLIDER_STEPS = 26

/* ================================================================
   라우트별 목표 그림
   - 좌표는 cols/rows 비율로 계산해 화면 크기가 달라도 형태가 유지된다
   - 얇은 선은 격자에서 끊기므로 lineWidth를 넉넉히 준다
   - 화면 가운데는 콘텐츠 카드가 가리므로 형태를 좌우로 벌려 배치한다
   ================================================================ */
const SHAPES = {
  /**
   * 홈(날씨 대시보드) - 사실적인 구름층을 화면 아래쪽에 깔아 준다.
   *
   * 아이콘처럼 또렷한 형태가 아니라 '농담(tone)'을 그린다.
   * 부드러운 원을 여러 겹 겹쳐 뭉게구름의 밝기 분포를 만들고,
   * 이 톤을 Bayer 디더링으로 넘기면 점의 밀도로 표현된다. (dither: true)
   */
  weather: (ctx, c, r) => {
    ctx.globalCompositeOperation = 'lighter'

    // 부드러운 덩어리 하나 (가장자리로 갈수록 서서히 옅어진다)
    const puff = (cx, cy, rad, strength) => {
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad)
      g.addColorStop(0, `rgba(255,255,255,${strength})`)
      g.addColorStop(0.55, `rgba(255,255,255,${strength * 0.45})`)
      g.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = g
      ctx.fillRect(cx - rad, cy - rad, rad * 2, rad * 2)
    }

    // 아래로 갈수록 짙어지는 바탕 (하늘 -> 구름층)
    const base = ctx.createLinearGradient(0, r * 0.35, 0, r)
    base.addColorStop(0, 'rgba(255,255,255,0)')
    base.addColorStop(1, 'rgba(255,255,255,0.42)')
    ctx.fillStyle = base
    ctx.fillRect(0, 0, c, r)

    // 뭉게구름 덩어리들. y가 클수록(아래쪽) 크고 진하게 깔린다.
    const blobs = [
      [0.08, 0.72, 0.30, 0.55], [0.22, 0.84, 0.34, 0.62],
      [0.37, 0.70, 0.26, 0.48], [0.50, 0.88, 0.32, 0.58],
      [0.63, 0.74, 0.28, 0.50], [0.78, 0.86, 0.34, 0.60],
      [0.93, 0.72, 0.30, 0.52],
      [0.15, 0.55, 0.20, 0.30], [0.45, 0.52, 0.18, 0.26],
      [0.72, 0.57, 0.22, 0.32], [0.90, 0.48, 0.17, 0.24],
    ]
    for (const [fx, fy, fr, st] of blobs) {
      puff(c * fx, r * fy, r * fr, st)
    }

    ctx.globalCompositeOperation = 'source-over'
  },

  // 영화 - 필름 스트립이 화면을 가로로 관통
  movies: (ctx, c, r) => {
    const top = r * 0.3
    const hgt = r * 0.4
    const bar = hgt * 0.17
    ctx.fillRect(0, top, c, bar) // 위쪽 띠
    ctx.fillRect(0, top + hgt - bar, c, bar) // 아래쪽 띠

    // 스프로킷 구멍 (띠 안쪽에 규칙적으로)
    const hw = c * 0.022
    const hh = bar * 0.55
    for (let x = c * 0.03; x < c; x += c * 0.075) {
      ctx.clearRect(x, top + bar * 0.22, hw, hh)
      ctx.clearRect(x, top + hgt - bar + bar * 0.22, hw, hh)
    }
  },

  // 코드 챌린지 - 중괄호를 좌우 끝으로 벌려 카드에 안 가리게
  challenges: (ctx, c, r) => {
    const size = r * 0.62
    ctx.font = `700 ${size}px "IBM Plex Mono", monospace`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('{', c * 0.12, r * 0.5)
    ctx.fillText('}', c * 0.88, r * 0.5)
  },

  // 소개 - 로고 텍스트
  about: (ctx, c, r) => {
    const size = r * 0.3
    ctx.font = `800 ${size}px "IBM Plex Mono", monospace`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('SKALA', c * 0.5, r * 0.18)
    ctx.fillText('SKALA', c * 0.5, r * 0.84)
  },

  // 지역 상세 - 온도계 (세로로 길게, 좌우에 하나씩)
  detail: (ctx, c, r) => {
    const draw = (cx) => {
      const w = r * 0.09
      const top = r * 0.16
      const bot = r * 0.74
      ctx.fillRect(cx - w / 2, top, w, bot - top) // 관
      ctx.beginPath()
      ctx.arc(cx, bot + w * 0.9, w * 1.5, 0, Math.PI * 2) // 구
      ctx.fill()
      // 눈금
      ctx.lineWidth = Math.max(3, w * 0.22)
      for (let i = 0; i < 6; i++) {
        const y = top + ((bot - top) / 6) * (i + 0.5)
        ctx.beginPath()
        ctx.moveTo(cx + w * 0.75, y)
        ctx.lineTo(cx + w * 1.9, y)
        ctx.stroke()
      }
    }
    draw(c * 0.13)
    draw(c * 0.87)
  },

  // 없는 경로
  notFound: (ctx, c, r) => {
    const size = r * 0.42
    ctx.font = `800 ${size}px "IBM Plex Mono", monospace`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('404', c * 0.5, r * 0.5)
  },
}

/** 라우트 경로 -> 그림 + 칸 크기 */
const resolveRoute = (path) => {
  // dither: true 는 농담이 있는 그림(구름)에만. 글자·도형은 경계가 또렷해야 한다.
  if (path === '/') return { painter: SHAPES.weather, cell: CELL_HEAVY, dither: true }
  if (path.startsWith('/weather')) return { painter: SHAPES.detail, cell: CELL_HEAVY }
  if (path.startsWith('/movies')) return { painter: SHAPES.movies, cell: CELL }
  if (path.startsWith('/challenges')) return { painter: SHAPES.challenges, cell: CELL }
  if (path.startsWith('/about')) return { painter: SHAPES.about, cell: CELL }
  return { painter: SHAPES.notFound, cell: CELL }
}

/* ================================================================ */

const canvasRef = ref(null)
const route = useRoute()

let engine = null
let raf = null
let lastTick = 0
let startedAt = 0
let resizeTimer = null

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** 현재 테마의 CSS 변수에서 색을 읽어 온다 (테마가 바뀌면 다시 호출) */
const readColors = () => {
  const s = getComputedStyle(document.documentElement)
  const text = s.getPropertyValue('--text').trim() || '#000'
  return { cell: text, lock: text }
}

const easeInOutQuad = (p) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2)

const stop = () => {
  if (raf) cancelAnimationFrame(raf)
  raf = null
  lifePhase.value = 'idle'
}

/** 목표 그림을 향해 3초간 진행한 뒤 완전히 정지한다 */
const restart = () => {
  if (!engine) return
  stop()

  const { painter, cell, dither } = resolveRoute(route.path)
  engine.setCellSize(cell)
  engine.resize()
  engine.setColors(readColors())
  engine.seedRandom(SEED_DENSITY)
  engine.setTarget(painter, dither === true)

  // 모션을 줄이도록 설정한 사용자에게는 애니메이션 없이 결과만 보여준다
  if (reduceMotion) {
    for (let i = 0; i < 240; i++) {
      engine.step()
      engine.applyLock(i / 239)
    }
    engine.applyLock(1)
    engine.draw()
    lifePhase.value = 'idle'
    return
  }

  lifePhase.value = 'running'
  startedAt = performance.now()
  lastTick = 0

  const loop = (now) => {
    const elapsed = now - startedAt

    if (elapsed >= DURATION) {
      engine.applyLock(1)
      engine.draw()
      stop() // rAF까지 멈춘다. 이후 CPU 사용 0
      return
    }

    if (now - lastTick >= TICK) {
      lastTick = now
      engine.step()
      engine.applyLock(easeInOutQuad(elapsed / DURATION))
      engine.draw()
    }
    raf = requestAnimationFrame(loop)
  }
  raf = requestAnimationFrame(loop)
}

/** 정지 상태에서 빈 곳을 클릭하면 글라이더를 놓고 잠깐만 돌린다 */
const onClick = (e) => {
  if (!engine || lifePhase.value !== 'idle' || reduceMotion) return
  if (e.target.closest('a, button, input, select, label, .leaflet-container')) return

  engine.spawnGlider(e.clientX, e.clientY)

  let left = GLIDER_STEPS
  let last = 0
  const loop = (now) => {
    if (now - last >= TICK) {
      last = now
      engine.step()
      engine.draw()
      left--
    }
    if (left > 0) raf = requestAnimationFrame(loop)
    else stop()
  }
  lifePhase.value = 'running'
  raf = requestAnimationFrame(loop)
}

const onResize = () => {
  clearTimeout(resizeTimer)
  resizeTimer = setTimeout(restart, 200)
}

const onVisibility = () => {
  if (document.hidden) stop()
}

// 테마가 바뀌면 색만 갈아끼우고 다시 그린다 (애니메이션은 다시 돌리지 않는다)
let themeObserver = null

onMounted(() => {
  engine = createLifeEngine(canvasRef.value, {
    cellSize: CELL,
    alpha: ALPHA,
    colors: readColors(),
    holeRatio: 0, // 칸을 꽉 채워 하프톤 점처럼 보이게 한다
  })

  window.addEventListener('resize', onResize)
  document.addEventListener('click', onClick)
  document.addEventListener('visibilitychange', onVisibility)

  themeObserver = new MutationObserver(() => {
    engine.setColors(readColors())
    engine.draw()
  })
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })

  watch(() => route.path, restart, { immediate: true })
})

onUnmounted(() => {
  stop()
  clearTimeout(resizeTimer)
  window.removeEventListener('resize', onResize)
  document.removeEventListener('click', onClick)
  document.removeEventListener('visibilitychange', onVisibility)
  themeObserver?.disconnect()
})

defineExpose({ spawnGlider: (x, y) => engine?.spawnGlider(x, y) })
</script>

<template>
  <canvas ref="canvasRef" class="life-backdrop" aria-hidden="true"></canvas>
</template>

<style scoped>
.life-backdrop {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: -1;
  /* 지도 클릭 등을 막지 않도록 반드시 통과시킨다 */
  pointer-events: none;
}
</style>
