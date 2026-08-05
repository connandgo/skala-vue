<script setup>
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

/**
 * 배경: 구름 사진을 8x8 Bayer 디더링한 하프톤 + 콘웨이의 라이프 게임.
 *
 * 흐름
 *   무작위 노이즈에서 시작 -> 라이프 규칙으로 꿈틀거림
 *   -> 사진의 픽셀이 랜덤 순서로 하나씩 "잠김"
 *   -> 3초 뒤 사진과 정확히 일치한 채로 정지 (이후 CPU 사용 0)
 *
 * 사진 출처: Wikimedia Commons "Cloudscape, 2022-06-22, 01 bw.jpg" (CC0)
 *
 * 중요한 점
 *   화면을 빈틈없이 칠한다. 밝은 픽셀도 사각형으로 그려야 인쇄물 같은 질감이 나온다.
 *   켜진 칸만 반투명으로 찍으면 성긴 점만 흩어져 보인다.
 */

const PX = 4 // 도트 한 칸 크기
// 하늘(점이 성긴 곳)은 진한 회색, 아래로 갈수록 검정에 가까워진다
const SKY_TOP = '#8a8a8a'
const SKY_BOTTOM = '#565656'
const EDGE = '#2b2b2b' // 구름 윤곽선
const LIGHT = '#ffffff'
// 흐린 값보다 이만큼 어두운 칸을 구름 윤곽선으로 본다.
// 반경을 키우면 넓은 경계를, 임계값을 낮추면 더 많은 칸을 윤곽선으로 잡는다.
const EDGE_RADIUS = 4
const EDGE_THRESHOLD = 0.015
const GAIN = 1.15 // 사진 대비
const SHARPEN = 2.2 // 구름 윤곽 강조 세기 (0이면 원본 그대로)
const SHARPEN_RADIUS = 2
// 어두운 하늘이 완전 검정으로 뭉치지 않도록 명암 범위를 좁힌다.
// FLOOR가 0이면 가장 어두운 곳에 밝은 픽셀이 하나도 안 남아 새까맣게 보인다.
const FLOOR = 0.22
const CEIL = 0.94
const SRC = `${import.meta.env.BASE_URL}sky.jpg`

// 원본 사진은 왼쪽이 빈 하늘이다.
// 좌우를 뒤집은 사본을 살짝 어긋나게 겹쳐 왼쪽에도 구름을 만든다.
// (그냥 뒤집어 겹치면 완전 대칭이라 인위적으로 보인다)
const MIRROR_X = -0.16 // 가로로 밀 양 (화면 폭 비율)
const MIRROR_Y = 0.14 // 세로로 밀 양
const MIRROR_ZOOM = 0.82

/* ================================================================
   라우트별 그림
   - 홈은 구름 사진, 나머지는 도형을 톤(농담)으로 그린다
   - 배경 0.30 / 도형 0.95 정도로 그리면 사진과 같은 결이 나온다
   ================================================================ */
const BG_TONE = 0.3
const FG_TONE = 0.95

const SHAPES = {
  // 영화 - 필름 스트립이 화면을 가로로 관통
  movies: (ctx, c, r) => {
    const top = r * 0.28
    const hgt = r * 0.44
    const bar = hgt * 0.18

    ctx.fillStyle = tone(FG_TONE)
    ctx.fillRect(0, top, c, bar)
    ctx.fillRect(0, top + hgt - bar, c, bar)

    // 스프로킷 구멍 (띠를 뚫는다)
    ctx.fillStyle = tone(BG_TONE)
    const hw = c * 0.02
    const hh = bar * 0.5
    for (let x = c * 0.025; x < c; x += c * 0.07) {
      ctx.fillRect(x, top + bar * 0.25, hw, hh)
      ctx.fillRect(x, top + hgt - bar + bar * 0.25, hw, hh)
    }
  },

  // 코드 챌린지 - 중괄호를 좌우 끝으로 벌린다
  challenges: (ctx, c, r) => {
    ctx.fillStyle = tone(FG_TONE)
    ctx.font = `700 ${r * 0.66}px "IBM Plex Mono", monospace`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('{', c * 0.13, r * 0.5)
    ctx.fillText('}', c * 0.87, r * 0.5)
  },

  // 소개 - 로고 텍스트
  about: (ctx, c, r) => {
    ctx.fillStyle = tone(FG_TONE)
    ctx.font = `800 ${r * 0.26}px "IBM Plex Mono", monospace`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('SKALA', c * 0.5, r * 0.2)
    ctx.fillText('SKALA', c * 0.5, r * 0.82)
  },
}

