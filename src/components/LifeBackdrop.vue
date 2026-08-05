<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { createLifeEngine } from '@/composables/useLifeEngine.js'
import { lifePhase } from '@/utils/lifeState.js'

/* ================================================================
   조정용 상수 - 눈으로 보고 여기만 만지면 된다
   ================================================================ */
// 배경 진하기. 콘텐츠 카드가 불투명해 글자 뒤에 깔리지 않으므로
// 레퍼런스처럼 또렷하게 보이도록 높게 잡는다.
const LEVELS = 4 // 밝기 단계 수. 많을수록 결이 다양해진다
const CELL = 4 // 기본 칸 크기. 4 미만으로 내리면 계산량이 급증
const CELL_HEAVY = 6 // 지도가 있는 무거운 라우트용
const DURATION = 3000 // 애니메이션 길이(ms)
const TICK = 110 // 세대 간격(ms). 60fps로 돌릴 이유가 없다
const SEED_DENSITY = 0.3
const GLIDER_STEPS = 26


/* ================================================================
   구름 텍스처 생성 (fBm - 다중 옥타브 값 노이즈)

   원을 여러 개 겹치는 방식으로는 실제 구름의 결이 안 나온다.
   해상도를 반씩 줄여 가며 노이즈를 겹쳐 쌓으면(fBm)
   큰 덩어리 + 잔결이 동시에 생겨 사진 같은 구름 톤이 만들어진다.
   ================================================================ */
const hash = (x, y, s) => {
  let h = (x * 374761393 + y * 668265263 + s * 1013904223) | 0
  h = ((h ^ (h >>> 13)) * 1274126177) | 0
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}

const smoothstep = (t) => t * t * (3 - 2 * t)

/** 격자점 난수를 부드럽게 보간한 값 노이즈 */
const valueNoise = (x, y, s) => {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const xf = x - xi
  const yf = y - yi
  const a = hash(xi, yi, s)
  const b = hash(xi + 1, yi, s)
  const c = hash(xi, yi + 1, s)
  const d = hash(xi + 1, yi + 1, s)
  const u = smoothstep(xf)
  const v = smoothstep(yf)
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v
}

/** 옥타브를 겹쳐 쌓아 구름 같은 농담을 만든다 */
const fbm = (x, y, s, octaves = 6) => {
  let value = 0
  let amp = 0.5
  let freq = 1
  let norm = 0
  for (let i = 0; i < octaves; i++) {
    value += amp * valueNoise(x * freq, y * freq, s + i * 101)
    norm += amp
    amp *= 0.5
    freq *= 2
  }
  return value / norm
}

