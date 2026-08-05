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
  // 영화 - 영사기가 빛을 쏜다.
  // 위쪽에 필름 띠가 비스듬히 지나가고, 왼쪽 아래 영사기에서
  // 가는 빛줄기가 오른쪽으로 뻗으며 서서히 옅어진다.
  // (스크린을 밝은 면으로 깔면 오른쪽 절반이 통째로 하얘져서 넣지 않는다)
  movies: (ctx, c, r) => {
    const ink = tone(FG_TONE)

    /* -------- 빛줄기 -------- */
    // 렌즈 끝에서 스크린 네 귀퉁이로 퍼진다
    const lensX = c * 0.2
    const lensY = r * 0.79
    const beam = ctx.createLinearGradient(lensX, lensY, c, lensY)
    beam.addColorStop(0, tone(1))
    beam.addColorStop(0.5, tone(0.88))
    beam.addColorStop(1, tone(BG_TONE))
    ctx.fillStyle = beam
    ctx.beginPath()
    ctx.moveTo(lensX, lensY)
    ctx.lineTo(c, r * 0.42)
    ctx.lineTo(c, r * 0.78)
    ctx.closePath()
    ctx.fill()

    /* -------- 필름 띠 (구불구불 흐른다) -------- */
    const bandH = r * 0.24
    const rail = bandH * 0.2

    /** 가로 위치(0~1)에 따른 띠의 세로 위치 */
    const filmY = (t) => r * (0.17 + Math.sin(t * Math.PI * 1.7 - 0.4) * 0.07 - t * 0.02)
    /** 그 지점의 기울기 (구멍과 칸을 띠와 나란히 눕히는 데 쓴다) */
    const filmSlope = (t) => {
      const d = 0.004
      return (filmY(t + d) - filmY(t - d)) / (d * 2 * c)
    }

    // 위 모서리를 따라가고, 아래 모서리를 되짚어 와서 면을 닫는다
    ctx.fillStyle = tone(0.55)
    ctx.beginPath()
    for (let t = -0.06; t <= 1.06; t += 0.02) ctx.lineTo(t * c, filmY(t))
    for (let t = 1.06; t >= -0.06; t -= 0.02) ctx.lineTo(t * c, filmY(t) + bandH)
    ctx.closePath()
    ctx.fill()

    /** 띠 위의 한 지점에 눕혀서 그린다 */
    const onFilm = (t, draw) => {
      ctx.save()
      ctx.translate(t * c, filmY(t))
      ctx.rotate(Math.atan(filmSlope(t)))
      draw()
      ctx.restore()
    }

    // 위아래 레일의 스프로킷 구멍
    ctx.fillStyle = tone(BG_TONE - 0.08)
    const hw = c * 0.02
    const hh = rail * 0.6
    for (let t = -0.05; t < 1.05; t += 0.036) {
      onFilm(t, () => {
        ctx.fillRect(0, rail * 0.2, hw, hh)
        ctx.fillRect(0, bandH - rail * 0.8, hw, hh)
      })
    }

    // 가운데 화면 칸
    ctx.fillStyle = tone(0.38)
    for (let t = -0.04; t < 1.05; t += 0.108) {
      onFilm(t, () => ctx.fillRect(0, rail * 1.35, c * 0.092, bandH - rail * 2.7))
    }

    /* -------- 영사기 -------- */
    const R = r * 0.1 // 릴 반지름

    /** 살이 들어간 릴 */
    const reel = (x, y) => {
      ctx.fillStyle = ink
      ctx.beginPath()
      ctx.arc(x, y, R, 0, Math.PI * 2)
      ctx.fill()

      // 살 사이를 파낸다
      ctx.fillStyle = tone(BG_TONE)
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + 0.3
        ctx.beginPath()
        ctx.arc(x + Math.cos(a) * R * 0.55, y + Math.sin(a) * R * 0.55, R * 0.26, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.fillStyle = ink
      ctx.beginPath()
      ctx.arc(x, y, R * 0.16, 0, Math.PI * 2)
      ctx.fill()
    }

    const bx = c * 0.055 // 몸통 왼쪽
    const by = r * 0.7 // 몸통 위
    const bw = c * 0.11
    const bh = r * 0.2

    reel(bx + bw * 0.22, by - R * 0.75)
    reel(bx + bw * 0.78, by - R * 0.95)

    ctx.fillStyle = ink
    ctx.fillRect(bx, by, bw, bh) // 몸통
    ctx.fillRect(bx + bw, by + bh * 0.18, c * 0.045, bh * 0.42) // 렌즈
    ctx.fillRect(bx - c * 0.012, by + bh * 0.3, c * 0.018, bh * 0.34) // 뒤쪽 손잡이

    // 다리
    ctx.fillRect(bx + bw * 0.42, by + bh, c * 0.012, r * 0.07)
    ctx.fillRect(bx + bw * 0.12, by + bh + r * 0.06, bw * 0.7, r * 0.014)
  },

  // 디자인 이펙트 - 흐르는 물결과 기하 요소.
  //
  // 원본 그림의 규칙
  //   왼쪽 위와 아래쪽에 물결이 여러 겹 겹친다.
  //   바깥으로 멀리 뻗은 겹일수록 옅고, 가장자리에 붙은 겹일수록 진하다.
  //   그래서 큰 것부터 그리고 작고 진한 것을 위에 덮는다.
  effects: (ctx, c, r) => {
    /** 곡선 위쪽(또는 아래쪽)을 채운다 */
    const fillCurve = (pts, v, closeTo) => {
      ctx.fillStyle = tone(v)
      ctx.beginPath()
      ctx.moveTo(pts[0][0] * c, pts[0][1] * r)
      for (let i = 1; i + 1 < pts.length; i += 2) {
        ctx.quadraticCurveTo(pts[i][0] * c, pts[i][1] * r, pts[i + 1][0] * c, pts[i + 1][1] * r)
      }
      // 화면 밖 모서리로 닫아 면을 만든다
      closeTo.forEach(([x, y]) => ctx.lineTo(x * c, y * r))
      ctx.closePath()
      ctx.fill()
    }

    /* ---------------- 왼쪽 위 물결 ---------------- */
    // 위 모서리와 왼쪽 모서리로 닫는다
    fillCurve(
      [[0, 0.58], [0.16, 0.5], [0.3, 0.3], [0.46, 0.12], [0.62, 0.02]],
      0.86,
      [[0.62, 0], [0, 0]],
    )
    fillCurve(
      [[0, 0.44], [0.1, 0.4], [0.2, 0.24], [0.32, 0.1], [0.44, 0.02]],
      0.7,
      [[0.44, 0], [0, 0]],
    )
    fillCurve(
      [[0, 0.28], [0.06, 0.24], [0.12, 0.14], [0.2, 0.06], [0.28, 0]],
      0.5,
      [[0, 0]],
    )

    /* ---------------- 아래 물결 ---------------- */
    // 아래 모서리로 닫는다. 화면 폭 전체를 가로지른다.
    fillCurve(
      [[0, 0.88], [0.2, 0.82], [0.42, 0.86], [0.7, 0.9], [1, 0.6]],
      0.86,
      [[1, 1], [0, 1]],
    )
    fillCurve(
      [[0, 0.98], [0.24, 0.92], [0.46, 0.95], [0.74, 0.98], [1, 0.72]],
      0.7,
      [[1, 1], [0, 1]],
    )
    fillCurve(
      [[0.3, 1], [0.5, 0.98], [0.68, 1], [0.86, 1.02], [1, 0.86]],
      0.5,
      [[1, 1]],
    )

    /* ---------------- 기하 요소 ---------------- */
    const ink = tone(FG_TONE)
    const thin = Math.max(1, r * 0.005)
    const u = r * 0.01

    /** 빗금 친 원 (테두리 없이 안쪽만) */
    const hatched = (x, y, R) => {
      ctx.save()
      ctx.beginPath()
      ctx.arc(x, y, R, 0, Math.PI * 2)
      ctx.clip()
      ctx.strokeStyle = ink
      ctx.lineWidth = thin
      for (let d = -R * 2; d < R * 2; d += R * 0.24) {
        ctx.beginPath()
        ctx.moveTo(x + d, y + R)
        ctx.lineTo(x + d + R * 2, y - R)
        ctx.stroke()
      }
      ctx.restore()
    }

    /** 점선 테두리 원 */
    const dotted = (x, y, R) => {
      ctx.strokeStyle = ink
      ctx.lineWidth = thin
      ctx.setLineDash([thin * 1.6, thin * 3])
      ctx.beginPath()
      ctx.arc(x, y, R, 0, Math.PI * 2)
      ctx.stroke()
      ctx.setLineDash([])
    }

    /** 점 격자 */
    const dots = (x, y, n = 5) => {
      ctx.fillStyle = ink
      const gap = u * 1.5
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) ctx.fillRect(x + i * gap, y + j * gap, thin * 1.4, thin * 1.4)
      }
    }

    const plus = (x, y, size) => {
      ctx.fillStyle = ink
      ctx.fillRect(x - size, y - thin / 2, size * 2, thin)
      ctx.fillRect(x - thin / 2, y - size, thin, size * 2)
    }

    /** 나란한 사선 두 줄 */
    const slashes = (x, y, len) => {
      ctx.strokeStyle = ink
      ctx.lineWidth = thin
      for (const off of [0, u * 2]) {
        ctx.beginPath()
        ctx.moveTo(x + off, y + len)
        ctx.lineTo(x + off + len, y)
        ctx.stroke()
      }
    }

    const disc = (x, y, R) => {
      ctx.fillStyle = ink
      ctx.beginPath()
      ctx.arc(x, y, R, 0, Math.PI * 2)
      ctx.fill()
    }

    // 원본 그림의 배치를 따르되, 카드가 덮는 가운데는 피한다
    hatched(c * 0.82, r * 0.1, u * 4.5) // 오른쪽 위 빗금 원
    dotted(c * 0.9, r * 0.3, u * 5) // 그 아래 점선 원
    disc(c * 0.9, r * 0.3, u * 3.4) // 점선 원 안의 채운 원
    dots(c * 0.95, r * 0.16) // 오른쪽 위 점 격자
    dots(c * 0.03, r * 0.72) // 왼쪽 아래 점 격자
    hatched(c * 0.13, r * 0.56, u * 5) // 왼쪽 빗금 원
    dotted(c * 0.13, r * 0.56, u * 5)
    disc(c * 0.55, r * 0.09, u * 1.6)
    disc(c * 0.7, r * 0.5, u * 1.1)
    plus(c * 0.24, r * 0.14, u * 1.5)
    plus(c * 0.78, r * 0.66, u * 1.5)
    plus(c * 0.86, r * 0.78, u * 1.2)
    slashes(c * 0.58, r * 0.03, u * 4.5) // 위쪽 사선
    slashes(c * 0.22, r * 0.88, u * 4.5) // 아래쪽 사선
  },

  // 뉴스 - 경위선이 그어진 지구본.
  // 왼쪽 끝에 반쯤 걸치게 둔다. 카드가 덮는 가운데를 피하면서
  // 격자와 구면 음영이 디더링과 잘 맞는다.
  news: (ctx, c, r) => {
    const R = Math.min(r * 0.46, c * 0.3)
    const cx = c * 0.06 // 왼쪽으로 밀어 일부를 화면 밖으로
    const cy = r * 0.5
    const line = Math.max(1, r * 0.004)

    // 구면 음영. 빛은 오른쪽 위에서 든다.
    const g = ctx.createRadialGradient(cx + R * 0.45, cy - R * 0.4, R * 0.05, cx, cy, R)
    g.addColorStop(0, tone(0.92))
    g.addColorStop(0.5, tone(0.6))
    g.addColorStop(1, tone(0.16))
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(cx, cy, R, 0, Math.PI * 2)
    ctx.fill()

    // 구 밖으로 선이 삐져나가지 않게 잘라 낸다
    ctx.save()
    ctx.beginPath()
    ctx.arc(cx, cy, R, 0, Math.PI * 2)
    ctx.clip()

    ctx.strokeStyle = tone(FG_TONE)
    ctx.lineWidth = line

    // 위도선: 높이만 눌러 그린 타원
    for (let i = -3; i <= 3; i++) {
      const y = cy + (i / 4) * R
      // 그 높이에서 구를 자른 단면의 반지름
      const rx = Math.sqrt(Math.max(0, R * R - (y - cy) ** 2))
      ctx.beginPath()
      ctx.ellipse(cx, y, rx, rx * 0.22, 0, 0, Math.PI * 2)
      ctx.stroke()
    }

    // 경도선: 폭만 줄인 타원. 가장자리로 갈수록 납작해진다.
    for (let i = 0; i < 6; i++) {
      const rx = R * Math.cos((i / 6) * Math.PI)
      ctx.beginPath()
      ctx.ellipse(cx, cy, Math.abs(rx), R, 0, 0, Math.PI * 2)
      ctx.stroke()
    }

    ctx.restore()

    // 오른쪽 위 가장자리의 광원
    const flare = ctx.createRadialGradient(
      cx + R * 0.72, cy - R * 0.62, 0,
      cx + R * 0.72, cy - R * 0.62, R * 0.3,
    )
    flare.addColorStop(0, tone(1))
    flare.addColorStop(1, tone(BG_TONE))
    ctx.globalCompositeOperation = 'lighten'
    ctx.fillStyle = flare
    ctx.fillRect(cx, cy - R, R * 1.1, R)
    ctx.globalCompositeOperation = 'source-over'

    /* -------- 오른쪽으로 뻗는 전파 -------- */
    // 지구본에서 소식이 퍼져 나가는 결. 오른쪽이 비어 보이지 않게 채운다.
    // 길이와 두께를 제각각 두어야 규칙적인 줄무늬로 보이지 않는다.
    const streaks = [
      // [세로 위치, 시작 x, 끝 x, 두께 배수, 밝기]
      [0.12, 0.55, 1.02, 1.6, 0.92],
      [0.2, 0.72, 1.02, 0.9, 0.6],
      [0.28, 0.4, 0.98, 2.4, 1],
      [0.35, 0.78, 1.02, 0.8, 0.5],
      [0.44, 0.6, 1.02, 1.2, 0.78],
      [0.56, 0.34, 1.02, 3, 1],
      [0.63, 0.8, 1.0, 0.8, 0.55],
      [0.71, 0.52, 1.02, 1.4, 0.85],
      [0.8, 0.68, 1.02, 1, 0.66],
      [0.9, 0.45, 1.02, 2, 0.95],
    ]

    ctx.globalCompositeOperation = 'lighten'
    for (const [y, x0, x1, weight, bright] of streaks) {
      const thick = Math.max(1, r * 0.006 * weight)
      // 왼쪽 끝은 배경에 녹고 오른쪽으로 갈수록 밝아진다
      const g2 = ctx.createLinearGradient(x0 * c, 0, x1 * c, 0)
      g2.addColorStop(0, tone(BG_TONE))
      g2.addColorStop(0.65, tone(BG_TONE + (bright - BG_TONE) * 0.5))
      g2.addColorStop(1, tone(bright))
      ctx.fillStyle = g2
      ctx.fillRect(x0 * c, y * r, (x1 - x0) * c, thick)
    }
    ctx.globalCompositeOperation = 'source-over'
  },

  // 소개(메인) - 셸 프롬프트.
  // 가운데는 콘텐츠 카드가 덮으므로, 좌우 여백으로 밀어내야 보인다.
  about: (ctx, c, r) => {
    ctx.fillStyle = tone(FG_TONE)
    ctx.font = `700 ${r * 0.66}px "IBM Plex Mono", monospace`
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'left'
    ctx.fillText('>', c * -0.015, r * 0.5)

    // 커서. '_' 글자는 글자 박스 바닥에 붙어 힘없이 보여서 사각형으로 그린다.
    const cw = r * 0.17
    const ch = r * 0.34
    ctx.fillRect(c - cw * 0.72, (r - ch) / 2, cw, ch)
  },
}

