// 지도에 표시할 도시 목록 (Open-Meteo 조회용 위경도 포함)
export const CITIES = [
  { id: 'city_01', name: '서울', lat: 37.5665, lon: 126.978 },
  { id: 'city_02', name: '수원', lat: 37.2636, lon: 127.0286 },
  { id: 'city_03', name: '인천', lat: 37.4563, lon: 126.7052 },
  { id: 'city_04', name: '대전', lat: 36.3504, lon: 127.3845 },
  { id: 'city_05', name: '대구', lat: 35.8714, lon: 128.6014 },
  { id: 'city_06', name: '광주', lat: 35.1595, lon: 126.8526 },
  { id: 'city_07', name: '부산', lat: 35.1796, lon: 129.0756 },
  { id: 'city_08', name: '울산', lat: 35.5384, lon: 129.3114 },
  { id: 'city_09', name: '강릉', lat: 37.7519, lon: 128.8761 },
  { id: 'city_10', name: '제주', lat: 33.4996, lon: 126.5312 },
]

/**
 * 도시 코드별 Mock 기상관측 데이터 (임시 데이터)
 * API 호출이 실패하거나 키가 없을 때 상세 페이지가 비지 않도록 폴백으로 사용한다.
 */
export const MOCK_WEATHER = {
  city_01: { temp: 28, feelsLike: 30, humidity: 60, pressure: 1008, windSpeed: 2.1, windDeg: 270, clouds: 20, visibility: 10000, rain: 0, snow: 0, status: '맑음', weatherCode: 0 },
  city_02: { temp: 27, feelsLike: 29, humidity: 65, pressure: 1009, windSpeed: 1.8, windDeg: 250, clouds: 40, visibility: 10000, rain: 0, snow: 0, status: '구름조금', weatherCode: 1 },
  city_03: { temp: 26, feelsLike: 28, humidity: 70, pressure: 1010, windSpeed: 3.4, windDeg: 290, clouds: 75, visibility: 9000, rain: 0.4, snow: 0, status: '실비', weatherCode: 61 },
  city_04: { temp: 27, feelsLike: 29, humidity: 62, pressure: 1009, windSpeed: 1.5, windDeg: 200, clouds: 30, visibility: 10000, rain: 0, snow: 0, status: '맑음', weatherCode: 0 },
  city_05: { temp: 29, feelsLike: 32, humidity: 55, pressure: 1007, windSpeed: 2.0, windDeg: 180, clouds: 10, visibility: 10000, rain: 0, snow: 0, status: '맑음', weatherCode: 0 },
  city_06: { temp: 28, feelsLike: 30, humidity: 63, pressure: 1008, windSpeed: 2.2, windDeg: 220, clouds: 50, visibility: 10000, rain: 0, snow: 0, status: '튼구름', weatherCode: 2 },
  city_07: { temp: 26, feelsLike: 28, humidity: 75, pressure: 1010, windSpeed: 4.1, windDeg: 130, clouds: 85, visibility: 8000, rain: 1.2, snow: 0, status: '비', weatherCode: 63 },
  city_08: { temp: 26, feelsLike: 28, humidity: 72, pressure: 1010, windSpeed: 3.0, windDeg: 150, clouds: 80, visibility: 9000, rain: 0, snow: 0, status: '온흐림', weatherCode: 3 },
  city_09: { temp: 24, feelsLike: 25, humidity: 68, pressure: 1011, windSpeed: 2.6, windDeg: 60, clouds: 60, visibility: 10000, rain: 0, snow: 0, status: '구름많음', weatherCode: 2 },
  city_10: { temp: 27, feelsLike: 30, humidity: 78, pressure: 1009, windSpeed: 5.2, windDeg: 170, clouds: 40, visibility: 10000, rain: 0, snow: 0, status: '구름조금', weatherCode: 1 },
}

/** 도시 코드로 Mock 상세 데이터를 만들어 반환한다 */
/**
 * 실시간 조회가 막혔을 때 대신 쓸 값.
 * 화면 구조가 실제 응답과 같아야 컴포넌트가 빈 화면을 그리지 않는다.
 */
export const getMockWeather = (cityId) => {
  const city = CITIES.find((c) => c.id === cityId)
  const mock = MOCK_WEATHER[cityId]
  if (!city || !mock) return null

  const today = new Date()
  const iso = (d) => d.toISOString().slice(0, 10)
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today)
    d.setDate(d.getDate() + i)
    return d
  })

  // 실제 응답과 같은 모양으로 일별/시간별을 채워 둔다
  const daily = {
    time: days.map(iso),
    weather_code: days.map((_, i) => [mock.weatherCode, 1, 2, 3, 61, 1, 0][i]),
    temperature_2m_min: days.map((_, i) => mock.temp - 4 + (i % 3)),
    temperature_2m_max: days.map((_, i) => mock.temp + 3 - (i % 2)),
    precipitation_probability_max: days.map((_, i) => [10, 20, 0, 30, 70, 20, 10][i]),
    sunrise: days.map((d) => `${iso(d)}T05:40`),
    sunset: days.map((d) => `${iso(d)}T19:30`),
    uv_index_max: days.map(() => 6),
  }

  const hours = Array.from({ length: 24 }, (_, i) => {
    const d = new Date(today)
    d.setHours(d.getHours() + i, 0, 0, 0)
    return d
  })
  const hourly = {
    time: hours.map((d) => `${iso(d)}T${String(d.getHours()).padStart(2, '0')}:00`),
    temperature_2m: hours.map((_, i) => mock.temp + Math.round(Math.sin(i / 3) * 3)),
    precipitation_probability: hours.map((_, i) => [10, 20, 30, 20, 10, 0, 0, 10][i % 8]),
  }

  return {
    ...city,
    ...mock,
    sunrise: Math.floor(today.setHours(5, 40, 0, 0) / 1000),
    sunset: Math.floor(new Date().setHours(19, 30, 0, 0) / 1000),
    uv: 6,
    todayMin: mock.temp - 4,
    todayMax: mock.temp + 3,
    _daily: daily,
    _hourly: hourly,
    _offset: 32400, // KST
  }
}