/** 0~1 밝기를 회색 문자열로 */
const tone = (v) => {
  const g = Math.round(v * 255)
  return `rgb(${g},${g},${g})`
}

const resolveShape = (path) => {
  if (path.startsWith('/movies')) return SHAPES.movies
  if (path.startsWith('/challenges')) return SHAPES.challenges
  if (path.startsWith('/about')) return SHAPES.about
  return null // 그 외에는 구름 사진
}

// 등장 연출. false로 두면 애니메이션 없이 그림만 바로 나온다.
const ANIMATE = true
const DURATION = 1800 // 애니메이션 길이(ms)
// 세대 간격(ms). 짧을수록 점들이 빠르게 꿈틀거려 산만해진다.
const TICK = 220
// 초기 노이즈 밀도. 높으면 화면 전체가 지글거려 눈이 피로하다.
const SEED_DENSITY = 0.07

// 8x8 Bayer 행렬 - 밝기를 점의 밀도로 바꾸는 임계값 표
const BAYER8 = [
  [0, 32, 8, 40, 2, 34, 10, 42],
  [48, 16, 56, 24, 50, 18, 58, 26],
  [12, 44, 4, 36, 14, 46, 6, 38],
  [60, 28, 52, 20, 62, 30, 54, 22],
  [3, 35, 11, 43, 1, 33, 9, 41],
  [51, 19, 59, 27, 49, 17, 57, 25],
  [15, 47, 7, 39, 13, 45, 5, 37],
  [63, 31, 55, 23, 61, 29, 53, 21],
]

const canvasRef = ref(null)
const route = useRoute()
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

let image = null
let ctx = null
let cols = 0
let rows = 0
let w = 0
let h = 0

let grid = new Uint8Array(0)
let lockMap = new Uint8Array(0)
let lockOrder = new Float32Array(0)
let target = new Uint8Array(0)
let edgeMap = new Uint8Array(0)

let raf = null
let resizeTimer = null

/* ---------------------------------------------------------------- 사진 */

/** 사진 또는 도형에서 밝기 지도를 만들고 Bayer 디더링해 목표 그림을 만든다 */
const buildTarget = () => {
  const off = document.createElement('canvas')
  off.width = cols
  off.height = rows
  const octx = off.getContext('2d', { willReadFrequently: true })

  const painter = resolveShape(route.path)
  if (painter) {
    // 배경에 옅은 세로 그라디언트를 깔아 밋밋하지 않게 한다
    const g = octx.createLinearGradient(0, 0, 0, rows)
    g.addColorStop(0, tone(BG_TONE + 0.06))
    g.addColorStop(1, tone(BG_TONE - 0.06))
    octx.fillStyle = g
    octx.fillRect(0, 0, cols, rows)
    painter(octx, cols, rows)
  } else {
    drawPhoto(octx)
  }

  finishTarget(octx)
  return
}

/** 구름 사진을 좌우 반전본과 함께 그린다 */
const drawPhoto = (octx) => {

  // background-size: cover 와 같은 방식으로 화면을 채운다
  const scale = Math.max(cols / image.width, rows / image.height)
  const dw = image.width * scale
  const dh = image.height * scale
  octx.drawImage(image, (cols - dw) / 2, (rows - dh) / 2, dw, dh)

  // 좌우 반전 사본을 겹친다. 'lighten'이라 두 장 중 밝은 쪽만 남아
  // 구름끼리 자연스럽게 이어지고 어두운 하늘은 덮이지 않는다.
  const mw = dw * MIRROR_ZOOM
  const mh = dh * MIRROR_ZOOM
  const mx = (cols - mw) / 2 + MIRROR_X * cols
  const my = (rows - mh) / 2 + MIRROR_Y * rows

  octx.globalCompositeOperation = 'lighten'
  octx.save()
  octx.translate(mx + mw, my)
  octx.scale(-1, 1) // 가로 뒤집기
  octx.drawImage(image, 0, 0, mw, mh)
  octx.restore()
  octx.globalCompositeOperation = 'source-over'
}

