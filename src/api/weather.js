import axios from 'axios'
import { CITIES } from '@/data/cities.js'

// .env의 VITE_ 로 시작하는 값만 브라우저 코드에서 읽을 수 있다
const API_KEY = import.meta.env.VITE_OPENWEATHER_API_KEY

const api = axios.create({
  baseURL: 'https://api.openweathermap.org/data/2.5',
  timeout: 8000,
})

/**
 * 도시 하나의 현재 날씨를 조회한다.
 * OpenWeather 응답을 화면이 쓰기 좋은 형태로 정리해서 돌려준다.
 */
export const fetchCityWeather = async (city) => {
  const { data } = await api.get('/weather', {
    params: {
      lat: city.lat,
      lon: city.lon,
      appid: API_KEY,
      units: 'metric', // 섭씨로 받기
      lang: 'kr', // 설명을 한글로 받기
    },
  })

  // 강수량은 비/눈이 올 때만 응답에 들어온다. 없으면 0으로 채운다.
  const rain = data.rain?.['1h'] ?? data.rain?.['3h'] ?? 0
  const snow = data.snow?.['1h'] ?? data.snow?.['3h'] ?? 0

  return {
    id: city.id,
    name: city.name,
    lat: city.lat,
    lon: city.lon,
    temp: Math.round(data.main.temp),
    feelsLike: Math.round(data.main.feels_like),
    tempMin: Math.round(data.main.temp_min),
    tempMax: Math.round(data.main.temp_max),
    humidity: data.main.humidity,
    pressure: data.main.pressure,
    windSpeed: data.wind?.speed ?? 0,
    windDeg: data.wind?.deg ?? 0,
    clouds: data.clouds?.all ?? 0,
    visibility: data.visibility ?? null,
    rain,
    snow,
    sunrise: data.sys?.sunrise ?? null,
    sunset: data.sys?.sunset ?? null,
    status: data.weather[0].description,
    icon: data.weather[0].icon,
    weatherId: data.weather[0].id, // 2xx 뇌우 / 3xx 이슬비 / 5xx 비 / 6xx 눈
  }
}

/**
 * 선택한 도시의 단기 예보(3시간 간격)를 조회한다.
 * 현재 날씨 API에는 없는 강수확률(pop)을 여기서 얻는다.
 */
export const fetchCityForecast = async (city, slots = 8) => {
  const { data } = await api.get('/forecast', {
    params: {
      lat: city.lat,
      lon: city.lon,
      appid: API_KEY,
      units: 'metric',
      lang: 'kr',
      cnt: slots, // 3시간 간격이므로 8칸 = 24시간
    },
  })

  return data.list.map((it) => {
    // ⚠️ dt_txt는 UTC 문자열이다. 그대로 자르면 한국 시각과 9시간 어긋난다.
    //    유닉스 시간(dt)을 Date로 바꿔 브라우저의 지역 시간으로 표시한다.
    const at = new Date(it.dt * 1000)

    return {
      at,
      time: at.toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }),
      date: at.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' }),
      temp: Math.round(it.main.temp),
      pop: Math.round((it.pop ?? 0) * 100), // 강수확률 %
      rain: it.rain?.['3h'] ?? 0,
      status: it.weather[0].description,
    }
  })
}

/**
 * 모든 도시의 날씨를 동시에 조회한다.
 * Promise.allSettled를 쓰므로 일부 도시가 실패해도 나머지는 살아남는다.
 */
export const fetchAllCitiesWeather = async () => {
  const results = await Promise.allSettled(CITIES.map((c) => fetchCityWeather(c)))

  const list = []
  const failed = []
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') list.push(r.value)
    else failed.push(CITIES[i].name)
  })

  if (list.length === 0) {
    // 전부 실패하면 화면에서 에러로 처리할 수 있도록 예외를 던진다
    throw new Error('날씨 데이터를 한 건도 가져오지 못했습니다.')
  }
  return { list, failed }
}
