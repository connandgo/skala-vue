<script setup>
import { onMounted, onUnmounted, ref } from 'vue'

/**
 * 콘웨이의 라이프 게임 데모.
 *
 * 소개 페이지에서 배경이 어떤 규칙으로 그려지는지 직접 보여 주려고 둔다.
 * 글로만 "라이프 게임을 씁니다"라고 하면 무슨 말인지 와닿지 않는다.
 *
 * 배경(DitherBackdrop)은 목표 그림으로 수렴시키고 멈추지만,
 * 여기서는 규칙만 계속 돌려 규칙 자체가 보이게 한다.
 */

const CELL = 4 // 한 칸의 화면 크기(px)
const FPS = 8 // 세대를 넘기는 속도. 너무 빠르면 무엇이 변했는지 안 보인다.
const DENSITY = 0.32 // 처음 살아 있는 칸의 비율

const canvasRef = ref(null)
const generation = ref(0)

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

let cols = 0
let rows = 0
let cells = null
let scratch = null
let ctx = null
let timer = null
let io = null
let ro = null

/** 무작위로 씨를 뿌린다 */
const seed = () => {
  for (let i = 0; i < cells.length; i++) {
    cells[i] = Math.random() < DENSITY ? 1 : 0
  }
  generation.value = 0
}

/**
 * 칸 수는 캔버스의 실제 크기에서 정한다.
 * 화면 픽셀비(devicePixelRatio)를 곱해 둬야 고해상도 화면에서 점이 흐려지지 않는다.
 */
const layout = () => {
  const canvas = canvasRef.value
  if (!canvas) return false

  const width = canvas.clientWidth
  const height = canvas.clientHeight
  if (!width || !height) return false

  const nextCols = Math.floor(width / CELL)
  const nextRows = Math.floor(height / CELL)
  // 칸 수가 그대로면 다시 뿌리지 않는다 (창을 조금 줄일 때마다 초기화되면 거슬린다)
  if (nextCols === cols && nextRows === rows) return false

  cols = nextCols
  rows = nextRows

  const dpr = window.devicePixelRatio || 1
  canvas.width = width * dpr
  canvas.height = height * dpr
  ctx = canvas.getContext('2d')
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

  cells = new Uint8Array(cols * rows)
  scratch = new Uint8Array(cols * rows)
  seed()
  return true
}

/**
 * 한 세대를 넘긴다.
 *
 * 규칙
 *   살아 있는 칸은 이웃이 2 또는 3이면 살아남는다
 *   죽어 있는 칸은 이웃이 정확히 3이면 태어난다
 *
 * 가장자리는 반대편으로 이어 붙인다. 그러지 않으면 패턴이 벽에 닿아 죽어 버린다.
 */
const step = () => {
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      let neighbors = 0

      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue
          const nx = (x + dx + cols) % cols
          const ny = (y + dy + rows) % rows
          neighbors += cells[ny * cols + nx]
        }
      }

      const alive = cells[y * cols + x]
      scratch[y * cols + x] = neighbors === 3 || (alive && neighbors === 2) ? 1 : 0
    }
  }

  cells.set(scratch)
  generation.value++
}

/** 살아 있는 칸만 찍는다. 색은 CSS의 color를 그대로 받아 테마를 따라간다. */
const draw = () => {
  if (!ctx) return

  ctx.clearRect(0, 0, cols * CELL, rows * CELL)
  ctx.fillStyle = getComputedStyle(canvasRef.value).color

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (!cells[y * cols + x]) continue
      // 1px을 남겨 칸 사이가 붙지 않게 한다
      ctx.fillRect(x * CELL, y * CELL, CELL - 1, CELL - 1)
    }
  }
}

const start = () => {
  if (timer || reduceMotion) return
  timer = setInterval(() => {
    step()
    draw()
  }, 1000 / FPS)
}

const stop = () => {
  clearInterval(timer)
  timer = null
}

/** 버튼 - 판을 비우고 다시 뿌린다 */
const reset = () => {
  if (!cells) return
  seed()
  draw()
}

onMounted(() => {
  if (!layout()) return
  draw()

  // 화면 밖으로 나가면 멈춘다. 안 보이는 것을 계산할 이유가 없다.
  io = new IntersectionObserver(
    ([entry]) => (entry.isIntersecting ? start() : stop()),
    { threshold: 0 },
  )
  io.observe(canvasRef.value)

  // 창 크기가 바뀌어 칸 수가 달라지면 판을 다시 잡는다
  ro = new ResizeObserver(() => {
    if (layout()) draw()
  })
  ro.observe(canvasRef.value)
})

onUnmounted(() => {
  stop()
  io?.disconnect()
  ro?.disconnect()
})
</script>

<template>
  <figure class="life">
    <canvas ref="canvasRef" class="life-canvas" aria-hidden="true"></canvas>

    <figcaption class="life-bar">
      <span class="life-gen">{{ generation }}세대</span>
      <button type="button" class="life-btn" @click="reset">다시 뿌리기</button>
    </figcaption>
  </figure>
</template>

<style scoped>
.life {
  margin: 0 0 14px;
  border: 1px solid var(--border);
  background: var(--bg-subtle);
}

.life-canvas {
  display: block;
  width: 100%;
  height: 116px;
  /* 캔버스가 이 색을 읽어 점을 찍는다 (다크 모드에서도 알아서 뒤집힌다) */
  color: var(--text-muted);
}

.life-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  border-top: 1px solid var(--border);
  font-family: var(--font-mono);
  font-size: 0.68rem;
  color: var(--text-muted);
}

.life-btn {
  margin: 0;
  padding: 2px 8px;
  border: 1px solid var(--border);
  background: var(--bg);
  font-family: var(--font-mono);
  font-size: 0.68rem;
  color: var(--text-muted);
}

.life-btn:hover {
  border-color: var(--hover-border);
  color: var(--text);
}
</style>