/** 밝기 지도를 다듬어 디더링한다 (사진/도형 공통) */
const finishTarget = (octx) => {
  const data = octx.getImageData(0, 0, cols, rows).data

  // 밝기만 뽑아 둔다
  const lum = new Float32Array(cols * rows)
  for (let i = 0; i < lum.length; i++) {
    const p = i * 4
    lum[i] = (data[p] * 0.299 + data[p + 1] * 0.587 + data[p + 2] * 0.114) / 255
  }

  // 언샵 마스크: 흐린 버전을 빼서 구름 윤곽을 도드라지게 한다.
  // 이 처리가 없으면 농담만 남아 구름 경계가 뭉개져 보인다.
  const edgeBlur = boxBlur(lum, cols, rows, EDGE_RADIUS)
  const sharpened = unsharpMask(lum, cols, rows, SHARPEN_RADIUS, SHARPEN)

  target = new Uint8Array(cols * rows)
  edgeMap = new Uint8Array(cols * rows)
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const idx = y * cols + x
      let v = (sharpened[idx] - 0.5) * GAIN + 0.5
      v = v < 0 ? 0 : v > 1 ? 1 : v
      v = FLOOR + v * (CEIL - FLOOR) // 완전한 검정/흰색을 없애 결을 남긴다

      // 밝기가 이 칸의 임계값을 넘으면 밝은 픽셀
      target[idx] = v > (BAYER8[y & 7][x & 7] + 0.5) / 64 ? 1 : 0

      // 흐린 값보다 크게 어두운 칸 = 구름 경계의 그늘. 여기만 검정으로 칠한다.
      edgeMap[idx] = lum[idx] - edgeBlur[idx] < -EDGE_THRESHOLD ? 1 : 0
    }
  }
}

/** 가로/세로로 나눠 처리하는 박스 블러 (한 번에 훑어 빠르다) */
const boxBlur = (src, cw, ch, radius) => {
  const tmp = new Float32Array(src.length)
  const out = new Float32Array(src.length)
  const span = radius * 2 + 1

  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      let sum = 0
      for (let d = -radius; d <= radius; d++) {
        const nx = Math.min(cw - 1, Math.max(0, x + d))
        sum += src[y * cw + nx]
      }
      tmp[y * cw + x] = sum / span
    }
  }
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      let sum = 0
      for (let d = -radius; d <= radius; d++) {
        const ny = Math.min(ch - 1, Math.max(0, y + d))
        sum += tmp[ny * cw + x]
      }
      out[y * cw + x] = sum / span
    }
  }
  return out
}

/** 원본에서 흐린 버전을 뺀 차이를 되더해 가장자리를 세운다 */
const unsharpMask = (src, cw, ch, radius, amount) => {
  if (amount <= 0) return src
  const blurred = boxBlur(src, cw, ch, radius)
  const out = new Float32Array(src.length)
  for (let i = 0; i < src.length; i++) {
    const v = src[i] + amount * (src[i] - blurred[i])
    out[i] = v < 0 ? 0 : v > 1 ? 1 : v
  }
  return out
}

/* ---------------------------------------------------------------- 규칙 */

/**
 * 한 세대 진행 (B3/S23)
 *
 * 잠긴 칸은 규칙을 적용하지 않고 그대로 1로 남긴다.
 * 이 처리가 없으면 완성된 사진도 이웃 수에 따라 곧바로 무너진다.
 * 가장자리는 토러스로 이어 붙여 경계에서 패턴이 죽지 않게 한다.
 */
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
          const ny = (y + dy + rows) % rows
          const nx = (x + dx + cols) % cols
          n += grid[ny * cols + nx]
        }
      }

      next[idx] = grid[idx] ? (n === 2 || n === 3 ? 1 : 0) : n === 3 ? 1 : 0
    }
  }
  grid = next
}