/** 0~1 밝기를 회색 문자열로 */
const tone = (v) => {
  const g = Math.round(v * 255)
  return `rgb(${g},${g},${g})`
}

const resolveShape = (path) => {
  if (path.startsWith('/movies')) return SHAPES.movies
  if (path.startsWith('/effects')) return SHAPES.effects
  if (path.startsWith('/news')) return SHAPES.news
  if (path === '/') return SHAPES.about // 메인(소개)
  return null // 날씨 페이지는 구름 사진
}

// 등장 연출. false로 두면 애니메이션 없이 그림만 바로 나온다.
const ANIMATE = true
const DURATION = 1100 // 애니메이션 길이(ms)
// 세대 간격(ms). 짧을수록 점들이 빠르게 꿈틀거려 산만해진다.
// 다만 너무 크면 프레임 수가 모자라 뚝뚝 끊긴다. (길이 ÷ 이 값 = 프레임 수)
const TICK = 220
// 초기 노이즈 밀도.
// 배경 점 밀도와 비슷하게 채워야 처음엔 '균일한 결'로만 보이고 형태가 드러나지 않는다.
// 라이프 규칙이 몇 세대 만에 이 노이즈를 알아서 솎아낸다.
const SEED_DENSITY = 0.42
// 마무리 구간 시작 지점(0~1).
// 이 지점부터 남은 잔해를 조금씩 지워, 정지 순간에 툭 끊기지 않게 한다.
const CLEANUP_FROM = 0.55

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
// 지금까지 드러난 비율. 윤곽선도 이 값에 맞춰 서서히 나타난다.
let revealed = 0
// 한 번 스러진 잔해는 다시 살아나지 않도록 표시해 둔다
let deadMask = new Uint8Array(0)

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
      // 마무리 구간에서 스러진 칸은 다시 살아나지 않는다
      if (deadMask[idx]) {
        next[idx] = 0
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
  revealed = progress
  for (let i = 0; i < target.length; i++) {
    if (target[i] === 1 && lockOrder[i] < progress) {
      lockMap[i] = 1
      grid[i] = 1
    }
  }
}

