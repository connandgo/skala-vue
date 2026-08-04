/**
 * 기온 색상 스케일 (발산형 diverging)
 *
 * - 파랑(춥다) ↔ 회색(평온) ↔ 빨강(덥다), 중간값은 중립 회색
 * - 각 팔(arm)은 밝기가 단조롭게 변하도록 구성했고, 접근성 검증기로
 *   "밝기 단조성 / 단계 간격 ΔL≥0.06 / 표면 대비 / 단일 색상" 4개 항목을 통과시켰다.
 * - 다크 모드는 밝기를 뒤집는다: 극단값일수록 밝게 (어두운 배경에서 눈에 띄도록),
 *   중간값은 배경에 가깝게 가라앉힌다.
 */

// 구간 경계 (°C) — 이 값 미만이면 해당 색
export const TEMP_BINS = [0, 5, 10, 15, 20, 25, 30, 35]

// 가장 추움 → 가장 더움 (9단계)
const LIGHT = [
  '#0d366b', // < 0
  '#184f95', // 0 ~ 5
  '#2a78d6', // 5 ~ 10
  '#5598e7', // 10 ~ 15
  '#f0efec', // 15 ~ 20  (중립)
  '#e8827c', // 20 ~ 25
  '#d94f48', // 25 ~ 30
  '#ab332d', // 30 ~ 35
  '#7a211c', // >= 35
]

const DARK = [
  '#cde2fb', // < 0
  '#86b6ef',
  '#5598e7',
  '#2a78d6',
  '#383835', // 중립
  '#d94f48',
  '#e8827c',
  '#f0a79f',
  '#f8cdc8', // >= 35
]

export const TEMP_LABELS = [
  '0°C 미만',
  '0~5°C',
  '5~10°C',
  '10~15°C',
  '15~20°C',
  '20~25°C',
  '25~30°C',
  '30~35°C',
  '35°C 이상',
]

/** 기온이 몇 번째 구간인지 */
export const tempBinIndex = (temp) => {
  let i = 0
  while (i < TEMP_BINS.length && temp >= TEMP_BINS[i]) i++
  return i
}

/** 기온 -> 배경색 */
export const tempColor = (temp, isDark = false) => (isDark ? DARK : LIGHT)[tempBinIndex(temp)]

/** 배경색 위에 얹을 글자색을 밝기로 판단해서 고른다 */
export const readableInk = (hex) => {
  const n = parseInt(hex.slice(1), 16)
  const toLin = (c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  const L =
    0.2126 * toLin((n >> 16) & 255) + 0.7152 * toLin((n >> 8) & 255) + 0.0722 * toLin(n & 255)
  return L > 0.42 ? '#0b0b0b' : '#ffffff'
}

/** 범례용 - [색, 라벨] 목록 */
export const tempLegend = (isDark = false) =>
  (isDark ? DARK : LIGHT).map((hex, i) => ({ hex, label: TEMP_LABELS[i] }))
