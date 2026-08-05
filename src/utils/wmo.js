/**
 * WMO 날씨 코드 해석.
 *
 * Open-Meteo는 OpenWeather의 자체 코드(800, 500…) 대신
 * 국제 표준인 WMO 코드를 준다. 설명 문구도 안 주기 때문에 여기서 붙인다.
 *
 * 표: https://open-meteo.com/en/docs (WMO Weather interpretation codes)
 */

const CODES = {
  0: '맑음',
  1: '대체로 맑음',
  2: '구름 조금',
  3: '흐림',
  45: '안개',
  48: '서리 안개',
  51: '약한 이슬비',
  53: '이슬비',
  55: '강한 이슬비',
  56: '어는 이슬비',
  57: '강한 어는 이슬비',
  61: '약한 비',
  63: '비',
  65: '강한 비',
  66: '어는 비',
  67: '강한 어는 비',
  71: '약한 눈',
  73: '눈',
  75: '강한 눈',
  77: '싸락눈',
  80: '소나기',
  81: '강한 소나기',
  82: '매우 강한 소나기',
  85: '약한 눈소나기',
  86: '강한 눈소나기',
  95: '뇌우',
  96: '우박 동반 뇌우',
  99: '강한 우박 동반 뇌우',
}

/** 코드 -> 한글 설명 */
export const wmoText = (code) => CODES[code] ?? '알 수 없음'

/**
 * 코드 -> 화면 효과.
 * 비 계열(이슬비·비·소나기·뇌우)은 rain, 눈 계열은 snow.
 */
export const wmoMode = (code) => {
  if (code == null) return 'none'
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snow'
  if (
    (code >= 51 && code <= 67) ||
    (code >= 80 && code <= 82) ||
    (code >= 95 && code <= 99)
  ) {
    return 'rain'
  }
  return 'none'
}

/** 비나 눈이 오는 중인지 (요약 문구에서 쓴다) */
export const isWet = (code) => wmoMode(code) !== 'none'