/**
 * 잠기지 않은 잔해를 progress만큼 스러지게 한다.
 * 잠금과 같은 난수 순서를 쓰므로 그림이 채워지는 결과 자연스럽게 이어진다.
 */
const applyCleanup = (progress) => {
  for (let i = 0; i < grid.length; i++) {
    if (!lockMap[i] && lockOrder[i] < progress) {
      deadMask[i] = 1
      grid[i] = 0
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
      // 윤곽선을 처음부터 다 그리면 형태가 미리 드러난다.
      // 밝은 점과 같은 순서로 서서히 나타나게 한다.
      if (edgeMap[idx] && lockOrder[idx] < revealed && !(lockMap[idx] || grid[idx])) {
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

// 처음엔 거의 잠기지 않다가 중반부터 빠르게 채워진다.
// 초반에 바로 채우면 형태가 처음부터 드러나 '이미 정해진 그림'처럼 보인다.
const easeInOutCubic = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2)

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
  deadMask = new Uint8Array(cols * rows)
  revealed = 0

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
      const t = elapsed / DURATION
      step()
      applyLock(easeInOutCubic(t))
      // 후반부터 잔해를 서서히 걷어낸다
      if (t > CLEANUP_FROM) {
        applyCleanup(easeInOutCubic((t - CLEANUP_FROM) / (1 - CLEANUP_FROM)))
      }
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