/**
 * 사진을 progress(0~1)만큼 잠근다.
 *
 * lockOrder는 칸마다 다른 난수라, progress가 커질수록
 * 랜덤한 위치부터 하나씩 굳는다. 그래서 사진이 한꺼번에 나타나지 않고
 * 흩뿌려지듯 채워진다.
 */
const applyLock = (progress) => {
  for (let i = 0; i < target.length; i++) {
    if (target[i] === 1 && lockOrder[i] < progress) {
      lockMap[i] = 1
      grid[i] = 1
    }
  }
}

/* ---------------------------------------------------------------- 렌더 */

const render = () => {
  // 1) 바탕: 위는 진한 회색, 아래로 갈수록 검정
  const sky = ctx.createLinearGradient(0, 0, 0, h)
  sky.addColorStop(0, SKY_TOP)
  sky.addColorStop(1, SKY_BOTTOM)
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, w, h)

  // 2) 구름 윤곽선만 검정으로 (같은 색끼리 모아 칠해야 빠르다)
  ctx.fillStyle = EDGE
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const idx = y * cols + x
      if (edgeMap[idx] && !(lockMap[idx] || grid[idx])) {
        ctx.fillRect(x * PX, y * PX, PX, PX)
      }
    }
  }

  // 3) 밝은 픽셀
  ctx.fillStyle = LIGHT
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const idx = y * cols + x
      if (lockMap[idx] || grid[idx]) {
        ctx.fillRect(x * PX, y * PX, PX, PX)
      }
    }
  }
}

// 초반에 빠르게 채워지고 끝에서 부드럽게 멎는다.
// 가운데가 느린 곡선(easeInOut)을 쓰면 노이즈만 오래 보여 조잡해진다.
const easeOutCubic = (p) => 1 - Math.pow(1 - p, 3)

const stop = () => {
  if (raf) cancelAnimationFrame(raf)
  raf = null
}

/** 정지 시점에는 사진과 정확히 일치시킨다 (라이프 잔해 제거) */
const settle = () => {
  applyLock(1)
  grid.set(target)
  render()
  stop()
}

const start = () => {
  const canvas = canvasRef.value
  if (!canvas || !image) return
  stop()

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

  // 모션을 줄이도록 설정한 사용자에게는 애니메이션 없이 결과만 보여준다
  if (reduceMotion || !ANIMATE) {
    settle()
    return
  }

  for (let i = 0; i < grid.length; i++) {
    grid[i] = Math.random() < SEED_DENSITY ? 1 : 0
  }

  const startedAt = performance.now()
  let lastTick = 0

  const loop = (now) => {
    const elapsed = now - startedAt
    if (elapsed >= DURATION) {
      settle() // rAF까지 멈춘다. 이후 CPU 사용 0
      return
    }
    if (now - lastTick >= TICK) {
      lastTick = now
      step()
      applyLock(easeOutCubic(elapsed / DURATION))
      render()
    }
    raf = requestAnimationFrame(loop)
  }
  raf = requestAnimationFrame(loop)
}

const onResize = () => {
  clearTimeout(resizeTimer)
  resizeTimer = setTimeout(start, 200)
}

const onVisibility = () => {
  if (document.hidden) settle()
}

onMounted(() => {
  image = new Image()
  image.onload = start
  // 사진을 못 불러오면 배경 없이 둔다 (화면이 깨지지는 않는다)
  image.onerror = () => console.warn('[배경] 구름 이미지를 불러오지 못했습니다:', SRC)
  image.src = SRC

  window.addEventListener('resize', onResize)
  document.addEventListener('visibilitychange', onVisibility)

  // 라우트가 바뀌면 그림을 새로 만들고 애니메이션을 다시 돌린다
  watch(() => route.path, start)
})

onUnmounted(() => {
  stop()
  clearTimeout(resizeTimer)
  window.removeEventListener('resize', onResize)
  document.removeEventListener('visibilitychange', onVisibility)
  if (image) image.onload = null
})
</script>

<template>
  <div class="shader-bg" aria-hidden="true">
    <canvas ref="canvasRef"></canvas>
  </div>
</template>

<style scoped>
.shader-bg {
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
}

.shader-bg canvas {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
