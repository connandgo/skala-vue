import axios from 'axios'

// .env의 VITE_ 로 시작하는 값만 브라우저 코드에서 읽을 수 있다
const API_KEY = import.meta.env.VITE_KOFIC_API_KEY

const api = axios.create({
  baseURL: 'https://www.kobis.or.kr/kobisopenapi/webservice/rest/boxoffice',
  timeout: 10000,
})

/** Date -> "YYYYMMDD" (KOFIC이 요구하는 형식) */
export const toTargetDt = (date) => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}${m}${d}`
}

/** "YYYYMMDD" -> "YYYY-MM-DD" */
export const formatDt = (s) => `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`

/**
 * 주간 조회용 날짜 보정
 *
 * KOFIC 주간 박스오피스는 "완료된 주(월~일)"만 집계한다.
 *    주 중간 날짜(예: 월요일)를 주면 결과가 0건으로 온다.
 *    그래서 그 날짜가 속한 주의 직전 일요일로 맞춰 준다.
 */
export const lastSunday = (date) => {
  const d = new Date(date)
  d.setDate(d.getDate() - d.getDay()) // 일요일(0)이면 그대로, 아니면 이전 일요일로
  return d
}

/** 어제 날짜 (박스오피스는 전일 집계가 확정본이다) */
export const yesterday = () => {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d
}

/**
 * KOFIC은 키가 틀려도 HTTP 200을 준다.
 *    본문의 faultInfo를 직접 확인해야 실패를 알 수 있다.
 *    (날씨 API가 401을 주던 것과 다르므로 try/catch만으로는 못 잡는다)
 */
const unwrap = (data) => {
  if (data?.faultInfo) {
    throw new Error(`[KOFIC ${data.faultInfo.errorCode}] ${data.faultInfo.message}`)
  }
  return data
}

/** 응답 한 건을 화면에서 쓰기 좋은 형태로 정리 */
const normalize = (m) => ({
  rank: Number(m.rank),
  rankInten: Number(m.rankInten), // 전일 대비 등락 (+/-/0)
  isNew: m.rankOldAndNew === 'NEW',
  code: m.movieCd,
  name: m.movieNm,
  openDt: m.openDt,
  audiCnt: Number(m.audiCnt), // 해당 기간 관객수
  audiAcc: Number(m.audiAcc), // 누적 관객수
  salesAmt: Number(m.salesAmt), // 매출액
  salesShare: Number(m.salesShare), // 매출 점유율(%)
  scrnCnt: Number(m.scrnCnt), // 스크린 수
  showCnt: Number(m.showCnt), // 상영 횟수
})

/**
 * 박스오피스 조회
 * @param {'daily'|'weekly'} type 일별 / 주간(주말)
 * @param {Date} date 조회 기준일
 */
export const fetchBoxOffice = async (type = 'daily', date = yesterday()) => {
  const isWeekly = type === 'weekly'
  const path = isWeekly ? '/searchWeeklyBoxOfficeList.json' : '/searchDailyBoxOfficeList.json'

  // 주간은 완료된 주만 조회되므로 직전 일요일로 보정한다
  const target = isWeekly ? lastSunday(date) : date

  const { data } = await api.get(path, {
    params: {
      key: API_KEY,
      targetDt: toTargetDt(target),
      // 주간 조회 시 0=주간(월~일), 1=주말(금~일)
      ...(isWeekly ? { weekGb: '0' } : {}),
    },
  })

  const result = unwrap(data).boxOfficeResult
  const list = result.dailyBoxOfficeList ?? result.weeklyBoxOfficeList ?? []

  return {
    label: result.boxofficeType, // "일별 박스오피스" 등
    // 집계가 없는 기간이면 showRange 자체가 응답에 없다
    range: result.showRange ?? null,
    movies: list.map(normalize),
  }
}

/** 예매/검색 사이트 바로가기 링크 (제목으로 검색) */
export const bookingLinks = (title) => {
  const q = encodeURIComponent(title) // 한글을 URL용으로 변환해야 링크가 깨지지 않는다
  return [
    { name: 'CGV', url: `http://www.cgv.co.kr/search/?query=${q}` },
    { name: '메가박스', url: `https://www.megabox.co.kr/movie?searchText=${q}` },
    { name: '롯데시네마', url: `https://www.lottecinema.co.kr/NLCHS/Movie` },
  ]
}
