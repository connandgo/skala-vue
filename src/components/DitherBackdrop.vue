<script setup>
import { onMounted, onUnmounted, ref } from 'vue'

const canvasRef = ref(null)

// 8x8 Bayer 행렬 - 순서 디더링(ordered dithering)의 임계값 표
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

const PX = 4 // 도트 하나의 화면 크기(px)
const DOT = 70 // 도트 색(0=검정, 255=흰색) - 낮출수록 진해진다

// 중앙은 밝고 가장자리로 갈수록 어두워지는 비네트 (콘텐츠 카드를 감싸는 형태)
const GAMMA = 2.2
const DEPTH = 0.85

// 좌우 대칭을 깨서 자연스럽게 보이도록 하는 그늘 덩어리 [x, y, 반지름, 세기]
const BLOBS = [
  [0.18, 0.22, 0.45, 0.18],
  [0.85, 0.78, 0.5, 0.16],
  [0.72, 0.12, 0.35, 0.12],
]

const draw = () => {
  const canvas = canvasRef.value
  if (!canvas) return

  const w = window.innerWidth
  const h = window.innerHeight
  canvas.width = w
  canvas.height = h

  // 1) 저해상도 오프스크린에 명암 지도를 만든다
  const lw = Math.ceil(w / PX)
  const lh = Math.ceil(h / PX)
  const off = document.createElement('canvas')
  off.width = lw
  off.height = lh
  const octx = off.getContext('2d')

  const img = octx.createImageData(lw, lh)
  const d = img.data
  const cx0 = lw / 2
  const cy0 = lh / 2
  const maxD = Math.hypot(cx0, cy0)
  const maxSide = Math.max(lw, lh)

  for (let y = 0; y < lh; y++) {
    for (let x = 0; x < lw; x++) {
      // 중심에서 멀어질수록 어두워지는 밝기 값
      const dist = Math.hypot(x - cx0, y - cy0) / maxD
      let v = 1 - DEPTH * Math.pow(dist, GAMMA)

      // 그늘 덩어리를 빼서 대칭을 깬다
      for (const [bx, by, r, a] of BLOBS) {
        const bd = Math.hypot(x - bx * lw, y - by * lh) / (r * maxSide)
        if (bd < 1) v -= a * (1 - bd) ** 2
      }
      v = v < 0 ? 0 : v > 1 ? 1 : v

      // 2) Bayer 행렬 임계값과 비교해 흑/백 두 단계로 결정
      const threshold = (BAYER8[y & 7][x & 7] + 0.5) / 64
      const on = v > threshold ? 255 : DOT

      const i = (y * lw + x) * 4
      d[i] = d[i + 1] = d[i + 2] = on
      d[i + 3] = 255
    }
  }
  octx.putImageData(img, 0, 0)

  // 3) 확대해서 도트를 뚜렷하게 (부드럽게 늘어나지 않도록 보간 끄기)
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingEnabled = false
  ctx.clearRect(0, 0, w, h)
  ctx.drawImage(off, 0, 0, lw, lh, 0, 0, lw * PX, lh * PX)
}

// 창 크기가 자주 바뀔 때 과하게 다시 그리지 않도록 지연 실행
let timer = null
const onResize = () => {
  clearTimeout(timer)
  timer = setTimeout(draw, 150)
}

onMounted(() => {
  draw()
  window.addEventListener('resize', onResize)
})

// 컴포넌트가 사라질 때 이벤트를 반드시 정리한다 (메모리 누수 방지)
onUnmounted(() => {
  clearTimeout(timer)
  window.removeEventListener('resize', onResize)
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