const CLOUD_SEED = 7
const CLOUD_OCTAVES = 5

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
  /**
   * 홈(날씨 대시보드) - 화면 전체를 덮는 구름 톤.
   * 픽셀마다 fBm 값을 직접 써 넣고, 그 톤을 Bayer 디더링이 점의 밀도로 바꾼다.
   */
  /**
   * 홈(날씨 대시보드) - 화면 아래를 채우는 적운(뭉게구름).
   *
   * 1) 밑변은 평평하고 위로 부풀어 오르는 적운 실루엣을 원을 겹쳐 만든다
   * 2) 그 안을 fBm 노이즈로 명암 처리해 덩어리진 결을 넣는다
   * 3) 이 톤을 다단계 Bayer 디더링이 여러 밝기의 점 패턴으로 바꾼다
   */
  weather: (ctx, c, r) => {
    const baseY = r * 0.98 // 구름 밑변
    const img = ctx.createImageData(c, r)

    // 적운 덩어리들 [중심x비율, 중심y비율, 반지름비율]
    const lumps = [
      [0.04, 0.90, 0.13], [0.11, 0.80, 0.15], [0.18, 0.70, 0.13],
      [0.25, 0.78, 0.16], [0.32, 0.66, 0.14], [0.39, 0.74, 0.17],
      [0.46, 0.62, 0.15], [0.52, 0.72, 0.16], [0.59, 0.58, 0.16],
      [0.66, 0.70, 0.18], [0.73, 0.62, 0.15], [0.80, 0.72, 0.17],
      [0.87, 0.66, 0.15], [0.94, 0.78, 0.16], [1.00, 0.86, 0.14],
      // 위로 솟은 봉우리
      [0.30, 0.54, 0.09], [0.44, 0.48, 0.10], [0.62, 0.46, 0.09],
      [0.76, 0.52, 0.08],
    ]

    for (let y = 0; y < r; y++) {
      for (let x = 0; x < c; x++) {
        // 실루엣 안쪽일수록 1에 가까운 값 (가장자리는 부드럽게 떨어진다)
        let inside = 0
        for (const [fx, fy, fr] of lumps) {
          const dx = (x - c * fx) / (r * fr)
          const dy = (y - r * fy) / (r * fr)
          const d = Math.sqrt(dx * dx + dy * dy)
          if (d < 1) inside = Math.max(inside, 1 - d * d)
        }
        if (y > baseY) inside = 0 // 밑변 아래는 잘라 평평하게

        let tone = 0.06 // 빈 하늘에도 아주 옅은 결을 남긴다
        if (inside > 0) {
          // 구름 속 명암: 위쪽이 밝고 아래로 갈수록 어둡다 + 노이즈로 결
          const n = fbm((x / c) * 7, (y / r) * 7 * 0.6, CLOUD_SEED, CLOUD_OCTAVES)
          const shade = 1 - (y / r - 0.45) * 0.9
          tone = Math.min(1, inside * 1.35 * shade * (0.55 + n * 0.75))
        }

        const g = Math.round(Math.max(0, Math.min(1, tone)) * 255)
        const i = (y * c + x) * 4
        img.data[i] = g
        img.data[i + 1] = g
        img.data[i + 2] = g
        img.data[i + 3] = 255
      }
    }
    ctx.putImageData(img, 0, 0)
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

const toRgb = (hex) => {
  const h = hex.replace('#', '')
  const v = h.length === 3 ? h.split('').map((ch) => ch + ch).join('') : h
  const n = parseInt(v, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/**
 * 단계별 색을 만든다. 본문색과 배경색을 정해진 비율로 섞으므로
 * 라이트/다크 어느 쪽에서도 대비가 유지된다.
 * index 0은 '안 그림'.
 */
const readPalette = () => {
  const st = getComputedStyle(document.documentElement)
  const fg = toRgb(st.getPropertyValue('--text').trim() || '#000')
  const bg = toRgb(st.getPropertyValue('--bg').trim() || '#fff')
  const mix = (t) =>
    `rgb(${Math.round(fg[0] * t + bg[0] * (1 - t))},${Math.round(fg[1] * t + bg[1] * (1 - t))},${Math.round(fg[2] * t + bg[2] * (1 - t))})`
  // 옅은 결 -> 중간 -> 진한 덩어리
  return ['', mix(0.16), mix(0.4), mix(0.72), mix(1)]
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
  engine.setPalette(readPalette())
  engine.seedRandom(SEED_DENSITY)
  engine.setTarget(painter, dither === true, LEVELS)

  // 모션을 줄이도록 설정한 사용자에게는 애니메이션 없이 결과만 보여준다
  if (reduceMotion) {
    for (let i = 0; i < 240; i++) {
      engine.step()
      engine.applyLock(i / 239)
    }
    engine.applyLock(1)
    engine.clearUnlocked()
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
      engine.clearUnlocked() // 잔해를 걷어내 구름만 남긴다
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
    palette: readPalette(),
    liveLevel: 2, // 라이프 잔해는 중간 밝기로
  })

  window.addEventListener('resize', onResize)
  document.addEventListener('click', onClick)
  document.addEventListener('visibilitychange', onVisibility)

  themeObserver = new MutationObserver(() => {
    engine.setPalette(readPalette())
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
