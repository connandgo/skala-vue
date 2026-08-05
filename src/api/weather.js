import { CITIES } from '@/data/cities.js'
import { wmoText } from '@/utils/wmo.js'

/**
 * 날씨 - Open-Meteo
 *
 * OpenWeather에서 갈아탄 이유
 *   1) API 키가 필요 없다.
 *      정적 사이트에서는 VITE_ 환경변수가 번들에 그대로 박혀서
 *      개발자도구만 열면 누구나 키를 꺼내 쓸 수 있었다.
 *   2) 도시 여러 곳을 한 번에 받는다.
 *      위경도를 쉼표로 이어 붙이면 배열로 돌아온다. 10개 도시 = 요청 10번 -> 1번.
 *   3) 현재 날씨 / 시간별 예보 / 일출·일몰을 한 응답에 담아 준다.
 *
 * 문서: https://open-meteo.com/en/docs
 */

const ENDPOINT = 'https://api.open-meteo.com/v1/forecast'

const CURRENT_FIELDS = [
  'temperature_2m',
  'apparent_temperature',
  'relative_humidity_2m',
  'weather_code',
  'surface_pressure',
  'wind_speed_10m',
  'wind_direction_10m',
  'cloud_cover',
  'rain',
  'snowfall',
]

const HOURLY_FIELDS = ['temperature_2m', 'precipitation_probability', 'visibility']

/** 여러 도시를 한 번에 조회한다 */
const request = async (cities) => {
  const url = new URL(ENDPOINT)
  url.searchParams.set('latitude', cities.map((c) => c.lat).join(','))
  url.searchParams.set('longitude', cities.map((c) => c.lon).join(','))
  url.searchParams.set('current', CURRENT_FIELDS.join(','))
  url.searchParams.set('hourly', HOURLY_FIELDS.join(','))
  url.searchParams.set('daily', 'sunrise,sunset')
  url.searchParams.set('forecast_days', '2')
  url.searchParams.set('temperature_unit', 'celsius')
  url.searchParams.set('wind_speed_unit', 'ms')
  url.searchParams.set('timezone', 'Asia/Seoul')

  const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
  if (!res.ok) throw new Error(`날씨 조회 실패 (${res.status})`)

  const data = await res.json()
  // 도시가 하나면 객체, 여럿이면 배열로 온다
  return Array.isArray(data) ? data : [data]
}

/**
 * Open-Meteo의 시각은 "2026-08-05T16:00" 처럼 표시가 없는 현지 시각이다.
 * 그냥 Date에 넣으면 보는 사람의 시간대로 읽혀 어긋나므로,
 * 응답에 같이 오는 utc_offset_seconds로 진짜 시각을 계산한다.
 */
const toUnix = (localIso, offsetSeconds) =>
  Math.floor(Date.parse(`${localIso}Z`) / 1000) - offsetSeconds

/** 지금 시각 이후의 첫 예보 칸을 찾는다 */
const nextHourIndex = (times, offset) => {
  const now = Math.floor(Date.now() / 1000)
  const i = times.findIndex((t) => toUnix(t, offset) >= now)
  return i === -1 ? 0 : i
}

/** 응답 한 덩어리를 화면이 쓰는 모양으로 바꾼다 */
const toCityWeather = (city, raw) => {
  const c = raw.current
  const offset = raw.utc_offset_seconds ?? 0
  const at = nextHourIndex(raw.hourly.time, offset)

  return {
    id: city.id,
    name: city.name,
    lat: city.lat,
    lon: city.lon,
    temp: Math.round(c.temperature_2m),
    feelsLike: Math.round(c.apparent_temperature),
    humidity: c.relative_humidity_2m,
    pressure: Math.round(c.surface_pressure),
    windSpeed: Math.round(c.wind_speed_10m * 10) / 10,
    windDeg: c.wind_direction_10m,
    clouds: c.cloud_cover,
    // Open-Meteo는 가시거리를 시간별로만 준다. 가장 가까운 칸을 쓴다.
    visibility: raw.hourly.visibility?.[at] ?? null,
    rain: c.rain ?? 0,
    snow: c.snowfall ?? 0,
    sunrise: toUnix(raw.daily.sunrise[0], offset),
    sunset: toUnix(raw.daily.sunset[0], offset),
    weatherCode: c.weather_code,
    status: wmoText(c.weather_code),
    // 예보를 같은 응답에서 뽑아 둔다 (도시를 고를 때 다시 부르지 않아도 된다)
    _hourly: raw.hourly,
    _offset: offset,
  }
}

/** 시간별 배열에서 3시간 간격 8칸(=24시간)을 뽑는다 */
const toForecast = (hourly, offset, slots = 8) => {
  const start = nextHourIndex(hourly.time, offset)
  const out = []

  for (let i = 0; i < slots; i++) {
    const idx = start + i * 3
    if (idx >= hourly.time.length) break

    const unix = toUnix(hourly.time[idx], offset)
    const at = new Date(unix * 1000)
    out.push({
      time: at.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }),
      date: at.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' }),
      temp: Math.round(hourly.temperature_2m[idx]),
      pop: Math.round(hourly.precipitation_probability?.[idx] ?? 0),
    })
  }
  return out
}

/* ------------------------------------------------------------------ 공개 */

/** 도시 한 곳의 현재 날씨 */
export const fetchCityWeather = async (city) => {
  const [raw] = await request([city])
  return toCityWeather(city, raw)
}

/**
 * 도시 한 곳의 단기 예보.
 * 목록 조회에서 이미 시간별 자료를 받아 왔다면 그걸 그대로 쓴다.
 */
export const fetchCityForecast = async (city, slots = 8) => {
  if (city._hourly) return toForecast(city._hourly, city._offset, slots)

  const [raw] = await request([city])
  return toForecast(raw.hourly, raw.utc_offset_seconds ?? 0, slots)
}

/** 전체 도시를 한 번에 조회한다 */
export const fetchAllCitiesWeather = async () => {
  const raws = await request(CITIES)

  const list = []
  const failed = []

  CITIES.forEach((city, i) => {
    // 응답 개수가 모자라거나 형태가 다르면 그 도시만 건너뛴다
    if (!raws[i]?.current) {
      failed.push(city.name)
      return
    }
    list.push(toCityWeather(city, raws[i]))
  })

  return { list, failed }
}
