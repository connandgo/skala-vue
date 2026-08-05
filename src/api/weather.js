import { CITIES, getMockWeather } from '@/data/cities.js'
import { wmoText } from '@/utils/wmo.js'

/**
 * 날씨 - Open-Meteo
 *
 * OpenWeather에서 갈아탄 이유
 *   1) API 키가 필요 없다. 정적 사이트에서는 키가 번들에 그대로 박힌다.
 *   2) 위경도를 쉼표로 이어 붙이면 도시 여러 곳이 한 번에 온다.
 *   3) 현재 날씨 / 시간별 / 일별 예보를 한 응답에 담아 준다.
 *
 * 주의: 무료 한도는 IP마다 하루치로 계산되고, 요청이 무거울수록 많이 깎인다.
 *      (도시 수 x 변수 수 x 날짜 수) 그래서 아래 두 가지를 지킨다.
 *        - 꼭 필요한 변수만 요청한다
 *        - 받은 결과를 잠시 담아 두고 다시 쓴다
 *
 * 문서: https://open-meteo.com/en/docs
 */

const ENDPOINT = 'https://api.open-meteo.com/v1/forecast'
const AIR_ENDPOINT = 'https://air-quality-api.open-meteo.com/v1/air-quality'

/** 받아 둔 응답을 다시 쓰는 시간 */
const CACHE_MS = 10 * 60 * 1000
const CACHE_KEY = 'skala-weather-cache'

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

// 시간별은 무게가 크다. 화면에 실제로 쓰는 둘만 받는다.
const HOURLY_FIELDS = ['temperature_2m', 'precipitation_probability']

const DAILY_FIELDS = [
  'weather_code',
  'temperature_2m_max',
  'temperature_2m_min',
  'precipitation_probability_max',
  'sunrise',
  'sunset',
  'uv_index_max',
]

/* ------------------------------------------------------------------ 캐시 */

const readCache = (key) => {
  try {
    const saved = JSON.parse(sessionStorage.getItem(CACHE_KEY) ?? '{}')
    const hit = saved[key]
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.data
  } catch {
    /* 저장소를 못 읽으면 그냥 새로 받는다 */
  }
  return null
}

const writeCache = (key, data) => {
  try {
    const saved = JSON.parse(sessionStorage.getItem(CACHE_KEY) ?? '{}')
    saved[key] = { at: Date.now(), data }
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(saved))
  } catch {
    /* 저장 공간이 막혀 있어도 화면은 정상 동작한다 */
  }
}

/* ------------------------------------------------------------------ 조회 */

/** 여러 도시를 한 번에 조회한다 */
const request = async (cities, { days = 7 } = {}) => {
  const key = `f:${cities.map((c) => c.id).join(',')}:${days}`
  const cached = readCache(key)
  if (cached) return cached

  const url = new URL(ENDPOINT)
  url.searchParams.set('latitude', cities.map((c) => c.lat).join(','))
  url.searchParams.set('longitude', cities.map((c) => c.lon).join(','))
  url.searchParams.set('current', CURRENT_FIELDS.join(','))
  url.searchParams.set('hourly', HOURLY_FIELDS.join(','))
  url.searchParams.set('daily', DAILY_FIELDS.join(','))
  url.searchParams.set('forecast_days', String(days))
  url.searchParams.set('temperature_unit', 'celsius')
  url.searchParams.set('wind_speed_unit', 'ms')
  url.searchParams.set('timezone', 'Asia/Seoul')

  const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
  const data = await res.json()

  // 한도를 넘기면 200이 아니라 4xx와 함께 reason이 온다
  if (!res.ok || data.error) {
    throw new Error(data.reason ?? `날씨 조회 실패 (${res.status})`)
  }

  // 도시가 하나면 객체, 여럿이면 배열로 온다
  const list = Array.isArray(data) ? data : [data]
  writeCache(key, list)
  return list
}

/** 대기질. 실패해도 날씨 화면은 그대로 뜬다. */
export const fetchAirQuality = async (city) => {
  const key = `a:${city.id}`
  const cached = readCache(key)
  if (cached) return cached

  const url = new URL(AIR_ENDPOINT)
  url.searchParams.set('latitude', city.lat)
  url.searchParams.set('longitude', city.lon)
  url.searchParams.set('current', 'pm10,pm2_5,european_aqi')
  url.searchParams.set('timezone', 'Asia/Seoul')

  const res = await fetch(url, { signal: AbortSignal.timeout(6000) })
  if (!res.ok) throw new Error('대기질 조회 실패')

  const data = await res.json()
  const out = {
    pm10: Math.round(data.current?.pm10 ?? 0),
    pm25: Math.round(data.current?.pm2_5 ?? 0),
    aqi: Math.round(data.current?.european_aqi ?? 0),
  }
  writeCache(key, out)
  return out
}

/* ------------------------------------------------------------------ 변환 */

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
    rain: c.rain ?? 0,
    snow: c.snowfall ?? 0,
    sunrise: toUnix(raw.daily.sunrise[0], offset),
    sunset: toUnix(raw.daily.sunset[0], offset),
    uv: raw.daily.uv_index_max?.[0] ?? null,
    todayMin: Math.round(raw.daily.temperature_2m_min[0]),
    todayMax: Math.round(raw.daily.temperature_2m_max[0]),
    weatherCode: c.weather_code,
    status: wmoText(c.weather_code),
    // 예보를 같은 응답에서 뽑아 둔다 (도시를 고를 때 다시 부르지 않아도 된다)
    _hourly: raw.hourly,
    _daily: raw.daily,
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

/** 일별 예보를 화면 모양으로 */
export const toWeekly = (daily) => {
  if (!daily?.time) return []
  return daily.time.map((date, i) => {
    const d = new Date(`${date}T00:00:00`)
    return {
      date,
      label: d.toLocaleDateString('ko-KR', { weekday: 'short' }),
      day: d.getDate(),
      min: Math.round(daily.temperature_2m_min[i]),
      max: Math.round(daily.temperature_2m_max[i]),
      pop: Math.round(daily.precipitation_probability_max?.[i] ?? 0),
      code: daily.weather_code[i],
      status: wmoText(daily.weather_code[i]),
    }
  })
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

/**
 * 전체 도시를 한 번에 조회한다.
 *
 * 한도 초과나 네트워크 장애로 실패하면 임시 데이터로 대신 채운다.
 * 화면이 통째로 비는 것보다, 값이 예시라는 걸 알리고 보여 주는 편이 낫다.
 */
export const fetchAllCitiesWeather = async () => {
  try {
    const raws = await request(CITIES)

    const list = []
    const failed = []
    CITIES.forEach((city, i) => {
      if (!raws[i]?.current) {
        failed.push(city.name)
        return
      }
      list.push(toCityWeather(city, raws[i]))
    })

    return { list, failed, isMock: false }
  } catch (err) {
    console.warn('[weather] 실시간 조회 실패, 임시 데이터로 대체합니다:', err.message)
    return {
      list: CITIES.map((city) => getMockWeather(city.id)),
      failed: [],
      isMock: true,
      reason: err.message,
    }
  }
}
