/**
 * 콘웨이의 라이프 게임 엔진
 *
 * Vue 반응성을 쓰지 않는 순수 JS다. 캔버스 하나를 받아 격자를 돌린다.
 *
 * 핵심 두 가지 (아래 step / applyLock 주석 참고)
 *  - lockMap  : 목표 그림에 해당하는 칸은 라이프 규칙에서 제외해 영원히 살려 둔다
 *  - lockOrder: 칸마다 랜덤 순서를 부여해, 그림이 한꺼번에가 아니라 흩뿌려지듯 채워지게 한다
 */

// 8x8 Bayer 행렬 - 순서 디더링의 임계값 표.
// 밝기를 점의 '밀도'로 바꿔 준다. (신문 사진 인쇄와 같은 방식)
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

const GLIDER = [
  [1, 0],
  [2, 1],
  [0, 2],
  [1, 2],
  [2, 2],
]

export function createLifeEngine(canvas, options = {}) {
  const ctx = canvas.getContext('2d')

  let cellSize = options.cellSize ?? 5
  let alpha = options.alpha ?? 0.16
  let colors = options.colors ?? { cell: '#000', lock: '#000' }
  // 0이면 칸을 꽉 채운다(하프톤 느낌). 0.42면 가운데가 뚫린 고리 모양.
  let holeRatio = options.holeRatio ?? 0

  let cols = 0
  let rows = 0
  let dpr = 1

  let grid = new Uint8Array(0)
  let lockMap = new Uint8Array(0)
  let lockOrder = new Float32Array(0)
  let target = null

  /* ---------------------------------------------------------------- 크기 */

  function resize() {
    // 고해상도 화면에서 캔버스가 과도하게 커지지 않도록 상한을 둔다
    dpr = Math.min(window.devicePixelRatio || 1, 2)

    const w = canvas.clientWidth || window.innerWidth
    const h = canvas.clientHeight || window.innerHeight

    canvas.width = Math.floor(w * dpr)
    canvas.height = Math.floor(h * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    cols = Math.ceil(w / cellSize)
    rows = Math.ceil(h / cellSize)

    grid = new Uint8Array(cols * rows)
    lockMap = new Uint8Array(cols * rows)
    lockOrder = new Float32Array(cols * rows)
    target = null
  }

  /* ---------------------------------------------------------------- 씨앗 */

  function seedRandom(density = 0.3) {
    for (let i = 0; i < grid.length; i++) {
      grid[i] = Math.random() < density ? 1 : 0
    }
    lockMap.fill(0)
  }

  /**
   * 그림을 격자로 변환한다.
   * painter가 cols x rows 크기의 캔버스에 아무 그림이나 그리면,
   * 불투명한 픽셀이 "살아있는 칸"이 된다.
   */
  function rasterize(painter, dither = false) {
    const off = document.createElement('canvas')
    off.width = cols
    off.height = rows
    const octx = off.getContext('2d', { willReadFrequently: true })

    octx.fillStyle = '#fff'
    octx.strokeStyle = '#fff'
    painter(octx, cols, rows)

    const data = octx.getImageData(0, 0, cols, rows).data
    const out = new Uint8Array(cols * rows)

    if (!dither) {
      // 글자·도형처럼 경계가 뚜렷해야 하는 그림은 임계값 하나로 자른다
      for (let i = 0; i < out.length; i++) {
        out[i] = data[i * 4 + 3] > 110 ? 1 : 0
      }
      return out
    }

    // 구름처럼 농담이 있는 그림은 Bayer 디더링으로 '점의 밀도'로 바꾼다.
    // 밝을수록 점이 촘촘해져 하프톤 인쇄물 같은 질감이 생긴다.
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = (y * cols + x) * 4
        const a = data[i + 3] / 255
        const lum = ((data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255) * a
        out[y * cols + x] = lum > (BAYER8[y & 7][x & 7] + 0.5) / 64 ? 1 : 0
      }
    }
    return out
  }

  /** 그림에서 시작 (인트로용 - 그림이 라이프 규칙으로 무너진다) */
  function seedShape(painter, dither = false) {
    grid = rasterize(painter, dither)
    lockMap.fill(0)
  }

  /** 도달할 목표 그림을 설정한다 */
  function setTarget(painter, dither = false) {
    target = rasterize(painter, dither)
    lockMap.fill(0)

    // 매번 새 랜덤값을 채워야 그림이 나타나는 순서가 달라진다.
    // 이 값을 고정하면 늘 같은 순서로 채워져 기계적으로 보인다.
    for (let i = 0; i < lockOrder.length; i++) {
      lockOrder[i] = Math.random()
    }
  }

  /**
   * 목표 그림을 progress(0~1)만큼 잠근다.
   *
   * lockOrder[i]가 progress보다 작은 칸만 잠기므로,
   * progress가 커질수록 랜덤한 위치부터 하나씩 굳어 간다.
   * -> 그림이 한 번에 나타나지 않고 흩뿌려지듯 채워지는 이유.
   */
  function applyLock(progress) {
    if (!target) return
    for (let i = 0; i < target.length; i++) {
      if (target[i] === 1 && lockOrder[i] < progress) {
        lockMap[i] = 1
        grid[i] = 1
      }
    }
  }

  /* ---------------------------------------------------------------- 규칙 */

  /**
   * 한 세대 진행 (B3/S23)
   *
   * 잠긴 칸은 규칙을 적용하지 않고 그대로 1로 남긴다.
   * 이 처리가 없으면 완성된 그림도 이웃 수에 따라 곧바로 무너진다.
   * 가장자리는 토러스로 이어 붙여(반대편과 연결) 경계에서 패턴이 죽지 않게 한다.
   */
  function step() {
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

  /** 화면 좌표에 글라이더(대각선으로 기어가는 패턴)를 놓는다 */
  function spawnGlider(px, py) {
    const gx = Math.floor(px / cellSize)
    const gy = Math.floor(py / cellSize)

    for (const [dx, dy] of GLIDER) {
      const x = (gx + dx + cols) % cols
      const y = (gy + dy + rows) % rows
      grid[y * cols + x] = 1
    }
  }

  /* ---------------------------------------------------------------- 렌더 */

  /**
   * 면(fillRect)으로 칸을 채우고 가운데를 뚫는다.
   * 점(arc)으로 그리면 낱알처럼 흩어져 보이고, 면이어야 덩어리로 뭉친다.
   */
  function draw() {
    const w = canvas.width / dpr
    const h = canvas.height / dpr
    ctx.clearRect(0, 0, w, h)

    const hole = cellSize * holeRatio
    const off = (cellSize - hole) / 2

    // 1) 살아있고 잠기지 않은 칸
    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = alpha
    ctx.fillStyle = colors.cell
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const idx = y * cols + x
        if (grid[idx] && !lockMap[idx]) {
          ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize)
        }
      }
    }

    // 2) 잠긴 칸은 더 밝게 그려 그림이 노이즈 위로 드러나게 한다
    ctx.globalAlpha = Math.min(alpha * 2.1, 1)
    ctx.fillStyle = colors.lock
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (lockMap[y * cols + x]) {
          ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize)
        }
      }
    }

    // 3) 가운데를 뚫는다(holeRatio > 0 일 때만).
    //    배경색을 덮어씌우는 대신 지우기 합성을 써서
    //    페이지 배경이 무슨 색이든(테마 전환 포함) 그대로 비치게 한다.
    if (hole <= 0) {
      ctx.globalAlpha = 1
      return
    }
    ctx.globalCompositeOperation = 'destination-out'
    ctx.globalAlpha = 1
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const idx = y * cols + x
        if (grid[idx] || lockMap[idx]) {
          ctx.fillRect(x * cellSize + off, y * cellSize + off, hole, hole)
        }
      }
    }

    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = 1
  }

  /* ---------------------------------------------------------------- 설정 */

  function setColors(next) {
    colors = next
  }

  function setCellSize(next) {
    cellSize = next
  }

  function setHoleRatio(next) {
    holeRatio = next
  }

  return {
    resize,
    seedRandom,
    seedShape,
    setTarget,
    applyLock,
    step,
    spawnGlider,
    draw,
    setColors,
    setCellSize,
    setHoleRatio,
    get size() {
      return { cols, rows }
    },
  }
}
