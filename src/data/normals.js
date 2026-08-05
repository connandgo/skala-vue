/**
 * 평년 기온(月 평균) 근사 모델
 *
 * 왜 API가 아니라 표를 쓰는가
 *   OpenWeather의 과거 데이터(One Call 3.0 timemachine, History API)는 모두
 *   유료 플랜 전용이라 무료 키로는 401이 떨어진다. 그래서 "작년 실측값" 비교는
 *   불가능하고, 대신 도시별 연평균/연교차로 월평균을 계산하는 근사 모델을 쓴다.
 *
 * 모델: normal(month) = mean + amp * cos(2π(month - PEAK) / 12)
 *   - mean : 연평균기온
 *   - amp  : 연교차의 절반 (여름 최고 ~ 겨울 최저)
 *   - PEAK : 가장 더운 시점 (8월 초 ≈ 7.6)
 *
 * 정확한 값이 필요하면 기상청 평년값(1991~2020)으로 아래 표를 교체하면 된다.
 * 화면에도 "평년 대비(근사)"로 표기해 실측 비교가 아님을 밝힌다.
 */

const PEAK = 7.6

// [연평균기온, 연교차/2]
const CITY_CLIMATE = {
  city_01: [12.8, 13.2], // 서울
  city_02: [12.4, 13.4], // 수원
  city_03: [12.6, 12.6], // 인천
  city_04: [13.2, 12.8], // 대전
  city_05: [14.5, 12.2], // 대구
  city_06: [14.1, 12.3], // 광주
  city_07: [15.0, 10.5], // 부산
  city_08: [14.4, 11.0], // 울산
  city_09: [13.5, 11.5], // 강릉
  city_10: [16.9, 9.5], // 제주
}

/** 해당 도시·월의 평년 기온(°C) */
export const normalTemp = (cityId, month) => {
  const c = CITY_CLIMATE[cityId]
  if (!c) return null
  const [mean, amp] = c
  return mean + amp * Math.cos((2 * Math.PI * (month - PEAK)) / 12)
}

/**
 * 현재 기온이 평년 대비 몇 도 높은지/낮은지
 * @returns {{diff:number, normal:number, text:string} | null}
 */
export const compareToNormal = (cityId, temp, date = new Date()) => {
  const normal = normalTemp(cityId, date.getMonth() + 1)
  if (normal == null) return null

  const diff = temp - normal
  const rounded = Math.round(diff * 10) / 10
  const monthLabel = `${date.getMonth() + 1}월`

  let text
  if (Math.abs(rounded) < 0.5) text = `${monthLabel} 평년과 비슷`
  else if (rounded > 0) text = `${monthLabel} 평년보다 ${rounded.toFixed(1)}°C 높음`
  else text = `${monthLabel} 평년보다 ${Math.abs(rounded).toFixed(1)}°C 낮음`

  return { diff: rounded, normal: Math.round(normal * 10) / 10, text }
}
