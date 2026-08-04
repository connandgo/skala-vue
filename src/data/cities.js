// 지도에 표시할 도시 목록 (OpenWeather 조회용 위경도 포함)
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
  city_01: { temp: 28, feelsLike: 30, tempMin: 24, tempMax: 31, humidity: 60, pressure: 1008, windSpeed: 2.1, windDeg: 270, clouds: 20, visibility: 10000, rain: 0, snow: 0, status: '맑음', weatherId: 800 },
  city_02: { temp: 27, feelsLike: 29, tempMin: 23, tempMax: 30, humidity: 65, pressure: 1009, windSpeed: 1.8, windDeg: 250, clouds: 40, visibility: 10000, rain: 0, snow: 0, status: '구름조금', weatherId: 801 },
  city_03: { temp: 26, feelsLike: 28, tempMin: 22, tempMax: 29, humidity: 70, pressure: 1010, windSpeed: 3.4, windDeg: 290, clouds: 75, visibility: 9000, rain: 0.4, snow: 0, status: '실비', weatherId: 500 },
  city_04: { temp: 27, feelsLike: 29, tempMin: 23, tempMax: 30, humidity: 62, pressure: 1009, windSpeed: 1.5, windDeg: 200, clouds: 30, visibility: 10000, rain: 0, snow: 0, status: '맑음', weatherId: 800 },
  city_05: { temp: 29, feelsLike: 32, tempMin: 25, tempMax: 33, humidity: 55, pressure: 1007, windSpeed: 2.0, windDeg: 180, clouds: 10, visibility: 10000, rain: 0, snow: 0, status: '맑음', weatherId: 800 },
  city_06: { temp: 28, feelsLike: 30, tempMin: 24, tempMax: 31, humidity: 63, pressure: 1008, windSpeed: 2.2, windDeg: 220, clouds: 50, visibility: 10000, rain: 0, snow: 0, status: '튼구름', weatherId: 802 },
  city_07: { temp: 26, feelsLike: 28, tempMin: 23, tempMax: 28, humidity: 75, pressure: 1010, windSpeed: 4.1, windDeg: 130, clouds: 85, visibility: 8000, rain: 1.2, snow: 0, status: '비', weatherId: 501 },
  city_08: { temp: 26, feelsLike: 28, tempMin: 22, tempMax: 29, humidity: 72, pressure: 1010, windSpeed: 3.0, windDeg: 150, clouds: 80, visibility: 9000, rain: 0, snow: 0, status: '온흐림', weatherId: 804 },
  city_09: { temp: 24, feelsLike: 25, tempMin: 20, tempMax: 27, humidity: 68, pressure: 1011, windSpeed: 2.6, windDeg: 60, clouds: 60, visibility: 10000, rain: 0, snow: 0, status: '구름많음', weatherId: 803 },
  city_10: { temp: 27, feelsLike: 30, tempMin: 24, tempMax: 29, humidity: 78, pressure: 1009, windSpeed: 5.2, windDeg: 170, clouds: 40, visibility: 10000, rain: 0, snow: 0, status: '구름조금', weatherId: 801 },
}

/** 도시 코드로 Mock 상세 데이터를 만들어 반환한다 */
export const getMockWeather = (cityId) => {
  const city = CITIES.find((c) => c.id === cityId)
  const mock = MOCK_WEATHER[cityId]
  if (!city || !mock) return null
  return { ...city, ...mock, sunrise: null, sunset: null, icon: '01d' }
}
